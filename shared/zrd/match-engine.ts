/**
 * ЗРД v2 — движок матча на 4 места (спека §2). Чистые детерминированные функции,
 * seeded RNG (mulberry32). Цикл такта (месяц): добор → действия (симультанно) →
 * лебеди/дилеммы(кв. рубеж) → производство. Сервер авторитетен: клиенты шлют SeatIntent.
 */
import type { Resources, Metrics, EventCard, EventOption, ContextTag, TurnLogEntry, Difficulty } from "./types";
import { RESOURCE_KEYS, METRIC_KEYS } from "./types";
import { DIFFICULTY_CONFIGS, STANDARD_ACTIONS, EVENT_CARDS, emptyMetrics, emptyResources } from "./content";
import type {
  MatchConfig, MatchState, SeatState, SeatIntent, SeatIntentResult, ActiveSwan, DeckId,
  ZrdSeatView, ZrdObserverView, ZrdSeatPublicSummary, MissionProgressView, RrsId, MatchCardDef, SeatOutcome, KpiId,
} from "./match-types";
import { DECK_IDS, RRS_LABEL, MASCOT_IDS, TICKS_TOTAL, WEEKS_PER_TICK, quarterOfTick, monthOfQuarter, isQuarterEnd } from "./match-types";
import { MATCH_DECK_CARDS, getMatchCard } from "./content-decks";
import { BLACK_SWANS, SWAN_TICK_PROBABILITY, getSwan } from "./content-swans";
import { getMission } from "./content-missions";
import { SCENARIOS } from "./content-scenarios";
import { computeKpi } from "./kpi";

// ── Экономика v3 (месячный такт), индексы = сложность 1..5 ─────────────────
export const INCOME_MONTHLY: Record<Difficulty, number> = { 1: 6, 2: 5, 3: 4, 4: 4, 5: 3 };
export const ACTIONS_PER_TICK: Record<Difficulty, number> = { 1: 2, 2: 2, 3: 2, 4: 1, 5: 1 };
export const DRAW_PER_TICK: Record<Difficulty, number> = { 1: 3, 2: 3, 3: 2, 4: 2, 5: 2 };
/** стартовая рука первого месяца (включает добор такта 1): игрок сразу видит карты всех направлений */
export const START_HAND: Record<Difficulty, number> = { 1: 8, 2: 7, 3: 6, 4: 5, 5: 4 };

// ── seeded RNG (mulberry32) ────────────────────────────────────────────────
function nextRng(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
}
function roll(s: MatchState): number {
  const r = nextRng(s.rng);
  s.rng = r.state;
  return r.value;
}
function shuffle<T>(arr: T[], seed: number): { arr: T[]; seed: number } {
  const out = [...arr];
  let st = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextRng(st); st = r.state;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { arr: out, seed: st };
}

// ── helpers ────────────────────────────────────────────────────────────────
const clampMetric = (v: number): number => Math.max(0, Math.min(20, v));
const cloneState = (s: MatchState): MatchState => JSON.parse(JSON.stringify(s));
const isActive = (seat: SeatState): boolean => seat.controller.kind !== "off";

function canAfford(seat: SeatState, cost?: Partial<Resources>): boolean {
  if (!cost) return true;
  return RESOURCE_KEYS.every((k) => (seat.resources[k] ?? 0) >= (cost[k] ?? 0));
}
function payCost(seat: SeatState, cost?: Partial<Resources>): void {
  if (!cost) return;
  for (const k of RESOURCE_KEYS) {
    const v = cost[k] ?? 0;
    seat.resources[k] -= v;
    seat.spentTotal += v;
  }
}
/** отрицательные значения масштабируются множителем наказания сложности, положительные — нет */
const scaleNeg = (v: number, mult: number): number => (v < 0 ? Math.round(v * mult) : v);

