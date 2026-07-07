/**
 * ЗРД v2 — клиентский API матчей (/api/zrd/match/*).
 * Оценщик (staff-cookie): создание, наблюдение, лебедь, пауза.
 * Игрок (seat-токен): вход по коду, seat-view, версия, интенты.
 */
import { apiRequest, getCsrfToken } from "@/lib/queryClient";
import type {
  RrsId, ScenarioId, WinMode, MissionMode, SwanFrequency, AiLevel, MascotId,
  SeatIntent, ZrdSeatView, ZrdObserverView, ActiveSwan, ZrdMatchListItem,
} from "@shared/zrd/match-types";
import type { Difficulty, CompetencyScores } from "@shared/zrd/types";

export interface CreateMatchSeatInput {
  rrsId: RrsId;
  controller: "human" | "ai" | "off";
  participantName?: string;
  aiLevel?: AiLevel;
  mascotId?: MascotId;
}

export interface CreateMatchInput {
  scenario: ScenarioId;
  difficulty: Difficulty;
  winMode: WinMode;
  missionMode: MissionMode;
  missionIds?: string[];
  keyMissionId?: string;
  swanFrequency: SwanFrequency;
  minutesPerTick: number;
  seats: CreateMatchSeatInput[];
  seed?: number;
}

export interface CreatedMatchSeat {
  seatIdx: number;
  rrsId: RrsId;
  controllerKind: "human" | "ai" | "off";
  participantName: string | null;
  aiLevel: number | null;
  accessCode: string | null;
}

export async function createZrdMatch(input: CreateMatchInput): Promise<{ id: number; seats: CreatedMatchSeat[] }> {
  const res = await apiRequest("POST", "/api/zrd/match", input);
  return res.json();
}

/** Демо-матч (1 человек + 3 ИИ) — публичный, без служебного входа. */
export async function createDemoZrdMatch(): Promise<{ id: number; seats: CreatedMatchSeat[] }> {
  const res = await apiRequest("POST", "/api/zrd/match/demo");
  return res.json();
}

export async function joinZrdMatch(code: string): Promise<{ matchId: number; seatIdx: number; token: string; participantName: string | null }> {
  const res = await apiRequest("POST", "/api/zrd/match/join", { code });
  return res.json();
}

export interface SeatViewResponse {
  view: ZrdSeatView;
  version: number;
  deadlineAt: string | null;
  paused: boolean;
}

function seatHeaders(token: string | null): Record<string, string> {
  return token ? { "x-zrd-seat-token": token } : {};
}

export async function fetchSeatView(matchId: number, seatIdx: number, token: string | null): Promise<SeatViewResponse> {
  const res = await apiRequest("GET", `/api/zrd/match/${matchId}/seat?seat=${seatIdx}`, undefined, { headers: seatHeaders(token) });
  return res.json();
}

export async function fetchMatchVersion(matchId: number, seatIdx: number, token: string | null): Promise<{ version: number; deadlineAt: string | null; paused: boolean; status: string }> {
  const res = await apiRequest("GET", `/api/zrd/match/${matchId}/version?seat=${seatIdx}`, undefined, { headers: seatHeaders(token) });
  return res.json();
}

/** игрок выбирает свою фигурку после входа по коду; следом — своя корпоративная почта (необязательно) */
export async function setZrdMascot(matchId: number, seatIdx: number, mascotId: MascotId, token: string | null, email?: string): Promise<SeatViewResponse> {
  const res = await apiRequest("POST", `/api/zrd/match/${matchId}/mascot`, { seatIdx, mascotId, email }, { headers: seatHeaders(token) });
  const data = await res.json();
  return { view: data.view, version: data.version, deadlineAt: null, paused: false };
}

export class ZrdMatchIntentError extends Error {
  code: string;
  constructor(code: string) {
    super(code);
    this.code = code;
  }
}

export async function sendSeatIntent(
  matchId: number,
  seatIdx: number,
  intent: SeatIntent,
  token: string | null,
): Promise<{ view: ZrdSeatView; version: number; ended: boolean }> {
  // CSRF нужен только staff-сессии (оценщик в демо-режиме); у игрока по токену куки-сессии нет
  const csrf = getCsrfToken();
  const res = await fetch(`/api/zrd/match/${matchId}/intent`, {
    method: "POST",
    credentials: "same-origin",
    headers: {
      "Content-Type": "application/json",
      ...(csrf ? { "X-CSRF-Token": csrf } : {}),
      ...seatHeaders(token),
    },
    body: JSON.stringify({ seatIdx, intent }),
  });
  if (!res.ok) {
    let code = `HTTP_${res.status}`;
    try {
      const payload = await res.json();
      code = payload?.error || payload?.code || code;
    } catch { /* ignore */ }
    throw new ZrdMatchIntentError(code);
  }
  return res.json();
}

export interface ObserverResponse {
  id: number;
  status: string;
  paused: boolean;
  deadlineAt: string | null;
  version: number;
  evaluatorName: string;
  startedAt: string;
  completedAt: string | null;
  observer: ZrdObserverView;
  seatAccess: CreatedMatchSeat[];
  results: Array<{
    seatIdx: number;
    tr: number;
    isWinner: boolean;
    kpi: Record<string, number>;
    competencies: CompetencyScores;
    outcome: Record<string, unknown>;
  }>;
}

export async function fetchObserverView(matchId: number): Promise<ObserverResponse> {
  const res = await apiRequest("GET", `/api/zrd/match/${matchId}/observer`);
  return res.json();
}

/** сводка матчей ЗРД для панели «Активные сессии» (у оценщика) */
export async function fetchZrdMatchList(): Promise<ZrdMatchListItem[]> {
  const res = await apiRequest("GET", "/api/staff/zrd-matches");
  return res.json();
}

export async function triggerMatchSwan(matchId: number, swanId: string, target: RrsId | "all"): Promise<void> {
  await apiRequest("POST", `/api/zrd/match/${matchId}/swan`, { swanId, target });
}

export async function setMatchPaused(matchId: number, paused: boolean): Promise<void> {
  await apiRequest("POST", `/api/zrd/match/${matchId}/pause`, { paused });
}

export type { ActiveSwan };
