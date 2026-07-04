/**
 * ЗРД v2 — серверная оркестрация матча (спека §8). Серверно-авторитетно:
 * состояние в zrd_matches.state_json, клиенты шлют SeatIntent по seat-токену.
 * ИИ-места ходят на сервере (детерминированный ε-ролл от seed/tick/seat).
 * Дедлайн такта — lazy: проверяется при любом обращении к матчу.
 */
import type { CompetencyScores, Difficulty } from "@shared/zrd/types";
import type {
  MatchConfig, MatchState, SeatIntent, SeatSetup, RrsId, ScenarioId, WinMode, MissionMode,
  SwanFrequency, AiLevel, MascotId,
} from "@shared/zrd/match-types";
import { RRS_IDS } from "@shared/zrd/match-types";
import {
  initMatch, applySeatIntent, resolveTickIfReady, toSeatView, toObserverView, triggerSwanManually,
} from "@shared/zrd/match-engine";
import { chooseSeatIntent } from "@shared/zrd/match-ai";
import { computeSeatCompetencies } from "@shared/zrd/match-scoring";
import { SCENARIOS } from "@shared/zrd/content-scenarios";
import { getSwan } from "@shared/zrd/content-swans";
import { zrdMatchStorage, generateZrdMatchAccessCode } from "./zrd-match-storage";
import { createSimulationSessionToken, hashSimulationSessionToken } from "./simulation-session-access";

export interface CreateZrdMatchSeatInput {
  rrsId: RrsId;
  controller: "human" | "ai" | "off";
  participantName?: string;
  aiLevel?: AiLevel;
  mascotId?: MascotId;
}

export interface CreateZrdMatchInput {
  evaluatorName: string;
  evaluatorAccountId: number | null;
  scenario: ScenarioId;
  difficulty: Difficulty;
  winMode: WinMode;
  missionMode: MissionMode;
  /** для manual; в auto берётся набор сценария */
  missionIds?: string[];
  keyMissionId?: string;
  swanFrequency: SwanFrequency;
  minutesPerTick: number;
  seats: CreateZrdMatchSeatInput[]; // ровно 4, порядок = RRS_IDS
  seed?: number;
}

function parseState(json: string): MatchState {
  return JSON.parse(json) as MatchState;
}
function parseConfig(json: string): MatchConfig {
  return JSON.parse(json) as MatchConfig;
}