function applyEffects(
  seat: SeatState,
  eff: { resources?: Partial<Resources>; resourceProd?: Partial<Resources>; metrics?: Partial<Metrics>; metricProd?: Partial<Metrics> } | undefined,
  penaltyMult = 1,
): void {
  if (!eff) return;
  if (eff.resources) for (const k of RESOURCE_KEYS) if (eff.resources[k] != null) seat.resources[k] = Math.max(0, seat.resources[k] + scaleNeg(eff.resources[k]!, penaltyMult));
  if (eff.resourceProd) for (const k of RESOURCE_KEYS) if (eff.resourceProd[k] != null) seat.resourceProd[k] = Math.max(0, seat.resourceProd[k] + scaleNeg(eff.resourceProd[k]!, penaltyMult));
  if (eff.metrics) for (const k of METRIC_KEYS) if (eff.metrics[k] != null) seat.metrics[k] = clampMetric(seat.metrics[k] + scaleNeg(eff.metrics[k]!, penaltyMult));
  if (eff.metricProd) for (const k of METRIC_KEYS) if (eff.metricProd[k] != null) seat.metricProd[k] = Math.max(0, seat.metricProd[k] + eff.metricProd[k]!);
}

function meetsCondition(seat: SeatState, cond?: MatchCardDef["condition"]): boolean {
  if (!cond) return true;
  if (cond.minMetric) for (const k of METRIC_KEYS) if ((seat.metrics[k] ?? 0) < (cond.minMetric[k] ?? 0)) return false;
  if (cond.minResource) for (const k of RESOURCE_KEYS) if ((seat.resources[k] ?? 0) < (cond.minResource[k] ?? 0)) return false;
  return true;
}

/** контекст-теги места (словарь соло-движка — совместимость fitsWhen и скоринга §8a) */
export function matchContextTags(seat: SeatState): ContextTag[] {
  const tags: ContextTag[] = ["anyReasonable"];
  if (seat.resources.capital < 8) tags.push("lowCapital"); else tags.push("highCapital");
  if (seat.resources.staff >= 1) tags.push("hasStaff"); else tags.push("lowStaff");
  if (seat.resources.tech >= 1) tags.push("hasTech");
  if (seat.resources.warehouse >= 2) tags.push("hasWarehouse");
  if (seat.metrics.nps < 6) tags.push("lowNps");
  if (seat.metrics.sales < 7) tags.push("lowSales");
  if (seat.metrics.coverage < 6) tags.push("lowCoverage");
  const behind = [seat.metrics.nps < 6, seat.metrics.sales < 7, seat.metrics.coverage < 6].filter(Boolean).length;
  if (behind >= 2) tags.push("behindTargets");
  if (seat.incomeMonthly >= 5 && behind <= 1) tags.push("stableEngine");
  return tags;
}

function pushLog(seat: SeatState, tick: number, e: Pick<TurnLogEntry, "type" | "detail" | "choiceId">): void {
  seat.log.push({
    quarter: tick, // в матче quarter-поле лога хранит номер такта (месяца)
    ctxTags: matchContextTags(seat),
    metrics: { ...seat.metrics },
    resources: { ...seat.resources },
    ...e,
  });
}

// ── добор карт ──────────────────────────────────────────────────────────────
/** взвешенный выбор колоды с непустым остатком; из очереди места берётся первая карта этой колоды */
function drawCards(s: MatchState, seat: SeatState, count: number): void {
  const weights = SCENARIOS[s.config.scenario].deckWeights;
  for (let n = 0; n < count; n++) {
    const remainingByDeck = new Map<DeckId, number>();
    for (const id of seat.deck) {
      const d = getMatchCard(id)!.deck;
      remainingByDeck.set(d, (remainingByDeck.get(d) ?? 0) + 1);
    }
    const candidates = DECK_IDS.filter((d) => (remainingByDeck.get(d) ?? 0) > 0);
    if (candidates.length === 0) return;
    const totalW = candidates.reduce((a, d) => a + weights[d], 0);
    let r = roll(s) * totalW;
    let chosen: DeckId = candidates[0];
    for (const d of candidates) { r -= weights[d]; if (r <= 0) { chosen = d; break; } }
    const idx = seat.deck.findIndex((id) => getMatchCard(id)!.deck === chosen);
    const [cardId] = seat.deck.splice(idx, 1);
    seat.hand.push(cardId);
  }
}

