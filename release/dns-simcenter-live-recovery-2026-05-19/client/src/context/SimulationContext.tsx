import { createContext, useContext, useReducer, useCallback, useRef, useEffect, useMemo, useState } from "react";
import { CASES_DATA, type SimCase, type CaseOption, type CycleSignal } from "../data/cases";
import { COMPETENCIES } from "../data/competencies";
import { generateConsequences, type ConsequenceExplanation, type MetricDeltaEntry } from "../data/consequences";
import { EMAIL_CASES } from "../data/email-cases";
import { CHATS, MESSENGER_CASES } from "../data/messenger-cases";
import { VIDEO_CASES } from "../data/video-cases";
import {
  playAudioFile,
  playAudioImmediate,
  playLoopingAudio,
  playTwoToneNotification,
  isCurrentAudioSource,
  resolveChannelSoundSource,
  stopCurrentAudio,
  stopLoopingAudio,
} from "../data/audio-map";
import { apiRequest } from "../lib/queryClient";
import { getSimulationContentSnapshot, getSimulationSettingsSnapshot } from "../lib/runtime-content";
import {
  extractScenarioDeadline,
  getSimTimeFromElapsed,
  type ScenarioDeadline,
} from "../lib/simulation-timing";
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

// Realistic store metrics
export interface RealisticMetrics {
  customersInStore: number;     // 0-50
  avgCheck: number;             // 3000-15000₽
  conversion: number;           // 20-80%
  nps: number;                  // 1-10
  pickupSpeed: number;          // 5-30 min
  warehouseLoad: number;        // 30-100%
  teamMorale: number;           // 1-10
  dailyRevenue: number;         // 300K-1200K₽
}

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
  deadline: ScenarioDeadline | null;
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
type EffectPayload = { queue: number; conversion: number; morale: number; revenue_impact: number; delivery_status: number };
type MetricKey = keyof RealisticMetrics;
type MetricApplicationContext = {
  sourceType: SessionSourceType;
  title: string;
  description: string;
  zones: string[];
  responsibility?: string;
};

const preloadedMediaUrls = new Set<string>();
const loadedMediaUrls = new Set<string>();
const preloadedMediaElements: Array<HTMLImageElement | HTMLAudioElement | HTMLVideoElement> = [];
const IMMEDIATE_PRELOAD_CASE_LIMIT = 2;
const IMMEDIATE_PRELOAD_CHANNEL_LIMIT = 3;

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

const RUNTIME_DRAFT_KEY = "rrs.runtime-draft";

interface PersistedSimulationDraft {
  version: 1;
  updatedAt: number;
  liveRole: LiveSimulationRole;
  liveSessionId: string | null;
  state: SimulationState;
  persistedAnswerCount: number;
  persistedMetricCount: number;
  completedSessionKey: string | null;
}

type Action =
  | { type: "SET_CONFIG"; payload: Partial<SimulationState> }
  | { type: "BOOTSTRAP_SIMULATION"; payload: Partial<SimulationState> }
  | { type: "RESTORE_STATE"; payload: SimulationState }
  | { type: "SET_SESSION_ID"; payload: number | null }
  | { type: "START_SIMULATION" }
  | { type: "TOGGLE_PAUSE" }
  | { type: "TICK" }
  | { type: "FIRE_SIGNAL" }
  | { type: "SELECT_SIGNAL"; payload: string }
  | { type: "SNOOZE_SIGNAL"; payload: string }
  | { type: "SELECT_OPTION"; payload: { option: CaseOption; signal: ActiveSignal } }
  | { type: "DISMISS_CONSEQUENCE" }
  | { type: "DISMISS_TOAST"; payload: string }
  | { type: "CLEAR_ACTION_PANEL" }
  | { type: "EXPIRE_SIGNAL"; payload: string }
  | { type: "TOGGLE_JOURNAL" }
  | { type: "COMPLETE_SIMULATION" }
  | { type: "RESET" }
  | { type: "OPEN_EMAIL"; payload: string }
  | { type: "ANSWER_EMAIL"; payload: { emailId: string; option: any } }
  | { type: "OPEN_MESSENGER"; payload: string }
  | { type: "ANSWER_MESSENGER"; payload: { msgId: string; option: any } }
  | { type: "OPEN_VIDEO"; payload: string }
  | { type: "ANSWER_VIDEO"; payload: { videoId: string; option: any } }
  | { type: "TICK_CHANNELS" }; // fires channel items based on elapsed time

