import type { SessionSourceType } from "@shared/simulation-content";
import type { RealisticMetrics } from "../simulation-types";

export type EffectPayload = {
  queue: number;
  conversion: number;
  morale: number;
  revenue_impact: number;
  delivery_status: number;
};

export interface MetricApplicationContext {
  sourceType: SessionSourceType;
  title: string;
  description: string;
  zones: string[];
  responsibility?: string;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const normalizeContent = (value: string | undefined) => (value || "").toLowerCase();
const matchesAny = (text: string, patterns: RegExp[]) => patterns.some((pattern) => pattern.test(text));

export function normalizeEffects(effects?: Partial<EffectPayload> | null): EffectPayload {
  return {
    queue: effects?.queue || 0,
    conversion: effects?.conversion || 0,
    morale: effects?.morale || 0,
    revenue_impact: effects?.revenue_impact || 0,
    delivery_status: effects?.delivery_status || 0,
  };
}

function inferMetricWeights(context: MetricApplicationContext): Record<keyof RealisticMetrics, number> {
  const textBlob = `${normalizeContent(context.title)} ${normalizeContent(context.description)} ${normalizeContent(context.responsibility)}`.trim();
  const zones = new Set(context.zones);
  const hallRelated = zones.has("торговый_зал") || matchesAny(textBlob, [/зал/, /клиент/, /витрин/, /продаж/, /конверс/, /выруч/, /аксессуар/]);
  const pickupRelated = zones.has("выдача") || matchesAny(textBlob, [/выдач/, /очеред/, /самовывоз/, /заказ/, /рекламац/, /возврат/]);
  const warehouseRelated = zones.has("склад") || matchesAny(textBlob, [/склад/, /поставк/, /отгруз/, /разгруз/, /приемк/, /товар/]);
  const teamRelated = matchesAny(textBlob, [/сотрудник/, /команд/, /обуч/, /стаж/, /конфликт/, /мотивац/, /смен/]);
  const managementRelated = zones.has("начальство") || matchesAny(textBlob, [/директор/, /регион/, /управля/, /офис/, /проверк/, /отчет/]);
  const customerCareRelated = matchesAny(textBlob, [/жалоб/, /претенз/, /nps/, /клиентск.*оцен/, /сервис/, /клиент/]);
  const financeRelated = matchesAny(textBlob, [/выруч/, /план/, /чек/, /продаж/, /конверс/]);

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

export function applyMetricEffects(
  metrics: RealisticMetrics,
  effects: EffectPayload,
  difficulty: "easy" | "medium" | "hard",
  context: MetricApplicationContext,
): RealisticMetrics {
  const diffMod = difficulty === "easy" ? 1.3 : difficulty === "hard" ? 0.7 : 1;
  const weights = inferMetricWeights(context);
  const nextCustomers = Math.round(metrics.customersInStore + (-effects.queue * 0.4 + effects.conversion * 0.2) * weights.customersInStore * diffMod);
  const nextAvgCheck = Math.round(metrics.avgCheck + effects.conversion * 80 * weights.avgCheck * diffMod + effects.revenue_impact * 12 * weights.avgCheck);
  const nextConversion = Math.round(metrics.conversion + effects.conversion * weights.conversion * diffMod - effects.queue * 0.15 * weights.conversion);
  const nextClientRating = Math.round((metrics.nps + effects.delivery_status * 0.08 * weights.nps + effects.morale * 0.006 * weights.nps) * 100) / 100;
  const nextPickupSpeed = Math.round(metrics.pickupSpeed + effects.queue * -0.35 * weights.pickupSpeed + effects.delivery_status * -0.12 * weights.pickupSpeed);
  const nextWarehouseLoad = Math.round(metrics.warehouseLoad + effects.delivery_status * -3 * weights.warehouseLoad + effects.queue * 0.2 * weights.warehouseLoad);
  const nextTeamMorale = Math.round((metrics.teamMorale + effects.morale / 10 * weights.teamMorale + effects.queue * -0.01 * weights.teamMorale) * 10) / 10;
  const nextDailyRevenue = Math.round(metrics.dailyRevenue + (effects.revenue_impact * 45 + effects.conversion * 10) * weights.dailyRevenue * diffMod);

  return {
    customersInStore: clamp(nextCustomers, 2, 60),
    avgCheck: clamp(nextAvgCheck, 3000, 20000),
    conversion: clamp(nextConversion, 20, 85),
    nps: clamp(nextClientRating, 1, 5),
    pickupSpeed: clamp(nextPickupSpeed, 5, 45),
    warehouseLoad: clamp(nextWarehouseLoad, 15, 100),
    teamMorale: clamp(nextTeamMorale, 1, 10),
    dailyRevenue: clamp(nextDailyRevenue, 600, 3500),
  };
}