/** детерминированный ролл для ε-шума ИИ (не трогает RNG движка) */
function aiRoll(state: MatchState, seatIdx: number): number {
  const seat = state.seats[seatIdx];
  let h = (state.config.seed ^ (state.tick * 2654435761) ^ (seatIdx * 40503) ^ (seat.actionsTotal * 2246822519) ^ (seat.log.length * 3266489917)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 2246822507);
  h = Math.imul(h ^ (h >>> 13), 3266489909);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** прогнать ходы всех ИИ-мест до их пасов (в пределах текущего такта) */
function runAiSeats(state: MatchState): MatchState {
  let s = state;
  let guard = 0;
  for (let i = 0; i < s.seats.length; i++) {
    while (!s.ended && s.seats[i].controller.kind === "ai" && !s.seats[i].passed && guard++ < 80) {
      const intent = chooseSeatIntent(s, i, aiRoll(s, i));
      const res = applySeatIntent(s, i, intent);
      if (res.ok) { s = res.state; if (intent.kind === "pass") break; }
      else {
        const p = applySeatIntent(s, i, { kind: "pass" });
        if (p.ok) s = p.state;
        break;
      }
    }
  }
  return s;
}

/** дедлайн истёк → принудительный пас непоходивших людей (дилемма закрывается бесплатной опцией) */
function forcePassHumans(state: MatchState): MatchState {
  let s = state;
  for (let i = 0; i < s.seats.length; i++) {
    const seat = s.seats[i];
    if (seat.controller.kind !== "human" || seat.passed) continue;
    if (s.seats[i].pendingEvent) {
      const ev = s.seats[i].pendingEvent!;
      const free = ev.options.find((o) => !o.cost || Object.values(o.cost).every((v) => !v)) ?? ev.options[0];
      const r = applySeatIntent(s, i, { kind: "eventChoice", optionId: free.id });
      if (r.ok) s = r.state;
    }
    const p = applySeatIntent(s, i, { kind: "pass" });
    if (p.ok) s = p.state;
  }
  return s;
}

function deadlineFrom(now: Date, minutesPerTick: number): string {
  return new Date(now.getTime() + minutesPerTick * 60_000).toISOString();
}

export const zrdMatchService = {
  createMatch(input: CreateZrdMatchInput) {
    if (input.seats.length !== 4) throw new Error("MATCH_NEEDS_4_SEATS");
    const scenario = SCENARIOS[input.scenario];
    const seats: SeatSetup[] = input.seats.map((s, i) => ({
      rrsId: s.rrsId ?? RRS_IDS[i],
      controller: s.controller === "human"
        ? { kind: "human", name: (s.participantName || "Игрок").slice(0, 60) }
        : s.controller === "ai"
          ? { kind: "ai", level: (s.aiLevel ?? 3) as AiLevel }
          : { kind: "off" },
      mascotId: s.mascotId,
    }));
    if (!seats.some((s) => s.controller.kind !== "off")) throw new Error("MATCH_NEEDS_ACTIVE_SEAT");

    const missionIds = input.missionMode === "manual" && input.missionIds?.length
      ? input.missionIds
      : scenario.missionIds;
    const keyMissionId = input.keyMissionId && missionIds.includes(input.keyMissionId)
      ? input.keyMissionId
      : (missionIds.includes(scenario.keyMissionId) ? scenario.keyMissionId : missionIds[0]);

    const config: MatchConfig = {
      scenario: input.scenario,
      difficulty: input.difficulty,
      winMode: input.winMode,
      missionMode: input.missionMode,
      missionIds,
      keyMissionId,
      swanFrequency: input.swanFrequency,
      minutesPerTick: Math.max(2, Math.min(15, input.minutesPerTick)),
      seats,
      seed: input.seed ?? Math.floor(Math.random() * 2_000_000_000),
    };

    let state = initMatch(config);
    state = runAiSeats(state); // ИИ делает ходы первого такта сразу
    state = resolveTickIfReady(state); // если людей нет вовсе — такты пойдут при обращениях

    const now = new Date();
    const match = zrdMatchStorage.createMatch({
      configJson: JSON.stringify(config),
      stateJson: JSON.stringify(state),
      stateVersion: 1,
      status: state.ended ? "completed" : "in_progress",
      paused: 0,
      tickDeadlineAt: deadlineFrom(now, config.minutesPerTick),
      evaluatorAccountId: input.evaluatorAccountId,
      evaluatorName: input.evaluatorName,
      startedAt: now.toISOString(),
      completedAt: state.ended ? now.toISOString() : null,
    });

    const seatRows = seats.map((s, i) => {
      const isHuman = s.controller.kind === "human";
      const accessCode = isHuman ? generateZrdMatchAccessCode() : null;
      return zrdMatchStorage.createSeat({
        matchId: match.id,
        seatIdx: i,
        rrsId: s.rrsId,
        controllerKind: s.controller.kind,
        aiLevel: s.controller.kind === "ai" ? s.controller.level : null,
        participantName: s.controller.kind === "human" ? s.controller.name : null,
        tokenHash: null, // токен выдаётся при входе по коду
        accessCode,
      });
    });

    return {
      match,
      seats: seatRows.map((row) => ({
        seatIdx: row.seatIdx,
        rrsId: row.rrsId,
        controllerKind: row.controllerKind,
        participantName: row.participantName,
        aiLevel: row.aiLevel,
        accessCode: row.accessCode,
      })),
    };
  },

  /** вход по коду места: выдаёт свежий seat-токен (последний вход выигрывает) */
  joinSeat(accessCode: string) {
    const seat = zrdMatchStorage.getSeatByCode(accessCode.trim().toUpperCase());
    if (!seat) return null;
    const match = zrdMatchStorage.getMatch(seat.matchId);
    if (!match) return null;
    const token = createSimulationSessionToken();
    zrdMatchStorage.updateSeatTokenHash(seat.id, hashSimulationSessionToken(token));
    return { matchId: seat.matchId, seatIdx: seat.seatIdx, token, participantName: seat.participantName };
  },

  verifySeatToken(matchId: number, seatIdx: number, token: string): boolean {
    if (!token) return false;
    const seat = zrdMatchStorage.getSeats(matchId).find((s) => s.seatIdx === seatIdx);
    if (!seat?.tokenHash) return false;
    return hashSimulationSessionToken(token) === seat.tokenHash;
  },

  /** lazy-проверка дедлайна такта; при истечении — форс-пас людей и продвижение */
  refreshMatch(matchId: number) {
    const match = zrdMatchStorage.getMatch(matchId);
    if (!match) return null;
    if (match.status === "completed" || match.paused) return match;
    const deadline = match.tickDeadlineAt ? Date.parse(match.tickDeadlineAt) : null;
    if (!deadline || Date.now() < deadline) return match;

    let state = parseState(match.stateJson);
    state = forcePassHumans(state);
    state = runAiSeats(state);
    state = resolveTickIfReady(state);
    const config = parseConfig(match.configJson);
    const updated = zrdMatchStorage.updateMatch(matchId, {
      stateJson: JSON.stringify(state),
      stateVersion: (match.stateVersion ?? 0) + 1,
      tickDeadlineAt: state.ended ? null : deadlineFrom(new Date(), config.minutesPerTick),
      status: state.ended ? "completed" : "in_progress",
      completedAt: state.ended ? new Date().toISOString() : null,
    });
    if (state.ended) this.finalize(matchId, state);
    return updated ?? zrdMatchStorage.getMatch(matchId);
  },

  applyIntent(matchId: number, seatIdx: number, intent: SeatIntent) {
    const match = this.refreshMatch(matchId);
    if (!match) return { ok: false as const, error: "NOT_FOUND" };
    if (match.status === "completed") return { ok: false as const, error: "GAME_ENDED" };
    if (match.paused) return { ok: false as const, error: "PAUSED" };

    let state = parseState(match.stateJson);
    const res = applySeatIntent(state, seatIdx, intent);
    if (!res.ok) return { ok: false as const, error: res.error ?? "REJECTED" };
    state = res.state;

    const seq = zrdMatchStorage.countTurns(matchId) + 1;
    const lastLog = state.seats[seatIdx].log[state.seats[seatIdx].log.length - 1];
    zrdMatchStorage.addTurn({
      matchId,
      seatIdx,
      seq,
      tick: state.tick,
      intentJson: JSON.stringify(intent),
      logType: lastLog?.type ?? "",
      detail: lastLog?.detail ?? "",
    });

    const tickBefore = state.tick;
    state = runAiSeats(state);
    state = resolveTickIfReady(state);
    const config = parseConfig(match.configJson);
    const tickAdvanced = state.tick !== tickBefore || state.ended;

    zrdMatchStorage.updateMatch(matchId, {
      stateJson: JSON.stringify(state),
      stateVersion: (match.stateVersion ?? 0) + 1,
      ...(tickAdvanced ? { tickDeadlineAt: state.ended ? null : deadlineFrom(new Date(), config.minutesPerTick) } : {}),
      status: state.ended ? "completed" : "in_progress",
      completedAt: state.ended ? new Date().toISOString() : null,
    });
    if (state.ended) this.finalize(matchId, state);

    return { ok: true as const, view: toSeatView(state, seatIdx), version: (match.stateVersion ?? 0) + 1, ended: state.ended };
  },

  getSeatView(matchId: number, seatIdx: number) {
    const match = this.refreshMatch(matchId);
    if (!match) return null;
    const state = parseState(match.stateJson);
    if (!state.seats[seatIdx]) return null;
    return {
      view: toSeatView(state, seatIdx),
      version: match.stateVersion ?? 0,
      deadlineAt: match.tickDeadlineAt,
      paused: Boolean(match.paused),
    };
  },

  getVersion(matchId: number) {
    const match = this.refreshMatch(matchId);
    if (!match) return null;
    return {
      version: match.stateVersion ?? 0,
      deadlineAt: match.tickDeadlineAt,
      paused: Boolean(match.paused),
      status: match.status,
    };
  },

  getObserverView(matchId: number) {
    const match = this.refreshMatch(matchId);
    if (!match) return null;
    const state = parseState(match.stateJson);
    const seats = zrdMatchStorage.getSeats(matchId);
    const results = match.status === "completed" ? zrdMatchStorage.getResults(matchId) : [];
    return {
      id: match.id,
      status: match.status,
      paused: Boolean(match.paused),
      deadlineAt: match.tickDeadlineAt,
      version: match.stateVersion ?? 0,
      evaluatorName: match.evaluatorName,
      startedAt: match.startedAt,
      completedAt: match.completedAt,
      observer: toObserverView(state),
      seatAccess: seats.map((s) => ({
        seatIdx: s.seatIdx,
        rrsId: s.rrsId,
        controllerKind: s.controllerKind,
        participantName: s.participantName,
        aiLevel: s.aiLevel,
        accessCode: s.accessCode,
      })),
      results: results.map((r) => ({
        seatIdx: r.seatIdx,
        tr: r.tr,
        isWinner: Boolean(r.isWinner),
        kpi: JSON.parse(r.kpiJson) as Record<string, number>,
        competencies: JSON.parse(r.competenciesJson) as CompetencyScores,
        outcome: JSON.parse(r.outcomeJson) as Record<string, unknown>,
      })),
    };
  },

  triggerSwan(matchId: number, swanId: string, target: RrsId | "all") {
    if (!getSwan(swanId)) return { ok: false as const, error: "NO_SWAN" };
    const match = this.refreshMatch(matchId);
    if (!match) return { ok: false as const, error: "NOT_FOUND" };
    if (match.status === "completed") return { ok: false as const, error: "GAME_ENDED" };
    const state = parseState(match.stateJson);
    const next = triggerSwanManually(state, swanId, target);
    if (next === state) return { ok: false as const, error: "SWAN_ALREADY_ACTIVE" };
    zrdMatchStorage.updateMatch(matchId, {
      stateJson: JSON.stringify(next),
      stateVersion: (match.stateVersion ?? 0) + 1,
    });
    return { ok: true as const };
  },

  setPaused(matchId: number, paused: boolean) {
    const match = zrdMatchStorage.getMatch(matchId);
    if (!match) return { ok: false as const, error: "NOT_FOUND" };
    if (match.status === "completed") return { ok: false as const, error: "GAME_ENDED" };
    const config = parseConfig(match.configJson);
    zrdMatchStorage.updateMatch(matchId, {
      paused: paused ? 1 : 0,
      stateVersion: (match.stateVersion ?? 0) + 1,
      // возобновление даёт полный такт времени заново
      ...(paused ? {} : { tickDeadlineAt: deadlineFrom(new Date(), config.minutesPerTick) }),
    });
    return { ok: true as const };
  },

  /** финализация: скоринг компетенций по каждому активному месту → zrd_match_results */
  finalize(matchId: number, state: MatchState) {
    state.seats.forEach((seat, idx) => {
      if (seat.controller.kind === "off") return;
      const competencies = computeSeatCompetencies(seat, state.config);
      const outcome = state.outcomes?.[idx];
      zrdMatchStorage.upsertSeatResult({
        matchId,
        seatIdx: idx,
        tr: outcome?.tr ?? 0,
        isWinner: state.winnerSeat === idx ? 1 : 0,
        kpiJson: JSON.stringify(outcome?.kpi ?? {}),
        competenciesJson: JSON.stringify(competencies),
        outcomeJson: JSON.stringify({
          missionsCompleted: outcome?.missionsCompleted ?? [],
          raceWinner: outcome?.raceWinner ?? false,
          quartersPlayed: Math.ceil(state.tick / 3),
        }),
      });
    });
  },
};