function clamp(val: number, min: number, max: number) {
  return Math.max(min, Math.min(max, val));
}

function normalizeEffects(effects?: Partial<EffectPayload> | null): EffectPayload {
  return {
    queue: effects?.queue || 0,
    conversion: effects?.conversion || 0,
    morale: effects?.morale || 0,
    revenue_impact: effects?.revenue_impact || 0,
    delivery_status: effects?.delivery_status || 0,
  };
}

function queueMediaPreload(url: string | null | undefined, kind: "image" | "audio" | "video") {
  if (typeof window === "undefined" || !url || preloadedMediaUrls.has(url)) {
    return;
  }

  preloadedMediaUrls.add(url);

  if (kind === "image") {
    const image = new Image();
    image.decoding = "async";
    image.loading = "eager";
    image.onload = () => {
      const decodePromise = typeof image.decode === "function" ? image.decode() : Promise.resolve();
      decodePromise
        .catch(() => undefined)
        .finally(() => loadedMediaUrls.add(url));
    };
    image.onerror = () => {
      preloadedMediaUrls.delete(url);
    };
    image.src = url;
    preloadedMediaElements.push(image);
    return;
  }

  if (kind === "audio") {
    const audio = document.createElement("audio");
    audio.preload = "auto";
    audio.onloadeddata = () => loadedMediaUrls.add(url);
    audio.oncanplaythrough = () => loadedMediaUrls.add(url);
    audio.onerror = () => preloadedMediaUrls.delete(url);
    audio.src = url;
    audio.load();
    preloadedMediaElements.push(audio);
    return;
  }

  const video = document.createElement("video");
  video.preload = "auto";
  video.src = url;
  video.muted = true;
  video.playsInline = true;
  video.onloadeddata = () => loadedMediaUrls.add(url);
  video.oncanplay = () => loadedMediaUrls.add(url);
  video.onerror = () => preloadedMediaUrls.delete(url);
  video.load();
  preloadedMediaElements.push(video);
}

function normalizeContent(value: string | undefined) {
  return (value || "").toLowerCase();
}

function matchesAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function inferMetricWeights(context: MetricApplicationContext): Record<MetricKey, number> {
  const normalizedTitle = normalizeContent(context.title);
  const normalizedDescription = normalizeContent(context.description);
  const normalizedResponsibility = normalizeContent(context.responsibility);
  const textBlob = `${normalizedTitle} ${normalizedDescription} ${normalizedResponsibility}`.trim();
  const zones = new Set(context.zones);

  const hallRelated =
    zones.has("торговый_зал") ||
    matchesAny(textBlob, [/зал/, /клиент/, /витрин/, /продаж/, /конверс/, /выруч/, /аксессуар/]);
  const pickupRelated =
    zones.has("выдача") ||
    matchesAny(textBlob, [/выдач/, /очеред/, /самовывоз/, /заказ/, /рекламац/, /возврат/]);
  const warehouseRelated =
    zones.has("склад") ||
    matchesAny(textBlob, [/склад/, /поставк/, /отгруз/, /разгруз/, /приемк/, /товар/]);
  const teamRelated =
    matchesAny(textBlob, [/сотрудник/, /команд/, /обуч/, /стаж/, /конфликт/, /мотивац/, /смен/]);
  const managementRelated =
    zones.has("начальство") ||
    matchesAny(textBlob, [/директор/, /регион/, /управля/, /офис/, /проверк/, /отчет/]);
  const customerCareRelated =
    matchesAny(textBlob, [/жалоб/, /претенз/, /nps/, /сервис/, /клиент/]);
  const financeRelated =
    matchesAny(textBlob, [/выруч/, /план/, /чек/, /продаж/, /конверс/]);

  return {
    customersInStore: hallRelated ? 1 : pickupRelated ? 0.25 : 0,
    avgCheck: hallRelated || financeRelated ? 1 : 0,
    conversion: hallRelated ? 1 : financeRelated ? 0.45 : 0,
    nps: customerCareRelated || pickupRelated || hallRelated ? 1 : managementRelated ? 0.3 : 0,
    pickupSpeed: pickupRelated ? 1 : warehouseRelated ? 0.35 : 0,
    warehouseLoad: warehouseRelated ? 1 : pickupRelated ? 0.2 : 0,
    teamMorale: teamRelated ? 1 : managementRelated ? 0.7 : 0.15,
    dailyRevenue: hallRelated || financeRelated ? 1 : pickupRelated ? 0.25 : 0,
  };
}

