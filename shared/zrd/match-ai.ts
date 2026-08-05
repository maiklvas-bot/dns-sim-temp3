/**
 * ЗРД v2 — ИИ-управленец уровней 1–5 (спека §7). ε-жадная политика поверх оценочной
 * функции: уровень 5 всегда берёт лучший ход, ниже — с вероятностью ε выбирает случайный
 * доступный. Детерминизм: случайность приходит снаружи (rngRoll из seeded RNG матча).
 */
import type { StandardAction, Metrics, Resources } from "./types";
import type { MatchState, SeatState, SeatIntent, AiLevel, MatchCardDef } from "./match-types";
import { matchContextTags } from "./match-engine";
import { getMatchCard } from "./content-decks";
import { getSwan } from "./content-swans";
import { getMission } from "./content-missions";
import { computeKpi } from "./kpi";

export const AI_EPSILON: Record<AiLevel, number> = { 1: 0.7, 2: 0.45, 3: 0.25, 4: 0.1, 5: 0 };

function affordable(res: Resources, cost?: Partial<Resources>): boolean {
  if (!cost) return true;
  return Object.entries(cost).every(([k, v]) => (res as Record<string, number>)[k] >= (v ?? 0));
}
function condOk(seat: SeatState, cond?: MatchCardDef["condition"]): boolean {
  if (!cond) return true;
  if (cond.minMetric && !Object.entries(cond.minMetric).every(([k, v]) => (seat.metrics as Record<string, number>)[k] >= (v ?? 0))) return false;
  if (cond.minResource && !Object.entries(cond.minResource).every(([k, v]) => (seat.resources as Record<string, number>)[k] >= (v ?? 0))) return false;
  return true;
}

/** самый отстающий из целевых KPI миссий → какой метрике помогать */
function laggingMetric(s: MatchState, seat: SeatState): keyof Metrics {
  const kpi = computeKpi(seat);
  let worst: keyof Metrics = "sales";
  let worstGap = -Infinity;
  const kpiToMetric: Partial<Record<string, keyof Metrics>> = {
    sales_growth: "sales", market_coverage: "coverage", service_level: "nps",
  };
  for (const mid of s.config.missionIds) {
    const m = getMission(mid);
    if (!m || seat.missionDone[mid]) continue;
    const gap = m.quarterTargets[3] - kpi[m.kpi];
    const metric = kpiToMetric[m.kpi];
    if (metric && gap > worstGap) { worstGap = gap; worst = metric; }
  }
  return worst;
}

/** ценность карты для места (адаптация cardValue соло-ИИ под матч) */
function cardValue(s: MatchState, seat: SeatState, c: MatchCardDef): number {
  const behind = laggingMetric(s, seat);
  let v = 0;
  v += (c.effects.resourceProd?.capital ?? 0) * 3;
  if (c.effects.metrics?.[behind]) v += c.effects.metrics[behind]! * 2;
  if (c.effects.metricProd?.[behind]) v += c.effects.metricProd[behind]! * 2.5;
  const sumMetrics = Object.values(c.effects.metrics ?? {}).reduce((a, x) => a + (x ?? 0), 0);
  const sumProd = Object.values(c.effects.metricProd ?? {}).reduce((a, x) => a + (x ?? 0), 0);
  v += sumMetrics * 0.6 + sumProd * 1.2;
  v += (c.effects.resourceProd?.warehouse ?? 0) * 1.2 + (c.effects.resourceProd?.staff ?? 0) * 1.2;
  // длинные проекты ценнее в первой половине года (успеют окупиться)
  if (c.durationWeeks >= 4) v += s.tick <= 6 ? 1.0 : -0.8;
  v -= (c.cost.capital ?? 0) * 0.08;
  return v;
}

