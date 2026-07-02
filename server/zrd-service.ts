/**
 * Симуляция ЗРД — серверная оркестрация (Фаза 3). Связывает persistence (zrd-storage)
 * с чистым движком/скорингом/AI (shared/zrd). Серверно-авторитетно: состояние партии живёт
 * в БД (state_json), клиент шлёт только намерения хода.
 */
import type { ZrdConfig, ZrdState, TurnIntent, CompetencyScores } from "@shared/zrd/types";
import type { Difficulty, StrategyKey } from "@shared/zrd/types";
import { initState, applyIntent, toPublicState } from "@shared/zrd/engine";
import { computeCompetencies } from "@shared/zrd/scoring";
import { playFullGame } from "@shared/zrd/run";
import type { PlayStyle } from "@shared/zrd/ai";
import { zrdStorage, generateZrdAccessCode } from "./zrd-storage";
import { createSimulationSessionToken, hashSimulationSessionToken } from "./simulation-session-access";

export interface CreateZrdGameInput {
  participantName: string;
  evaluatorName: string;
  evaluatorAccountId: number | null;
  difficulty: Difficulty;
  region: string | null;
  seed?: number;
  quarters: number;
}

function botStyleForDifficulty(difficulty: Difficulty): PlayStyle {
  if (difficulty <= 1) return "improviser";
  if (difficulty <= 3) return "balanced";
  return "planner";
}

function parseState(json: string): ZrdState {
  return JSON.parse(json) as ZrdState;
}

export const zrdService = {
  createGame(input: CreateZrdGameInput) {
    const seed = input.seed ?? Math.floor(Math.random() * 2_000_000_000);
    const config: ZrdConfig = {
      difficulty: input.difficulty,
      quarters: input.quarters,
      seed,
      strategy: null,
    };
    const state = initState(config);
    const token = createSimulationSessionToken();
    const accessCode = generateZrdAccessCode();
    const now = new Date().toISOString();

    const session = zrdStorage.createSession({
      participantName: input.participantName,
      participantTokenHash: hashSimulationSessionToken(token),
      evaluatorAccountId: input.evaluatorAccountId,
      evaluatorName: input.evaluatorName,
      difficulty: input.difficulty,
      region: input.region,
      seed,
      quarters: input.quarters,
      opponent: "ai",
      accessCode,
      stateJson: JSON.stringify(state),
      status: "in_progress",
      startedAt: now,
      completedAt: null,
    });

    return { session, token, accessCode, state: toPublicState(state) };
  },

  /** Применяет намерение игрока. Возвращает ok=false с кодом ошибки, если ход невалиден. */
  applyPlayerIntent(sessionId: number, intent: TurnIntent) {
    const session = zrdStorage.getSession(sessionId);
    if (!session) return { ok: false as const, error: "NOT_FOUND" };
    if (session.status === "completed") return { ok: false as const, error: "GAME_ENDED" };

    const state = parseState(session.stateJson);
    const res = applyIntent(state, intent);
    if (!res.ok) return { ok: false as const, error: res.error ?? "REJECTED" };

    const next = res.state;
    const seq = zrdStorage.countTurns(sessionId) + 1;
    zrdStorage.addTurn({
      sessionId,
      seq,
      quarter: res.log?.quarter ?? next.quarter,
      intentJson: JSON.stringify(intent),
      logType: res.log?.type ?? "",
      detail: res.log?.detail ?? "",
    });

    let result: ReturnType<typeof zrdService.finalize> | null = null;
    if (next.ended) {
      result = this.finalize(sessionId, next);
      zrdStorage.updateSession(sessionId, {
        stateJson: JSON.stringify(next),
        status: "completed",
        completedAt: new Date().toISOString(),
      });
    } else {
      zrdStorage.updateSession(sessionId, { stateJson: JSON.stringify(next) });
    }

    return { ok: true as const, state: toPublicState(next), finalized: next.ended, result };
  },

  /** Финализация: AI-оппонент (детерминированный) + скоринг 12 компетенций → zrd_results. */
  finalize(sessionId: number, finalState: ZrdState) {
    const playerTr = finalState.outcome?.tr ?? 0;
    const aiState = playFullGame(
      { difficulty: finalState.config.difficulty, quarters: finalState.config.quarters, seed: finalState.config.seed + 1, strategy: null },
      { style: botStyleForDifficulty(finalState.config.difficulty) },
    );
    const aiTr = aiState.outcome?.tr ?? 0;
    const winner = playerTr > aiTr ? "player" : aiTr > playerTr ? "ai" : "draw";
    const competencies: CompetencyScores = computeCompetencies(finalState);

    const row = zrdStorage.upsertResult({
      sessionId,
      tr: playerTr,
      aiTr,
      winner,
      finalMetricsJson: JSON.stringify(finalState.outcome?.metrics ?? {}),
      competenciesJson: JSON.stringify(competencies),
      outcomeJson: JSON.stringify({
        earlyWin: finalState.outcome?.earlyWin ?? false,
        quartersPlayed: finalState.outcome?.quartersPlayed ?? finalState.quarter,
      }),
    });
    return row;
  },

  getPublicSession(sessionId: number) {
    const session = zrdStorage.getSession(sessionId);
    if (!session) return null;
    const state = toPublicState(parseState(session.stateJson));
    const details = zrdStorage.getSessionDetails(sessionId);
    return {
      id: session.id,
      participantName: session.participantName,
      evaluatorName: session.evaluatorName,
      difficulty: session.difficulty,
      region: session.region,
      quarters: session.quarters,
      opponent: session.opponent,
      accessCode: session.accessCode,
      status: session.status,
      startedAt: session.startedAt,
      completedAt: session.completedAt,
      state,
      result: details?.result ?? null,
    };
  },
};
