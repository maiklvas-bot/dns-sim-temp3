/**
 * Симуляция ЗРД — контент (Фаза 1): карты проектов, события, конфиги сложности.
 * Числа из docs/zrd-economy-v1.md (v2). Тексты карт/событий — черновые;
 * финальные формулировки обязаны соответствовать §8a (равная форма, неочевидность).
 */
import type {
  DifficultyConfig, Difficulty, ProjectCard, EventCard, Resources, Metrics, StandardAction, Effects,
} from "./types";

export function emptyResources(): Resources {
  return { capital: 0, staff: 0, tech: 0, warehouse: 0, market: 0 };
}
export function emptyMetrics(): Metrics {
  return { sales: 0, nps: 0, coverage: 0 };
}

// ── Конфиги сложности (v2 §5) ──────────────────────────────────────────────
export const DIFFICULTY_CONFIGS: Record<Difficulty, DifficultyConfig> = {
  1: {
    difficulty: 1,
    startResources: { capital: 48, staff: 4, tech: 2, warehouse: 2, market: 3 },
    startProd: { capital: 6, staff: 1, tech: 0, warehouse: 0, market: 1 },
    startMetrics: { sales: 2, nps: 2, coverage: 2 },
    earlyWinTargets: { sales: 7, nps: 6, coverage: 5 },
    penaltyMultiplier: 0.5, actionsPerQuarter: 3, botLevel: 1,
  },
  2: {
    difficulty: 2,
    startResources: { capital: 44, staff: 3, tech: 2, warehouse: 2, market: 3 },
    startProd: { capital: 5, staff: 1, tech: 0, warehouse: 0, market: 1 },
    startMetrics: { sales: 2, nps: 2, coverage: 2 },
    earlyWinTargets: { sales: 8, nps: 7, coverage: 5 },
    penaltyMultiplier: 0.75, actionsPerQuarter: 3, botLevel: 2,
  },
  3: {
    difficulty: 3,
    startResources: { capital: 40, staff: 3, tech: 1, warehouse: 1, market: 2 },
    startProd: { capital: 4, staff: 1, tech: 1, warehouse: 0, market: 1 },
    startMetrics: { sales: 2, nps: 2, coverage: 2 },
    earlyWinTargets: { sales: 8, nps: 7, coverage: 6 },
    penaltyMultiplier: 1.0, actionsPerQuarter: 2, botLevel: 3,
  },
  4: {
    difficulty: 4,
    startResources: { capital: 36, staff: 2, tech: 1, warehouse: 1, market: 2 },
    startProd: { capital: 4, staff: 1, tech: 0, warehouse: 0, market: 1 },
    startMetrics: { sales: 2, nps: 2, coverage: 2 },
    earlyWinTargets: { sales: 9, nps: 8, coverage: 7 },
    penaltyMultiplier: 1.5, actionsPerQuarter: 2, botLevel: 4,
  },
  5: {
    difficulty: 5,
    startResources: { capital: 32, staff: 2, tech: 1, warehouse: 1, market: 1 },
    startProd: { capital: 3, staff: 0, tech: 0, warehouse: 0, market: 1 },
    startMetrics: { sales: 2, nps: 2, coverage: 2 },
    earlyWinTargets: { sales: 10, nps: 9, coverage: 7 },
    penaltyMultiplier: 2.0, actionsPerQuarter: 2, botLevel: 5,
  },
};

