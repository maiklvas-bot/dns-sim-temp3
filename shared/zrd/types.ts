/**
 * Симуляция ЗРД — доменные типы (Фаза 1).
 * Соответствует экономике docs/zrd-economy-v1.md (v2) и профилю компетенций ЗРД (12).
 * Всё сериализуемо (для персистентности и реплея). Без зависимостей.
 */

// ── Ресурсы (5) ────────────────────────────────────────────────────────────
export type ResourceKey = "capital" | "staff" | "tech" | "warehouse" | "market";
export type Resources = Record<ResourceKey, number>;
export const RESOURCE_KEYS: ResourceKey[] = ["capital", "staff", "tech", "warehouse", "market"];

// ── Показатели (3): Продажи / NPS / Охват ──────────────────────────────────
export type MetricKey = "sales" | "nps" | "coverage";
export type Metrics = Record<MetricKey, number>;
export const METRIC_KEYS: MetricKey[] = ["sales", "nps", "coverage"];

export type Difficulty = 1 | 2 | 3 | 4 | 5;
export type StrategyKey = "service" | "expansion" | "efficiency";

// ── Компетенции ЗРД (12) ───────────────────────────────────────────────────
export type CompetencyKey =
  | "planning"
  | "goal_setting"
  | "decision_making"
  | "analytical"
  | "flexibility"
  | "communication"
  | "result_orientation"
  | "team_motivation"
  | "critical_thinking"
  | "initiative"
  | "conflict_management"
  | "strategic_vision";

export const COMPETENCY_KEYS: CompetencyKey[] = [
  "planning", "goal_setting", "decision_making", "analytical",
  "flexibility", "communication", "result_orientation", "team_motivation",
  "critical_thinking", "initiative", "conflict_management", "strategic_vision",
];

export const COMPETENCY_LABEL: Record<CompetencyKey, string> = {
  planning: "Планирование и организация",
  goal_setting: "Постановка цели",
  decision_making: "Принятие решений",
  analytical: "Аналитическое мышление",
  flexibility: "Гибкость / адаптивность",
  communication: "Коммуникация",
  result_orientation: "Ориентация на результат",
  team_motivation: "Мотивация и построение команды",
  critical_thinking: "Критическое мышление",
  initiative: "Инициативность",
  conflict_management: "Управление конфликтами",
  strategic_vision: "Стратегическое видение",
};

export type CompetencyScores = Record<CompetencyKey, number>; // ФАКТ 0..5

// ── Эффекты (общие для карт и выборов событий) ─────────────────────────────
export interface Effects {
  resources?: Partial<Resources>;       // мгновенный запас
  resourceProd?: Partial<Resources>;    // +производство ресурсов (в т.ч. capital = доход)
  metrics?: Partial<Metrics>;           // мгновенный показатель
  metricProd?: Partial<Metrics>;        // +производство показателей (prodS/N/O)
}

// Временный модификатор производства показателей (напр. prodS−1 на 1 квартал)
export interface PendingMod {
  metricProd: Partial<Metrics>;
  quartersLeft: number;
}

export interface CardCondition {
  minMetric?: Partial<Metrics>;
  minResource?: Partial<Resources>;
  minResourceProd?: Partial<Resources>;
}

export type CardCategory = "infra" | "hr" | "marketing" | "it" | "strategic";

export interface ProjectCard {
  id: string;
  category: CardCategory;
  title: string;
  cost: Partial<Resources>;
  condition?: CardCondition;
  effects: Effects;
  /** prodMod: эффект как временное производство (напр. наставничество +prodN на 2 кв.) */
  tempMetricProd?: { metricProd: Partial<Metrics>; quarters: number };
  /** флаги */
  givesData?: boolean;        // BI: даёт «данные» (сигнал analytical при использовании)
  longTerm?: boolean;         // стратегическая/производственная карта (сигнал strategic_vision)
  warehouseStrain?: boolean;  // #1: при складе<1 → nps−1
}

