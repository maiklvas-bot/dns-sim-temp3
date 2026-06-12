import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useMemo, useState } from "react";
import { CASES_DATA, type SimCase, type CaseOption, type CycleSignal } from "@/data/cases";
import { COMPETENCIES } from "@/data/competencies";
import { generateConsequences, type ConsequenceExplanation, type MetricDeltaEntry } from "@/data/consequences";
import { EMAIL_CASES } from "@/data/email-cases";
import { CHATS, MESSENGER_CASES } from "@/data/messenger-cases";
import { VIDEO_CASES } from "@/data/video-cases";
import {
  playAudioFile,
  playAudioImmediate,
  playLoopingAudio,
  playTwoToneNotification,
  isCurrentAudioSource,
  resolveChannelSoundSource,
  stopCurrentAudio,
  stopLoopingAudio,
} from "@/data/audio-map";
import { getSimulationContentSnapshot, getSimulationSettingsSnapshot } from "@/lib/runtime-content";
import {
  appendPersistedAnswer,
  appendPersistedMetrics,
  createPersistedSession,
  savePersistedResult,
  updatePersistedSession,
} from "./persistence/session-sync-client";
import {
  buildConfiguredDeadline,
  extractScenarioDeadline,
  getSimTimeFromElapsed,
  simMinutesToRealSeconds,
  type ScenarioDeadline,
} from "@/lib/simulation-timing";
import type {
  SessionAnswerDetails,
  SessionAnswerPayload,
  SessionResultPayload,
  SessionSourceType,
  SimulationRuntimeSettings,
  TimerSnapshot,
} from "@shared/simulation-content";
import type {
  LiveSimulationConfig,
  LiveSimulationPresence,
  LiveSimulationSessionState,
  LiveSimulationSnapshot,
  LiveSimulationStatus,
} from "@shared/live-session";
import {
  consumePendingLiveSimulationState,
  connectToLiveSimulationSession,
  fetchRemoteLiveSimulation,
  getLiveSimulationConfig,
  getLiveSimulationRole,
  joinRemoteLiveSimulation,
  LIVE_SIMULATION_STATE_EVENT,
  syncRemoteStudentState,
  type LiveSimulationRole,
} from "@/lib/live-session";
import {
  getCaseScheduledDelaySeconds,
  getFirstMainCaseDelaySeconds,
  getMainSignalEndBufferSeconds,
  shuffleOptions,
} from "./scheduling/case-scheduler";
import type { SimulationAction as Action } from "./simulation-actions";
import { getSignalTypeEmoji, getSignalTypeLabel, type RealisticMetrics } from "./simulation-types";
import { getNotificationIntervalSeconds, getSimulationTickStep, getTimerPenalty } from "./timers/timer-utils";
import {
  getLoadedMediaCount,
  preloadCaseMedia,
  preloadEmailMedia,
  preloadMessengerMedia,
  preloadVideoMedia,
  queueMediaPreload,
} from "./media/media-preloader";
import {
  clearPersistedSimulationState,
  persistSimulationState,
  readPersistedSimulationDraft,
  shouldPersistSimulationState,
} from "./persistence/simulation-draft-storage";
import { applyMetricEffects, normalizeEffects } from "./scoring/metric-effects";

export type { RealisticMetrics } from "./simulation-types";

export interface DecisionRecord {
  caseId: string;
  sourceType: SessionSourceType;
  caseTitle: string;
  cycle: number;
  optionLevel: number;
  optionText: string;
  score: number;
  baseScore: number;
  timerPenalty: number;
  timer: TimerSnapshot | null;
  responsibility: string;
  zoneLabel: string;
  taskType: string;
  rawEffects: { queue: number; conversion: number; morale: number; revenue_impact: number; delivery_status: number };
  consequences: ConsequenceExplanation[];
  competencyScores: Record<string, number>;
  timestamp: string;
  simTime: string;
}

export type ZoneHealth = "green" | "yellow" | "orange" | "red";

export interface ZoneStatus {
  торговый_зал: { health: ZoneHealth; label: string };
  склад: { health: ZoneHealth; label: string };
  выдача: { health: ZoneHealth; label: string };
  начальство: { health: ZoneHealth; label: string };
}

export interface ActiveSignal {
  id: string;
  caseId: string;
  caseIndex: number;
  cycle: number;
  type: CycleSignal["type"] | "call" | "email" | "visitor";
  title: string;
  source: string;
  preview: string;
  fullSituation: string;
  options: CaseOption[];
  arrivedAt: number; // timestamp
  isExpired: boolean;
  isActive: boolean; // currently selected/viewing
  isAcknowledged: boolean;
  acknowledgedAt: number | null;
  narrationText: string;
  audioUrl: string | null;
  imageUrl: string | null;
  deadline: ScenarioDeadline | null;
  reminderIntervalSeconds?: number | null;
}

export interface ToastNotification {
  id: string;
  signalId: string;
  sourceType: SessionSourceType;
  type: string;
  title: string;
  source: string;
  arrivedAt: number;
  dismissed: boolean;
}

export interface PauseRecord {
  id: string;
  startedAt: number;
  startedSimTime: string;
  endedAt: number | null;
  endedSimTime: string | null;
  startedAtUnixMs: number;
  endedAtUnixMs: number | null;
  durationSeconds: number;
}

export interface ChannelSignalMeta {
  arrivedAt: number;
  deadline: ScenarioDeadline | null;
}

export interface ChannelNotificationCounts {
  calls: number;
  email: number;
  messenger: number;
  video: number;
}

export type ActionPanelSource = "main_case" | "email" | "messenger" | "video";
const IMMEDIATE_PRELOAD_CASE_LIMIT = 2;
const IMMEDIATE_PRELOAD_CHANNEL_LIMIT = 3;
const MAX_PAUSE_COUNT = 5;
const MAX_PAUSE_TOTAL_SECONDS = 30 * 60;

export interface SimulationState {
  // Session config
  participantName: string;
  assessorName: string;
  sessionId: number | null;
  difficulty: "easy" | "medium" | "hard";
  selectedCaseIds: string[];
  manualSelection: boolean;
  repeatCases: boolean;
  timeLimit: number; // minutes
  isTestMode: boolean;
  speedMultiplier: number; // 1-10
  enabledChannels: { audio: boolean; email: boolean; messenger: boolean; video: boolean; };
  selectedChannelItemIds: { email: string[]; messenger: string[]; video: string[] };
  startingMetrics: RealisticMetrics;

  // Runtime
  isRunning: boolean;
  isPaused: boolean;
  isCompleted: boolean;
  timeRemaining: number; // seconds
  simDateTime: string;
  elapsedSeconds: number;
  pauseStartedAt: number | null;

  // Signal queue system
  caseQueue: number[]; // indices into selectedCases
  nextSignalAt: number; // seconds elapsed when next signal fires
  activeSignals: ActiveSignal[];
  currentSignalId: string | null;
  toasts: ToastNotification[];
  actionPanelSource: ActionPanelSource | null;
  actionPanelContentId: string | null;

  // Realistic metrics
  metrics: RealisticMetrics;

  // Store zones
  zones: ZoneStatus;

  // History
  decisions: DecisionRecord[];
  competencyTotals: Record<string, { total: number; count: number }>;

  // UI state
  showConsequence: boolean;
  lastConsequences: ConsequenceExplanation[];
  lastOptionText: string;
  journalOpen: boolean;

  // Multi-channel state
  arrivedEmailIds: string[];
  answeredEmailIds: string[];
  openedEmailIds: string[];
  arrivedMessengerIds: string[];
  answeredMessengerIds: string[];
  openedMessengerIds: string[];
  arrivedVideoIds: string[];
  answeredVideoIds: string[];
  openedVideoIds: string[];
  emailSignalMeta: Record<string, ChannelSignalMeta>;
  messengerSignalMeta: Record<string, ChannelSignalMeta>;
  videoSignalMeta: Record<string, ChannelSignalMeta>;

  // Pause audit
  pauses: PauseRecord[];
}

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function normalizeClientRating(value: unknown, fallback = 3.3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const scaled = numeric > 10 ? numeric / 20 : numeric > 5 ? numeric / 2 : numeric;
  return Math.round(clamp(scaled, 1, 5) * 100) / 100;
}

type ChannelScheduleType = "email" | "messenger" | "video";

type SchedulableChannelItem = {
  id: string;
  arrivalMinute: number;
  sortOrder: number;
  timing?: {
    arrivalMinute?: number | null;
    decisionDeadlineSeconds?: number | null;
    reminderIntervalSeconds?: number | null;
  } | null;
};

type ScheduledChannelCandidate = {
  channelType: ChannelScheduleType;
  id: string;
  scheduledAt: number;
};

const CHANNEL_SCHEDULE_KIND_OFFSETS: Record<ChannelScheduleType, number> = {
  email: 0,
  messenger: 20,
  video: 40,
};

const CHANNEL_SCHEDULE_MIN_GAP_SECONDS = 45;
const CHANNEL_REMINDER_MAX_COUNT = 1;
const VIDEO_REMINDER_MAX_COUNT = 2;

function sortChannelItemsByConfiguredOrder<T extends SchedulableChannelItem>(items: T[]) {
  return [...items].sort((left, right) => {
    const leftArrival = left.timing?.arrivalMinute ?? left.arrivalMinute;
    const rightArrival = right.timing?.arrivalMinute ?? right.arrivalMinute;
    if (leftArrival !== rightArrival) {
      return leftArrival - rightArrival;
    }
    if (left.sortOrder !== right.sortOrder) {
      return left.sortOrder - right.sortOrder;
    }
    return left.id.localeCompare(right.id);
  });
}

function getScheduledChannelArrivalSeconds(
  totalDurationSeconds: number,
  channelType: ChannelScheduleType,
  itemIndex: number,
  totalItems: number,
) {
  const startPaddingSeconds = clamp(Math.round(totalDurationSeconds * 0.1), 150, 240);
  const endPaddingSeconds = clamp(Math.round(totalDurationSeconds * 0.08), 90, 180);
  const usableWindowSeconds = Math.max(120, totalDurationSeconds - startPaddingSeconds - endPaddingSeconds);
  const slotSeconds = usableWindowSeconds / Math.max(1, totalItems + 1);
  const scheduledAtSeconds =
    startPaddingSeconds +
    slotSeconds * (itemIndex + 1) +
    CHANNEL_SCHEDULE_KIND_OFFSETS[channelType];
  return Math.min(totalDurationSeconds - 30, Math.round(scheduledAtSeconds));
}

function getDistributedChannelArrivalSeconds(
  totalDurationSeconds: number,
  itemIndex: number,
  totalItems: number,
) {
  const startPaddingSeconds = clamp(Math.round(totalDurationSeconds * 0.08), 60, 180);
  const endPaddingSeconds = clamp(Math.round(totalDurationSeconds * 0.18), 90, 360);
  const usableWindowSeconds = Math.max(120, totalDurationSeconds - startPaddingSeconds - endPaddingSeconds);
  const slotSeconds = usableWindowSeconds / Math.max(1, totalItems + 1);
  return Math.round(startPaddingSeconds + slotSeconds * (itemIndex + 1));
}

function getChannelArrivalSeconds(
  totalDurationSeconds: number,
  channelType: ChannelScheduleType,
  item: SchedulableChannelItem,
  itemIndex: number,
  totalItems: number,
  timeLimitMinutes: number,
) {
  const configuredArrivalMinute = item.timing?.arrivalMinute ?? item.arrivalMinute;
  if (Number.isFinite(configuredArrivalMinute) && configuredArrivalMinute >= 0) {
    const configuredSeconds = simMinutesToRealSeconds(configuredArrivalMinute, timeLimitMinutes);
    return clamp(
      Math.round(configuredSeconds + CHANNEL_SCHEDULE_KIND_OFFSETS[channelType]),
      10,
      Math.max(10, totalDurationSeconds - 10),
    );
  }

  return getScheduledChannelArrivalSeconds(totalDurationSeconds, channelType, itemIndex, totalItems);
}

function buildDecisionDeadline(
  timing: { decisionDeadlineSeconds?: number | null } | null | undefined,
  textParts: string[],
  simTime: string,
  elapsedSeconds: number,
  timeLimitMinutes: number,
) {
  return buildConfiguredDeadline(timing?.decisionDeadlineSeconds, elapsedSeconds)
    || extractScenarioDeadline(textParts, simTime, elapsedSeconds, timeLimitMinutes);
}

function getLastChannelArrivalSeconds(state: SimulationState) {
  return Math.max(
    -Infinity,
    ...Object.values(state.emailSignalMeta).map((item) => item.arrivedAt),
    ...Object.values(state.messengerSignalMeta).map((item) => item.arrivedAt),
    ...Object.values(state.videoSignalMeta).map((item) => item.arrivedAt),
  );
}

function isChannelItemSelected(state: SimulationState, channelType: ChannelScheduleType, id: string) {
  const selectedIds = state.selectedChannelItemIds?.[channelType] || [];
  return selectedIds.length === 0 || selectedIds.includes(id);
}

function getSelectedChannelItems<T extends SchedulableChannelItem>(
  state: SimulationState,
  channelType: ChannelScheduleType,
  items: T[],
) {
  return sortChannelItemsByConfiguredOrder(items).filter((item) => isChannelItemSelected(state, channelType, item.id));
}

function getNextPendingChannelEvent(state: SimulationState) {
  return getUpcomingChannelEvents(state, 1)[0] || null;
}

