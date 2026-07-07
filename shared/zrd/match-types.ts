/**
 * ЗРД v2 «Мультистол» — доменные типы матча на 4 места (4 РРС Дивизиона Урал).
 * Спека: docs/superpowers/specs/2026-07-03-zrd-multiseat-design.md.
 * Всё сериализуемо (персистентность + реплей). Без зависимостей, кроме ./types.
 */
import type {
  Resources, Metrics, Difficulty, CompetencyKey, TurnLogEntry, EventOption, EventCard, StandardAction,
} from "./types";

// ── Места и РРС ─────────────────────────────────────────────────────────────
export type RrsId = "ekb" | "chel" | "tmn" | "perm";
export const RRS_IDS: RrsId[] = ["ekb", "chel", "tmn", "perm"];
export const RRS_LABEL: Record<RrsId, string> = {
  ekb: "РРС Екатеринбург",
  chel: "РРС Челябинск",
  tmn: "РРС Тюмень",
  perm: "РРС Пермь",
};

export type AiLevel = 1 | 2 | 3 | 4 | 5;
export type SeatController =
  | { kind: "human"; name: string; email?: string }
  | { kind: "ai"; level: AiLevel }
  | { kind: "off" };

// ── Колоды и карты ──────────────────────────────────────────────────────────
export type DeckId = "promo" | "service" | "logistics" | "goods" | "staff" | "projects";
export const DECK_IDS: DeckId[] = ["promo", "service", "logistics", "goods", "staff", "projects"];
export const DECK_LABEL: Record<DeckId, string> = {
  promo: "Продвижение",
  service: "Сервис",
  logistics: "Логистика",
  goods: "Товар",
  staff: "Сотрудники",
  projects: "Проекты",
};

export type CardTier = 1 | 2 | 3;

export interface MatchCardCondition {
  minMetric?: Partial<Metrics>;
  minResource?: Partial<Resources>;
}

export interface MatchCardEffects {
  resources?: Partial<Resources>;
  resourceProd?: Partial<Resources>;
  metrics?: Partial<Metrics>;
  metricProd?: Partial<Metrics>;
}

export interface MatchCardDef {
  id: string;             // напр. "promo_ad_t2_v1"
  deck: DeckId;
  /** якорь арта: 9 листов Canva на колоду (id из zrd-decks.ts), арт переиспользуется вариантами */
  anchorId: string;
  tier: CardTier;
  title: string;
  cost: Partial<Resources>;
  condition?: MatchCardCondition;
  effects: MatchCardEffects;
  /** 0 = мгновенно; >0 = проект: эффект применяется по завершении (недели) */
  durationWeeks: number;
  competencyTags: CompetencyKey[];
}

// ── Чёрные лебеди ───────────────────────────────────────────────────────────
export type SwanScope = "local" | "global";
export type SwanFrequency = "off" | "rare" | "standard" | "storm";

export interface BlackSwanDef {
  id: string;
  title: string;
  description: string;
  scope: SwanScope;
  /** вес при случайном выборе из пула */
  weight: number;
  /** сколько недель действует штраф */
  durationWeeks: number;
  /** штраф каждому целевому месту за каждый такт действия */
  tickPenalty: { metrics?: Partial<Metrics>; resources?: Partial<Resources> };
  /** варианты реакции места (есть бесплатный; реакция снимает/ослабляет штраф) */
  options: EventOption[];
}

export interface ActiveSwan {
  swanId: string;
  scope: SwanScope;
  /** для local — конкретная РРС; для global — null */
  targetRrs: RrsId | null;
  weeksLeft: number;
  /** индексы мест, уже отреагировавших (штраф к ним больше не применяется) */
  reactedSeats: number[];
}

// ── KPI и миссии ────────────────────────────────────────────────────────────
export type KpiId = "sales_growth" | "market_coverage" | "efficiency" | "service_level" | "logistics" | "staffing";
export const KPI_IDS: KpiId[] = ["sales_growth", "market_coverage", "efficiency", "service_level", "logistics", "staffing"];

export interface MissionDef {
  id: string;
  label: string;
  kpi: KpiId;
  /** целевые значения KPI (0..100) на конец кварталов 1..4; авто-режим двигает цель по ним */
  quarterTargets: [number, number, number, number];
  /** бонус к ТР за выполнение финальной цели */
  weight: number;
}