// ── События ────────────────────────────────────────────────────────────────
export type ContextTag =
  | "lowCapital" | "highCapital" | "hasStaff" | "lowStaff" | "hasTech" | "hasWarehouse"
  | "lowNps" | "lowSales" | "lowCoverage" | "behindTargets" | "stableEngine" | "anyReasonable";

export interface EventOption {
  id: string;
  label: string;             // нейтральная формулировка (финальные тексты — по §8a)
  cost?: Partial<Resources>;
  effects?: Effects;
  /** если опция «гасит» базовый урон события */
  negatesBaseHit?: boolean;
  /** контекст, в котором выбор уместен (для скоринга по умстности, не по тексту) */
  fitsWhen: ContextTag[];
  /** «худший» вариант: не тупик, но слабый (для critical_thinking) */
  weak?: boolean;
}

export interface EventCard {
  id: string;
  title: string;
  /** базовый негативный эффект, если применимо (масштабируется множителем сложности) */
  baseHit?: Effects;
  /** условие, при котором baseHit применяется (напр. склад<2) */
  baseHitWhen?: CardCondition;
  options: EventOption[];
  competencies: CompetencyKey[]; // какие компетенции сигналит выбор
}

// ── Стандартные действия (всегда доступны) ─────────────────────────────────
export type StandardAction = "open_basic" | "hire" | "promo" | "improve_service" | "improve_logistics";

// ── Конфиг сложности и партии ──────────────────────────────────────────────
export interface DifficultyConfig {
  difficulty: Difficulty;
  startResources: Resources;
  startProd: Resources;
  startMetrics: Metrics;
  earlyWinTargets: Metrics;
  penaltyMultiplier: number;
  actionsPerQuarter: number;
  botLevel: number;
}

export interface ZrdConfig {
  difficulty: Difficulty;
  quarters: number;
  seed: number;
  strategy: StrategyKey | null; // декларируется на старте
}

// ── Лог ────────────────────────────────────────────────────────────────────
export type LogType =
  | "declare" | "keep" | "play_card" | "standard" | "event" | "pass" | "production" | "end";

export interface TurnLogEntry {
  quarter: number;
  type: LogType;
  detail: string;
  /** контекст-теги состояния в момент действия (для скоринга по уместности, §8a) */
  ctxTags?: ContextTag[];
  /** id выбранной опции события / сыгранной карты / стандартного действия */
  choiceId?: string;
  metrics?: Metrics;
  resources?: Resources;
}

// ── Намерения хода (от клиента/AI) ─────────────────────────────────────────
export type TurnIntent =
  | { kind: "declareStrategy"; strategy: StrategyKey }
  | { kind: "keepCards"; cardIds: string[] }
  | { kind: "playCard"; cardId: string }
  | { kind: "standard"; action: StandardAction }
  | { kind: "viewData" } // открыть BI-панель перед ходом (сигнал analytical)
  | { kind: "eventChoice"; optionId: string }
  | { kind: "pass" };

export type Phase = "setup" | "research" | "action" | "event" | "production" | "ended";

export interface Outcome {
  metrics: Metrics;
  tr: number;             // итоговый рейтинг
  earlyWin: boolean;
  quartersPlayed: number;
}

export interface PlayerState {
  resources: Resources;
  resourceProd: Resources;
  metrics: Metrics;
  metricProd: Metrics;
  declaredStrategy: StrategyKey | null;
  hand: ProjectCard[];
  playedCardIds: string[];
  pendingMods: PendingMod[];
  viewedDataThisQuarter: boolean;
  nextEventHarsher: boolean;
}

export interface ZrdState {
  config: ZrdConfig;
  diff: DifficultyConfig;
  quarter: number;        // 1..N
  phase: Phase;
  player: PlayerState;
  deck: ProjectCard[];
  offer: ProjectCard[];   // карты, разложенные в фазе исследования (4 шт.)
  eventDeck: EventCard[];
  pendingEvent: EventCard | null;
  actionsLeft: number;
  passed: boolean;
  rng: number;            // seeded RNG state
  log: TurnLogEntry[];
  ended: boolean;
  outcome?: Outcome;
}

export interface ApplyResult {
  state: ZrdState;
  ok: boolean;
  error?: string;
  log?: TurnLogEntry;
}