// ── init ────────────────────────────────────────────────────────────────────
export function initMatch(config: MatchConfig): MatchState {
  if (config.seats.length !== 4) throw new Error("MATCH_NEEDS_4_SEATS");
  const diff = DIFFICULTY_CONFIGS[config.difficulty];
  const scenario = SCENARIOS[config.scenario];
  let seed = config.seed >>> 0;

  const seats: SeatState[] = config.seats.map((setup, seatIdx) => {
    const active = setup.controller.kind !== "off";
    const resources = active ? { ...diff.startResources } : emptyResources();
    const metrics = active ? { ...diff.startMetrics } : emptyMetrics();
    if (active && scenario.startTweak?.resources) for (const k of RESOURCE_KEYS) resources[k] = Math.max(0, resources[k] + (scenario.startTweak.resources[k] ?? 0));
    if (active && scenario.startTweak?.metrics) for (const k of METRIC_KEYS) metrics[k] = clampMetric(metrics[k] + (scenario.startTweak.metrics[k] ?? 0));
    let deck: string[] = [];
    if (active) {
      const sh = shuffle(MATCH_DECK_CARDS.map((c) => c.id), seed);
      deck = sh.arr; seed = sh.seed;
    }
    return {
      rrsId: setup.rrsId,
      controller: setup.controller,
      mascotId: setup.mascotId ?? MASCOT_IDS[seatIdx % MASCOT_IDS.length],
      // человек выбирает фигурку сам при входе; ИИ/выключенным выбор не нужен
      mascotChosen: setup.controller.kind !== "human" || Boolean(setup.mascotId),
      resources,
      incomeMonthly: active ? INCOME_MONTHLY[config.difficulty] : 0,
      resourceProd: active ? { ...diff.startProd } : emptyResources(),
      metrics,
      metricProd: emptyMetrics(),
      deck,
      hand: [],
      discard: [],
      activeProjects: [],
      actionsLeft: 0,
      passed: true, // beginTick выставит для активных
      spentTotal: 0,
      actionsTotal: 0,
      missionDone: {},
      pendingEvent: null,
      viewedDataThisTick: false,
      log: [],
    };
  });

  const evSh = shuffle(EVENT_CARDS.map((e) => e.id), seed);

  const state: MatchState = {
    config,
    tick: 1,
    phase: "action",
    seats,
    activeSwans: [],
    eventDeck: evSh.arr,
    rng: evSh.seed,
    ended: false,
  };
  // стартовая рука: добираем разницу до START_HAND, остальное доложит beginTick такта 1
  const startExtra = Math.max(0, START_HAND[config.difficulty] - DRAW_PER_TICK[config.difficulty]);
  for (const seat of state.seats) {
    if (isActive(seat) && startExtra > 0) drawCards(state, seat, startExtra);
  }
  beginTick(state);
  return state;
}

function beginTick(s: MatchState): void {
  for (const seat of s.seats) {
    if (!isActive(seat)) continue;
    drawCards(s, seat, DRAW_PER_TICK[s.config.difficulty]);
    seat.actionsLeft = ACTIONS_PER_TICK[s.config.difficulty];
    seat.passed = false;
    seat.viewedDataThisTick = false;
  }
}