function applyMetricEffects(
  metrics: RealisticMetrics,
  effects: EffectPayload,
  difficulty: SimulationState["difficulty"],
  context: MetricApplicationContext,
): RealisticMetrics {
  const diffMod = difficulty === "easy" ? 1.3 : difficulty === "hard" ? 0.7 : 1;
  const weights = inferMetricWeights(context);
  const nextCustomers = Math.round(
    metrics.customersInStore +
    (-effects.queue * 0.4 + effects.conversion * 0.2) * weights.customersInStore * diffMod
  );
  const nextAvgCheck = Math.round(
    metrics.avgCheck + effects.conversion * 80 * weights.avgCheck * diffMod + effects.revenue_impact * 12 * weights.avgCheck
  );
  const nextConversion = Math.round(
    metrics.conversion + effects.conversion * weights.conversion * diffMod - effects.queue * 0.15 * weights.conversion
  );
  const nextNps = Math.round(
    (metrics.nps + effects.delivery_status * 0.3 * weights.nps + effects.morale * 0.02 * weights.nps) * 10
  ) / 10;
  const nextPickupSpeed = Math.round(
    metrics.pickupSpeed + effects.queue * -0.35 * weights.pickupSpeed + effects.delivery_status * -0.12 * weights.pickupSpeed
  );
  const nextWarehouseLoad = Math.round(
    metrics.warehouseLoad + effects.delivery_status * -3 * weights.warehouseLoad + effects.queue * 0.2 * weights.warehouseLoad
  );
  const nextTeamMorale = Math.round(
    (metrics.teamMorale + effects.morale / 10 * weights.teamMorale + effects.queue * -0.01 * weights.teamMorale) * 10
  ) / 10;
  const nextDailyRevenue = Math.round(
    metrics.dailyRevenue +
    (effects.revenue_impact * 45 + effects.conversion * 10) * weights.dailyRevenue * diffMod
  );

  return {
    customersInStore: clamp(nextCustomers, 2, 60),
    avgCheck: clamp(nextAvgCheck, 3000, 20000),
    conversion: clamp(nextConversion, 20, 85),
    nps: clamp(nextNps, 1, 10),
    pickupSpeed: clamp(nextPickupSpeed, 5, 45),
    warehouseLoad: clamp(nextWarehouseLoad, 15, 100),
    teamMorale: clamp(nextTeamMorale, 1, 10),
    dailyRevenue: clamp(nextDailyRevenue, 600, 3500),
  };
}

function shouldPersistSimulationState(state: SimulationState) {
  return state.isRunning || state.isPaused || state.isCompleted || state.sessionId != null || state.decisions.length > 0;
}

function clearPersistedSimulationState() {
  if (typeof window === "undefined") {
    return;
  }

  window.sessionStorage.removeItem(RUNTIME_DRAFT_KEY);
}

function persistSimulationState(
  state: SimulationState,
  liveRole: LiveSimulationRole,
  liveSessionId: string | null,
  syncMeta: {
    persistedAnswerCount: number;
    persistedMetricCount: number;
    completedSessionKey: string | null;
  },
) {
  if (typeof window === "undefined") {
    return;
  }

  const payload: PersistedSimulationDraft = {
    version: 1,
    updatedAt: Date.now(),
    liveRole,
    liveSessionId,
    state,
    persistedAnswerCount: syncMeta.persistedAnswerCount,
    persistedMetricCount: syncMeta.persistedMetricCount,
    completedSessionKey: syncMeta.completedSessionKey,
  };

  window.sessionStorage.setItem(RUNTIME_DRAFT_KEY, JSON.stringify(payload));
}

