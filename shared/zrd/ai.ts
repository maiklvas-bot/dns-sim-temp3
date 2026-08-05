/**
 * Симуляция ЗРД — политика игрока (rule-based). Используется и как AI-бот (оппонент),
 * и как набор «персон» для проверки дифференциации скоринга в Фазе 2.
 * Чистая функция состояния → детерминированно.
 */
import type { ZrdState, TurnIntent, StrategyKey, ProjectCard, StandardAction, Resources, Metrics, CardCondition } from "./types";
import { RESOURCE_KEYS, METRIC_KEYS } from "./types";
import { contextTags } from "./engine";

export type PlayStyle = "balanced" | "planner" | "improviser" | "risktaker" | "weak";
export interface PolicyOptions { style?: PlayStyle; strategy?: StrategyKey; }

function affordable(res: Resources, cost?: Partial<Resources>): boolean {
  if (!cost) return true;
  return RESOURCE_KEYS.every((k) => (res[k] ?? 0) >= (cost[k] ?? 0));
}
function condOk(s: ZrdState, cond?: CardCondition): boolean {
  if (!cond) return true;
  const p = s.player;
  if (cond.minMetric) for (const k of METRIC_KEYS) if (p.metrics[k] < (cond.minMetric[k] ?? 0)) return false;
  if (cond.minResource) for (const k of RESOURCE_KEYS) if (p.resources[k] < (cond.minResource[k] ?? 0)) return false;
  if (cond.minResourceProd) for (const k of RESOURCE_KEYS) if (p.resourceProd[k] < (cond.minResourceProd[k] ?? 0)) return false;
  return true;
}

function defaultStrategy(style: PlayStyle): StrategyKey {
  if (style === "planner") return "efficiency";
  if (style === "risktaker" || style === "weak") return "expansion";
  return "service";
}

function behindMetric(s: ZrdState): keyof Metrics {
  const t = s.diff.earlyWinTargets; const m = s.player.metrics;
  let worst: keyof Metrics = "sales"; let gap = -Infinity;
  for (const k of METRIC_KEYS) { const g = t[k] - m[k]; if (g > gap) { gap = g; worst = k; } }
  return worst;
}

function cardValue(s: ZrdState, c: ProjectCard, strategy: StrategyKey | null): number {
  const behind = behindMetric(s);
  let v = 0;
  v += (c.effects.resourceProd?.capital ?? 0) * 3;            // доход важен
  if (c.effects.metrics?.[behind]) v += c.effects.metrics[behind]! * 2;
  if (c.effects.metricProd?.[behind]) v += c.effects.metricProd[behind]! * 2.5;
  if (c.longTerm) v += s.quarter <= 2 ? 1.2 : 0.3;            // движок ценнее рано
  if (strategy === "service" && (c.category === "hr" || c.effects.metrics?.nps)) v += 1.2;
  if (strategy === "expansion" && (c.category === "infra")) v += 1.2;
  if (strategy === "efficiency" && (c.effects.resourceProd || c.longTerm)) v += 1.2;
  v -= (c.cost.capital ?? 0) * 0.04;
  return v;
}

export function chooseIntent(s: ZrdState, opts: PolicyOptions = {}): TurnIntent {
  const style = opts.style ?? "balanced";
  const p = s.player;

  if (s.phase === "setup") return { kind: "declareStrategy", strategy: opts.strategy ?? defaultStrategy(style) };

  if (s.phase === "research") {
    // оценить карты в оффере, оставить лучшие доступные
    const scored = s.offer
      .filter((c) => affordable(p.resources, c.cost) || c.cost.capital! <= p.resources.capital + p.resourceProd.capital)
      .map((c) => ({ c, v: cardValue(s, c, p.declaredStrategy) }))
      .sort((a, b) => b.v - a.v);
    const keepN = style === "weak" ? Math.min(1, scored.length) : style === "planner" ? Math.min(2, scored.length) : Math.min(2, scored.length);
    const ids = (style === "weak" ? s.offer.slice(0, keepN) : scored.slice(0, keepN).map((x) => x.c)).map((c) => c.id);
    return { kind: "keepCards", cardIds: ids };
  }

  if (s.phase === "action") {
    // planner смотрит данные перед ходами
    if (style === "planner" && !p.viewedDataThisQuarter) return { kind: "viewData" };
    if (s.actionsLeft <= 0) return { kind: "pass" };
    // лучшая доступная карта
    const playable = p.hand
      .filter((c) => affordable(p.resources, c.cost) && condOk(s, c.condition))
      .map((c) => ({ c, v: cardValue(s, c, p.declaredStrategy) }))
      .sort((a, b) => b.v - a.v);
    if (playable.length && playable[0].v > 0.5) return { kind: "playCard", cardId: playable[0].c.id };
    // иначе стандартное действие на отстающий показатель
    const behind = behindMetric(s);
    const std: Record<keyof Metrics, StandardAction> = { sales: "promo", nps: "improve_service", coverage: "open_basic" };
    const action = std[behind];
    const cost: Partial<Resources> = action === "open_basic" ? { capital: 10 } : action === "improve_service" ? { capital: 6 } : { capital: 4 };
    if (style !== "weak" && affordable(p.resources, cost)) return { kind: "standard", action };
    if (affordable(p.resources, { capital: 4 })) return { kind: "standard", action: "promo" };
    return { kind: "pass" };
  }

  if (s.phase === "event" && s.pendingEvent) {
    const ev = s.pendingEvent; const tags = contextTags(s);
    const fitting = ev.options.filter((o) => o.fitsWhen.some((tag) => tags.includes(tag)) && affordable(p.resources, o.cost));
    if (style === "weak") {
      const weak = ev.options.find((o) => o.weak) ?? ev.options[ev.options.length - 1];
      return { kind: "eventChoice", optionId: weak.id };
    }
    if (style === "improviser" && ev.options.length > 1) {
      // не всегда оптимально: берёт первый доступный, не сверяясь с контекстом
      const any = ev.options.find((o) => affordable(p.resources, o.cost)) ?? ev.options[0];
      return { kind: "eventChoice", optionId: any.id };
    }
    const pick = fitting[0] ?? ev.options.find((o) => affordable(p.resources, o.cost)) ?? ev.options[0];
    return { kind: "eventChoice", optionId: pick.id };
  }

  return { kind: "pass" };
}