// ── интенты мест ─────────────────────────────────────────────────────────────
export function applySeatIntent(prev: MatchState, seatIdx: number, intent: SeatIntent): SeatIntentResult {
  if (prev.ended) return { state: prev, ok: false, error: "GAME_ENDED" };
  const seatPrev = prev.seats[seatIdx];
  if (!seatPrev) return { state: prev, ok: false, error: "NO_SEAT" };
  if (seatPrev.controller.kind === "off") return { state: prev, ok: false, error: "SEAT_OFF" };
  if (prev.phase !== "action") return { state: prev, ok: false, error: "BAD_PHASE" };

  const s = cloneState(prev);
  const seat = s.seats[seatIdx];
  const diff = DIFFICULTY_CONFIGS[s.config.difficulty];

  switch (intent.kind) {
    case "playCard": {
      if (seat.passed) return fail(prev, "ALREADY_PASSED");
      if (seat.actionsLeft <= 0) return fail(prev, "NO_ACTIONS");
      const inHand = seat.hand.includes(intent.cardId);
      if (!inHand) return fail(prev, "NO_CARD");
      const card = getMatchCard(intent.cardId);
      if (!card) return fail(prev, "NO_CARD");
      if (!canAfford(seat, card.cost)) return fail(prev, "CANT_AFFORD");
      if (!meetsCondition(seat, card.condition)) return fail(prev, "COND_NOT_MET");
      payCost(seat, card.cost);
      if (card.durationWeeks > 0) {
        seat.activeProjects.push({ cardId: card.id, title: card.title, deck: card.deck, weeksLeft: card.durationWeeks, totalWeeks: card.durationWeeks });
      } else {
        applyEffects(seat, card.effects);
      }
      seat.hand = seat.hand.filter((id) => id !== card.id);
      seat.discard.push(card.id);
      seat.actionsLeft -= 1;
      seat.actionsTotal += 1;
      pushLog(seat, s.tick, { type: "play_card", detail: card.id, choiceId: card.id });
      return ok(s);
    }
    case "standard": {
      if (seat.passed) return fail(prev, "ALREADY_PASSED");
      if (seat.actionsLeft <= 0) return fail(prev, "NO_ACTIONS");
      const def = STANDARD_ACTIONS[intent.action];
      if (!def) return fail(prev, "NO_ACTION");
      if (!canAfford(seat, def.cost)) return fail(prev, "CANT_AFFORD");
      payCost(seat, def.cost);
      applyEffects(seat, def.effects);
      seat.actionsLeft -= 1;
      seat.actionsTotal += 1;
      pushLog(seat, s.tick, { type: "standard", detail: intent.action, choiceId: intent.action });
      return ok(s);
    }
    case "viewData": {
      seat.viewedDataThisTick = true;
      pushLog(seat, s.tick, { type: "standard", detail: "view_data", choiceId: "view_data" });
      return ok(s);
    }
    case "eventChoice": {
      const ev = seat.pendingEvent;
      if (!ev) return fail(prev, "NO_EVENT");
      const opt = ev.options.find((o) => o.id === intent.optionId);
      if (!opt) return fail(prev, "NO_OPTION");
      if (!canAfford(seat, opt.cost)) return fail(prev, "CANT_AFFORD");
      const mult = diff.penaltyMultiplier;
      const hitApplies = ev.baseHit && !meetsConditionSolo(seat, ev.baseHitWhen) && !opt.negatesBaseHit;
      if (hitApplies) applyEffects(seat, ev.baseHit, mult);
      payCost(seat, opt.cost);
      applyEffects(seat, opt.effects, mult);
      seat.pendingEvent = null;
      pushLog(seat, s.tick, { type: "event", detail: `${ev.id}:${opt.id}`, choiceId: opt.id });
      return ok(s);
    }
    case "swanChoice": {
      const swan = s.activeSwans.find((a) => a.swanId === intent.swanId);
      if (!swan) return fail(prev, "NO_SWAN");
      const targetsSeat = swan.scope === "global" || swan.targetRrs === seat.rrsId;
      if (!targetsSeat) return fail(prev, "SWAN_NOT_YOURS");
      if (swan.reactedSeats.includes(seatIdx)) return fail(prev, "ALREADY_REACTED");
      const def = getSwan(swan.swanId);
      if (!def) return fail(prev, "NO_SWAN");
      const opt = def.options.find((o) => o.id === intent.optionId);
      if (!opt) return fail(prev, "NO_OPTION");
      if (!canAfford(seat, opt.cost)) return fail(prev, "CANT_AFFORD");
      payCost(seat, opt.cost);
      applyEffects(seat, opt.effects, diff.penaltyMultiplier);
      swan.reactedSeats.push(seatIdx);
      pushLog(seat, s.tick, { type: "event", detail: `swan:${def.id}:${opt.id}`, choiceId: opt.id });
      return ok(s);
    }
    case "pass": {
      if (seat.pendingEvent) return fail(prev, "EVENT_PENDING");
      if (seat.passed) return fail(prev, "ALREADY_PASSED");
      seat.passed = true;
      pushLog(seat, s.tick, { type: "pass", detail: "pass" });
      return ok(s);
    }
    default:
      return fail(prev, "UNKNOWN_INTENT");
  }
}