function readPersistedSimulationDraft(liveRole: LiveSimulationRole, liveSessionId: string | null): PersistedSimulationDraft | null {
  if (typeof window === "undefined" || liveRole === "assessor-monitor") {
    return null;
  }

  const raw = window.sessionStorage.getItem(RUNTIME_DRAFT_KEY);
  if (!raw) {
    return null;
  }

  try {
    const payload = JSON.parse(raw) as PersistedSimulationDraft;
    if (payload.version !== 1 || payload.liveRole !== liveRole) {
      return null;
    }

    if ((payload.liveSessionId || null) !== (liveSessionId || null)) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function midpointBetween(min: number, max: number) {
  return Math.round((Math.min(min, max) + Math.max(min, max)) / 2);
}

// Shuffle array maintaining original indices for scoring
function shuffleOptions<T extends { level: number }>(options: T[]): T[] {
  const arr = [...options];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getNextSignalIntervalSeconds(_speedMultiplier: number): number {
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const rawMinSeconds = Number(settings?.signalIntervalMinSeconds ?? 120);
  const rawMaxSeconds = Number(settings?.signalIntervalMaxSeconds ?? 180);
  return Math.max(30, midpointBetween(rawMinSeconds, rawMaxSeconds));
}

function getMainSignalEndBufferSeconds(totalDurationSeconds: number) {
  return clamp(Math.round(totalDurationSeconds * 0.08), 120, 240);
}

function getEvenMainSignalIntervalSeconds(
  totalDurationSeconds: number,
  elapsedSeconds: number,
  remainingSignalCount: number,
) {
  const endBufferSeconds = getMainSignalEndBufferSeconds(totalDurationSeconds);
  const remainingWindowSeconds = Math.max(60, totalDurationSeconds - elapsedSeconds - endBufferSeconds);
  return Math.max(45, Math.round(remainingWindowSeconds / Math.max(1, remainingSignalCount + 1)));
}

function getFirstSignalDelaySeconds(
  _speedMultiplier: number,
  totalDurationSeconds: number,
  signalCount: number,
): number {
  const settings = getSimulationSettingsSnapshot<SimulationRuntimeSettings>();
  const rawMinSeconds = Number(settings?.firstSignalMinSeconds ?? 15);
  const rawMaxSeconds = Number(settings?.firstSignalMaxSeconds ?? 30);
  const configuredDelaySeconds = Math.max(20, midpointBetween(rawMinSeconds, rawMaxSeconds));
  const evenIntervalSeconds = getEvenMainSignalIntervalSeconds(totalDurationSeconds, 0, signalCount);
  return clamp(Math.min(Math.max(configuredDelaySeconds, 45), evenIntervalSeconds), 20, 120);
}

function getCaseScheduledDelaySeconds(
  _speedMultiplier: number,
  totalDurationSeconds: number,
  elapsedSeconds: number,
  remainingSignalCount: number,
  timing?: { minIntervalSeconds?: number | null; maxIntervalSeconds?: number | null } | null,
) {
  const evenIntervalSeconds = getEvenMainSignalIntervalSeconds(
    totalDurationSeconds,
    elapsedSeconds,
    remainingSignalCount,
  );

  if (timing?.minIntervalSeconds != null && timing?.maxIntervalSeconds != null) {
    const configuredSeconds = midpointBetween(timing.minIntervalSeconds, timing.maxIntervalSeconds);
    return clamp(
      configuredSeconds,
      Math.max(30, Math.round(evenIntervalSeconds * 0.75)),
      Math.max(60, Math.round(evenIntervalSeconds * 1.25)),
    );
  }

  return evenIntervalSeconds;
}

type ChannelScheduleType = "email" | "messenger" | "video";

type SchedulableChannelItem = {
  id: string;
  arrivalMinute: number;
  sortOrder: number;
  timing?: { arrivalMinute?: number | null } | null;
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
const VIDEO_REMINDER_INTERVAL_SECONDS = 45;

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

function getLastChannelArrivalSeconds(state: SimulationState) {
  return Math.max(
    -Infinity,
    ...Object.values(state.emailSignalMeta).map((item) => item.arrivedAt),
    ...Object.values(state.messengerSignalMeta).map((item) => item.arrivedAt),
    ...Object.values(state.videoSignalMeta).map((item) => item.arrivedAt),
  );
}

function getNextPendingChannelEvent(state: SimulationState) {
  return getUpcomingChannelEvents(state, 1)[0] || null;
}

function getUpcomingChannelEvents(state: SimulationState, limit = Number.POSITIVE_INFINITY) {
  const totalDurationSeconds = state.timeLimit * 60;
  const candidates: ScheduledChannelCandidate[] = [];

  if (state.enabledChannels.email) {
    const orderedEmails = sortChannelItemsByConfiguredOrder(EMAIL_CASES);
    orderedEmails.forEach((item, index) => {
      if (!state.arrivedEmailIds.includes(item.id)) {
        candidates.push({
          channelType: "email",
          id: item.id,
          scheduledAt: getScheduledChannelArrivalSeconds(totalDurationSeconds, "email", index, orderedEmails.length),
        });
      }
    });
  }

  if (state.enabledChannels.messenger) {
    const orderedMessages = sortChannelItemsByConfiguredOrder(MESSENGER_CASES);
    orderedMessages.forEach((item, index) => {
      if (!state.arrivedMessengerIds.includes(item.id)) {
        candidates.push({
          channelType: "messenger",
          id: item.id,
          scheduledAt: getScheduledChannelArrivalSeconds(totalDurationSeconds, "messenger", index, orderedMessages.length),
        });
      }
    });
  }

  if (state.enabledChannels.video) {
    const orderedVideos = sortChannelItemsByConfiguredOrder(VIDEO_CASES);
    orderedVideos.forEach((item, index) => {
      if (!state.arrivedVideoIds.includes(item.id)) {
        candidates.push({
          channelType: "video",
          id: item.id,
          scheduledAt: getScheduledChannelArrivalSeconds(totalDurationSeconds, "video", index, orderedVideos.length),
        });
      }
    });
  }

  const ordered = candidates
    .sort((left, right) => left.scheduledAt - right.scheduledAt || left.id.localeCompare(right.id));

  return Number.isFinite(limit) ? ordered.slice(0, limit) : ordered;
}

function getNextDueChannelEvent(state: SimulationState) {
  return getUpcomingChannelEvents(state, Number.POSITIVE_INFINITY).find((item) => item.scheduledAt <= state.elapsedSeconds) || null;
}

function getQueuedCaseByState(state: SimulationState, pointer: number) {
  return getQueuedCaseByPointer(pointer, getOrderedSelectedCases(state.selectedCaseIds));
}

function preloadCaseMedia(caseItem: SimCase | null | undefined) {
  if (!caseItem) {
    return;
  }

  queueMediaPreload(caseItem.imageUrl, "image");
  queueMediaPreload(caseItem.audioUrl, "audio");
}

function preloadEmailMedia(emailCase: (typeof EMAIL_CASES)[number] | null | undefined) {
  if (!emailCase) {
    return;
  }

  queueMediaPreload(emailCase.imageUrl, "image");
  queueMediaPreload(emailCase.audioUrl, "audio");
}

function preloadMessengerMedia(messengerCase: (typeof MESSENGER_CASES)[number] | null | undefined) {
  if (!messengerCase) {
    return;
  }

  queueMediaPreload(messengerCase.imageUrl, "image");
  queueMediaPreload(messengerCase.audioUrl, "audio");
}

function preloadVideoMedia(videoCase: (typeof VIDEO_CASES)[number] | null | undefined) {
  if (!videoCase) {
    return;
  }

  queueMediaPreload(videoCase.imageUrl, "image");
  queueMediaPreload(videoCase.audioUrl, "audio");
  queueMediaPreload(videoCase.videoUrl, "video");
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
    preloadedMediaCount: loadedMediaUrls.size,
  };
}

function getSimulationTickStep(speedMultiplier: number) {
  return Math.max(1, Math.round(speedMultiplier || 1));
}

function getSignalTypeEmoji(type: string): string {
  switch (type) {
    case "call": return "📞";
    case "email": return "📧";
    case "message": return "💬";
    case "video": return "🎥";
    case "visitor": return "👤";
    case "zone_signal": return "⚠️";
    default: return "📋";
  }
}

function getSignalTypeLabel(type: string): string {
  switch (type) {
    case "call": return "Входящий звонок";
    case "email": return "Новое письмо";
    case "message": return "Сообщение";
    case "video": return "Видеообращение";
    case "visitor": return "Личное обращение";
    case "zone_signal": return "Сигнал зоны";
    default: return "Уведомление";
  }
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

function getNotificationIntervalSeconds(channel: "email" | "messenger", reminderIntervalSeconds?: number | null) {
  if (reminderIntervalSeconds != null && reminderIntervalSeconds > 0) {
    if (channel === "email") {
      return reminderIntervalSeconds >= 120 ? reminderIntervalSeconds : 240;
    }

    return reminderIntervalSeconds >= 90 ? reminderIntervalSeconds : 90;
  }

  return channel === "email" ? 240 : 90;
}

function getMainSignalReminderSeconds(signal: ActiveSignal) {
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

function getTimerPenalty(timer: TimerSnapshot | null) {
  if (!timer?.wasOverdue) {
    return 0;
  }

  return Math.min(2, Math.max(1, Math.ceil(timer.overdueSeconds / 120)));
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
    { key: "customersInStore", metric: "Покупатели в зале", unit: "count", betterWhen: "higher", before: before.customersInStore, after: after.customersInStore },
    { key: "avgCheck", metric: "Средний чек", unit: "rub", betterWhen: "higher", before: before.avgCheck, after: after.avgCheck },
    { key: "conversion", metric: "Конверсия", unit: "percent", betterWhen: "higher", before: before.conversion, after: after.conversion },
    { key: "nps", metric: "NPS клиентов", unit: "score", betterWhen: "higher", before: before.nps, after: after.nps },
    { key: "pickupSpeed", metric: "Скорость выдачи", unit: "minutes", betterWhen: "lower", before: before.pickupSpeed, after: after.pickupSpeed },
    { key: "warehouseLoad", metric: "Загрузка склада", unit: "percent", betterWhen: "lower", before: before.warehouseLoad, after: after.warehouseLoad },
    { key: "teamMorale", metric: "Настроение команды", unit: "score", betterWhen: "higher", before: before.teamMorale, after: after.teamMorale },
    { key: "dailyRevenue", metric: "Выручка за день", unit: "kRub", betterWhen: "higher", before: before.dailyRevenue, after: after.dailyRevenue },
  ];

  return rows
    .map((row) => ({
      ...row,
      delta: row.unit === "score"
        ? Math.round((row.after - row.before) * 10) / 10
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
  const bossHealthScore = (metrics.teamMorale * 0.55) + (metrics.nps * 0.45);
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
  nps: 6.6,
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
    nps: clamp(Math.round(Number(metrics?.nps ?? defaultStartingMetrics.nps) * 10) / 10, 1, 10),
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
  return selectedCases.map((_, index) => index * 3);
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
    (state.enabledChannels.email && EMAIL_CASES.some((item) => !state.arrivedEmailIds.includes(item.id))) ||
    (state.enabledChannels.messenger && MESSENGER_CASES.some((item) => !state.arrivedMessengerIds.includes(item.id))) ||
    (state.enabledChannels.video && VIDEO_CASES.some((item) => !state.arrivedVideoIds.includes(item.id)))
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

  const competencyAverages = Object.fromEntries(
    Object.entries(buildCompetencyAverageMap(state.competencyTotals)).map(([competencyId, value]) => ([
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

  state.arrivedEmailIds
    .filter((id) => !state.answeredEmailIds.includes(id))
    .forEach((emailId) => {
      const emailCase = EMAIL_CASES.find((item) => item.id === emailId);
      const meta = state.emailSignalMeta[emailId];
      const timer = buildTimerSnapshot({
        deadline: meta?.deadline,
        sourceType: "email",
        contentId: emailId,
        title: emailCase?.subject || emailId,
        responsibility: emailCase?.from || "Корпоративная почта",
        taskType: "Почта",
        zoneLabel: emailCase?.department || "Корпоративная почта",
        arrivedAtElapsed: meta?.arrivedAt ?? state.elapsedSeconds,
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
  const caseIndex = Math.floor(queuePointer / 3);
  return selectedCases[caseIndex] || null;
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
        playLoopingAudio(soundSrc, 0.6);
      } else {
        playAudioFile(soundSrc, 0.6);
      }
      break;
    case "messenger":
      if (mode === "reminder") {
        playTwoToneNotification(soundSrc, 0.55);
      } else {
        playAudioFile(soundSrc, 0.55);
      }
      break;
    case "video":
      if (mode === "loop") {
        playLoopingAudio(soundSrc, 0.65);
      } else {
        playAudioFile(soundSrc, 0.65);
      }
      break;
    case "email":
      playAudioFile(soundSrc, 0.4);
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
          nextSignalAt: getFirstSignalDelaySeconds(state.speedMultiplier, state.timeLimit * 60, queue.length),
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

        return {
          ...state,
          isPaused: false,
          pauseStartedAt: null,
          pauses: resumedPauses,
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
      const tickStep = getSimulationTickStep(state.speedMultiplier);
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

      return {
        ...state,
        timeRemaining: newRemaining,
        elapsedSeconds: newElapsed,
        simDateTime: newSimTime,
      };
    }

    case "FIRE_SIGNAL": {
      if (state.caseQueue.length === 0) {
        return state;
      }

      const [nextQueueItem, ...restQueue] = state.caseQueue;
      const selectedCases = getOrderedSelectedCases(state.selectedCaseIds);
      const caseIndex = Math.floor(nextQueueItem / 3);
      const cycleIndex = nextQueueItem % 3;
      const caseData = selectedCases[caseIndex];

      if (!caseData || !caseData.cycles[cycleIndex]) {
        return {
          ...state,
          caseQueue: restQueue,
          nextSignalAt: restQueue.length > 0
            ? state.elapsedSeconds + getNextSignalIntervalSeconds(state.speedMultiplier)
            : state.elapsedSeconds,
        };
      }

      const cycle = caseData.cycles[cycleIndex];
      const signalId = `${caseData.id}-c${cycleIndex + 1}-${Date.now()}`;
      const signalType = cycle.signal.type;
      const narrationText = buildSignalNarration(
        caseData.title,
        caseData.trigger.source,
        cycle.situation,
        cycle.signal.content
      );
      const deadline = extractScenarioDeadline(
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
        title: caseData.title,
        source: caseData.trigger.source,
        preview: cycle.signal.content.slice(0, 100) + (cycle.signal.content.length > 100 ? "..." : ""),
        fullSituation: cycle.situation,
        options: shuffleOptions(cycle.options), // randomize order so answer isn't predictable
        arrivedAt: state.elapsedSeconds,
        isExpired: false,
        isActive: false,
        isAcknowledged: false,
        acknowledgedAt: null,
        narrationText,
        audioUrl: caseData.audioUrl,
        deadline,
      };

      const newToast: ToastNotification = {
        id: `toast-${signalId}`,
        signalId,
        sourceType: "main_case",
        type: signalType,
        title: `${getSignalTypeEmoji(signalType)} ${getSignalTypeLabel(signalType)}`,
        source: caseData.trigger.source,
        arrivedAt: state.elapsedSeconds,
        dismissed: false,
      };

      if (state.enabledChannels.audio) {
        playChannelSound(getSignalNotificationChannel(signalType));
      }

      // Update zones for affected areas
      const nextQueuedCase = restQueue.length > 0 ? getQueuedCaseByPointer(restQueue[0], selectedCases) : null;
      return {
        ...state,
        caseQueue: restQueue,
        nextSignalAt: restQueue.length > 0
          ? state.elapsedSeconds + getCaseScheduledDelaySeconds(
              state.speedMultiplier,
              state.timeLimit * 60,
              state.elapsedSeconds,
              restQueue.length,
              nextQueuedCase?.timing,
            )
          : state.elapsedSeconds,
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
        playAudioImmediate(selectedSignal.audioUrl, 0.9);
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
      const nextQueueItem =
        state.repeatCases && signal.cycle < caseData.cycles.length
          ? signal.caseIndex * 3 + signal.cycle
          : null;
      const nextQueue =
        nextQueueItem != null && !state.caseQueue.includes(nextQueueItem)
          ? [...state.caseQueue, nextQueueItem]
          : state.caseQueue;

      return {
        ...state,
        metrics: newMetrics,
        zones: computeZones(newMetrics),
        decisions: [...state.decisions, decision],
        competencyTotals: newTotals,
        caseQueue: nextQueue,
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
        const emailCase = EMAIL_CASES.find((item) => item.id === nextEvent.id);
        newEmailIds = [nextEvent.id];
        nextEmailMeta[nextEvent.id] = {
          arrivedAt: state.elapsedSeconds,
          deadline: emailCase
            ? extractScenarioDeadline(
                [emailCase.subject, emailCase.preview, emailCase.body],
                state.simDateTime,
                state.elapsedSeconds,
                state.timeLimit
              )
            : null,
        };
        playChannelSound("email");
      } else if (nextEvent.channelType === "messenger") {
        const msgCase = MESSENGER_CASES.find((item) => item.id === nextEvent.id);
        newMsgIds = [nextEvent.id];
        nextMessengerMeta[nextEvent.id] = {
          arrivedAt: state.elapsedSeconds,
          deadline: msgCase
            ? extractScenarioDeadline(
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
            ? extractScenarioDeadline(
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
          playAudioImmediate(emailCase.audioUrl, 0.85);
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
      const timer = buildTimerSnapshot({
        deadline: state.emailSignalMeta[emailId]?.deadline,
        sourceType: "email",
        contentId: emailId,
        title: emailCase?.subject || emailId,
        responsibility: emailCase?.from || "Корпоративная почта",
        taskType: getTaskTypeLabel("email"),
        zoneLabel: emailCase?.department || "Корпоративная почта",
        arrivedAtElapsed: state.emailSignalMeta[emailId]?.arrivedAt ?? state.elapsedSeconds,
        resolvedAtElapsed: state.elapsedSeconds,
        resolvedSimTime: state.simDateTime,
        referenceElapsed: state.elapsedSeconds,
      });
      const timerPenalty = getTimerPenalty(timer);
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
          playAudioImmediate(messengerCase.audioUrl, 0.85);
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
  const restoredDraft = readPersistedSimulationDraft(liveRole, liveSessionId);
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
            setMonitorState(session.snapshot?.state || null);
            return;
          }
          applyStudentLiveSession(session);
        },
        onSnapshot: (snapshot) => {
          if (liveRole === "assessor-monitor" && liveConfig.liveSessionId === activeMonitorSessionIdRef.current) {
            setMonitorState(snapshot?.state || null);
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
  }, [applyStudentLiveSession, isReadOnly, liveRole, liveSessionId]);

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
        setMonitorState(session.snapshot?.state || null);
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
  }, [liveConfig, liveRole]);

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
      timerRef.current = setInterval(() => {
        dispatch({ type: "TICK" });
      }, 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [state.isRunning, state.isCompleted, state.isPaused]);

  useEffect(() => {
    if (!state.isRunning || state.isCompleted || state.sessionId || sessionCreationInFlightRef.current) {
      return;
    }

    sessionCreationInFlightRef.current = true;
    let isCancelled = false;

    (async () => {
      try {
        const response = await apiRequest("POST", "/api/sessions", {
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
        const session = await response.json();

        if (!isCancelled) {
          dispatch({ type: "SET_SESSION_ID", payload: Number(session.id) });
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
          await apiRequest("POST", `/api/sessions/${state.sessionId}/answers`, {
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
          await apiRequest(
            "POST",
            `/api/sessions/${state.sessionId}/metrics`,
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

    const completionKey = `${state.sessionId}:${state.decisions.length}:${state.timeRemaining}:${state.pauses.length}`;
    if (completedSessionKeyRef.current === completionKey) {
      return;
    }

    resultSyncInFlightRef.current = true;
    const resultPayload = buildSessionResultPayload(state);

    (async () => {
      try {
        await apiRequest("PUT", `/api/sessions/${state.sessionId}/result`, resultPayload);
        await apiRequest("PATCH", `/api/sessions/${state.sessionId}`, {
          technicalStatus: "completed",
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

    apiRequest("PATCH", `/api/sessions/${state.sessionId}`, {
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

      fetch(`/api/sessions/${state.sessionId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          technicalStatus: "interrupted",
          completedAt: new Date().toISOString(),
        }),
        keepalive: true,
      }).catch(() => undefined);
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
        EMAIL_CASES.forEach(preloadEmailMedia);
      }

      if (effectiveState.enabledChannels.messenger) {
        MESSENGER_CASES.forEach(preloadMessengerMedia);
      }

      if (effectiveState.enabledChannels.video) {
        VIDEO_CASES.forEach(preloadVideoMedia);
      }
    }, 2200);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [effectiveState.enabledChannels, effectiveState.selectedCaseIds]);

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
      if (!meta) {
        return false;
      }

      const elapsedSinceArrival = state.elapsedSeconds - meta.arrivedAt;
      if (elapsedSinceArrival <= 0) {
        return false;
      }

      const targetRepeatCount = Math.floor(elapsedSinceArrival / VIDEO_REMINDER_INTERVAL_SECONDS);
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
  collectPendingTimers as getActiveTimerSnapshots,
  getSignalTypeEmoji,
  getSignalTypeLabel,
};
