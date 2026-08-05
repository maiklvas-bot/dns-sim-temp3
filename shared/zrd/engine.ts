/**
 * Симуляция ЗРД — движок (Фаза 1). Чистые детерминированные функции.
 * Поток квартала: research → action → event → production → (next | end).
 * Клиент/AI шлёт TurnIntent; applyIntent применяет и логирует. RNG — seeded.
 */
import type {
  ZrdState, ZrdConfig, TurnIntent, ApplyResult, TurnLogEntry, Effects, Resources, Metrics,
  ProjectCard, EventCard, EventOption, ContextTag, PlayerState, Outcome, CardCondition,
} from "./types";
import { RESOURCE_KEYS, METRIC_KEYS } from "./types";
import {
  DIFFICULTY_CONFIGS, pickContentForDifficulty, STANDARD_ACTIONS, emptyMetrics, emptyResources,
} from "./content";

// ── seeded RNG (mulberry32) ────────────────────────────────────────────────
function nextRng(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
}

function shuffle<T>(arr: T[], seed: number): { arr: T[]; seed: number } {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    const r = nextRng(s); s = r.state;
    const j = Math.floor(r.value * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return { arr: out, seed: s };
}

// ── helpers ────────────────────────────────────────────────────────────────
function clampMetric(v: number): number { return Math.max(0, Math.min(20, v)); }

function cloneState(s: ZrdState): ZrdState {
  return JSON.parse(JSON.stringify(s));
}

function canAfford(p: PlayerState, cost: Partial<Resources> | undefined): boolean {
  if (!cost) return true;
  return RESOURCE_KEYS.every((k) => (p.resources[k] ?? 0) >= (cost[k] ?? 0));
}

function payCost(p: PlayerState, cost: Partial<Resources> | undefined): void {
  if (!cost) return;
  for (const k of RESOURCE_KEYS) p.resources[k] -= cost[k] ?? 0;
}

function meetsCondition(p: PlayerState, cond: CardCondition | undefined): boolean {
  if (!cond) return true;
  if (cond.minMetric) for (const k of METRIC_KEYS) if ((p.metrics[k] ?? 0) < (cond.minMetric[k] ?? 0)) return false;
  if (cond.minResource) for (const k of RESOURCE_KEYS) if ((p.resources[k] ?? 0) < (cond.minResource[k] ?? 0)) return false;
  if (cond.minResourceProd) for (const k of RESOURCE_KEYS) if ((p.resourceProd[k] ?? 0) < (cond.minResourceProd[k] ?? 0)) return false;
  return true;
}

function applyEffects(p: PlayerState, eff: Effects | undefined, penaltyMult = 1): void {
  if (!eff) return;
  if (eff.resources) for (const k of RESOURCE_KEYS) if (eff.resources[k] != null) p.resources[k] += scaleNeg(eff.resources[k]!, penaltyMult);
  if (eff.resourceProd) for (const k of RESOURCE_KEYS) if (eff.resourceProd[k] != null) p.resourceProd[k] = Math.max(0, p.resourceProd[k] + scaleNeg(eff.resourceProd[k]!, penaltyMult));
  if (eff.metrics) for (const k of METRIC_KEYS) if (eff.metrics[k] != null) p.metrics[k] = clampMetric(p.metrics[k] + scaleNeg(eff.metrics[k]!, penaltyMult));
  if (eff.metricProd) for (const k of METRIC_KEYS) if (eff.metricProd[k] != null) p.metricProd[k] = Math.max(0, p.metricProd[k] + eff.metricProd[k]!);
}

/** отрицательные значения масштабируются множителем наказания, положительные — нет (§7). */
function scaleNeg(v: number, mult: number): number {
  return v < 0 ? Math.round(v * mult) : v;
}

// ── контекст-теги (для скоринга по уместности, §8a) ────────────────────────
export function contextTags(s: ZrdState): ContextTag[] {
  const p = s.player; const t = s.diff.earlyWinTargets; const tags: ContextTag[] = ["anyReasonable"];
  if (p.resources.capital < 10) tags.push("lowCapital"); else tags.push("highCapital");
  if (p.resources.staff >= 1) tags.push("hasStaff"); else tags.push("lowStaff");
  if (p.resources.tech >= 1) tags.push("hasTech");
  if (p.resources.warehouse >= 2) tags.push("hasWarehouse");
  if (p.metrics.nps < t.nps - 1) tags.push("lowNps");
  if (p.metrics.sales < t.sales - 1) tags.push("lowSales");
  if (p.metrics.coverage < t.coverage - 1) tags.push("lowCoverage");
  const behind = METRIC_KEYS.filter((k) => p.metrics[k] < t[k]).length;
  if (behind >= 2) tags.push("behindTargets");
  if (p.resourceProd.capital >= 5 && behind <= 1) tags.push("stableEngine");
  return tags;
}

// ── init ───────────────────────────────────────────────────────────────────
export function initState(config: ZrdConfig): ZrdState {
  const diff = DIFFICULTY_CONFIGS[config.difficulty];
  const content = pickContentForDifficulty(config.difficulty);
  const sh1 = shuffle(content.deck, config.seed);
  const sh2 = shuffle(content.events, sh1.seed);
  const player: PlayerState = {
    resources: { ...diff.startResources },
    resourceProd: { ...diff.startProd },
    metrics: { ...diff.startMetrics },
    metricProd: emptyMetrics(),
    declaredStrategy: config.strategy ?? null,
    hand: [],
    playedCardIds: [],
    pendingMods: [],
    viewedDataThisQuarter: false,
    nextEventHarsher: false,
  };
  return {
    config, diff,
    quarter: 1,
    phase: config.strategy ? "research" : "setup",
    player,
    deck: sh1.arr,
    offer: [],
    eventDeck: sh2.arr,
    pendingEvent: null,
    actionsLeft: 0,
    passed: false,
    rng: sh2.seed,
    log: [],
    ended: false,
  };
}

function pushLog(s: ZrdState, e: Omit<TurnLogEntry, "quarter" | "ctxTags" | "metrics" | "resources"> & Partial<TurnLogEntry>): TurnLogEntry {
  const entry: TurnLogEntry = {
    quarter: s.quarter,
    ctxTags: contextTags(s),
    metrics: { ...s.player.metrics },
    resources: { ...s.player.resources },
    ...e,
  } as TurnLogEntry;
  s.log.push(entry);
  return entry;
}

// ── фазы ────────────────────────────────────────────────────────────────────
function enterResearch(s: ZrdState): void {
  s.phase = "research";
  s.player.viewedDataThisQuarter = false;
  // разложить 4 карты (или сколько есть)
  const n = Math.min(4, s.deck.length);
  s.offer = s.deck.slice(0, n);
  s.deck = s.deck.slice(n);
}

function enterAction(s: ZrdState): void {
  s.phase = "action";
  s.actionsLeft = s.diff.actionsPerQuarter;
  s.passed = false;
}

function enterEvent(s: ZrdState): void {
  s.phase = "event";
  if (s.eventDeck.length === 0) { s.eventDeck = []; }
  s.pendingEvent = s.eventDeck.length ? s.eventDeck[0] : null;
  if (s.eventDeck.length) s.eventDeck = s.eventDeck.slice(1).concat(s.pendingEvent!); // циклически
}

function runProduction(s: ZrdState): void {
  const p = s.player;
  for (const k of RESOURCE_KEYS) p.resources[k] += p.resourceProd[k];
  for (const k of METRIC_KEYS) p.metrics[k] = clampMetric(p.metrics[k] + p.metricProd[k]);
  // временные модификаторы prod (напр. наставничество)
  p.pendingMods = p.pendingMods.filter((m) => {
    for (const k of METRIC_KEYS) if (m.metricProd[k] != null) p.metrics[k] = clampMetric(p.metrics[k] + m.metricProd[k]!);
    m.quartersLeft -= 1;
    return m.quartersLeft > 0;
  });
  pushLog(s, { type: "production", detail: `q${s.quarter}` });
}

function computeOutcome(s: ZrdState): Outcome {
  const m = s.player.metrics;
  const t = s.diff.earlyWinTargets;
  const earlyWin = METRIC_KEYS.every((k) => m[k] >= t[k]);
  let tr = m.sales + m.nps + m.coverage;
  // бонусы стратегии (§8)
  const strat = s.player.declaredStrategy;
  if (strat === "service") tr += Math.max(0, m.nps - t.nps);
  if (strat === "expansion") tr += Math.max(0, m.coverage - t.coverage);
  if (strat === "efficiency") {
    const reserve = RESOURCE_KEYS.reduce((a, k) => a + s.player.resources[k], 0);
    if (reserve >= 30) tr += 2;
  }
  return { metrics: { ...m }, tr, earlyWin, quartersPlayed: s.quarter };
}

function endGame(s: ZrdState): void {
  s.ended = true;
  s.phase = "ended";
  s.outcome = computeOutcome(s);
  pushLog(s, { type: "end", detail: `tr=${s.outcome.tr}` });
}

function advanceAfterProduction(s: ZrdState): void {
  // ранняя победа?
  const m = s.player.metrics; const t = s.diff.earlyWinTargets;
  if (METRIC_KEYS.every((k) => m[k] >= t[k])) { endGame(s); return; }
  if (s.quarter >= s.config.quarters) { endGame(s); return; }
  s.quarter += 1;
  enterResearch(s);
}

// ── applyIntent ─────────────────────────────────────────────────────────────
export function applyIntent(prev: ZrdState, intent: TurnIntent): ApplyResult {
  if (prev.ended) return { state: prev, ok: false, error: "GAME_ENDED" };
  const s = cloneState(prev);
  const p = s.player;

  switch (intent.kind) {
    case "declareStrategy": {
      if (s.phase !== "setup") return fail(prev, "BAD_PHASE");
      p.declaredStrategy = intent.strategy;
      pushLog(s, { type: "declare", detail: intent.strategy, choiceId: intent.strategy });
      enterResearch(s);
      return ok(s);
    }
    case "keepCards": {
      if (s.phase !== "research") return fail(prev, "BAD_PHASE");
      const kept: ProjectCard[] = [];
      let idx = 0;
      for (const id of intent.cardIds) {
        const card = s.offer.find((c) => c.id === id);
        if (!card) continue;
        const keepCost = idx === 0 ? 0 : 2; // первая бесплатно, далее 2К (v2)
        if (p.resources.capital < keepCost) break;
        p.resources.capital -= keepCost;
        kept.push(card);
        idx++;
      }
      p.hand.push(...kept);
      s.offer = [];
      pushLog(s, { type: "keep", detail: kept.map((c) => c.id).join(","), choiceId: String(kept.length) });
      enterAction(s);
      return ok(s);
    }
    case "viewData": {
      if (s.phase !== "action") return fail(prev, "BAD_PHASE");
      p.viewedDataThisQuarter = true;
      pushLog(s, { type: "standard", detail: "view_data", choiceId: "view_data" });
      return ok(s);
    }
    case "playCard": {
      if (s.phase !== "action") return fail(prev, "BAD_PHASE");
      if (s.actionsLeft <= 0) return fail(prev, "NO_ACTIONS");
      const card = p.hand.find((c) => c.id === intent.cardId);
      if (!card) return fail(prev, "NO_CARD");
      if (!canAfford(p, card.cost)) return fail(prev, "CANT_AFFORD");
      if (!meetsCondition(p, card.condition)) return fail(prev, "COND_NOT_MET");
      payCost(p, card.cost);
      applyEffects(p, card.effects);
      if (card.tempMetricProd) p.pendingMods.push({ metricProd: { ...card.tempMetricProd.metricProd }, quartersLeft: card.tempMetricProd.quarters });
      if (card.warehouseStrain && p.resources.warehouse < 1) p.metrics.nps = clampMetric(p.metrics.nps - 1);
      if (card.id === "new_district") p.nextEventHarsher = true;
      p.hand = p.hand.filter((c) => c.id !== card.id);
      p.playedCardIds.push(card.id);
      s.actionsLeft -= 1;
      pushLog(s, { type: "play_card", detail: card.id, choiceId: card.id });
      return ok(s);
    }
    case "standard": {
      if (s.phase !== "action") return fail(prev, "BAD_PHASE");
      if (s.actionsLeft <= 0) return fail(prev, "NO_ACTIONS");
      const def = STANDARD_ACTIONS[intent.action];
      if (!canAfford(p, def.cost)) return fail(prev, "CANT_AFFORD");
      payCost(p, def.cost);
      applyEffects(p, def.effects);
      s.actionsLeft -= 1;
      pushLog(s, { type: "standard", detail: intent.action, choiceId: intent.action });
      return ok(s);
    }
    case "pass": {
      if (s.phase !== "action") return fail(prev, "BAD_PHASE");
      pushLog(s, { type: "pass", detail: "pass" });
      enterEvent(s);
      // если события нет — сразу производство
      if (!s.pendingEvent) { runProduction(s); advanceAfterProduction(s); }
      return ok(s);
    }
    case "eventChoice": {
      if (s.phase !== "event" || !s.pendingEvent) return fail(prev, "BAD_PHASE");
      const ev = s.pendingEvent;
      const opt = ev.options.find((o) => o.id === intent.optionId);
      if (!opt) return fail(prev, "NO_OPTION");
      if (!canAfford(p, opt.cost)) return fail(prev, "CANT_AFFORD");
      const mult = (s.diff.penaltyMultiplier) * (p.nextEventHarsher ? 1.5 : 1);
      // базовый урон (если применим и не погашен опцией)
      const hitApplies = ev.baseHit && !meetsCondition(p, ev.baseHitWhen) && !opt.negatesBaseHit;
      if (hitApplies) applyEffects(p, ev.baseHit, mult);
      payCost(p, opt.cost);
      applyEffects(p, opt.effects, mult);
      p.nextEventHarsher = false;
      pushLog(s, { type: "event", detail: `${ev.id}:${opt.id}`, choiceId: opt.id });
      s.pendingEvent = null;
      runProduction(s);
      advanceAfterProduction(s);
      return ok(s);
    }
    default:
      return fail(prev, "UNKNOWN_INTENT");
  }
}

function ok(s: ZrdState): ApplyResult {
  return { state: s, ok: true, log: s.log[s.log.length - 1] };
}
function fail(prev: ZrdState, error: string): ApplyResult {
  return { state: prev, ok: false, error };
}

export { runProduction, computeOutcome };

/**
 * Публичное состояние для игрока/наблюдателя: скрывает порядок колоды, колоду событий и RNG
 * (целостность ассессмента — нельзя «подсмотреть» будущие карты). Открытый оффер/событие/рука
 * остаются. Возвращает обычный объект, безопасный для отправки на клиент.
 */
export function toPublicState(s: ZrdState) {
  const { deck, eventDeck, rng, ...rest } = s;
  return { ...rest, deckRemaining: deck.length, eventsRemaining: eventDeck.length };
}
export type PublicZrdState = ReturnType<typeof toPublicState>;
