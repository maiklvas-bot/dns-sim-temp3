/**
 * ЗРД v2 — контент колод: 6 колод × 50 карт = 300 (спека §3).
 * Каждая колода собирается из 9 «якорей» (существующие арты Canva, id = zrd-decks.ts):
 * якоря 1–5 дают по 6 вариантов (t1×2, t2×2, t3×2), якоря 6–9 — по 5 (t3×1) → 5×6+4×5 = 50.
 * Числа — экономика v3 (месячный доход 3–6 капитала); баланс держит харнесс zrd-match-sim.
 */
import type { Metrics, Resources, CompetencyKey } from "./types";
import type { DeckId, MatchCardDef, MatchCardCondition, MatchCardEffects, CardTier } from "./match-types";
import { DECK_IDS } from "./match-types";

export interface AnchorDef {
  anchorId: string;
  title: string;
  cost: Partial<Resources>;
  effects: MatchCardEffects;
  competencyTags: CompetencyKey[];
}

// ── Вариантные суффиксы (масштаб внедрения) ────────────────────────────────
const VARIANT_SUFFIX: readonly string[] = ["пилот", "точечно", "стандарт", "сеть", "масштаб", "дивизион"];
// параметры вариантов: тир, множитель цены, множитель эффекта, длительность (нед.)
const VARIANTS: readonly { tier: CardTier; costK: number; effK: number; weeks: number; cond: boolean }[] = [
  { tier: 1, costK: 0.6, effK: 0.6, weeks: 0, cond: false },
  { tier: 1, costK: 0.8, effK: 0.8, weeks: 0, cond: false },
  { tier: 2, costK: 1.0, effK: 1.0, weeks: 2, cond: false },
  { tier: 2, costK: 1.2, effK: 1.2, weeks: 4, cond: true },
  { tier: 3, costK: 1.6, effK: 1.8, weeks: 6, cond: true },
  { tier: 3, costK: 2.0, effK: 2.2, weeks: 8, cond: true },
];

// условие по колоде: чем «профильнее» колода, тем профильнее порог
const DECK_CONDITION: Record<DeckId, (tier: CardTier) => MatchCardCondition> = {
  promo: (t) => ({ minMetric: { sales: t === 3 ? 5 : 3 } }),
  service: (t) => ({ minMetric: { nps: t === 3 ? 5 : 3 } }),
  logistics: (t) => ({ minResource: { warehouse: t === 3 ? 2 : 1 } }),
  goods: (t) => ({ minResource: { warehouse: t === 3 ? 2 : 1 } }),
  staff: (t) => ({ minResource: { staff: t === 3 ? 2 : 1 } }),
  projects: (t) => ({ minMetric: { coverage: t === 3 ? 5 : 3 } }),
};

function scaleNum(v: number, k: number): number {
  const scaled = v * k;
  const rounded = scaled >= 0 ? Math.max(1, Math.round(scaled)) : Math.min(-1, Math.round(scaled));
  return v === 0 ? 0 : rounded;
}
function scalePartial<T extends string>(rec: Partial<Record<T, number>> | undefined, k: number): Partial<Record<T, number>> | undefined {
  if (!rec) return undefined;
  const out: Partial<Record<T, number>> = {};
  for (const key of Object.keys(rec) as T[]) out[key] = scaleNum(rec[key]!, k);
  return out;
}
function scaleEffects(e: MatchCardEffects, k: number): MatchCardEffects {
  return {
    ...(e.resources ? { resources: scalePartial<keyof Resources & string>(e.resources, k) } : {}),
    ...(e.resourceProd ? { resourceProd: scalePartial<keyof Resources & string>(e.resourceProd, k) } : {}),
    ...(e.metrics ? { metrics: scalePartial<keyof Metrics & string>(e.metrics, k) } : {}),
    ...(e.metricProd ? { metricProd: scalePartial<keyof Metrics & string>(e.metricProd, k) } : {}),
  };
}
function scaleCost(cost: Partial<Resources>, k: number): Partial<Resources> {
  const out: Partial<Resources> = { ...cost };
  if (out.capital != null && out.capital > 0) out.capital = Math.max(1, Math.ceil(out.capital * k));
  return out;
}