/** baseHitWhen соло-событий использует minResourceProd — поддерживаем полный CardCondition */
function meetsConditionSolo(seat: SeatState, cond?: EventCard["baseHitWhen"]): boolean {
  if (!cond) return true;
  if (cond.minMetric) for (const k of METRIC_KEYS) if ((seat.metrics[k] ?? 0) < (cond.minMetric[k] ?? 0)) return false;
  if (cond.minResource) for (const k of RESOURCE_KEYS) if ((seat.resources[k] ?? 0) < (cond.minResource[k] ?? 0)) return false;
  if (cond.minResourceProd) for (const k of RESOURCE_KEYS) if ((seat.resourceProd[k] ?? 0) < (cond.minResourceProd[k] ?? 0)) return false;
  return true;
}

const ok = (s: MatchState): SeatIntentResult => ({ state: s, ok: true });
const fail = (prev: MatchState, error: string): SeatIntentResult => ({ state: prev, ok: false, error });

// ── разрешение такта ─────────────────────────────────────────────────────────
/** Если все активные места спасовали — разрешает такт и открывает следующий (или финал). */
export function resolveTickIfReady(prev: MatchState): MatchState {
  if (prev.ended) return prev;
  const pending = prev.seats.some((seat) => isActive(seat) && !seat.passed);
  if (pending) return prev;

  const s = cloneState(prev);
  const diff = DIFFICULTY_CONFIGS[s.config.difficulty];

  // 1) бросок лебедя
  const prob = SWAN_TICK_PROBABILITY[s.config.swanFrequency];
  if (prob > 0 && roll(s) < prob) {
    const activeIds = new Set(s.activeSwans.map((a) => a.swanId));
    const pool = BLACK_SWANS.filter((sw) => !activeIds.has(sw.id));
    if (pool.length > 0) {
      const totalW = pool.reduce((a, sw) => a + sw.weight, 0);
      let r = roll(s) * totalW;
      let chosen = pool[0];
      for (const sw of pool) { r -= sw.weight; if (r <= 0) { chosen = sw; break; } }
      let targetRrs: RrsId | null = null;
      if (chosen.scope === "local") {
        const activeSeats = s.seats.filter(isActive);
        targetRrs = activeSeats[Math.floor(roll(s) * activeSeats.length)].rrsId;
      }
      s.activeSwans.push({ swanId: chosen.id, scope: chosen.scope, targetRrs, weeksLeft: chosen.durationWeeks, reactedSeats: [] });
    }
  }

  // 2) штрафы активных лебедей (кто не отреагировал) + недельный отсчёт
  for (const swan of s.activeSwans) {
    const def = getSwan(swan.swanId);
    if (!def) continue;
    s.seats.forEach((seat, idx) => {
      if (!isActive(seat)) return;
      const targeted = swan.scope === "global" || swan.targetRrs === seat.rrsId;
      if (!targeted || swan.reactedSeats.includes(idx)) return;
      applyEffects(seat, def.tickPenalty, diff.penaltyMultiplier);
    });
    swan.weeksLeft -= WEEKS_PER_TICK;
  }
  s.activeSwans = s.activeSwans.filter((a) => a.weeksLeft > 0);

  // 3) прогресс проектов (недели), завершение → эффект
  for (const seat of s.seats) {
    if (!isActive(seat)) continue;
    const still: typeof seat.activeProjects = [];
    for (const p of seat.activeProjects) {
      p.weeksLeft -= WEEKS_PER_TICK;
      if (p.weeksLeft <= 0) {
        const card = getMatchCard(p.cardId);
        if (card) applyEffects(seat, card.effects);
        pushLog(seat, s.tick, { type: "production", detail: `project_done:${p.cardId}`, choiceId: p.cardId });
      } else {
        still.push(p);
      }
    }
    seat.activeProjects = still;
  }

  // 4) месячный доход
  for (const seat of s.seats) {
    if (!isActive(seat)) continue;
    seat.resources.capital += seat.incomeMonthly;
  }

  // 5) квартальный рубеж: производство + дилеммы следующего такта
  if (isQuarterEnd(s.tick)) {
    for (const seat of s.seats) {
      if (!isActive(seat)) continue;
      for (const k of RESOURCE_KEYS) seat.resources[k] += seat.resourceProd[k];
      for (const k of METRIC_KEYS) seat.metrics[k] = clampMetric(seat.metrics[k] + seat.metricProd[k]);
      pushLog(seat, s.tick, { type: "production", detail: `q${quarterOfTick(s.tick)}` });
    }
    if (s.tick < TICKS_TOTAL) {
      for (const seat of s.seats) {
        if (!isActive(seat)) continue;
        const evId = s.eventDeck[0];
        s.eventDeck = s.eventDeck.slice(1).concat(evId); // циклически
        seat.pendingEvent = EVENT_CARDS.find((e) => e.id === evId) ?? null;
      }
    }
  }

  // 6) миссии: достижение финальной цели фиксируется навсегда
  for (const seat of s.seats) {
    if (!isActive(seat)) continue;
    const kpi = computeKpi(seat);
    for (const mid of s.config.missionIds) {
      const m = getMission(mid);
      if (!m || seat.missionDone[mid]) continue;
      if (kpi[m.kpi] >= m.quarterTargets[3]) seat.missionDone[mid] = true;
    }
  }

  // 7) гонка: первый, кто дотянул целевой KPI до цели финиша, завершает матч.
  // Оценщик может настроить цель (KPI + значение) в мастере запуска — тогда она замещает
  // встроенный quarterTargets[3] ключевой миссии; без настройки цель берётся из ключевой миссии (как раньше).
  if (s.config.winMode === "race") {
    const keyMission = getMission(s.config.keyMissionId);
    const targetKpi = s.config.raceTargetKpi ?? keyMission?.kpi;
    const targetValue = s.config.raceTargetValue ?? keyMission?.quarterTargets[3];
    if (targetKpi != null && targetValue != null) {
      const finishers = s.seats
        .map((seat, idx) => ({ seat, idx }))
        .filter(({ seat }) => isActive(seat) && computeKpi(seat)[targetKpi] >= targetValue);
      if (finishers.length > 0) {
        endMatch(s, finishers.map((f) => f.idx));
        return s;
      }
    }
  }

  // 8) конец года или следующий такт
  if (s.tick >= TICKS_TOTAL) {
    endMatch(s, s.seats.map((seat, idx) => (isActive(seat) ? idx : -1)).filter((i) => i >= 0));
    return s;
  }
  s.tick += 1;
  beginTick(s);
  return s;
}