function getUpcomingChannelEvents(state: SimulationState, limit = Number.POSITIVE_INFINITY) {
  const totalDurationSeconds = state.timeLimit * 60;
  const candidateItems: Array<{
    channelType: ChannelScheduleType;
    id: string;
    item: SchedulableChannelItem;
    channelIndex: number;
    channelTotal: number;
  }> = [];

  if (state.enabledChannels.email) {
    const orderedEmails = getSelectedChannelItems(state, "email", EMAIL_CASES);
    orderedEmails.forEach((item, index) => {
      if (!state.arrivedEmailIds.includes(item.id)) {
        candidateItems.push({
          channelType: "email",
          id: item.id,
          item,
          channelIndex: index,
          channelTotal: orderedEmails.length,
        });
      }
    });
  }

  if (state.enabledChannels.messenger) {
    const orderedMessages = getSelectedChannelItems(state, "messenger", MESSENGER_CASES);
    orderedMessages.forEach((item, index) => {
      if (!state.arrivedMessengerIds.includes(item.id)) {
        candidateItems.push({
          channelType: "messenger",
          id: item.id,
          item,
          channelIndex: index,
          channelTotal: orderedMessages.length,
        });
      }
    });
  }

  if (state.enabledChannels.video) {
    const orderedVideos = getSelectedChannelItems(state, "video", VIDEO_CASES);
    orderedVideos.forEach((item, index) => {
      if (!state.arrivedVideoIds.includes(item.id)) {
        candidateItems.push({
          channelType: "video",
          id: item.id,
          item,
          channelIndex: index,
          channelTotal: orderedVideos.length,
        });
      }
    });
  }

  const ordered = candidateItems
    .sort((left, right) => {
      const leftArrival = left.item.timing?.arrivalMinute ?? left.item.arrivalMinute;
      const rightArrival = right.item.timing?.arrivalMinute ?? right.item.arrivalMinute;
      if (leftArrival !== rightArrival) {
        return leftArrival - rightArrival;
      }
      const offsetDiff = CHANNEL_SCHEDULE_KIND_OFFSETS[left.channelType] - CHANNEL_SCHEDULE_KIND_OFFSETS[right.channelType];
      if (offsetDiff !== 0) {
        return offsetDiff;
      }
      if (left.item.sortOrder !== right.item.sortOrder) {
        return left.item.sortOrder - right.item.sortOrder;
      }
      return left.id.localeCompare(right.id);
    })
    .map((candidate, index, allItems) => {
      const distributedAt = getDistributedChannelArrivalSeconds(totalDurationSeconds, index, allItems.length);
      const configuredAt = getChannelArrivalSeconds(
        totalDurationSeconds,
        candidate.channelType,
        candidate.item,
        candidate.channelIndex,
        candidate.channelTotal,
        state.timeLimit,
      );
      const scheduledAt = clamp(
        Math.max(distributedAt, Math.min(configuredAt, Math.round(totalDurationSeconds * 0.82))),
        10,
        Math.max(10, totalDurationSeconds - 10),
      );
      return {
        channelType: candidate.channelType,
        id: candidate.id,
        scheduledAt,
      };
    })
    .sort((left, right) => left.scheduledAt - right.scheduledAt || left.id.localeCompare(right.id));

  return Number.isFinite(limit) ? ordered.slice(0, limit) : ordered;
}

function getNextDueChannelEvent(state: SimulationState) {
  return getUpcomingChannelEvents(state, Number.POSITIVE_INFINITY).find((item) => item.scheduledAt <= state.elapsedSeconds) || null;
}

function getQueuedCaseByState(state: SimulationState, pointer: number) {
  return getQueuedCaseByPointer(pointer, getOrderedSelectedCases(state.selectedCaseIds));
}

export interface RuntimeDiagnosticsSnapshot {
  activeSource: ActionPanelSource | "idle";
  activeTitle: string;
  pendingMainSignals: number;
  pendingEmailSignals: number;
  pendingMessengerSignals: number;
  pendingVideoSignals: number;
  nextMainSignalEtaSeconds: number | null;
  nextChannelEvent: { channelType: ChannelScheduleType; title: string; etaSeconds: number } | null;
  preloadedMediaCount: number;
}

export function getRuntimeDiagnosticsSnapshot(state: SimulationState): RuntimeDiagnosticsSnapshot {
  const nextMainSignalEtaSeconds =
    state.caseQueue.length > 0 && state.nextSignalAt >= state.elapsedSeconds
      ? Math.max(0, state.nextSignalAt - state.elapsedSeconds)
      : null;
  const nextChannelEventCandidate = getUpcomingChannelEvents(state, Number.POSITIVE_INFINITY)
    .find((item) => !state[
      item.channelType === "email"
        ? "arrivedEmailIds"
        : item.channelType === "messenger"
          ? "arrivedMessengerIds"
          : "arrivedVideoIds"
    ].includes(item.id));

  const nextChannelTitle =
    nextChannelEventCandidate?.channelType === "email"
      ? EMAIL_CASES.find((item) => item.id === nextChannelEventCandidate.id)?.subject || nextChannelEventCandidate.id
      : nextChannelEventCandidate?.channelType === "messenger"
        ? MESSENGER_CASES.find((item) => item.id === nextChannelEventCandidate.id)?.senderName || nextChannelEventCandidate.id
        : nextChannelEventCandidate?.channelType === "video"
          ? VIDEO_CASES.find((item) => item.id === nextChannelEventCandidate.id)?.title || nextChannelEventCandidate.id
          : "";

  const activeTitle =
    state.actionPanelSource === "main_case"
      ? state.activeSignals.find((signal) => signal.id === state.actionPanelContentId)?.title || "Звонок"
      : state.actionPanelSource === "email"
        ? EMAIL_CASES.find((item) => item.id === state.actionPanelContentId)?.subject || "Почта"
        : state.actionPanelSource === "messenger"
          ? MESSENGER_CASES.find((item) => item.id === state.actionPanelContentId)?.senderName || "ТёрКограмм"
          : state.actionPanelSource === "video"
            ? VIDEO_CASES.find((item) => item.id === state.actionPanelContentId)?.title || "Видео"
            : "Нет активного сигнала";

  return {
    activeSource: state.actionPanelSource || "idle",
    activeTitle,
    pendingMainSignals: state.activeSignals.filter((signal) => !signal.isExpired).length,
    pendingEmailSignals: state.arrivedEmailIds.filter((id) => !state.answeredEmailIds.includes(id)).length,
    pendingMessengerSignals: state.arrivedMessengerIds.filter((id) => !state.answeredMessengerIds.includes(id)).length,
    pendingVideoSignals: state.arrivedVideoIds.filter((id) => !state.answeredVideoIds.includes(id)).length,
    nextMainSignalEtaSeconds,
    nextChannelEvent: nextChannelEventCandidate
      ? {
          channelType: nextChannelEventCandidate.channelType,
          title: nextChannelTitle,
          etaSeconds: Math.max(0, nextChannelEventCandidate.scheduledAt - state.elapsedSeconds),
        }
      : null,
    preloadedMediaCount: getLoadedMediaCount(),
  };
}

interface SimulationProgressSummary {
  completed: number;
  total: number;
  active: number;
  remaining: number;
  pendingMain: number;
  pendingChannels: number;
  futureMain: number;
  futureChannels: number;
  percent: number;
}

function getSimulationProgressSummary(state: SimulationState): SimulationProgressSummary {
  const pendingMain = state.activeSignals.filter((signal) => !signal.isExpired).length;
  const pendingEmail = state.arrivedEmailIds.filter((id) => !state.answeredEmailIds.includes(id)).length;
  const pendingMessenger = state.arrivedMessengerIds.filter((id) => !state.answeredMessengerIds.includes(id)).length;
  const pendingVideo = state.arrivedVideoIds.filter((id) => !state.answeredVideoIds.includes(id)).length;
  const pendingChannels = pendingEmail + pendingMessenger + pendingVideo;
  const futureMain = state.caseQueue.length;
  const futureEmail = state.enabledChannels.email
    ? getSelectedChannelItems(state, "email", EMAIL_CASES).filter((item) => !state.arrivedEmailIds.includes(item.id)).length
    : 0;
  const futureMessenger = state.enabledChannels.messenger
    ? getSelectedChannelItems(state, "messenger", MESSENGER_CASES).filter((item) => !state.arrivedMessengerIds.includes(item.id)).length
    : 0;
  const futureVideo = state.enabledChannels.video
    ? getSelectedChannelItems(state, "video", VIDEO_CASES).filter((item) => !state.arrivedVideoIds.includes(item.id)).length
    : 0;
  const futureChannels = futureEmail + futureMessenger + futureVideo;
  const completed = state.decisions.length;
  const active = pendingMain + pendingChannels;
  const remaining = active + futureMain + futureChannels;
  const total = Math.max(completed + remaining, completed, 1);

  return {
    completed,
    total,
    active,
    remaining,
    pendingMain,
    pendingChannels,
    futureMain,
    futureChannels,
    percent: Math.round((completed / total) * 100),
  };
}

function getSignalNotificationChannel(type: string): "call" | "messenger" | "video" | "email" {
  switch (type) {
    case "email":
      return "email";
    case "message":
      return "messenger";
    case "visitor":
    case "call":
    case "zone_signal":
    default:
      return "call";
  }
}

function getMainSignalReminderSeconds(signal: ActiveSignal) {
  if (signal.reminderIntervalSeconds != null && signal.reminderIntervalSeconds > 0) {
    return Math.max(5, Math.round(signal.reminderIntervalSeconds));
  }

  return getSignalNotificationChannel(signal.type) === "messenger" ? 10 : 180;
}

function getTaskTypeLabel(sourceType: SessionSourceType): string {
  switch (sourceType) {
    case "email":
      return "Почта";
    case "messenger":
      return "ТёркоГрамм";
    case "video":
      return "Видео";
    case "main_case":
    default:
      return "Звонок";
  }
}

function formatZoneLabel(zones: string[] | undefined, fallback = "Общая зона"): string {
  if (!zones || zones.length === 0) {
    return fallback;
  }

  return zones.join(", ");
}

function buildTimerSnapshot({
  deadline,
  sourceType,
  contentId,
  title,
  responsibility,
  taskType,
  zoneLabel,
  arrivedAtElapsed,
  resolvedAtElapsed,
  resolvedSimTime,
  referenceElapsed,
}: {
  deadline: ScenarioDeadline | null | undefined;
  sourceType: SessionSourceType;
  contentId: string;
  title: string;
  responsibility: string;
  taskType: string;
  zoneLabel: string;
  arrivedAtElapsed: number;
  resolvedAtElapsed: number | null;
  resolvedSimTime: string | null;
  referenceElapsed: number;
}): TimerSnapshot | null {
  if (!deadline) {
    return null;
  }

  const effectiveElapsed = resolvedAtElapsed ?? referenceElapsed;
  const overdueSeconds = Math.max(0, effectiveElapsed - deadline.dueAtElapsed);
  const wasOverdue = overdueSeconds > 0;

  return {
    id: `${sourceType}:${contentId}:${deadline.dueAtElapsed}`,
    sourceType,
    contentId,
    title,
    responsibility,
    taskType,
    zoneLabel,
    label: deadline.label,
    totalSeconds: deadline.totalSeconds,
    arrivedAtElapsed,
    dueAtElapsed: deadline.dueAtElapsed,
    resolvedAtElapsed,
    resolvedSimTime,
    wasOverdue,
    overdueSeconds,
    status: resolvedAtElapsed == null ? (wasOverdue ? "overdue" : "active") : (wasOverdue ? "overdue" : "resolved"),
  };
}