function expandAnchor(deck: DeckId, anchor: AnchorDef, variantsCount: 5 | 6): MatchCardDef[] {
  return VARIANTS.slice(0, variantsCount).map((v, i) => ({
    id: `${anchor.anchorId}_t${v.tier}_v${i + 1}`,
    deck,
    anchorId: anchor.anchorId,
    tier: v.tier,
    title: `${anchor.title} · ${VARIANT_SUFFIX[i]}`,
    cost: scaleCost(anchor.cost, v.costK),
    ...(v.cond ? { condition: DECK_CONDITION[deck](v.tier) } : {}),
    effects: scaleEffects(anchor.effects, v.effK),
    durationWeeks: v.weeks,
    competencyTags: [...anchor.competencyTags],
  }));
}

// ── Якоря (id и названия = арты zrd-decks.ts) ──────────────────────────────
export const DECK_ANCHORS: Record<DeckId, AnchorDef[]> = {
  promo: [
    { anchorId: "pr_ad", title: "Реклама", cost: { capital: 6 }, effects: { metrics: { sales: 1 } }, competencyTags: ["initiative", "result_orientation"] },
    { anchorId: "pr_tv", title: "ТВ реклама", cost: { capital: 10 }, effects: { metrics: { sales: 2, coverage: 1 } }, competencyTags: ["result_orientation", "strategic_vision"] },
    { anchorId: "pr_viral", title: "Вирусный ролик в сети", cost: { capital: 5 }, effects: { metrics: { coverage: 1, sales: 1 } }, competencyTags: ["initiative"] },
    { anchorId: "pr_branding", title: "Брендинг", cost: { capital: 8 }, effects: { metricProd: { sales: 1 } }, competencyTags: ["strategic_vision"] },
    { anchorId: "pr_loyalty", title: "Программа лояльности", cost: { capital: 7 }, effects: { metrics: { nps: 1 }, metricProd: { sales: 1 } }, competencyTags: ["strategic_vision", "result_orientation"] },
    { anchorId: "pr_sale", title: "Акция распродажа", cost: { capital: 4 }, effects: { metrics: { sales: 1, nps: -1 } }, competencyTags: ["result_orientation", "critical_thinking"] },
    { anchorId: "pr_promoter", title: "Промоутеры на улице", cost: { capital: 3 }, effects: { metrics: { sales: 1 } }, competencyTags: ["initiative"] },
    { anchorId: "pr_reviews", title: "Работа с отзывами", cost: { capital: 3 }, effects: { metrics: { nps: 1 } }, competencyTags: ["communication", "critical_thinking"] },
    { anchorId: "pr_cutbudget", title: "Сократить бюджеты", cost: {}, effects: { resources: { capital: 4 }, metrics: { coverage: -1 } }, competencyTags: ["critical_thinking", "decision_making"] },
  ],
  service: [
    { anchorId: "sv_operations", title: "Сервисные операции", cost: { capital: 6 }, effects: { metrics: { nps: 1 } }, competencyTags: ["planning", "result_orientation"] },
    { anchorId: "sv_recovery", title: "Восстановление клиента", cost: { capital: 5 }, effects: { metrics: { nps: 1, sales: 1 } }, competencyTags: ["communication"] },
    { anchorId: "sv_warranty", title: "Гарантийный процесс", cost: { capital: 6 }, effects: { metricProd: { nps: 1 } }, competencyTags: ["planning"] },
    { anchorId: "sv_court", title: "Судебная защита", cost: { capital: 8 }, effects: { metrics: { nps: 2 } }, competencyTags: ["conflict_management", "decision_making"] },
    { anchorId: "sv_repair", title: "Ремонтная мастерская", cost: { capital: 4 }, effects: { metrics: { nps: 1 } }, competencyTags: ["planning"] },
    { anchorId: "sv_replace", title: "Быстрая замена", cost: { capital: 6 }, effects: { metrics: { nps: 1 } }, competencyTags: ["decision_making"] },
    { anchorId: "sv_claim", title: "Разбор претензии", cost: { capital: 3 }, effects: { metrics: { nps: 1 } }, competencyTags: ["conflict_management", "communication"] },
    { anchorId: "sv_nowarranty", title: "Платный не-гарантийный сервис", cost: {}, effects: { resources: { capital: 3 }, metrics: { nps: -1 } }, competencyTags: ["critical_thinking", "decision_making"] },
    { anchorId: "sv_extremist", title: "Разбор потребэкстремизма", cost: { capital: 2 }, effects: { metrics: { nps: 1 } }, competencyTags: ["conflict_management", "critical_thinking"] },
  ],
  logistics: [
    { anchorId: "lg_supply", title: "Поставка", cost: { capital: 6 }, effects: { resources: { warehouse: 1 } }, competencyTags: ["planning"] },
    { anchorId: "lg_warehouse", title: "Складирование", cost: { capital: 8 }, effects: { resourceProd: { warehouse: 1 } }, competencyTags: ["planning", "strategic_vision"] },
    { anchorId: "lg_delivery", title: "Доставка до клиента", cost: { capital: 7 }, effects: { metrics: { nps: 1, sales: 1 } }, competencyTags: ["result_orientation"] },
    { anchorId: "lg_distribute", title: "Распределение по сети", cost: { capital: 5 }, effects: { metrics: { sales: 1 } }, competencyTags: ["analytical", "planning"] },
    { anchorId: "lg_shipping", title: "Отгрузка", cost: { capital: 6 }, effects: { metrics: { sales: 1 } }, competencyTags: ["planning"] },
    { anchorId: "lg_transport", title: "Транспортировка", cost: { capital: 5 }, effects: { resources: { warehouse: 1 } }, competencyTags: ["planning"] },
    { anchorId: "lg_acceptance", title: "Приёмка товара", cost: { capital: 4 }, effects: { resources: { warehouse: 1 } }, competencyTags: ["analytical"] },
    { anchorId: "lg_picking", title: "Комплектация заказа", cost: { capital: 4 }, effects: { metrics: { nps: 1 } }, competencyTags: ["planning"] },
    { anchorId: "lg_inventory", title: "Инвентаризация склада", cost: { capital: 3 }, effects: { resources: { warehouse: 1 } }, competencyTags: ["analytical", "critical_thinking"] },
  ],
  goods: [
    { anchorId: "gd_assortment", title: "Ассортиментная матрица", cost: { capital: 7, warehouse: 1 }, effects: { metrics: { sales: 2 } }, competencyTags: ["analytical", "strategic_vision"] },
    { anchorId: "gd_purchase", title: "Закупка", cost: { capital: 6 }, effects: { resources: { warehouse: 1 }, metrics: { sales: 1 } }, competencyTags: ["analytical", "planning"] },
    { anchorId: "gd_pricing", title: "Ценообразование", cost: { capital: 4 }, effects: { metrics: { sales: 1 } }, competencyTags: ["analytical", "critical_thinking"] },
    { anchorId: "gd_display", title: "Выкладка", cost: { capital: 4 }, effects: { metrics: { sales: 1 } }, competencyTags: ["result_orientation"] },
    { anchorId: "gd_storage", title: "Хранение", cost: { capital: 4 }, effects: { resourceProd: { warehouse: 1 } }, competencyTags: ["planning"] },
    { anchorId: "gd_arrival", title: "Поступление товара", cost: { capital: 5 }, effects: { resources: { warehouse: 1 } }, competencyTags: ["planning"] },
    { anchorId: "gd_acceptance", title: "Приёмка партии", cost: { capital: 3 }, effects: { resources: { warehouse: 1 } }, competencyTags: ["analytical"] },
    { anchorId: "gd_labeling", title: "Маркировка", cost: { capital: 3 }, effects: { metrics: { nps: 1 } }, competencyTags: ["planning"] },
    { anchorId: "gd_inventory", title: "Инвентаризация товара", cost: { capital: 3 }, effects: { resources: { capital: 2 }, metrics: { sales: 0 } }, competencyTags: ["analytical", "critical_thinking"] },
  ],
  staff: [
    { anchorId: "st_hire", title: "Нанять персонал", cost: { capital: 6 }, effects: { resourceProd: { staff: 1 } }, competencyTags: ["team_motivation", "planning"] },
    { anchorId: "st_competency", title: "Развитие компетенций", cost: { capital: 6 }, effects: { metrics: { nps: 1 } }, competencyTags: ["team_motivation"] },
    { anchorId: "st_mentoring", title: "Наставничество", cost: { capital: 6, staff: 1 }, effects: { metricProd: { nps: 1 } }, competencyTags: ["team_motivation", "communication"] },
    { anchorId: "st_team", title: "Собрать команду", cost: { capital: 8, staff: 1 }, effects: { metrics: { nps: 2 } }, competencyTags: ["team_motivation", "communication"] },
    { anchorId: "st_learning", title: "Адаптивное обучение", cost: { capital: 7 }, effects: { metricProd: { nps: 1 } }, competencyTags: ["team_motivation", "strategic_vision"] },
    { anchorId: "st_motivation", title: "Повысить мотивацию", cost: { capital: 5 }, effects: { metrics: { nps: 1 } }, competencyTags: ["team_motivation"] },
    { anchorId: "st_recruit", title: "Точечный рекрутинг", cost: { capital: 4 }, effects: { resources: { staff: 1 } }, competencyTags: ["goal_setting"] },
    { anchorId: "st_assessment", title: "Оценка навыков", cost: { capital: 4 }, effects: { metrics: { nps: 1 } }, competencyTags: ["analytical", "team_motivation"] },
    { anchorId: "st_retain", title: "Удержание сотрудников", cost: { capital: 5 }, effects: { resources: { staff: 1 } }, competencyTags: ["team_motivation", "conflict_management"] },
  ],
  projects: [
    { anchorId: "pj_open_store", title: "Открытие магазина", cost: { capital: 12, staff: 1 }, effects: { metrics: { coverage: 2 }, metricProd: { sales: 1 } }, competencyTags: ["strategic_vision", "goal_setting"] },
    { anchorId: "pj_new_loc", title: "Развитие новой локации", cost: { capital: 14, staff: 1 }, effects: { metrics: { coverage: 2 }, resourceProd: { capital: 1 } }, competencyTags: ["strategic_vision", "planning"] },
    { anchorId: "pj_warehouse", title: "Расширение склада", cost: { capital: 10 }, effects: { resources: { warehouse: 1 }, resourceProd: { warehouse: 1 } }, competencyTags: ["planning", "strategic_vision"] },
    { anchorId: "pj_potential", title: "Раскрытие потенциала РРС", cost: { capital: 12 }, effects: { metrics: { coverage: 1, sales: 1 }, resourceProd: { capital: 1 } }, competencyTags: ["strategic_vision", "analytical"] },
    { anchorId: "pj_modernize", title: "Модернизация зала", cost: { capital: 9 }, effects: { metrics: { nps: 2 } }, competencyTags: ["planning", "decision_making"] },
    { anchorId: "pj_pickup", title: "Пункт выдачи", cost: { capital: 7 }, effects: { metrics: { coverage: 1 } }, competencyTags: ["goal_setting"] },
    { anchorId: "pj_relocate", title: "Переезд магазина", cost: { capital: 9 }, effects: { metrics: { coverage: 1, nps: 1 } }, competencyTags: ["decision_making", "planning"] },
    { anchorId: "pj_resize", title: "Изменение площади", cost: { capital: 8 }, effects: { metrics: { sales: 1, coverage: 1 } }, competencyTags: ["analytical", "decision_making"] },
    { anchorId: "pj_close_store", title: "Закрытие точки", cost: {}, effects: { resources: { capital: 6 }, metrics: { coverage: -1 } }, competencyTags: ["critical_thinking", "decision_making"] },
  ],
};

// ── Сборка 300 карт ─────────────────────────────────────────────────────────
export const MATCH_DECK_CARDS: MatchCardDef[] = DECK_IDS.flatMap((deck) =>
  DECK_ANCHORS[deck].flatMap((anchor, idx) => expandAnchor(deck, anchor, idx < 5 ? 6 : 5)),
);

const CARD_BY_ID = new Map(MATCH_DECK_CARDS.map((c) => [c.id, c]));
export function getMatchCard(id: string): MatchCardDef | undefined {
  return CARD_BY_ID.get(id);
}
/** id всех карт колоды (для сборки личной колоды места) */
export function deckCardIds(deck: DeckId): string[] {
  return MATCH_DECK_CARDS.filter((c) => c.deck === deck).map((c) => c.id);
}