// ── Сценарии ────────────────────────────────────────────────────────────────
export type WinMode = "year" | "race";
export type MissionMode = "auto" | "manual";
export type ScenarioId = "conquest" | "crisis" | "race" | "efficiency";

export interface ScenarioDef {
  id: ScenarioId;
  title: string;
  tagline: string;
  winModeDefault: WinMode;
  swanFrequencyDefault: SwanFrequency;
  /** авто-набор миссий (id из каталога) */
  missionIds: string[];
  /** ключевая миссия для режима «гонка» */
  keyMissionId: string;
  /** веса колод при доборе — сдвигают состав руки под сценарий */
  deckWeights: Record<DeckId, number>;
  /** правка стартовых наборов поверх сложности */
  startTweak?: { resources?: Partial<Resources>; metrics?: Partial<Metrics> };
}

// ── Маскоты (фигурки игроков) ───────────────────────────────────────────────
export type MascotId = "strateg" | "media" | "dispatcher" | "captain";
export const MASCOT_IDS: MascotId[] = ["strateg", "media", "dispatcher", "captain"];
/** имя + краткая характеристика стиля игры (арт — на клиенте, zrd-mascots.ts) */
export const MASCOT_META: Record<MascotId, { name: string; style: string }> = {
  strateg: {
    name: "Стратег",
    style: "Играет вдолгую: тир-3 проекты, производство, холодный расчёт. Медленный старт — мощный финиш.",
  },
  media: {
    name: "Промо-гений",
    style: "Агрессивный охват: реклама, акции, вирусные ролики. Рискует кассой ради доли рынка.",
  },
  dispatcher: {
    name: "Диспетчер",
    style: "Процессы и логистика: склады, поставки, устойчивость к чёрным лебедям. Надёжность вместо блеска.",
  },
  captain: {
    name: "Капитан команды",
    style: "Люди и сервис: команда, лояльность, переговоры в кризисах. Выигрывает длинной волей.",
  },
};

// ── Конфиг матча ────────────────────────────────────────────────────────────
export interface SeatSetup { rrsId: RrsId; controller: SeatController; mascotId?: MascotId }

export interface MatchConfig {
  scenario: ScenarioId;
  difficulty: Difficulty;
  winMode: WinMode;
  missionMode: MissionMode;
  /** выбранные миссии (manual) или копия набора сценария (auto) */
  missionIds: string[];
  keyMissionId: string;
  swanFrequency: SwanFrequency;
  /** темп: минут реального времени на такт (следит сервер; движок времени не знает) */
  minutesPerTick: number;
  /** ровно 4, порядок = RRS_IDS */
  seats: SeatSetup[];
  seed: number;
}

// ── Состояние места ─────────────────────────────────────────────────────────
export interface ActiveProject {
  cardId: string;
  title: string;
  deck: DeckId;
  weeksLeft: number;
  totalWeeks: number;
}

export interface SeatState {
  rrsId: RrsId;
  controller: SeatController;
  /** фигурка на карте; выбирает сам игрок при входе по коду */
  mascotId: MascotId;
  /** игрок уже выбрал фигурку? до выбора борд показывает экран выбора (старые матчи: undefined = выбрано) */
  mascotChosen?: boolean;
  resources: Resources;
  /** капитал, приходящий каждый месяц (экономика v3) */
  incomeMonthly: number;
  /** применяется на квартальных рубежах (тик 3/6/9/12) */
  resourceProd: Resources;
  metrics: Metrics;
  /** применяется на квартальных рубежах */
  metricProd: Metrics;
  /** личная колода: id карт; порядок скрыт от клиента */
  deck: string[];
  hand: string[];
  discard: string[];
  activeProjects: ActiveProject[];
  actionsLeft: number;
  passed: boolean;
  /** суммарно потраченные ресурсы (тай-брейк №1) */
  spentTotal: number;
  /** число совершённых действий (тай-брейк №2) */
  actionsTotal: number;
  missionDone: Record<string, boolean>;
  /** квартальная дилемма, ждущая решения этого места */
  pendingEvent: EventCard | null;
  viewedDataThisTick: boolean;
  log: TurnLogEntry[];
}