// ── Карты проектов (15, §6 v2) ─────────────────────────────────────────────
export const PROJECT_CARDS: ProjectCard[] = [
  { id: "store", category: "infra", title: "Открыть магазин", cost: { capital: 12, staff: 1 },
    effects: { metrics: { coverage: 2 }, resourceProd: { capital: 1 }, metricProd: { sales: 1 } },
    warehouseStrain: true },
  { id: "hyper", category: "infra", title: "Открыть Гипер", cost: { capital: 22, staff: 2, tech: 1 },
    condition: { minMetric: { coverage: 4 }, minResource: { warehouse: 1 } },
    effects: { metrics: { coverage: 2, sales: 2 }, resourceProd: { capital: 2 }, metricProd: { sales: 2 } },
    longTerm: true },
  { id: "logistics_hub", category: "infra", title: "Логистический узел", cost: { capital: 14 },
    effects: { resourceProd: { warehouse: 1 } }, longTerm: true },
  { id: "service_equipment", category: "infra", title: "Сервис-оборудование", cost: { capital: 10, tech: 1 },
    effects: { metrics: { nps: 2, sales: 1 } } },
  { id: "hire_staff", category: "hr", title: "Набор сотрудников", cost: { capital: 8 },
    effects: { resourceProd: { staff: 1 } } },
  { id: "training", category: "hr", title: "Обучение продавцов", cost: { capital: 9, staff: 1 },
    effects: { metrics: { nps: 2 } } },
  { id: "mentoring", category: "hr", title: "Наставничество", cost: { capital: 11, staff: 1 },
    condition: { minMetric: { nps: 6 } },
    effects: {}, tempMetricProd: { metricProd: { nps: 1 }, quarters: 2 } },
  { id: "ad_campaign", category: "marketing", title: "Рекламная кампания", cost: { capital: 10, market: 1 },
    effects: { metrics: { sales: 2 }, resources: { market: 1 } } },
  { id: "local_promo", category: "marketing", title: "Локальные акции", cost: { capital: 6 },
    effects: { metrics: { sales: 1, nps: -1 } } },
  { id: "assortment", category: "marketing", title: "Расширение ассортимента", cost: { capital: 12, warehouse: 1 },
    condition: { minResource: { warehouse: 1 } },
    effects: { metricProd: { sales: 1 } }, longTerm: true },
  { id: "crm", category: "it", title: "Внедрение CRM", cost: { capital: 12, tech: 1 },
    effects: { resourceProd: { tech: 1 }, metrics: { nps: 1 } }, longTerm: true },
  { id: "bi", category: "it", title: "BI-аналитика", cost: { capital: 11, tech: 1 },
    effects: { resourceProd: { capital: 1 } }, givesData: true, longTerm: true },
  { id: "wh_automation", category: "it", title: "Автоматизация склада", cost: { capital: 13, tech: 1 },
    condition: { minResource: { warehouse: 1 } },
    effects: { resourceProd: { warehouse: 1 } }, longTerm: true },
  { id: "new_district", category: "strategic", title: "Выход в новый район", cost: { capital: 24, staff: 2 },
    condition: { minMetric: { coverage: 6 } },
    effects: { metrics: { coverage: 3 } }, longTerm: true },
  { id: "ecommerce", category: "strategic", title: "E-commerce / маркетплейс", cost: { capital: 18, tech: 2 },
    condition: { minResource: { tech: 2 }, minResourceProd: { tech: 1 } },
    effects: { metricProd: { sales: 2 }, resources: { market: 2 } }, longTerm: true },
];

// ── Стандартные действия (§6) ──────────────────────────────────────────────
export const STANDARD_ACTIONS: Record<StandardAction, { title: string; cost: Partial<Resources>; effects: Effects }> = {
  open_basic: { title: "Открыть базовую точку", cost: { capital: 10 }, effects: { metrics: { coverage: 1 } } },
  hire: { title: "Нанять", cost: { capital: 6 }, effects: { resourceProd: { staff: 1 } } },
  promo: { title: "Провести акцию", cost: { capital: 4 }, effects: { metrics: { sales: 1 } } },
  improve_service: { title: "Улучшить сервис", cost: { capital: 6 }, effects: { metrics: { nps: 1 } } },
  improve_logistics: { title: "Улучшить логистику", cost: { capital: 8 }, effects: { resourceProd: { warehouse: 1 } } },
};