function buildSignalNarration(title: string, source: string, situation: string, content: string): string {
  const parts = [
    title,
    source ? `Источник: ${source}.` : "",
    content,
    situation,
  ];

  return parts
    .filter(Boolean)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildMetricDeltaEntries(before: RealisticMetrics, after: RealisticMetrics): MetricDeltaEntry[] {
  const rows: Array<Omit<MetricDeltaEntry, "before" | "after" | "delta"> & { before: number; after: number }> = [
    { key: "customersInStore", metric: "Торг. зал / покупатели", unit: "count", betterWhen: "higher", before: before.customersInStore, after: after.customersInStore },
    { key: "avgCheck", metric: "Клиенты / средний чек", unit: "rub", betterWhen: "higher", before: before.avgCheck, after: after.avgCheck },
    { key: "conversion", metric: "Торг. зал / конверсия", unit: "percent", betterWhen: "higher", before: before.conversion, after: after.conversion },
    { key: "nps", metric: "Клиенты / оценка", unit: "score", betterWhen: "higher", before: before.nps, after: after.nps },
    { key: "pickupSpeed", metric: "Выдача / скорость", unit: "minutes", betterWhen: "lower", before: before.pickupSpeed, after: after.pickupSpeed },
    { key: "warehouseLoad", metric: "Склад / загрузка", unit: "percent", betterWhen: "lower", before: before.warehouseLoad, after: after.warehouseLoad },
    { key: "teamMorale", metric: "Команда / мораль", unit: "score", betterWhen: "higher", before: before.teamMorale, after: after.teamMorale },
    { key: "dailyRevenue", metric: "Финансы / выручка", unit: "kRub", betterWhen: "higher", before: before.dailyRevenue, after: after.dailyRevenue },
  ];

  return rows
    .map((row) => ({
      ...row,
      delta: row.unit === "score"
        ? Math.round((row.after - row.before) * 100) / 100
        : Math.round(row.after - row.before),
    }))
    .filter((row) => row.delta !== 0);
}

function computeZones(metrics: RealisticMetrics): ZoneStatus {
  const hallHealth: ZoneHealth =
    metrics.conversion >= 55 ? "green" : metrics.conversion >= 45 ? "yellow" : metrics.conversion >= 35 ? "orange" : "red";
  const warehouseHealth: ZoneHealth =
    metrics.warehouseLoad <= 55 ? "green" : metrics.warehouseLoad <= 72 ? "yellow" : metrics.warehouseLoad <= 86 ? "orange" : "red";
  const pickupHealth: ZoneHealth =
    metrics.pickupSpeed <= 10 ? "green" : metrics.pickupSpeed <= 18 ? "yellow" : metrics.pickupSpeed <= 28 ? "orange" : "red";
  const clientRatingAsTenPoint = metrics.nps * 2;
  const bossHealthScore = (metrics.teamMorale * 0.55) + (clientRatingAsTenPoint * 0.45);
  const bossHealth: ZoneHealth =
    bossHealthScore >= 7 ? "green" : bossHealthScore >= 5.8 ? "yellow" : bossHealthScore >= 4.5 ? "orange" : "red";

  return {
    торговый_зал: { health: hallHealth, label: `Конв. ${metrics.conversion}%` },
    склад: { health: warehouseHealth, label: `Загр. ${metrics.warehouseLoad}%` },
    выдача: { health: pickupHealth, label: `${metrics.pickupSpeed} мин` },
    начальство: { health: bossHealth, label: `${bossHealthScore.toFixed(1)} / 10` },
  };
}

const defaultStartingMetrics: RealisticMetrics = {
  customersInStore: 18,
  avgCheck: 7200,
  conversion: 48,
  nps: 3.3,
  pickupSpeed: 16,
  warehouseLoad: 44,
  teamMorale: 6.8,
  dailyRevenue: 1800,
};

function sanitizeStartingMetrics(metrics?: Partial<RealisticMetrics> | null): RealisticMetrics {
  return {
    customersInStore: clamp(Number(metrics?.customersInStore ?? defaultStartingMetrics.customersInStore), 2, 60),
    avgCheck: clamp(Number(metrics?.avgCheck ?? defaultStartingMetrics.avgCheck), 3000, 20000),
    conversion: clamp(Number(metrics?.conversion ?? defaultStartingMetrics.conversion), 20, 85),
    nps: normalizeClientRating(metrics?.nps ?? defaultStartingMetrics.nps, defaultStartingMetrics.nps),
    pickupSpeed: clamp(Number(metrics?.pickupSpeed ?? defaultStartingMetrics.pickupSpeed), 5, 45),
    warehouseLoad: clamp(Number(metrics?.warehouseLoad ?? defaultStartingMetrics.warehouseLoad), 15, 100),
    teamMorale: clamp(Math.round(Number(metrics?.teamMorale ?? defaultStartingMetrics.teamMorale) * 10) / 10, 1, 10),
    dailyRevenue: clamp(Number(metrics?.dailyRevenue ?? defaultStartingMetrics.dailyRevenue), 600, 3500),
  };
}

function getMainCaseTimelinePriority(caseData: SimCase) {
  const text = `${caseData.title} ${caseData.description} ${caseData.trigger.text}`.toLowerCase();

  if (/закрыт|конец смен|отч[её]т/.test(text)) {
    return 9000 + caseData.sortOrder;
  }

  if (/открыт|утрен|опозда|до открытия/.test(text)) {
    return caseData.sortOrder - 1000;
  }

  if (caseData.timing?.arrivalMinute != null) {
    return caseData.timing.arrivalMinute;
  }

  return caseData.sortOrder * 100;
}

function getOrderedSelectedCases(selectedCaseIds: string[]) {
  return [...CASES_DATA.filter((item) => selectedCaseIds.includes(item.id))].sort((left, right) => {
    const priorityDiff = getMainCaseTimelinePriority(left) - getMainCaseTimelinePriority(right);
    if (priorityDiff !== 0) {
      return priorityDiff;
    }
    return left.id.localeCompare(right.id);
  });
}

function buildMainCaseQueue(selectedCases: SimCase[]) {
  let pointer = 0;
  const queue: number[] = [];
  selectedCases.forEach((caseItem) => {
    const firstActiveCycleIndex = caseItem.cycles.findIndex(isRuntimeCycleActive);
    if (firstActiveCycleIndex >= 0) {
      queue.push(pointer + firstActiveCycleIndex);
    }
    pointer += Math.max(1, caseItem.cycles.length);
  });
  return queue;
}

function isRuntimeCycleActive(cycle: SimCase["cycles"][number]) {
  return (cycle.status || "active") === "active";
}

function resolveMainQueuePointer(pointer: number, selectedCases: SimCase[]) {
  let cursor = 0;

  for (let caseIndex = 0; caseIndex < selectedCases.length; caseIndex += 1) {
    const caseData = selectedCases[caseIndex];
    const cycleCount = Math.max(1, caseData.cycles.length);
    if (pointer >= cursor && pointer < cursor + cycleCount) {
      return {
        caseData,
        caseIndex,
        cycleIndex: pointer - cursor,
      };
    }
    cursor += cycleCount;
  }

  return {
    caseData: null,
    caseIndex: -1,
    cycleIndex: -1,
  };
}

function getMainQueuePointerForCaseCycle(selectedCases: SimCase[], caseIndex: number, cycleIndex: number) {
  if (caseIndex < 0 || cycleIndex < 0 || caseIndex >= selectedCases.length) {
    return null;
  }

  const caseData = selectedCases[caseIndex];
  if (!caseData || cycleIndex >= caseData.cycles.length) {
    return null;
  }

  let pointer = 0;
  for (let index = 0; index < caseIndex; index += 1) {
    pointer += Math.max(1, selectedCases[index].cycles.length);
  }

  return pointer + cycleIndex;
}

function resolveNextCaseCycleIndex(caseData: SimCase, signalCycleNumber: number, option: CaseOption) {
  if (option.nextCycleId === "__complete") {
    return null;
  }

  if (option.nextCycleId) {
    const linkedIndex = caseData.cycles.findIndex((cycle) => cycle.id === option.nextCycleId && isRuntimeCycleActive(cycle));
    if (linkedIndex >= 0) {
      return linkedIndex;
    }
  }

  const currentCycle = caseData.cycles[signalCycleNumber - 1];
  if (currentCycle?.isFinal) {
    return null;
  }

  const nextLinearIndex = caseData.cycles.findIndex((cycle, index) => index >= signalCycleNumber && isRuntimeCycleActive(cycle));
  return nextLinearIndex >= 0 ? nextLinearIndex : null;
}

function getVisibleCaseOptions(options: CaseOption[]) {
  return (options || []).filter((option) => (option.status || "active") === "active");
}

function getMainCaseArrivalSeconds(
  caseData: SimCase | null | undefined,
  caseIndex: number,
  totalCases: number,
  totalDurationSeconds: number,
  timeLimitMinutes: number,
) {
  void caseData;
  void timeLimitMinutes;

  const firstCaseAt = getFirstMainCaseDelaySeconds(totalDurationSeconds);
  if (totalCases <= 1) {
    return firstCaseAt;
  }

  const endBufferSeconds = getMainSignalEndBufferSeconds(totalDurationSeconds);
  const lastCaseAt = Math.max(firstCaseAt + 60, totalDurationSeconds - endBufferSeconds);
  const intervalSeconds = (lastCaseAt - firstCaseAt) / Math.max(1, totalCases - 1);
  return Math.round(firstCaseAt + intervalSeconds * caseIndex);
}

function getNextMainSignalAtFromQueue(
  queue: number[],
  selectedCases: SimCase[],
  elapsedSeconds: number,
  totalDurationSeconds: number,
  timeLimitMinutes: number,
  speedMultiplier: number,
) {
  if (queue.length === 0) {
    return elapsedSeconds;
  }

  const nextQueueItem = queue[0];
  const resolved = resolveMainQueuePointer(nextQueueItem, selectedCases);
  if (resolved.cycleIndex === 0) {
    const scheduledAt = getMainCaseArrivalSeconds(resolved.caseData, resolved.caseIndex, selectedCases.length, totalDurationSeconds, timeLimitMinutes);
    if (scheduledAt > elapsedSeconds + 5) {
      return scheduledAt;
    }
  }

  return elapsedSeconds + getCaseScheduledDelaySeconds(
    speedMultiplier,
    totalDurationSeconds,
    elapsedSeconds,
    queue.length,
    resolved.caseData?.timing,
  );
}

function hasPendingMainSignals(state: SimulationState) {
  return state.activeSignals.some((signal) => !signal.isExpired);
}

function hasUnansweredChannelSignals(state: SimulationState) {
  return (
    state.arrivedEmailIds.some((id) => !state.answeredEmailIds.includes(id)) ||
    state.arrivedMessengerIds.some((id) => !state.answeredMessengerIds.includes(id)) ||
    state.arrivedVideoIds.some((id) => !state.answeredVideoIds.includes(id))
  );
}

function hasFutureChannelSignals(state: SimulationState) {
  return (
    (state.enabledChannels.email && getSelectedChannelItems(state, "email", EMAIL_CASES).some((item) => !state.arrivedEmailIds.includes(item.id))) ||
    (state.enabledChannels.messenger && getSelectedChannelItems(state, "messenger", MESSENGER_CASES).some((item) => !state.arrivedMessengerIds.includes(item.id))) ||
    (state.enabledChannels.video && getSelectedChannelItems(state, "video", VIDEO_CASES).some((item) => !state.arrivedVideoIds.includes(item.id)))
  );
}

function shouldReleaseDelayedFirstMainCase(state: SimulationState, elapsedSeconds: number) {
  return (
    state.caseQueue.length > 0 &&
    state.decisions.every((decision) => decision.sourceType !== "main_case") &&
    !hasPendingMainSignals(state) &&
    state.nextSignalAt > elapsedSeconds + 5 &&
    elapsedSeconds >= getFirstMainCaseDelaySeconds(state.timeLimit * 60)
  );
}

function shouldAutoCompleteSimulation(state: SimulationState) {
  if (!state.isRunning || state.isPaused || state.isCompleted) {
    return false;
  }

  return (
    state.caseQueue.length === 0 &&
    !hasPendingMainSignals(state) &&
    !hasUnansweredChannelSignals(state) &&
    !hasFutureChannelSignals(state)
  );
}

function buildCompetencyAverageMap(totals: SimulationState["competencyTotals"]): Record<string, number> {
  return Object.fromEntries(
    Object.entries(totals)
      .filter(([, value]) => value.count > 0)
      .map(([key, value]) => [key, Math.round((value.total / value.count) * 10) / 10]),
  );
}

const TIME_PROFILE_EVALUATION_COEFFICIENT: Record<SimulationState["difficulty"], number> = {
  easy: 0.95,
  medium: 1,
  hard: 1.08,
};

function getCaseWeightRatio(caseId: string, sourceType: SessionSourceType) {
  if (sourceType !== "main_case") {
    return 1;
  }

  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const explicitWeight = Number(settings?.caseWeights?.[caseId]);
  if (!Number.isFinite(explicitWeight)) {
    return 1;
  }

  return clamp(explicitWeight / 100, 0, 1);
}

function getTimeEvaluationCoefficient(
  difficulty: SimulationState["difficulty"],
  timeInfluenceEnabled: boolean,
) {
  return timeInfluenceEnabled ? TIME_PROFILE_EVALUATION_COEFFICIENT[difficulty] : 1;
}

function applyCompetencyContribution(
  currentTotals: SimulationState["competencyTotals"],
  competencyScores: Record<string, number> | null | undefined,
  caseId: string,
  sourceType: SessionSourceType,
  resolvedScore: number,
) {
  const weightRatio = getCaseWeightRatio(caseId, sourceType);
  const qualityRatio = clamp(resolvedScore / 5, 0.1, 1);
  const nextTotals = { ...currentTotals };

  Object.entries(competencyScores || {}).forEach(([competencyId, rawScore]) => {
    const score = Number(rawScore || 0);
    if (!nextTotals[competencyId]) {
      nextTotals[competencyId] = { total: 0, count: 0 };
    }

    nextTotals[competencyId] = {
      total: nextTotals[competencyId].total + score * weightRatio * qualityRatio,
      count: nextTotals[competencyId].count + weightRatio,
    };
  });

  return nextTotals;
}

function buildAdjustedSessionSummary(state: SimulationState) {
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const timeCoefficient = getTimeEvaluationCoefficient(
    state.difficulty,
    Boolean(settings?.timeInfluenceEnabled),
  );

  let weightedScoreTotal = 0;
  let weightedDecisionCount = 0;

  state.decisions.forEach((decision) => {
    const weightRatio = getCaseWeightRatio(decision.caseId, decision.sourceType);
    weightedScoreTotal += decision.score * weightRatio;
    weightedDecisionCount += weightRatio;
  });

  const averageScore = weightedDecisionCount > 0
    ? Math.round(clamp((weightedScoreTotal / weightedDecisionCount) * timeCoefficient, 0, 5) * 10) / 10
    : 0;

  const reconstructedTotals = state.decisions.reduce<SimulationState["competencyTotals"]>((totals, decision) => (
    applyCompetencyContribution(
      totals,
      decision.competencyScores,
      decision.caseId,
      decision.sourceType,
      decision.score,
    )
  ), {});
  const effectiveCompetencyTotals = Object.keys(state.competencyTotals || {}).length > 0
    ? state.competencyTotals
    : reconstructedTotals;

  const competencyAverages = Object.fromEntries(
    Object.entries(buildCompetencyAverageMap(effectiveCompetencyTotals)).map(([competencyId, value]) => ([
      competencyId,
      Math.round(clamp(value * timeCoefficient, 0, 5) * 10) / 10,
    ])),
  );

  return {
    totalScore: Math.round(weightedScoreTotal * timeCoefficient),
    averageScore,
    competencyAverages,
    timeCoefficient,
  };
}

function buildSessionMetricPayload(metrics: RealisticMetrics, timestamp: string) {
  return {
    timestamp,
    queue: metrics.customersInStore,
    conversion: metrics.conversion,
    morale: Math.round(metrics.teamMorale * 10),
    revenueImpact: metrics.dailyRevenue,
    deliveryStatus: clamp(100 - metrics.pickupSpeed * 3, 0, 100),
  };
}

function buildSessionResultPayload(state: SimulationState): SessionResultPayload {
  const summary = buildAdjustedSessionSummary(state);

  return {
    totalScore: summary.totalScore,
    averageScore: summary.averageScore,
    competencyAverages: summary.competencyAverages,
    finalMetrics: {
      customersInStore: state.metrics.customersInStore,
      avgCheck: state.metrics.avgCheck,
      conversion: state.metrics.conversion,
      nps: state.metrics.nps,
      pickupSpeed: state.metrics.pickupSpeed,
      warehouseLoad: state.metrics.warehouseLoad,
      teamMorale: state.metrics.teamMorale,
      dailyRevenue: state.metrics.dailyRevenue,
    },
    timers: collectAllTimers(state),
    pauses: state.pauses,
  };
}

function getChannelNotificationCounts(state: SimulationState): ChannelNotificationCounts {
  return {
    calls: state.activeSignals.filter((signal) => !signal.isExpired).length,
    email: state.arrivedEmailIds.filter((id) => !state.answeredEmailIds.includes(id)).length,
    messenger: state.arrivedMessengerIds.filter((id) => !state.answeredMessengerIds.includes(id)).length,
    video: state.arrivedVideoIds.filter((id) => !state.answeredVideoIds.includes(id)).length,
  };
}

function collectPendingTimers(state: SimulationState): TimerSnapshot[] {
  const selectedCases = getOrderedSelectedCases(state.selectedCaseIds);
  const timers: TimerSnapshot[] = [];

  state.activeSignals
    .filter((signal) => !signal.isExpired)
    .forEach((signal) => {
      const caseData = selectedCases.find((item) => item.id === signal.caseId);
      const timer = buildTimerSnapshot({
        deadline: signal.deadline,
        sourceType: "main_case",
        contentId: signal.caseId,
        title: signal.title,
        responsibility: signal.source || "Операционная зона",
        taskType: "Звонок",
        zoneLabel: formatZoneLabel(caseData?.zones_affected, signal.source || "Операционная зона"),
        arrivedAtElapsed: signal.arrivedAt,
        resolvedAtElapsed: null,
        resolvedSimTime: null,
        referenceElapsed: state.elapsedSeconds,
      });

      if (timer) {
        timers.push(timer);
      }
    });

  state.arrivedMessengerIds
    .filter((id) => !state.answeredMessengerIds.includes(id))
    .forEach((msgId) => {
      const msgCase = MESSENGER_CASES.find((item) => item.id === msgId);
      const meta = state.messengerSignalMeta[msgId];
      const timer = buildTimerSnapshot({
        deadline: meta?.deadline,
        sourceType: "messenger",
        contentId: msgId,
        title: msgCase?.senderName || msgId,
        responsibility: msgCase?.senderRole || "ТёркоГрамм",
        taskType: "ТёркоГрамм",
        zoneLabel: CHATS.find((chat) => chat.id === msgCase?.chatId)?.name || "Чат",
        arrivedAtElapsed: meta?.arrivedAt ?? state.elapsedSeconds,
        resolvedAtElapsed: null,
        resolvedSimTime: null,
        referenceElapsed: state.elapsedSeconds,
      });

      if (timer) {
        timers.push(timer);
      }
    });

  state.arrivedVideoIds
    .filter((id) => !state.answeredVideoIds.includes(id))
    .forEach((videoId) => {
      const videoCase = VIDEO_CASES.find((item) => item.id === videoId);
      const meta = state.videoSignalMeta[videoId];
      const timer = buildTimerSnapshot({
        deadline: meta?.deadline,
        sourceType: "video",
        contentId: videoId,
        title: videoCase?.title || videoId,
        responsibility: videoCase?.sender || "Видео",
        taskType: "Видео",
        zoneLabel: videoCase?.role || "Видеообращение",
        arrivedAtElapsed: meta?.arrivedAt ?? state.elapsedSeconds,
        resolvedAtElapsed: null,
        resolvedSimTime: null,
        referenceElapsed: state.elapsedSeconds,
      });

      if (timer) {
        timers.push(timer);
      }
    });

  return timers.sort((left, right) => left.dueAtElapsed - right.dueAtElapsed);
}

function collectAllTimers(state: SimulationState): TimerSnapshot[] {
  const resolved = state.decisions
    .map((decision) => decision.timer)
    .filter((timer): timer is TimerSnapshot => Boolean(timer));
  const pending = collectPendingTimers(state);
  const merged = new Map<string, TimerSnapshot>();

  [...resolved, ...pending].forEach((timer) => {
    merged.set(timer.id, timer);
  });

  return Array.from(merged.values()).sort((left, right) => left.dueAtElapsed - right.dueAtElapsed);
}

function getQueuedCaseByPointer(queuePointer: number, selectedCases: SimCase[]) {
  return resolveMainQueuePointer(queuePointer, selectedCases).caseData || null;
}

function getInitialState(): SimulationState {
  const sanitizedStartingMetrics = sanitizeStartingMetrics(defaultStartingMetrics);
  return {
    participantName: "",
    assessorName: "",
    sessionId: null,
    difficulty: "medium",
    selectedCaseIds: CASES_DATA.map((c) => c.id),
    manualSelection: false,
    repeatCases: false,
    timeLimit: 60,
    isTestMode: false,
    speedMultiplier: 1,
    enabledChannels: { audio: true, email: true, messenger: true, video: true },
    selectedChannelItemIds: {
      email: EMAIL_CASES.map((item) => item.id),
      messenger: MESSENGER_CASES.map((item) => item.id),
      video: VIDEO_CASES.map((item) => item.id),
    },
    startingMetrics: sanitizedStartingMetrics,

    isRunning: false,
    isPaused: false,
    isCompleted: false,
    timeRemaining: 60 * 60,
    simDateTime: "09:00",
    elapsedSeconds: 0,
    pauseStartedAt: null,

    caseQueue: [],
    nextSignalAt: 0,
    activeSignals: [],
    currentSignalId: null,
    toasts: [],
    actionPanelSource: null,
    actionPanelContentId: null,

    metrics: { ...sanitizedStartingMetrics },
    zones: computeZones(sanitizedStartingMetrics),

    decisions: [],
    competencyTotals: {},

    showConsequence: false,
    lastConsequences: [],
    lastOptionText: "",
    journalOpen: false,

    arrivedEmailIds: [],
    answeredEmailIds: [],
    openedEmailIds: [],
    arrivedMessengerIds: [],
    answeredMessengerIds: [],
    openedMessengerIds: [],
    arrivedVideoIds: [],
    answeredVideoIds: [],
    openedVideoIds: [],
    emailSignalMeta: {},
    messengerSignalMeta: {},
    videoSignalMeta: {},
    pauses: [],
  };
}

function normalizeSimulationState(input: Partial<SimulationState> | SimulationState): SimulationState {
  const base = getInitialState();
  const startingMetrics = sanitizeStartingMetrics({
    ...base.startingMetrics,
    ...(input.startingMetrics || {}),
  });
  const metrics = sanitizeStartingMetrics({
    ...startingMetrics,
    ...(input.metrics || {}),
  });

  return {
    ...base,
    ...input,
    enabledChannels: {
      ...base.enabledChannels,
      ...(input.enabledChannels || {}),
    },
    selectedChannelItemIds: {
      ...base.selectedChannelItemIds,
      ...(input.selectedChannelItemIds || {}),
    },
    startingMetrics,
    metrics,
    zones: input.zones || computeZones(metrics),
    actionPanelSource: input.actionPanelSource ?? null,
    actionPanelContentId: input.actionPanelContentId ?? null,
  };
}

function isPlaceholderLiveSnapshot(
  input: Partial<SimulationState> | SimulationState,
  status: LiveSimulationStatus,
) {
  const snapshot = normalizeSimulationState(input);

  return (
    status === "waiting" &&
    !snapshot.isRunning &&
    !snapshot.isPaused &&
    !snapshot.isCompleted &&
    snapshot.elapsedSeconds === 0 &&
    snapshot.decisions.length === 0 &&
    snapshot.activeSignals.length === 0
  );
}

// Play channel notification sound
export function playChannelSound(
  channel: "call" | "messenger" | "video" | "email",
  mode: "single" | "loop" | "reminder" = "single",
) {
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const configuredSelection =
    channel === "call"
      ? settings?.callSoundAssetId
      : channel === "email"
      ? settings?.emailSoundAssetId
      : channel === "messenger"
      ? settings?.messengerSoundAssetId
      : settings?.videoSoundAssetId;
  const soundSrc = resolveChannelSoundSource(configuredSelection, channel);

  switch (channel) {
    case "call":
      if (mode === "loop") {
        playLoopingAudio(soundSrc, 0.9);
      } else {
        playAudioFile(soundSrc, 0.9);
      }
      break;
    case "messenger":
      if (mode === "reminder") {
        playTwoToneNotification(soundSrc, 0.85);
      } else {
        playAudioFile(soundSrc, 0.85);
      }
      break;
    case "video":
      if (mode === "loop") {
        playLoopingAudio(soundSrc, 0.95);
      } else {
        playAudioFile(soundSrc, 0.95);
      }
      break;
    case "email":
      playAudioFile(soundSrc, 0.75);
      break;
  }
}

function reducer(state: SimulationState, action: Action): SimulationState {
  switch (action.type) {
    case "SET_CONFIG":
      return normalizeSimulationState({
        ...state,
        ...action.payload,
        enabledChannels: action.payload.enabledChannels
          ? { ...state.enabledChannels, ...action.payload.enabledChannels }
          : state.enabledChannels,
        selectedChannelItemIds: action.payload.selectedChannelItemIds
          ? { ...state.selectedChannelItemIds, ...action.payload.selectedChannelItemIds }
          : state.selectedChannelItemIds,
        startingMetrics: action.payload.startingMetrics
          ? { ...state.startingMetrics, ...action.payload.startingMetrics }
          : state.startingMetrics,
        metrics: action.payload.metrics
          ? { ...state.metrics, ...action.payload.metrics }
          : state.metrics,
      });

    case "BOOTSTRAP_SIMULATION":
      return reducer(
        normalizeSimulationState({
          ...state,
          ...action.payload,
          enabledChannels: action.payload.enabledChannels
            ? { ...state.enabledChannels, ...action.payload.enabledChannels }
            : state.enabledChannels,
          selectedChannelItemIds: action.payload.selectedChannelItemIds
            ? { ...state.selectedChannelItemIds, ...action.payload.selectedChannelItemIds }
            : state.selectedChannelItemIds,
          startingMetrics: action.payload.startingMetrics
            ? { ...state.startingMetrics, ...action.payload.startingMetrics }
            : state.startingMetrics,
          metrics: action.payload.metrics
            ? { ...state.metrics, ...action.payload.metrics }
            : state.metrics,
        }),
        { type: "START_SIMULATION" },
      );

    case "RESTORE_STATE":
      return normalizeSimulationState(action.payload);

    case "SET_SESSION_ID":
      return { ...state, sessionId: action.payload };

    case "START_SIMULATION": {
      const selectedCases = getOrderedSelectedCases(state.selectedCaseIds);
      const queue = buildMainCaseQueue(selectedCases);

      const startingMetrics = sanitizeStartingMetrics(state.startingMetrics);

        return {
          ...state,
          sessionId: null,
        isRunning: true,
        isPaused: false,
        isCompleted: false,
        timeRemaining: state.timeLimit * 60,
        simDateTime: "09:00",
          elapsedSeconds: 0,
          pauseStartedAt: null,
          caseQueue: queue,
          nextSignalAt: getNextMainSignalAtFromQueue(
            queue,
            selectedCases,
            0,
            state.timeLimit * 60,
            state.timeLimit,
            state.speedMultiplier,
          ),
          activeSignals: [],
        currentSignalId: null,
        toasts: [],
        actionPanelSource: null,
        actionPanelContentId: null,
        metrics: startingMetrics,
        zones: computeZones(startingMetrics),
        decisions: [],
        competencyTotals: {},
        showConsequence: false,
        lastConsequences: [],
        lastOptionText: "",
        pauses: [],
        arrivedEmailIds: [],
        answeredEmailIds: [],
        openedEmailIds: [],
        arrivedMessengerIds: [],
        answeredMessengerIds: [],
        openedMessengerIds: [],
        arrivedVideoIds: [],
        answeredVideoIds: [],
        openedVideoIds: [],
        emailSignalMeta: {},
        messengerSignalMeta: {},
        videoSignalMeta: {},
      };
    }

    case "TOGGLE_PAUSE": {
      if (!state.isRunning || state.isCompleted) {
        return state;
      }

      const totalPauseSeconds = state.pauses.reduce((sum, pause) => sum + Math.max(0, pause.durationSeconds || 0), 0);
      if (!state.isPaused && (state.pauses.length >= MAX_PAUSE_COUNT || totalPauseSeconds >= MAX_PAUSE_TOTAL_SECONDS)) {
        return {
          ...state,
          isRunning: false,
          isPaused: false,
          isCompleted: true,
          pauseStartedAt: null,
          lastOptionText: "Симуляция остановлена: превышены ограничения по паузам (макс. 5 пауз и 30 минут суммарно).",
        };
      }

      if (state.isPaused) {
        const resumedAtUnixMs = Date.now();
        const resumedPauses = state.pauses.map((pause) =>
          pause.endedAt == null
            ? {
                ...pause,
                endedAt: state.elapsedSeconds,
                endedSimTime: state.simDateTime,
                endedAtUnixMs: resumedAtUnixMs,
                durationSeconds: Math.max(1, Math.round((resumedAtUnixMs - pause.startedAtUnixMs) / 1000)),
              }
            : pause
        );

        const resumedTotalPauseSeconds = resumedPauses.reduce((sum, pause) => sum + Math.max(0, pause.durationSeconds || 0), 0);
        const violatesPauseLimits = resumedPauses.length > MAX_PAUSE_COUNT || resumedTotalPauseSeconds > MAX_PAUSE_TOTAL_SECONDS;

        return {
          ...state,
          isRunning: violatesPauseLimits ? false : state.isRunning,
          isPaused: false,
          isCompleted: violatesPauseLimits ? true : state.isCompleted,
          pauseStartedAt: null,
          pauses: resumedPauses,
          lastOptionText: violatesPauseLimits
            ? "Симуляция завершена из-за нарушения правил пауз: более 5 пауз или более 30 минут суммарно."
            : state.lastOptionText,
        };
      }

      stopCurrentAudio();

      return {
        ...state,
        isPaused: true,
        pauseStartedAt: state.elapsedSeconds,
        pauses: [
          ...state.pauses,
          {
            id: `pause-${Date.now()}`,
            startedAt: state.elapsedSeconds,
            startedSimTime: state.simDateTime,
            endedAt: null,
            endedSimTime: null,
            startedAtUnixMs: Date.now(),
            endedAtUnixMs: null,
            durationSeconds: 0,
          },
        ],
      };
    }

    case "TICK": {
      if (!state.isRunning || state.timeRemaining <= 0) {
        stopCurrentAudio();
        const completedAtUnixMs = Date.now();
        const finalizedPauses = state.pauses.map((pause) =>
          pause.endedAt == null
            ? {
                ...pause,
                endedAt: state.elapsedSeconds,
                endedSimTime: state.simDateTime,
                endedAtUnixMs: completedAtUnixMs,
                durationSeconds: Math.max(1, Math.round((completedAtUnixMs - pause.startedAtUnixMs) / 1000)),
              }
            : pause
        );

        return {
          ...state,
          isRunning: false,
          isPaused: false,
          isCompleted: true,
          pauseStartedAt: null,
          pauses: finalizedPauses,
        };
      }
      const tickStep = Math.max(1, Math.round(action.payload?.stepSeconds ?? getSimulationTickStep(state.speedMultiplier)));
      const newElapsed = state.elapsedSeconds + tickStep;
      const newRemaining = Math.max(0, state.timeRemaining - tickStep);
      const newSimTime = getSimTimeFromElapsed(newElapsed, state.timeLimit * 60);

      if (newRemaining <= 0) {
        stopCurrentAudio();
        const completedAtUnixMs = Date.now();
        const finalizedPauses = state.pauses.map((pause) =>
          pause.endedAt == null
            ? {
                ...pause,
                endedAt: newElapsed,
                endedSimTime: newSimTime,
                endedAtUnixMs: completedAtUnixMs,
                durationSeconds: Math.max(1, Math.round((completedAtUnixMs - pause.startedAtUnixMs) / 1000)),
              }
            : pause
        );

        return {
          ...state,
          isRunning: false,
          isPaused: false,
          isCompleted: true,
          timeRemaining: 0,
          elapsedSeconds: newElapsed,
          simDateTime: newSimTime,
          pauseStartedAt: null,
          pauses: finalizedPauses,
        };
      }

      const normalizedMetrics =
        state.metrics.nps < 1 || state.metrics.nps > 5
          ? sanitizeStartingMetrics(state.metrics)
          : state.metrics;

      return {
        ...state,
        timeRemaining: newRemaining,
        elapsedSeconds: newElapsed,
        simDateTime: newSimTime,
        metrics: normalizedMetrics,
        zones: normalizedMetrics === state.metrics ? state.zones : computeZones(normalizedMetrics),
        nextSignalAt: shouldReleaseDelayedFirstMainCase(state, newElapsed) ? newElapsed : state.nextSignalAt,
      };
    }

    case "FIRE_SIGNAL": {
      if (state.caseQueue.length === 0) {
        return state;
      }

      const [nextQueueItem, ...restQueue] = state.caseQueue;
      const selectedCases = getOrderedSelectedCases(state.selectedCaseIds);
      const { caseData, caseIndex, cycleIndex } = resolveMainQueuePointer(nextQueueItem, selectedCases);

      if (!caseData || !caseData.cycles[cycleIndex]) {
        return {
          ...state,
          caseQueue: restQueue,
          nextSignalAt: getNextMainSignalAtFromQueue(
            restQueue,
            selectedCases,
            state.elapsedSeconds,
            state.timeLimit * 60,
            state.timeLimit,
            state.speedMultiplier,
          ),
        };
      }

      const cycle = caseData.cycles[cycleIndex];
      const signalId = `${caseData.id}-c${cycleIndex + 1}-${Date.now()}`;
      const signalType = cycle.signal.type;
      const narrationText = buildSignalNarration(
        cycle.title || caseData.title,
        cycle.source || caseData.trigger.source,
        cycle.situation,
        cycle.signal.content
      );
      const deadline = buildDecisionDeadline(
        cycle.timing || caseData.timing,
        [cycle.situation, cycle.signal.content, caseData.trigger.text, caseData.description],
        state.simDateTime,
        state.elapsedSeconds,
        state.timeLimit
      );

      const newSignal: ActiveSignal = {
        id: signalId,
        caseId: caseData.id,
        caseIndex,
        cycle: cycleIndex + 1,
        type: signalType,
        title: cycle.title || caseData.title,
        source: cycle.source || caseData.trigger.source,
        preview: cycle.signal.content.slice(0, 100) + (cycle.signal.content.length > 100 ? "..." : ""),
        fullSituation: cycle.situation,
        options: shuffleOptions(getVisibleCaseOptions(cycle.options)), // randomize order so answer isn't predictable
        arrivedAt: state.elapsedSeconds,
        isExpired: false,
        isActive: false,
        isAcknowledged: false,
        acknowledgedAt: null,
        narrationText,
        audioUrl: cycle.audioUrl || caseData.audioUrl,
        imageUrl: cycle.imageUrl || caseData.imageUrl,
        deadline,
        reminderIntervalSeconds: cycle.timing?.reminderIntervalSeconds ?? caseData.timing?.reminderIntervalSeconds ?? null,
      };

      const newToast: ToastNotification = {
        id: `toast-${signalId}`,
        signalId,
        sourceType: "main_case",
        type: signalType,
        title: `${getSignalTypeEmoji(signalType)} ${getSignalTypeLabel(signalType)}`,
        source: cycle.source || caseData.trigger.source,
        arrivedAt: state.elapsedSeconds,
        dismissed: false,
      };

      if (state.enabledChannels.audio) {
        playChannelSound(getSignalNotificationChannel(signalType));
      }

      // Update zones for affected areas
      return {
        ...state,
        caseQueue: restQueue,
        nextSignalAt: getNextMainSignalAtFromQueue(
          restQueue,
          selectedCases,
          state.elapsedSeconds,
          state.timeLimit * 60,
          state.timeLimit,
          state.speedMultiplier,
        ),
        activeSignals: [...state.activeSignals, newSignal],
        toasts: [...state.toasts, newToast],
        zones: computeZones(state.metrics),
      };
    }

    case "SELECT_SIGNAL": {
      const signalId = action.payload;
      const selectedSignal = state.activeSignals.find((signal) => signal.id === signalId);

      stopLoopingAudio();

      if (state.enabledChannels.audio && selectedSignal?.audioUrl && !isCurrentAudioSource(selectedSignal.audioUrl)) {
        playAudioImmediate(selectedSignal.audioUrl, 1);
      }

      return {
        ...state,
        currentSignalId: signalId,
        actionPanelSource: "main_case",
        actionPanelContentId: signalId,
        activeSignals: state.activeSignals.map(s => ({
          ...s,
          isActive: s.id === signalId,
          isAcknowledged: s.id === signalId ? true : s.isAcknowledged,
          acknowledgedAt: s.id === signalId && !s.isAcknowledged ? state.elapsedSeconds : s.acknowledgedAt,
        })),
        toasts: state.toasts.map((toast) =>
          toast.signalId === signalId ? { ...toast, dismissed: true } : toast
        ),
        showConsequence: false,
        };
      }

    case "SNOOZE_SIGNAL": {
      const signalId = action.payload;
      const snoozedSignal = state.activeSignals.find((signal) => signal.id === signalId);

      if (!snoozedSignal) {
        return state;
      }

      stopCurrentAudio();
      stopLoopingAudio();

      return {
        ...state,
        activeSignals: state.activeSignals.map((signal) =>
          signal.id === signalId
            ? {
                ...signal,
                isAcknowledged: true,
                acknowledgedAt: signal.acknowledgedAt ?? state.elapsedSeconds,
              }
            : signal
        ),
        toasts: state.toasts.map((toast) =>
          toast.signalId === signalId ? { ...toast, dismissed: true } : toast
        ),
      };
    }

      case "SELECT_OPTION": {
        const { option, signal } = action.payload;
        const selectedCases = getOrderedSelectedCases(state.selectedCaseIds);
      const caseData = selectedCases.find(c => c.id === signal.caseId);
      if (!caseData) return state;

      const beforeMetrics = state.metrics;
      const newMetrics = applyMetricEffects(beforeMetrics, normalizeEffects(option.effects), state.difficulty, {
        sourceType: "main_case",
        title: caseData.title,
        description: `${caseData.description} ${signal.fullSituation} ${caseData.trigger.text}`,
        zones: caseData.zones_affected,
        responsibility: signal.source,
      });
      const consequences = generateConsequences(buildMetricDeltaEntries(beforeMetrics, newMetrics));
      const timer = buildTimerSnapshot({
        deadline: signal.deadline,
        sourceType: "main_case",
        contentId: caseData.id,
        title: caseData.title,
        responsibility: signal.source || caseData.trigger.source || "Операционная зона",
        taskType: getTaskTypeLabel("main_case"),
        zoneLabel: formatZoneLabel(caseData.zones_affected, signal.source || "Операционная зона"),
        arrivedAtElapsed: signal.arrivedAt,
        resolvedAtElapsed: state.elapsedSeconds,
        resolvedSimTime: state.simDateTime,
        referenceElapsed: state.elapsedSeconds,
      });
      const timerPenalty = getTimerPenalty(timer);
      const resolvedScore = clamp(option.score - timerPenalty, 0, 5);

      const decision: DecisionRecord = {
        caseId: caseData.id,
        sourceType: "main_case",
        caseTitle: caseData.title,
        cycle: signal.cycle,
        optionLevel: option.level,
        optionText: option.text,
        score: resolvedScore,
        baseScore: option.score,
        timerPenalty,
        timer,
        responsibility: signal.source || caseData.trigger.source || "Операционная зона",
        zoneLabel: formatZoneLabel(caseData.zones_affected, signal.source || "Операционная зона"),
        taskType: getTaskTypeLabel("main_case"),
        rawEffects: { ...option.effects },
        consequences,
        competencyScores: { ...option.competency_scores },
        timestamp: new Date().toISOString(),
        simTime: state.simDateTime,
      };

      // Update competency totals
      const newTotals = applyCompetencyContribution(
        state.competencyTotals,
        option.competency_scores,
        caseData.id,
        "main_case",
        resolvedScore,
      );

      // Remove signal from active
      const updatedSignals = state.activeSignals.filter(s => s.id !== signal.id);
      const nextCycleIndex = resolveNextCaseCycleIndex(caseData, signal.cycle, option);
      const nextQueueItem =
        nextCycleIndex != null
          ? getMainQueuePointerForCaseCycle(selectedCases, signal.caseIndex, nextCycleIndex)
          : null;
      const nextQueue =
        nextQueueItem != null && !state.caseQueue.includes(nextQueueItem)
          ? [...state.caseQueue, nextQueueItem]
          : state.caseQueue;
      const shouldScheduleLinkedCycle = nextQueueItem != null && nextQueue.length > state.caseQueue.length && state.caseQueue.length === 0;
      const linkedCycleDelaySeconds = Math.max(0, Number(option.nextDelaySeconds || 0));

      return {
        ...state,
        metrics: newMetrics,
        zones: computeZones(newMetrics),
        decisions: [...state.decisions, decision],
        competencyTotals: newTotals,
        caseQueue: nextQueue,
        nextSignalAt: shouldScheduleLinkedCycle
          ? state.elapsedSeconds + linkedCycleDelaySeconds
          : state.nextSignalAt,
        activeSignals: updatedSignals,
        currentSignalId: null,
        actionPanelSource: state.actionPanelSource === "main_case" && state.actionPanelContentId === signal.id ? null : state.actionPanelSource,
        actionPanelContentId: state.actionPanelSource === "main_case" && state.actionPanelContentId === signal.id ? null : state.actionPanelContentId,
        toasts: state.toasts.filter((toast) => toast.signalId !== signal.id),
        showConsequence: true,
        lastConsequences: consequences,
        lastOptionText: option.text,
      };
    }

    case "DISMISS_CONSEQUENCE":
      return { ...state, showConsequence: false, lastConsequences: [], lastOptionText: "" };

    case "DISMISS_TOAST":
      return {
        ...state,
        toasts: state.toasts.map(t => t.id === action.payload ? { ...t, dismissed: true } : t),
      };

    case "CLEAR_ACTION_PANEL":
      stopCurrentAudio();
      return {
        ...state,
        actionPanelSource: null,
        actionPanelContentId: null,
      };

    case "EXPIRE_SIGNAL":
      return {
        ...state,
        activeSignals: state.activeSignals.map(s =>
          s.id === action.payload ? { ...s, isExpired: true } : s
        ),
      };

    case "TOGGLE_JOURNAL":
      return { ...state, journalOpen: !state.journalOpen };

    case "COMPLETE_SIMULATION": {
      stopCurrentAudio();
      const completedAtUnixMs = Date.now();
      const finalizedPauses = state.pauses.map((pause) =>
        pause.endedAt == null
          ? {
              ...pause,
              endedAt: state.elapsedSeconds,
              endedSimTime: state.simDateTime,
              endedAtUnixMs: completedAtUnixMs,
              durationSeconds: Math.max(1, Math.round((completedAtUnixMs - pause.startedAtUnixMs) / 1000)),
            }
          : pause
      );

      return {
        ...state,
        isRunning: false,
        isPaused: false,
        isCompleted: true,
        pauseStartedAt: null,
        pauses: finalizedPauses,
      };
    }

    case "RESET":
      return getInitialState();

    case "TICK_CHANNELS": {
      const nextEvent = getNextDueChannelEvent(state);
      if (!nextEvent) {
        return state;
      }

      const lastChannelArrival = getLastChannelArrivalSeconds(state);
      if (Number.isFinite(lastChannelArrival) && state.elapsedSeconds - lastChannelArrival < CHANNEL_SCHEDULE_MIN_GAP_SECONDS) {
        return state;
      }

      const nextEmailMeta = { ...state.emailSignalMeta };
      const nextMessengerMeta = { ...state.messengerSignalMeta };
      const nextVideoMeta = { ...state.videoSignalMeta };

      let newEmailIds: string[] = [];
      let newMsgIds: string[] = [];
      let newVideoIds: string[] = [];

      if (nextEvent.channelType === "email") {
        newEmailIds = [nextEvent.id];
        nextEmailMeta[nextEvent.id] = {
          arrivedAt: state.elapsedSeconds,
          deadline: null,
        };
        playChannelSound("email");
      } else if (nextEvent.channelType === "messenger") {
        const msgCase = MESSENGER_CASES.find((item) => item.id === nextEvent.id);
        newMsgIds = [nextEvent.id];
        nextMessengerMeta[nextEvent.id] = {
          arrivedAt: state.elapsedSeconds,
          deadline: msgCase
            ? buildDecisionDeadline(
                msgCase.timing,
                [msgCase.senderName, msgCase.message],
                state.simDateTime,
                state.elapsedSeconds,
                state.timeLimit
              )
            : null,
        };
        playChannelSound("messenger");
      } else {
        const videoCase = VIDEO_CASES.find((item) => item.id === nextEvent.id);
        newVideoIds = [nextEvent.id];
        nextVideoMeta[nextEvent.id] = {
          arrivedAt: state.elapsedSeconds,
          deadline: videoCase
            ? buildDecisionDeadline(
                videoCase.timing,
                [videoCase.title, videoCase.situation],
                state.simDateTime,
                state.elapsedSeconds,
                state.timeLimit
              )
            : null,
        };
        playChannelSound("video");
      }

      const emailToasts: ToastNotification[] = newEmailIds.map((emailId) => {
        const emailCase = EMAIL_CASES.find((item) => item.id === emailId);
        return {
          id: `toast-email-${emailId}-${state.elapsedSeconds}`,
          signalId: emailId,
          sourceType: "email",
          type: "email",
          title: `${getSignalTypeEmoji("email")} ${getSignalTypeLabel("email")}`,
          source: emailCase?.from || "Корпоративная почта",
          arrivedAt: state.elapsedSeconds,
          dismissed: false,
        };
      });

      const messengerToasts: ToastNotification[] = newMsgIds.map((msgId) => {
        const messengerCase = MESSENGER_CASES.find((item) => item.id === msgId);
        return {
          id: `toast-messenger-${msgId}-${state.elapsedSeconds}`,
          signalId: msgId,
          sourceType: "messenger",
          type: "message",
          title: `${getSignalTypeEmoji("message")} ${getSignalTypeLabel("message")}`,
          source: messengerCase?.senderName || "ТёркоГрамм",
          arrivedAt: state.elapsedSeconds,
          dismissed: false,
        };
      });

      const videoToasts: ToastNotification[] = newVideoIds.map((videoId) => {
        const videoCase = VIDEO_CASES.find((item) => item.id === videoId);
        return {
          id: `toast-video-${videoId}-${state.elapsedSeconds}`,
          signalId: videoId,
          sourceType: "video",
          type: "video",
          title: `${getSignalTypeEmoji("video")} ${getSignalTypeLabel("video")}`,
          source: videoCase?.sender || "Видеообращение",
          arrivedAt: state.elapsedSeconds,
          dismissed: false,
        };
      });

      return {
        ...state,
        arrivedEmailIds: [...state.arrivedEmailIds, ...newEmailIds],
        arrivedMessengerIds: [...state.arrivedMessengerIds, ...newMsgIds],
        arrivedVideoIds: [...state.arrivedVideoIds, ...newVideoIds],
        toasts: [...state.toasts, ...emailToasts, ...messengerToasts, ...videoToasts],
        emailSignalMeta: nextEmailMeta,
        messengerSignalMeta: nextMessengerMeta,
        videoSignalMeta: nextVideoMeta,
      };
    }

    case "OPEN_EMAIL":
      if (state.enabledChannels.audio) {
        const emailCase = EMAIL_CASES.find((item) => item.id === action.payload);
        if (emailCase?.audioUrl && !isCurrentAudioSource(emailCase.audioUrl)) {
          playAudioImmediate(emailCase.audioUrl, 0.95);
        }
      }
      return {
        ...state,
        openedEmailIds: state.openedEmailIds.includes(action.payload)
          ? state.openedEmailIds
          : [...state.openedEmailIds, action.payload],
        toasts: state.toasts.map((toast) =>
          toast.sourceType === "email" && toast.signalId === action.payload
            ? { ...toast, dismissed: true }
            : toast
        ),
        actionPanelSource: "email",
        actionPanelContentId: action.payload,
      };

    case "ANSWER_EMAIL": {
      const { emailId, option } = action.payload;
      if (state.answeredEmailIds.includes(emailId)) return state;
      const effects = normalizeEffects(option.effects);
      const emailCase = EMAIL_CASES.find((item) => item.id === emailId);
      const beforeMetrics = state.metrics;
      const newMetrics = applyMetricEffects(beforeMetrics, effects, state.difficulty, {
        sourceType: "email",
        title: emailCase?.subject || emailId,
        description: `${emailCase?.preview || ""} ${emailCase?.body || ""}`,
        zones: [],
        responsibility: emailCase?.department || emailCase?.from,
      });
      const consequences = generateConsequences(buildMetricDeltaEntries(beforeMetrics, newMetrics));
      const timer = null;
      const timerPenalty = 0;
      const resolvedScore = clamp(option.score - timerPenalty, 0, 5);
      const newTotals = applyCompetencyContribution(
        state.competencyTotals,
        option.competency_scores || {},
        emailId,
        "email",
        resolvedScore,
      );
      const decision: DecisionRecord = {
        caseId: emailId,
        sourceType: "email",
        caseTitle: `Письмо: ${emailCase?.subject || emailId}`,
        cycle: 1,
        optionLevel: option.level,
        optionText: option.text,
        score: resolvedScore,
        baseScore: option.score,
        timerPenalty,
        timer,
        responsibility: emailCase?.from || "Корпоративная почта",
        zoneLabel: emailCase?.department || "Корпоративная почта",
        taskType: getTaskTypeLabel("email"),
        rawEffects: effects,
        consequences,
        competencyScores: option.competency_scores || {},
        timestamp: new Date().toISOString(),
        simTime: state.simDateTime,
      };
      return {
        ...state,
        metrics: newMetrics,
        zones: computeZones(newMetrics),
        answeredEmailIds: [...state.answeredEmailIds, emailId],
        openedEmailIds: state.openedEmailIds.includes(emailId)
          ? state.openedEmailIds
          : [...state.openedEmailIds, emailId],
        toasts: state.toasts.filter((toast) => !(toast.sourceType === "email" && toast.signalId === emailId)),
        actionPanelSource: state.actionPanelSource === "email" && state.actionPanelContentId === emailId ? null : state.actionPanelSource,
        actionPanelContentId: state.actionPanelSource === "email" && state.actionPanelContentId === emailId ? null : state.actionPanelContentId,
        competencyTotals: newTotals,
        decisions: [...state.decisions, decision],
        showConsequence: true,
        lastConsequences: consequences,
        lastOptionText: option.text,
      };
    }

    case "OPEN_MESSENGER":
      if (state.enabledChannels.audio) {
        const messengerCase = MESSENGER_CASES.find((item) => item.id === action.payload);
        if (messengerCase?.audioUrl && !isCurrentAudioSource(messengerCase.audioUrl)) {
          playAudioImmediate(messengerCase.audioUrl, 0.95);
        }
      }
      return {
        ...state,
        openedMessengerIds: state.openedMessengerIds.includes(action.payload)
          ? state.openedMessengerIds
          : [...state.openedMessengerIds, action.payload],
        toasts: state.toasts.map((toast) =>
          toast.sourceType === "messenger" && toast.signalId === action.payload
            ? { ...toast, dismissed: true }
            : toast
        ),
        actionPanelSource: "messenger",
        actionPanelContentId: action.payload,
      };

    case "ANSWER_MESSENGER": {
      const { msgId, option } = action.payload;
      if (state.answeredMessengerIds.includes(msgId)) return state;
      const effects = normalizeEffects(option.effects);
      const mc = MESSENGER_CASES.find(m => m.id === msgId);
      const chatName = CHATS.find((chat) => chat.id === mc?.chatId)?.name || "Чат";
      const beforeMetrics = state.metrics;
      const newMetrics = applyMetricEffects(beforeMetrics, effects, state.difficulty, {
        sourceType: "messenger",
        title: mc?.senderName || msgId,
        description: mc?.message || "",
        zones: [],
        responsibility: `${mc?.senderRole || ""} ${chatName}`.trim(),
      });
      const consequences = generateConsequences(buildMetricDeltaEntries(beforeMetrics, newMetrics));
      const timer = buildTimerSnapshot({
        deadline: state.messengerSignalMeta[msgId]?.deadline,
        sourceType: "messenger",
        contentId: msgId,
        title: mc?.senderName || msgId,
        responsibility: mc?.senderRole || "ТёркоГрамм",
        taskType: getTaskTypeLabel("messenger"),
        zoneLabel: CHATS.find((chat) => chat.id === mc?.chatId)?.name || "Чат",
        arrivedAtElapsed: state.messengerSignalMeta[msgId]?.arrivedAt ?? state.elapsedSeconds,
        resolvedAtElapsed: state.elapsedSeconds,
        resolvedSimTime: state.simDateTime,
        referenceElapsed: state.elapsedSeconds,
      });
      const timerPenalty = getTimerPenalty(timer);
      const resolvedScore = clamp(option.score - timerPenalty, 0, 5);
      const newTotals = applyCompetencyContribution(
        state.competencyTotals,
        option.competency_scores || {},
        msgId,
        "messenger",
        resolvedScore,
      );
      const decision: DecisionRecord = {
        caseId: msgId,
        sourceType: "messenger",
        caseTitle: `ТёрКограмм: ${mc?.senderName || msgId}`,
        cycle: 1,
        optionLevel: option.level,
        optionText: option.text,
        score: resolvedScore,
        baseScore: option.score,
        timerPenalty,
        timer,
        responsibility: mc?.senderRole || "ТёркоГрамм",
        zoneLabel: mc?.chatId || "Чат",
        taskType: getTaskTypeLabel("messenger"),
        rawEffects: effects,
        consequences,
        competencyScores: option.competency_scores || {},
        timestamp: new Date().toISOString(),
        simTime: state.simDateTime,
      };
      return {
        ...state,
        metrics: newMetrics,
        zones: computeZones(newMetrics),
        answeredMessengerIds: [...state.answeredMessengerIds, msgId],
        openedMessengerIds: state.openedMessengerIds.includes(msgId)
          ? state.openedMessengerIds
          : [...state.openedMessengerIds, msgId],
        toasts: state.toasts.filter((toast) => !(toast.sourceType === "messenger" && toast.signalId === msgId)),
        actionPanelSource: state.actionPanelSource === "messenger" && state.actionPanelContentId === msgId ? null : state.actionPanelSource,
        actionPanelContentId: state.actionPanelSource === "messenger" && state.actionPanelContentId === msgId ? null : state.actionPanelContentId,
        competencyTotals: newTotals,
        decisions: [...state.decisions, decision],
        showConsequence: true,
        lastConsequences: consequences,
        lastOptionText: option.text,
      };
    }

    case "OPEN_VIDEO":
      stopCurrentAudio();
      stopLoopingAudio();
      return {
        ...state,
        openedVideoIds: state.openedVideoIds.includes(action.payload)
          ? state.openedVideoIds
          : [...state.openedVideoIds, action.payload],
        toasts: state.toasts.map((toast) =>
          toast.sourceType === "video" && toast.signalId === action.payload
            ? { ...toast, dismissed: true }
            : toast
        ),
        actionPanelSource: "video",
        actionPanelContentId: action.payload,
      };

    case "ANSWER_VIDEO": {
      const { videoId, option } = action.payload;
      if (state.answeredVideoIds.includes(videoId)) return state;
      const effects = normalizeEffects(option.effects);
      const vc = VIDEO_CASES.find(v => v.id === videoId);
      const beforeMetrics = state.metrics;
      const newMetrics = applyMetricEffects(beforeMetrics, effects, state.difficulty, {
        sourceType: "video",
        title: vc?.title || videoId,
        description: vc?.situation || "",
        zones: [],
        responsibility: `${vc?.sender || ""} ${vc?.role || ""}`.trim(),
      });
      const consequences = generateConsequences(buildMetricDeltaEntries(beforeMetrics, newMetrics));
      const timer = buildTimerSnapshot({
        deadline: state.videoSignalMeta[videoId]?.deadline,
        sourceType: "video",
        contentId: videoId,
        title: vc?.title || videoId,
        responsibility: vc?.sender || "Видео",
        taskType: getTaskTypeLabel("video"),
        zoneLabel: vc?.role || "Видеообращение",
        arrivedAtElapsed: state.videoSignalMeta[videoId]?.arrivedAt ?? state.elapsedSeconds,
        resolvedAtElapsed: state.elapsedSeconds,
        resolvedSimTime: state.simDateTime,
        referenceElapsed: state.elapsedSeconds,
      });
      const timerPenalty = getTimerPenalty(timer);
      const resolvedScore = clamp(option.score - timerPenalty, 0, 5);
      const newTotals = applyCompetencyContribution(
        state.competencyTotals,
        option.competency_scores || {},
        videoId,
        "video",
        resolvedScore,
      );
      const decision: DecisionRecord = {
        caseId: videoId,
        sourceType: "video",
        caseTitle: `Видео: ${vc?.title || videoId}`,
        cycle: 1,
        optionLevel: option.level,
        optionText: option.text,
        score: resolvedScore,
        baseScore: option.score,
        timerPenalty,
        timer,
        responsibility: vc?.sender || "Видео",
        zoneLabel: vc?.role || "Видеообращение",
        taskType: getTaskTypeLabel("video"),
        rawEffects: effects,
        consequences,
        competencyScores: option.competency_scores || {},
        timestamp: new Date().toISOString(),
        simTime: state.simDateTime,
      };
      return {
        ...state,
        metrics: newMetrics,
        zones: computeZones(newMetrics),
        answeredVideoIds: [...state.answeredVideoIds, videoId],
        openedVideoIds: state.openedVideoIds.includes(videoId)
          ? state.openedVideoIds
          : [...state.openedVideoIds, videoId],
        toasts: state.toasts.filter((toast) => !(toast.sourceType === "video" && toast.signalId === videoId)),
        actionPanelSource: state.actionPanelSource === "video" && state.actionPanelContentId === videoId ? null : state.actionPanelSource,
        actionPanelContentId: state.actionPanelSource === "video" && state.actionPanelContentId === videoId ? null : state.actionPanelContentId,
        competencyTotals: newTotals,
        decisions: [...state.decisions, decision],
        showConsequence: true,
        lastConsequences: consequences,
        lastOptionText: option.text,
      };
    }

    default:
      return state;
  }
}

interface SimContextType {
  state: SimulationState;
  dispatch: React.Dispatch<Action>;
  getCompetencyAverage: (compId: string) => number;
  getSelectedCases: () => SimCase[];
  mode: LiveSimulationRole;
  isReadOnly: boolean;
  liveSessionConfig: LiveSimulationConfig | null;
  livePresence: LiveSimulationPresence;
  liveStatus: LiveSimulationStatus | null;
  liveSocketConnected: boolean;
}

const SimulationContext = createContext<SimContextType | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [liveConfig, setLiveConfigState] = useState<LiveSimulationConfig | null>(() => getLiveSimulationConfig());
  const [liveRole, setLiveRoleState] = useState<LiveSimulationRole>(() => getLiveSimulationRole());
  const liveSessionId = liveConfig?.liveSessionId || null;
  const isReadOnly = liveRole === "assessor-monitor";
  const restoredDraft = readPersistedSimulationDraft<SimulationState>(liveRole, liveSessionId);
  const [state, rawDispatch] = useReducer(reducer, undefined, () => {
    return restoredDraft?.state || getInitialState();
  });
  const stateRef = useRef(state);
  const [monitorState, setMonitorState] = useState<SimulationState | null>(null);
  const [livePresence, setLivePresence] = useState<LiveSimulationPresence>({
    assessorConnected: false,
    studentConnected: false,
  });
  const [liveStatus, setLiveStatus] = useState<LiveSimulationStatus | null>(null);
  const [liveSocketConnected, setLiveSocketConnected] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const lastTickAtRef = useRef<number | null>(null);
  const tickAccumulatorRef = useRef(0);
  const liveSocketRef = useRef<ReturnType<typeof connectToLiveSimulationSession> | null>(null);
  const hydratedLiveSessionRef = useRef<string | null>(null);
  const sessionCreationInFlightRef = useRef(false);
  const answerSyncInFlightRef = useRef(false);
  const resultSyncInFlightRef = useRef(false);
  const persistedAnswerCountRef = useRef(0);
  const persistedMetricCountRef = useRef(0);
  const completedSessionKeyRef = useRef<string | null>(null);
  const resumedSessionStatusRef = useRef<number | null>(null);
  const emailReminderCountsRef = useRef<Record<string, number>>({});
  const messengerReminderCountsRef = useRef<Record<string, number>>({});
  const videoReminderCountsRef = useRef<Record<string, number>>({});
  const activeMonitorSessionIdRef = useRef<string | null>(liveSessionId);
  const effectiveState = isReadOnly && monitorState
    ? {
        ...monitorState,
        journalOpen: state.journalOpen,
      }
    : state;
  const initialDraftRef = useRef(restoredDraft);

  if (initialDraftRef.current) {
    persistedAnswerCountRef.current = initialDraftRef.current.persistedAnswerCount;
    persistedMetricCountRef.current = initialDraftRef.current.persistedMetricCount;
    completedSessionKeyRef.current = initialDraftRef.current.completedSessionKey;
    initialDraftRef.current = null;
  }

  useEffect(() => {
    const syncLiveClientState = () => {
      setLiveConfigState(getLiveSimulationConfig());
      setLiveRoleState(getLiveSimulationRole());
    };

    syncLiveClientState();
    window.addEventListener(LIVE_SIMULATION_STATE_EVENT, syncLiveClientState as EventListener);
    window.addEventListener("storage", syncLiveClientState);

    return () => {
      window.removeEventListener(LIVE_SIMULATION_STATE_EVENT, syncLiveClientState as EventListener);
      window.removeEventListener("storage", syncLiveClientState);
    };
  }, []);

  useEffect(() => {
    activeMonitorSessionIdRef.current = liveSessionId;
    if (isReadOnly) {
      setMonitorState(null);
    }
  }, [isReadOnly, liveSessionId]);

  const applyStudentLiveSession = useCallback((session: LiveSimulationSessionState<SimulationState>) => {
    setLivePresence(session.presence);
    setLiveStatus(session.status);

    if (session.snapshot?.state && !isPlaceholderLiveSnapshot(session.snapshot.state, session.status)) {
      const restoredDecisionCount = Array.isArray(session.snapshot.state.decisions)
        ? session.snapshot.state.decisions.length
        : 0;
      persistedAnswerCountRef.current = Math.max(persistedAnswerCountRef.current, restoredDecisionCount);
      persistedMetricCountRef.current = Math.max(persistedMetricCountRef.current, restoredDecisionCount);
      hydratedLiveSessionRef.current = session.config.liveSessionId;
      rawDispatch({ type: "RESTORE_STATE", payload: session.snapshot.state });
      return;
    }

    if (session.config.selectedCaseIds.length === 0) {
      return;
    }

    const currentState = stateRef.current;
    if (
      hydratedLiveSessionRef.current === session.config.liveSessionId &&
      (currentState.isRunning || currentState.isCompleted || currentState.decisions.length > 0)
    ) {
      return;
    }

    hydratedLiveSessionRef.current = session.config.liveSessionId;

    rawDispatch({
      type: "BOOTSTRAP_SIMULATION",
      payload: {
        participantName: session.config.participantName,
        assessorName: session.config.assessorName,
        difficulty: session.config.difficulty,
        selectedCaseIds: session.config.selectedCaseIds,
        manualSelection: session.config.manualSelection,
        repeatCases: session.config.repeatCases,
        timeLimit: session.config.timeLimit,
        isTestMode: session.config.isTestMode,
        speedMultiplier: session.config.speedMultiplier,
        enabledChannels: session.config.enabledChannels,
        selectedChannelItemIds: session.config.selectedChannelItemIds,
        startingMetrics: session.config.initialMetrics,
      },
    });
  }, []);

  const dispatch = useCallback<React.Dispatch<Action>>((action) => {
    if (isReadOnly && action.type !== "TOGGLE_JOURNAL") {
      return;
    }

    rawDispatch(action);
  }, [isReadOnly]);

  const applyMonitorSnapshot = useCallback((nextState: SimulationState | null | undefined) => {
    setMonitorState((current) => {
      if (!nextState) {
        return null;
      }

      if (
        current &&
        !nextState.isCompleted &&
        nextState.elapsedSeconds + 1 < current.elapsedSeconds
      ) {
        return current;
      }

      return nextState;
    });
  }, []);

  const flushPersistedDraft = useCallback((nextState?: SimulationState) => {
    const snapshot = nextState || stateRef.current;

    if (isReadOnly) {
      clearPersistedSimulationState();
      return;
    }

    if (!shouldPersistSimulationState(snapshot)) {
      clearPersistedSimulationState();
      return;
    }

    persistSimulationState(snapshot, liveRole, liveSessionId, {
      persistedAnswerCount: persistedAnswerCountRef.current,
      persistedMetricCount: persistedMetricCountRef.current,
      completedSessionKey: completedSessionKeyRef.current,
    });
  }, [isReadOnly, liveRole, liveSessionId]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    flushPersistedDraft(state);
  }, [flushPersistedDraft, state]);

  useEffect(() => {
    if (!liveConfig || (liveRole !== "student" && liveRole !== "assessor-monitor")) {
      setLiveSocketConnected(false);
      setLiveStatus(null);
      setLivePresence({ assessorConnected: false, studentConnected: false });
      if (isReadOnly) {
        setMonitorState(null);
      }
      return;
    }

    const controller = connectToLiveSimulationSession(
      liveConfig.liveSessionId,
      liveRole === "student" ? "student" : "assessor",
      {
        onOpen: () => setLiveSocketConnected(true),
        onClose: () => setLiveSocketConnected(false),
        onError: (message) => console.error("Live simulation socket error:", message),
        onHello: (session) => {
          if (session.config.liveSessionId !== activeMonitorSessionIdRef.current && liveRole === "assessor-monitor") {
            return;
          }
          setLivePresence(session.presence);
          setLiveStatus(session.status);

          if (liveRole === "assessor-monitor") {
            applyMonitorSnapshot(session.snapshot?.state || null);
            return;
          }
          applyStudentLiveSession(session);
        },
        onSnapshot: (snapshot) => {
          if (liveRole === "assessor-monitor" && liveConfig.liveSessionId === activeMonitorSessionIdRef.current) {
            applyMonitorSnapshot(snapshot?.state || null);
          }
        },
        onPresence: (presence) => setLivePresence(presence),
        onStatus: (status) => setLiveStatus(status),
        onReset: () => {
          setLiveStatus("waiting");
          videoReminderCountsRef.current = {};
          hydratedLiveSessionRef.current = null;
          if (liveRole === "assessor-monitor") {
            setMonitorState(null);
          }
        },
      },
    );

    liveSocketRef.current = controller;

    return () => {
      controller.close();
      liveSocketRef.current = null;
      setLiveSocketConnected(false);
    };
  }, [applyMonitorSnapshot, applyStudentLiveSession, isReadOnly, liveRole, liveSessionId]);

  useEffect(() => {
    if (!liveConfig || liveRole !== "student") {
      return;
    }

    let cancelled = false;
    let inFlight = false;
    let intervalId: number | null = null;

    const hydrateStudentSession = async () => {
      if (cancelled || inFlight || hydratedLiveSessionRef.current === liveConfig.liveSessionId) {
        return;
      }

      inFlight = true;
      try {
        const session = await joinRemoteLiveSimulation(liveConfig.accessCode);
        if (!cancelled) {
          applyStudentLiveSession(session);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to bootstrap student live session from join payload", error);
        }
      } finally {
        inFlight = false;
      }
    };

    const pendingSession = consumePendingLiveSimulationState<SimulationState>(liveConfig.liveSessionId);
    if (pendingSession) {
      applyStudentLiveSession(pendingSession);
    }

    hydrateStudentSession();
    intervalId = window.setInterval(() => {
      if (hydratedLiveSessionRef.current === liveConfig.liveSessionId || stateRef.current.isRunning || stateRef.current.isCompleted) {
        if (intervalId != null) {
          window.clearInterval(intervalId);
        }
        return;
      }

      hydrateStudentSession();
    }, 1200);

    return () => {
      cancelled = true;
      if (intervalId != null) {
        window.clearInterval(intervalId);
      }
    };
  }, [applyStudentLiveSession, liveConfig, liveRole]);

  useEffect(() => {
    if (!liveConfig || liveRole !== "student") {
      return;
    }

    let cancelled = false;
    let inFlight = false;

    const syncStudentState = async () => {
      if (inFlight) {
        return;
      }

      inFlight = true;
      const currentState = stateRef.current;
      const hasStartedLocally =
        currentState.isRunning ||
        currentState.isPaused ||
        currentState.isCompleted ||
        currentState.elapsedSeconds > 0 ||
        currentState.decisions.length > 0;

      if (!hasStartedLocally) {
        inFlight = false;
        return;
      }

      const nextStatus: LiveSimulationStatus = currentState.isCompleted ? "completed" : currentState.isRunning ? "running" : "waiting";

      try {
        const session = await syncRemoteStudentState(liveConfig.liveSessionId, liveConfig.accessCode, {
          snapshot: {
            liveSessionId: liveConfig.liveSessionId,
            updatedAt: Date.now(),
            state: currentState,
          },
          status: nextStatus,
        });

        if (!cancelled) {
          setLivePresence(session.presence);
          setLiveStatus(session.status);
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to sync student live session state", error);
        }
      } finally {
        inFlight = false;
      }
    };

    syncStudentState();
    const intervalId = window.setInterval(syncStudentState, 1500);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [liveConfig, liveRole]);

  useEffect(() => {
    if (!liveConfig || liveRole !== "assessor-monitor") {
      return;
    }

    let cancelled = false;

    const syncMonitorState = async () => {
      try {
        const session = await fetchRemoteLiveSimulation(liveConfig.liveSessionId, liveConfig.accessCode);
        if (cancelled) {
          return;
        }

        if (session.config.liveSessionId !== activeMonitorSessionIdRef.current) {
          return;
        }

        setLivePresence(session.presence);
        setLiveStatus(session.status);
        applyMonitorSnapshot(session.snapshot?.state || null);
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to reconcile assessor live session state", error);
        }
      }
    };

    syncMonitorState();
    const intervalId = window.setInterval(syncMonitorState, 1200);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [applyMonitorSnapshot, liveConfig, liveRole]);

  useEffect(() => {
    if (liveRole !== "assessor-monitor") {
      return;
    }

    const intervalId = window.setInterval(() => {
      setMonitorState((current) => {
        if (!current?.isRunning || current.isPaused || current.isCompleted) {
          return current;
        }

        return reducer(current, { type: "TICK" });
      });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [liveRole]);

  useEffect(() => {
    if (liveRole !== "student" || !liveConfig || !liveSocketRef.current) {
      return;
    }

    liveSocketRef.current.sendSnapshot({
      liveSessionId: liveConfig.liveSessionId,
      updatedAt: Date.now(),
      state,
    } satisfies LiveSimulationSnapshot<SimulationState>);
  }, [liveConfig, liveRole, state]);

  useEffect(() => {
    if (liveRole !== "student" || !liveSocketRef.current) {
      return;
    }

    const nextStatus: LiveSimulationStatus = state.isCompleted ? "completed" : state.isRunning ? "running" : "waiting";
    liveSocketRef.current.sendStatus(nextStatus);
  }, [liveRole, state.isCompleted, state.isRunning]);

  useEffect(() => {
    if (!state.sessionId) {
      persistedAnswerCountRef.current = 0;
      persistedMetricCountRef.current = 0;
      completedSessionKeyRef.current = null;
      resumedSessionStatusRef.current = null;
    }
  }, [state.sessionId]);

  useEffect(() => {
    if (state.isRunning && !state.isCompleted && !state.isPaused) {
      lastTickAtRef.current = performance.now();
      tickAccumulatorRef.current = 0;
      timerRef.current = setInterval(() => {
        const now = performance.now();
        const lastTickAt = lastTickAtRef.current ?? now;
        const realDeltaMs = Math.min(1000, Math.max(0, now - lastTickAt));
        lastTickAtRef.current = now;

        const speed = Math.max(1, Number(stateRef.current.speedMultiplier) || 1);
        tickAccumulatorRef.current += (realDeltaMs / 1000) * speed;

        const stepSeconds = Math.floor(tickAccumulatorRef.current);
        if (stepSeconds <= 0) {
          return;
        }

        tickAccumulatorRef.current -= stepSeconds;
        dispatch({ type: "TICK", payload: { stepSeconds } });
      }, 200);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
      lastTickAtRef.current = null;
      tickAccumulatorRef.current = 0;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      lastTickAtRef.current = null;
      tickAccumulatorRef.current = 0;
    };
  }, [dispatch, state.isRunning, state.isCompleted, state.isPaused]);

  useEffect(() => {
    if (!state.isRunning || state.isCompleted || state.sessionId || sessionCreationInFlightRef.current) {
      return;
    }

    sessionCreationInFlightRef.current = true;
    let isCancelled = false;

    (async () => {
      try {
        const session = await createPersistedSession({
          participantName: state.participantName || "Участник",
          assessorName: state.assessorName || "",
          difficulty: state.difficulty,
          selectedCaseIds: state.selectedCaseIds,
          enabledChannels: state.enabledChannels,
          manualSelection: state.manualSelection,
          timeLimit: state.timeLimit,
          isTestMode: state.isTestMode,
          speedMultiplier: state.speedMultiplier,
          technicalStatus: "in_progress",
          startedAt: new Date().toISOString(),
        });
        if (!isCancelled) {
          dispatch({ type: "SET_SESSION_ID", payload: session.id });
        }
      } catch (error) {
        console.error("Failed to create simulation session", error);
      } finally {
        sessionCreationInFlightRef.current = false;
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [
    state.assessorName,
    state.difficulty,
    state.enabledChannels,
    state.isCompleted,
    state.isRunning,
    state.isTestMode,
    state.manualSelection,
    state.participantName,
    state.selectedCaseIds,
    state.sessionId,
    state.speedMultiplier,
    state.timeLimit,
  ]);

  // Signal firing effect
  useEffect(() => {
    if (
      state.isRunning &&
      !state.isCompleted &&
      !state.isPaused &&
      state.elapsedSeconds >= state.nextSignalAt &&
      state.caseQueue.length > 0
    ) {
      dispatch({ type: "FIRE_SIGNAL" });
    }
  }, [state.elapsedSeconds, state.nextSignalAt, state.isRunning, state.isCompleted, state.isPaused, state.caseQueue.length]);

  useEffect(() => {
    if (shouldAutoCompleteSimulation(state)) {
      dispatch({ type: "COMPLETE_SIMULATION" });
    }
  }, [
    dispatch,
    state.activeSignals,
    state.arrivedEmailIds,
    state.arrivedMessengerIds,
    state.arrivedVideoIds,
    state.answeredEmailIds,
    state.answeredMessengerIds,
    state.answeredVideoIds,
    state.caseQueue.length,
    state.enabledChannels,
    state.isCompleted,
    state.isPaused,
    state.isRunning,
  ]);

  useEffect(() => {
    if (!state.sessionId || answerSyncInFlightRef.current || state.decisions.length <= persistedAnswerCountRef.current) {
      return;
    }

    const sessionId = state.sessionId;
    answerSyncInFlightRef.current = true;
    let isCancelled = false;

    (async () => {
      try {
        for (let index = persistedAnswerCountRef.current; index < state.decisions.length; index += 1) {
          const decision = state.decisions[index];
          const details: SessionAnswerDetails = {
            channelLabel: decision.taskType,
            responsibility: decision.responsibility,
            zoneLabel: decision.zoneLabel,
            timer: decision.timer,
            baseScore: decision.baseScore,
            timerPenalty: decision.timerPenalty,
            overdue: decision.timer?.wasOverdue || false,
          };
          await appendPersistedAnswer(sessionId, {
            sourceType: decision.sourceType,
            contentId: decision.caseId,
            caseTitle: decision.caseTitle,
            cycle: decision.cycle,
            optionLevel: decision.optionLevel,
            optionText: decision.optionText,
            score: decision.score,
            rawEffects: decision.rawEffects,
            competencyScores: decision.competencyScores,
            timestamp: decision.timestamp,
            simTime: decision.simTime,
            details,
          } satisfies SessionAnswerPayload);

          persistedAnswerCountRef.current = index + 1;
          flushPersistedDraft();
          if (isCancelled) {
            return;
          }
        }

        if (persistedMetricCountRef.current < state.decisions.length && state.decisions.length > 0) {
          const lastDecision = state.decisions[state.decisions.length - 1];
          await appendPersistedMetrics(
            sessionId,
            buildSessionMetricPayload(state.metrics, lastDecision.timestamp),
          );
          persistedMetricCountRef.current = state.decisions.length;
          flushPersistedDraft();
        }
      } catch (error) {
        console.error("Failed to sync session answers", error);
      } finally {
        answerSyncInFlightRef.current = false;
      }
    })();

    return () => {
      isCancelled = true;
    };
  }, [state.decisions, state.metrics, state.sessionId]);

  useEffect(() => {
    if (!state.sessionId || !state.isCompleted || resultSyncInFlightRef.current) {
      return;
    }

    const sessionId = state.sessionId;
    const completionKey = `${sessionId}:${state.decisions.length}:${state.timeRemaining}:${state.pauses.length}`;
    if (completedSessionKeyRef.current === completionKey) {
      return;
    }

    resultSyncInFlightRef.current = true;
    const resultPayload = buildSessionResultPayload(state);
    const totalPauseSeconds = state.pauses.reduce((sum, pause) => sum + Math.max(0, pause.durationSeconds || 0), 0);
    const violatesPauseLimits = state.pauses.length > MAX_PAUSE_COUNT || totalPauseSeconds > MAX_PAUSE_TOTAL_SECONDS;

    (async () => {
      try {
        await savePersistedResult(sessionId, resultPayload);
        await updatePersistedSession(sessionId, {
          technicalStatus: violatesPauseLimits ? "interrupted" : "completed",
          completedAt: new Date().toISOString(),
        });
        completedSessionKeyRef.current = completionKey;
        flushPersistedDraft();
      } catch (error) {
        console.error("Failed to sync simulation result", error);
      } finally {
        resultSyncInFlightRef.current = false;
      }
    })();
  }, [
    flushPersistedDraft,
    state.competencyTotals,
    state.decisions,
    state.isCompleted,
    state.metrics,
    state.pauses,
    state.sessionId,
    state.timeRemaining,
  ]);

  useEffect(() => {
    if (!state.sessionId || !state.isRunning || state.isCompleted || resumedSessionStatusRef.current === state.sessionId) {
      return;
    }

    resumedSessionStatusRef.current = state.sessionId;

    updatePersistedSession(state.sessionId, {
      technicalStatus: "in_progress",
      completedAt: null,
    }).catch((error) => {
      console.error("Failed to restore simulation session status", error);
    });
  }, [state.isCompleted, state.isRunning, state.sessionId]);

  useEffect(() => {
    if (!state.sessionId || !state.isRunning || state.isCompleted) {
      return;
    }

    const interruptSession = () => {
      if (state.isCompleted) {
        return;
      }

      updatePersistedSession(
        state.sessionId!,
        {
          technicalStatus: "interrupted",
          completedAt: new Date().toISOString(),
        },
        { keepalive: true },
      ).catch(() => undefined);
    };

    window.addEventListener("beforeunload", interruptSession);
    return () => {
      window.removeEventListener("beforeunload", interruptSession);
    };
  }, [state.isCompleted, state.isRunning, state.sessionId]);

  useEffect(() => {
    const queuedCases = effectiveState.caseQueue
      .slice(0, IMMEDIATE_PRELOAD_CASE_LIMIT)
      .map((pointer) => getQueuedCaseByState(effectiveState, pointer))
      .filter((item): item is SimCase => Boolean(item));
    const currentCase = effectiveState.currentSignalId
      ? effectiveState.activeSignals.find((signal) => signal.id === effectiveState.currentSignalId)
      : null;
    const currentCaseData = currentCase ? CASES_DATA.find((item) => item.id === currentCase.caseId) || null : null;
    const upcomingChannelEvents = getUpcomingChannelEvents(effectiveState, IMMEDIATE_PRELOAD_CHANNEL_LIMIT);

    preloadCaseMedia(currentCaseData);
    queuedCases.forEach(preloadCaseMedia);

    upcomingChannelEvents.forEach((item) => {
      if (item.channelType === "email") {
        preloadEmailMedia(EMAIL_CASES.find((entry) => entry.id === item.id) || null);
        return;
      }
      if (item.channelType === "messenger") {
        preloadMessengerMedia(MESSENGER_CASES.find((entry) => entry.id === item.id) || null);
        return;
      }
      preloadVideoMedia(VIDEO_CASES.find((entry) => entry.id === item.id) || null);
    });
  }, [
    effectiveState.activeSignals,
    effectiveState.caseQueue,
    effectiveState.currentSignalId,
    effectiveState.elapsedSeconds,
    effectiveState.enabledChannels,
    effectiveState.selectedCaseIds,
    effectiveState.selectedChannelItemIds,
    effectiveState.timeLimit,
  ]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const selectedCaseMedia = CASES_DATA.filter((caseItem) => effectiveState.selectedCaseIds.includes(caseItem.id));
      getSimulationContentSnapshot().assets.forEach((asset) => {
        if (asset.kind === "image") {
          queueMediaPreload(asset.publicUrl, "image");
        }
        if (asset.kind === "audio") {
          queueMediaPreload(asset.publicUrl, "audio");
        }
        if (asset.kind === "video") {
          queueMediaPreload(asset.publicUrl, "video");
        }
      });

      selectedCaseMedia.forEach(preloadCaseMedia);

      if (effectiveState.enabledChannels.email) {
        getSelectedChannelItems(effectiveState, "email", EMAIL_CASES).forEach(preloadEmailMedia);
      }

      if (effectiveState.enabledChannels.messenger) {
        getSelectedChannelItems(effectiveState, "messenger", MESSENGER_CASES).forEach(preloadMessengerMedia);
      }

      if (effectiveState.enabledChannels.video) {
        getSelectedChannelItems(effectiveState, "video", VIDEO_CASES).forEach(preloadVideoMedia);
      }
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [effectiveState.enabledChannels, effectiveState.selectedCaseIds, effectiveState.selectedChannelItemIds]);

  // Channel items delivery
  useEffect(() => {
    if (state.isRunning && !state.isCompleted && !state.isPaused) {
      dispatch({ type: "TICK_CHANNELS" });
    }
  }, [state.elapsedSeconds, state.isRunning, state.isCompleted, state.isPaused]);

  // Continuous ringtone only for main calls.
  useEffect(() => {
    if (!state.isRunning || state.isCompleted || state.isPaused) {
      stopLoopingAudio();
      return;
    }

    if (!state.enabledChannels.audio) {
      stopLoopingAudio();
      return;
    }

    const pendingCall = state.activeSignals.find((signal) => !signal.isExpired && !signal.isAcknowledged);
    if (pendingCall) {
      playChannelSound("call", "loop");
      return;
    }

    stopLoopingAudio();

    return () => {
      stopLoopingAudio();
    };
  }, [
    state.activeSignals,
    state.answeredVideoIds,
    state.arrivedVideoIds,
    state.enabledChannels.audio,
    state.isCompleted,
    state.isPaused,
    state.isRunning,
    state.openedVideoIds,
  ]);

  useEffect(() => {
    if (!state.isRunning || state.isCompleted || state.isPaused || !state.enabledChannels.audio || state.elapsedSeconds === 0) {
      return;
    }

    state.arrivedMessengerIds.forEach((id) => {
      if (state.openedMessengerIds.includes(id) || state.answeredMessengerIds.includes(id)) {
        delete messengerReminderCountsRef.current[id];
      }
    });
    state.arrivedEmailIds.forEach((id) => {
      if (state.openedEmailIds.includes(id) || state.answeredEmailIds.includes(id)) {
        delete emailReminderCountsRef.current[id];
      }
    });

    const dueMessengerReminder = state.arrivedMessengerIds.find((id) => {
      if (state.openedMessengerIds.includes(id) || state.answeredMessengerIds.includes(id)) {
        return false;
      }

      const meta = state.messengerSignalMeta[id];
      const caseData = MESSENGER_CASES.find((item) => item.id === id);
      const intervalSeconds = getNotificationIntervalSeconds("messenger", caseData?.timing?.reminderIntervalSeconds);
      if (!meta || intervalSeconds <= 0) {
        return false;
      }

      const elapsedSinceArrival = state.elapsedSeconds - meta.arrivedAt;
      const targetRepeatCount = Math.floor(elapsedSinceArrival / intervalSeconds);
      const playedRepeatCount = messengerReminderCountsRef.current[id] || 0;
      return targetRepeatCount > playedRepeatCount && playedRepeatCount < CHANNEL_REMINDER_MAX_COUNT;
    });

    if (dueMessengerReminder) {
      playChannelSound("messenger", "reminder");
      messengerReminderCountsRef.current[dueMessengerReminder] =
        (messengerReminderCountsRef.current[dueMessengerReminder] || 0) + 1;
      return;
    }

    const dueEmailReminder = state.arrivedEmailIds.find((id) => {
      if (state.openedEmailIds.includes(id) || state.answeredEmailIds.includes(id)) {
        return false;
      }

      const meta = state.emailSignalMeta[id];
      const caseData = EMAIL_CASES.find((item) => item.id === id);
      const intervalSeconds = getNotificationIntervalSeconds("email", caseData?.timing?.reminderIntervalSeconds);
      if (!meta || intervalSeconds <= 0) {
        return false;
      }

      const elapsedSinceArrival = state.elapsedSeconds - meta.arrivedAt;
      const targetRepeatCount = Math.floor(elapsedSinceArrival / intervalSeconds);
      const playedRepeatCount = emailReminderCountsRef.current[id] || 0;
      return targetRepeatCount > playedRepeatCount && playedRepeatCount < CHANNEL_REMINDER_MAX_COUNT;
    });

    if (dueEmailReminder) {
      playChannelSound("email", "reminder");
      emailReminderCountsRef.current[dueEmailReminder] =
        (emailReminderCountsRef.current[dueEmailReminder] || 0) + 1;
    }
  }, [
    state.answeredEmailIds,
    state.answeredMessengerIds,
    state.arrivedEmailIds,
    state.arrivedMessengerIds,
    state.elapsedSeconds,
    state.emailSignalMeta,
    state.enabledChannels.audio,
    state.isCompleted,
    state.isPaused,
    state.isRunning,
    state.messengerSignalMeta,
    state.openedEmailIds,
    state.openedMessengerIds,
  ]);

  useEffect(() => {
    if (!state.isRunning || state.isCompleted || state.isPaused || !state.enabledChannels.audio) {
      return;
    }

    const unopenedVideo = state.arrivedVideoIds.find((id) => {
      if (state.openedVideoIds.includes(id) || state.answeredVideoIds.includes(id)) {
        delete videoReminderCountsRef.current[id];
        return false;
      }

      const meta = state.videoSignalMeta[id];
      const caseData = VIDEO_CASES.find((item) => item.id === id);
      const intervalSeconds = Math.max(5, Math.round(caseData?.timing?.reminderIntervalSeconds ?? 45));
      if (!meta) {
        return false;
      }

      const elapsedSinceArrival = state.elapsedSeconds - meta.arrivedAt;
      if (elapsedSinceArrival <= 0) {
        return false;
      }

      const targetRepeatCount = Math.floor(elapsedSinceArrival / intervalSeconds);
      const playedRepeatCount = videoReminderCountsRef.current[id] || 0;
      return targetRepeatCount > playedRepeatCount && playedRepeatCount < VIDEO_REMINDER_MAX_COUNT;
    });

    if (!unopenedVideo) {
      return;
    }

    playChannelSound("video", "single");
    videoReminderCountsRef.current[unopenedVideo] = (videoReminderCountsRef.current[unopenedVideo] || 0) + 1;
  }, [
    state.answeredVideoIds,
    state.arrivedVideoIds,
    state.elapsedSeconds,
    state.enabledChannels.audio,
    state.isCompleted,
    state.isPaused,
    state.isRunning,
    state.openedVideoIds,
    state.videoSignalMeta,
  ]);

  const getSelectedCases = useCallback(() => {
    return CASES_DATA.filter((c) => effectiveState.selectedCaseIds.includes(c.id));
  }, [effectiveState.selectedCaseIds]);

  const adjustedSummary = useMemo(
    () => buildAdjustedSessionSummary(effectiveState),
    [effectiveState],
  );

  const getCompetencyAverage = useCallback(
    (compId: string) => {
      if (effectiveState.isCompleted) {
        return adjustedSummary.competencyAverages[compId] || 0;
      }

      const data = effectiveState.competencyTotals[compId];
      if (!data || data.count === 0) return 0;
      return Math.round((data.total / data.count) * 10) / 10;
    },
    [adjustedSummary.competencyAverages, effectiveState.competencyTotals, effectiveState.isCompleted]
  );

  return (
    <SimulationContext.Provider
      value={{
        state: effectiveState,
        dispatch,
        getCompetencyAverage,
        getSelectedCases,
        mode: liveRole,
        isReadOnly,
        liveSessionConfig: liveConfig,
        livePresence,
        liveStatus,
        liveSocketConnected,
      }}
    >
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulation() {
  const ctx = useContext(SimulationContext);
  if (!ctx) throw new Error("useSimulation must be used within SimulationProvider");
  return ctx;
}

export {
  COMPETENCIES,
  getChannelNotificationCounts,
  getSimulationProgressSummary,
  collectPendingTimers as getActiveTimerSnapshots,
  getSignalTypeEmoji,
  getSignalTypeLabel,
};