// ── финал и победитель ──────────────────────────────────────────────────────
function seatTr(seat: SeatState): number {
  let tr = seat.metrics.sales + seat.metrics.nps + seat.metrics.coverage;
  for (const [mid, done] of Object.entries(seat.missionDone)) {
    if (done) tr += getMission(mid)?.weight ?? 0;
  }
  return tr;
}

function endMatch(s: MatchState, candidateIdxs: number[]): void {
  s.ended = true;
  s.phase = "ended";
  const raceWinners = new Set(s.config.winMode === "race" ? candidateIdxs : []);
  s.outcomes = s.seats.map((seat, idx) => {
    const active = isActive(seat);
    const outcome: SeatOutcome = {
      tr: active ? seatTr(seat) : 0,
      kpi: computeKpi(seat),
      missionsCompleted: Object.entries(seat.missionDone).filter(([, d]) => d).map(([id]) => id),
      raceWinner: raceWinners.has(idx),
    };
    return outcome;
  });
  // победитель среди кандидатов: max ТР → меньше потрачено → меньше действий → ничья (null)
  let best: number[] = [];
  let bestTr = -Infinity;
  for (const idx of candidateIdxs) {
    const tr = s.outcomes[idx].tr;
    if (tr > bestTr) { bestTr = tr; best = [idx]; }
    else if (tr === bestTr) best.push(idx);
  }
  if (best.length > 1) {
    const minSpent = Math.min(...best.map((i) => s.seats[i].spentTotal));
    best = best.filter((i) => s.seats[i].spentTotal === minSpent);
  }
  if (best.length > 1) {
    const minActions = Math.min(...best.map((i) => s.seats[i].actionsTotal));
    best = best.filter((i) => s.seats[i].actionsTotal === minActions);
  }
  s.winnerSeat = best.length === 1 ? best[0] : null;
  for (const seat of s.seats) {
    if (isActive(seat)) pushLog(seat, s.tick, { type: "end", detail: `tr=${seatTr(seat)}` });
  }
}