// ── События (5, §7) — тексты черновые (финал по §8a) ───────────────────────
export const EVENT_CARDS: EventCard[] = [
  {
    id: "market_swing", title: "Рыночное колебание",
    competencies: ["flexibility", "decision_making"],
    options: [
      { id: "wait", label: "Сохранить ресурсы и переждать колебание", effects: { metricProd: { sales: -1 } }, fitsWhen: ["lowCapital", "stableEngine"] },
      { id: "invest", label: "Вложиться в продвижение под колебание", cost: { capital: 6 }, effects: { metrics: { sales: 1 } }, fitsWhen: ["highCapital", "lowSales", "behindTargets"] },
    ],
  },
  {
    id: "logistics_fail", title: "Сбой логистики",
    competencies: ["decision_making", "result_orientation"],
    baseHit: { metrics: { sales: -2, nps: -1 } }, baseHitWhen: { minResource: { warehouse: 2 } }, // hit if NOT meeting (warehouse<2)
    options: [
      { id: "redistribute", label: "Перераспределить остатки между точками", cost: { staff: 1 }, effects: { metrics: { sales: 1 } }, fitsWhen: ["hasStaff"] },
      { id: "absorb", label: "Сфокусироваться и принять потери", effects: {}, fitsWhen: ["lowStaff", "stableEngine"], weak: true },
    ],
  },
  {
    id: "turnover", title: "Текучесть кадров",
    competencies: ["team_motivation"],
    options: [
      { id: "train", label: "Вложиться в обучение команды", cost: { capital: 9, staff: 1 }, effects: { metrics: { nps: 1 } }, fitsWhen: ["hasStaff", "lowNps"] },
      { id: "replace", label: "Заменить часть персонала быстро", cost: { capital: 6 }, effects: { metrics: { nps: -1 } }, fitsWhen: ["lowStaff"], weak: true },
      { id: "audit", label: "Провести аудит процессов", cost: { tech: 1 }, effects: {}, fitsWhen: ["hasTech"] },
      // Бесплатный вариант обязателен (инвариант §8a: ход всегда возможен) — уместен при нехватке ресурсов.
      { id: "postpone", label: "Стабилизировать нагрузку без затрат", effects: { metrics: { nps: -1 } }, fitsWhen: ["lowCapital"] },
    ],
  },
  {
    id: "store_conflict", title: "Конфликт между точками",
    competencies: ["conflict_management", "communication"],
    options: [
      { id: "meeting", label: "Организовать совещание и договориться", effects: { metrics: { nps: 1 } }, fitsWhen: ["anyReasonable"] },
      { id: "decree", label: "Принять волевое решение по распределению", effects: { metrics: { nps: -1 } }, fitsWhen: ["behindTargets"], weak: true },
      { id: "ignore", label: "Оставить ситуацию на усмотрение точек", effects: { metrics: { nps: -2 } }, fitsWhen: [], weak: true },
    ],
  },
  {
    id: "competitor", title: "Выход конкурента",
    competencies: ["strategic_vision", "flexibility"],
    baseHit: { metrics: { sales: -2 } },
    options: [
      { id: "cut_prices", label: "Скорректировать цены под рынок", negatesBaseHit: true, effects: { resourceProd: { capital: -1 } }, fitsWhen: ["lowCapital"] },
      { id: "boost_service", label: "Усилить сервис и удержать лояльность", cost: { capital: 8 }, negatesBaseHit: true, effects: { metrics: { nps: 1 } }, fitsWhen: ["highCapital", "lowNps"] },
      { id: "marketing", label: "Ответить маркетинговой активностью", cost: { capital: 10 }, negatesBaseHit: true, effects: { metrics: { sales: 1 } }, fitsWhen: ["highCapital", "lowSales"] },
    ],
  },
];

export function getCardById(id: string): ProjectCard | undefined {
  return PROJECT_CARDS.find((c) => c.id === id);
}

/** Колода под сложность (для MVP — вся базовая колода; масштаб региона задаётся стартом). */
export function pickContentForDifficulty(_difficulty: Difficulty): { deck: ProjectCard[]; events: EventCard[] } {
  return { deck: [...PROJECT_CARDS], events: [...EVENT_CARDS] };
}