// ── Состояние матча ─────────────────────────────────────────────────────────
export type MatchPhase = "action" | "ended";

export interface SeatOutcome {
  tr: number;
  kpi: Record<KpiId, number>;
  missionsCompleted: string[];
  raceWinner: boolean;
}

export interface MatchState {
  config: MatchConfig;
  /** месяц 1..12 */
  tick: number;
  phase: MatchPhase;
  seats: SeatState[];
  activeSwans: ActiveSwan[];
  /** id квартальных событий-дилемм (переиспользуем EVENT_CARDS соло-движка) */
  eventDeck: string[];
  rng: number;
  ended: boolean;
  /** индекс = место; заполняется на финале */
  outcomes?: SeatOutcome[];
  /** null = ничья даже после тай-брейка */
  winnerSeat?: number | null;
}

// ── Календарь ───────────────────────────────────────────────────────────────
export const TICKS_TOTAL = 12;
export const WEEKS_PER_TICK = 4;
/** квартал 1..4 по номеру такта */
export const quarterOfTick = (tick: number): number => Math.ceil(tick / 3);
/** месяц внутри квартала 1..3 */
export const monthOfQuarter = (tick: number): number => ((tick - 1) % 3) + 1;
/** такт — квартальный рубеж? (производство, миссии, дилеммы) */
export const isQuarterEnd = (tick: number): boolean => tick % 3 === 0;

// ── Намерения места ─────────────────────────────────────────────────────────
export type SeatIntent =
  | { kind: "playCard"; cardId: string }
  | { kind: "standard"; action: StandardAction }
  | { kind: "eventChoice"; optionId: string }
  | { kind: "swanChoice"; swanId: string; optionId: string }
  | { kind: "viewData" }
  | { kind: "pass" };

export interface SeatIntentResult {
  state: MatchState;
  ok: boolean;
  error?: string;
}

// ── Виды состояния (privacy) ────────────────────────────────────────────────
/** публичная сводка чужого места: без руки, колоды и сброса-содержимого */
export interface ZrdSeatPublicSummary {
  seatIdx: number;
  rrsId: RrsId;
  controllerKind: SeatController["kind"];
  mascotId: MascotId;
  name: string;
  metrics: Metrics;
  kpi: Record<KpiId, number>;
  missionsDone: number;
  discardCount: number;
  passed: boolean;
}

export interface MissionProgressView {
  def: MissionDef;
  /** текущее значение KPI места 0..100 */
  value: number;
  /** цель текущего квартала */
  target: number;
  /** финальная цель */
  finalTarget: number;
  done: boolean;
  isKey: boolean;
}

export interface ZrdSeatView {
  matchEnded: boolean;
  tick: number;
  quarter: number;
  month: number;
  phase: MatchPhase;
  seatIdx: number;
  you: Omit<SeatState, "deck" | "log"> & { deckCounts: Record<DeckId, number> };
  others: ZrdSeatPublicSummary[];
  swans: ActiveSwan[];
  missions: MissionProgressView[];
  winMode: WinMode;
  scenario: ScenarioId;
  difficulty: Difficulty;
  minutesPerTick: number;
  outcomes?: SeatOutcome[];
  winnerSeat?: number | null;
}

/** сводка матча для листинга в панели оценщика («Активные сессии») — без полного состояния */
export interface ZrdMatchListItem {
  id: number;
  status: string;
  paused: boolean;
  evaluatorName: string;
  scenario: ScenarioId;
  difficulty: Difficulty;
  startedAt: string;
  completedAt: string | null;
  tick: number;
  quarter: number;
  seats: Array<{
    seatIdx: number;
    rrsId: RrsId;
    controllerKind: SeatController["kind"];
    participantName: string | null;
    accessCode: string | null;
  }>;
}

export interface ZrdObserverView {
  tick: number;
  quarter: number;
  month: number;
  phase: MatchPhase;
  config: MatchConfig;
  seats: (ZrdSeatPublicSummary & { handCount: number; actionsLeft: number; resources: Resources })[];
  activeSwans: ActiveSwan[];
  ended: boolean;
  outcomes?: SeatOutcome[];
  winnerSeat?: number | null;
}