// ── ручной лебедь (оценщик) ─────────────────────────────────────────────────
export function triggerSwanManually(prev: MatchState, swanId: string, target: RrsId | "all"): MatchState {
  if (prev.ended) return prev;
  const def = getSwan(swanId);
  if (!def) return prev;
  const s = cloneState(prev);
  if (s.activeSwans.some((a) => a.swanId === swanId)) return prev; // уже активен
  s.activeSwans.push({
    swanId,
    scope: target === "all" ? "global" : "local",
    targetRrs: target === "all" ? null : target,
    weeksLeft: def.durationWeeks,
    reactedSeats: [],
  });
  return s;
}

// ── виды состояния (privacy) ─────────────────────────────────────────────────
function seatName(seat: SeatState): string {
  if (seat.controller.kind === "human") return seat.controller.name;
  if (seat.controller.kind === "ai") return `ИИ · уровень ${seat.controller.level}`;
  return "—";
}

function publicSummary(seat: SeatState, idx: number): ZrdSeatPublicSummary {
  return {
    seatIdx: idx,
    rrsId: seat.rrsId,
    controllerKind: seat.controller.kind,
    mascotId: seat.mascotId,
    name: seat.controller.kind === "off" ? RRS_LABEL[seat.rrsId] : seatName(seat),
    metrics: { ...seat.metrics },
    kpi: computeKpi(seat),
    missionsDone: Object.values(seat.missionDone).filter(Boolean).length,
    discardCount: seat.discard.length,
    passed: seat.passed,
  };
}

function missionViews(s: MatchState, seat: SeatState): MissionProgressView[] {
  const kpi = computeKpi(seat);
  const q = quarterOfTick(Math.min(s.tick, TICKS_TOTAL));
  return s.config.missionIds
    .map((mid) => getMission(mid))
    .filter((m): m is NonNullable<typeof m> => Boolean(m))
    .map((m) => ({
      def: m,
      value: kpi[m.kpi],
      target: m.quarterTargets[q - 1],
      finalTarget: m.quarterTargets[3],
      done: Boolean(seat.missionDone[m.id]),
      isKey: m.id === s.config.keyMissionId,
    }));
}

export function toSeatView(s: MatchState, seatIdx: number): ZrdSeatView {
  const seat = s.seats[seatIdx];
  const { deck, log, ...rest } = seat;
  const deckCounts = DECK_IDS.reduce((acc, d) => { acc[d] = 0; return acc; }, {} as Record<DeckId, number>);
  for (const id of deck) deckCounts[getMatchCard(id)!.deck] += 1;
  return {
    matchEnded: s.ended,
    tick: s.tick,
    quarter: quarterOfTick(Math.min(s.tick, TICKS_TOTAL)),
    month: monthOfQuarter(Math.min(s.tick, TICKS_TOTAL)),
    phase: s.phase,
    seatIdx,
    you: { ...rest, deckCounts },
    others: s.seats.map((other, i) => ({ other, i })).filter(({ i }) => i !== seatIdx).map(({ other, i }) => publicSummary(other, i)),
    swans: s.activeSwans.map((a) => ({ ...a })),
    missions: missionViews(s, seat),
    winMode: s.config.winMode,
    scenario: s.config.scenario,
    difficulty: s.config.difficulty,
    minutesPerTick: s.config.minutesPerTick,
    outcomes: s.outcomes,
    winnerSeat: s.winnerSeat,
  };
}

export function toObserverView(s: MatchState): ZrdObserverView {
  return {
    tick: s.tick,
    quarter: quarterOfTick(Math.min(s.tick, TICKS_TOTAL)),
    month: monthOfQuarter(Math.min(s.tick, TICKS_TOTAL)),
    phase: s.phase,
    config: s.config,
    seats: s.seats.map((seat, idx) => ({
      ...publicSummary(seat, idx),
      handCount: seat.hand.length,
      actionsLeft: seat.actionsLeft,
      resources: { ...seat.resources },
    })),
    activeSwans: s.activeSwans.map((a) => ({ ...a })),
    ended: s.ended,
    outcomes: s.outcomes,
    winnerSeat: s.winnerSeat,
  };
}