/** все доступные ходы места (кроме pass) */
function legalMoves(s: MatchState, seatIdx: number): SeatIntent[] {
  const seat = s.seats[seatIdx];
  const moves: SeatIntent[] = [];
  if (seat.pendingEvent) {
    for (const o of seat.pendingEvent.options) {
      if (affordable(seat.resources, o.cost)) moves.push({ kind: "eventChoice", optionId: o.id });
    }
    return moves; // дилемма блокирует остальное
  }
  for (const swan of s.activeSwans) {
    const targeted = swan.scope === "global" || swan.targetRrs === seat.rrsId;
    if (!targeted || swan.reactedSeats.includes(seatIdx)) continue;
    const def = getSwan(swan.swanId);
    for (const o of def?.options ?? []) {
      if (affordable(seat.resources, o.cost)) moves.push({ kind: "swanChoice", swanId: swan.swanId, optionId: o.id });
    }
  }
  if (seat.actionsLeft > 0) {
    for (const id of seat.hand) {
      const c = getMatchCard(id);
      if (c && affordable(seat.resources, c.cost) && condOk(seat, c.condition)) moves.push({ kind: "playCard", cardId: id });
    }
    const stdCosts: Record<StandardAction, number> = { open_basic: 10, hire: 6, promo: 4, improve_service: 6, improve_logistics: 8 };
    for (const [action, cost] of Object.entries(stdCosts) as [StandardAction, number][]) {
      if (seat.resources.capital >= cost) moves.push({ kind: "standard", action });
    }
  }
  return moves;
}

/** оценка хода (больше — лучше) */
function moveValue(s: MatchState, seatIdx: number, intent: SeatIntent): number {
  const seat = s.seats[seatIdx];
  const tags = matchContextTags(seat);
  switch (intent.kind) {
    case "eventChoice": {
      const opt = seat.pendingEvent?.options.find((o) => o.id === intent.optionId);
      if (!opt) return -Infinity;
      const fits = (opt.fitsWhen ?? []).some((t) => tags.includes(t));
      return (fits ? 3 : 0) + (opt.weak ? -2 : 0) + (opt.negatesBaseHit ? 1.5 : 0);
    }
    case "swanChoice": {
      const def = getSwan(intent.swanId);
      const opt = def?.options.find((o) => o.id === intent.optionId);
      if (!def || !opt) return -Infinity;
      const fits = (opt.fitsWhen ?? []).some((t) => tags.includes(t));
      // реакция на лебедя ценна: штраф перестаёт тикать
      const penaltyWeight = Object.values(def.tickPenalty.metrics ?? {}).reduce((a, v) => a + Math.abs(v ?? 0), 0)
        + Object.values(def.tickPenalty.resources ?? {}).reduce((a, v) => a + Math.abs(v ?? 0), 0) * 0.5;
      return 2 + penaltyWeight + (fits ? 2 : 0) + (opt.weak ? -2 : 0);
    }
    case "playCard": {
      const c = getMatchCard(intent.cardId);
      return c ? cardValue(s, seat, c) : -Infinity;
    }
    case "standard": {
      const behind = laggingMetric(s, seat);
      const map: Record<keyof Metrics, StandardAction> = { sales: "promo", nps: "improve_service", coverage: "open_basic" };
      return map[behind] === intent.action ? 1.2 : 0.3;
    }
    default:
      return 0;
  }
}

/**
 * Выбор хода ИИ. rngRoll ∈ [0,1) — из seeded RNG вызывающего (сервер/харнесс),
 * второй бросок для случайного хода получается детерминированным сдвигом.
 */
export function chooseSeatIntent(s: MatchState, seatIdx: number, rngRoll: number): SeatIntent {
  const seat = s.seats[seatIdx];
  if (seat.controller.kind !== "ai") return { kind: "pass" };
  const level = seat.controller.level;
  let moves = legalMoves(s, seatIdx);
  // слабые уровни (1–2) не замечают чёрных лебедей — штраф продолжает тикать (спека §7)
  if (level <= 2) moves = moves.filter((m) => m.kind !== "swanChoice");
  if (moves.length === 0) return { kind: "pass" };

  // ε-шум: слабый уровень чаще берёт случайный ход; в случайном пуле есть и «пас»
  // (прожигание действий) — если только дилемма не требует решения
  if (rngRoll < AI_EPSILON[level]) {
    const pool: SeatIntent[] = seat.pendingEvent ? moves : [...moves, { kind: "pass" }, { kind: "pass" }];
    const idx = Math.floor(((rngRoll / Math.max(1e-9, AI_EPSILON[level])) * pool.length)) % pool.length;
    return pool[idx];
  }

  let best = moves[0];
  let bestV = -Infinity;
  for (const m of moves) {
    const v = moveValue(s, seatIdx, m);
    if (v > bestV) { bestV = v; best = m; }
  }
  // низкая ценность лучшего хода → лучше сберечь ресурсы (сильные уровни пасуют осознанно)
  if (bestV < 0.5 && !seat.pendingEvent && level >= 4) return { kind: "pass" };
  return best;
}
