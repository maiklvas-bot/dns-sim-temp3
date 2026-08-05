export interface CompetencyDefinition {
  id: string;
  name: string;
  description: string;
  category: "basic" | "advanced" | "leadership";
  facetOfCompetencyId?: string | null;
  isStopFactor?: boolean;
}

export interface MetricEffects {
  queue: number;
  conversion: number;
  morale: number;
  revenue_impact: number;
  delivery_status: number;
}

export interface CaseTimingConfig {
  arrivalMinute?: number | null;
  minIntervalSeconds?: number | null;
  maxIntervalSeconds?: number | null;
  decisionDeadlineSeconds?: number | null;
  reminderIntervalSeconds?: number | null;
}

export interface CaseOption {
  id: string;
  level: number;
  text: string;
  score: number;
  effects: MetricEffects;
  competency_scores: Record<string, number>;
  comment?: string | null;
  nextCycleId?: string | null;
  nextDelaySeconds?: number | null;
  nextChannel?: "main_case" | "email" | "messenger" | "video" | null;
  status?: "active" | "hidden" | "draft";
}

export interface CycleSignal {
  type: "message" | "zone_signal" | "email" | "call" | "visitor";
  content: string;
}

export interface CaseCycle {
  id: string;
  cycle: number;
  title?: string | null;
  description?: string | null;
  source?: string | null;
  situation: string;
  signal: CycleSignal;
  zonesAffected?: ZoneType[];
  timing?: CaseTimingConfig | null;
  status?: "active" | "draft" | "hidden";
  isFinal?: boolean;
  priority?: "normal" | "high" | "critical";
  criticality?: "normal" | "attention" | "risk";
  options: CaseOption[];
  imageAssetId?: string | null;
  imageUrl?: string | null;
  audioAssetId?: string | null;
  audioUrl?: string | null;
}

export interface CaseTrigger {
  type: "message" | "zone_signal" | "email" | "call" | "visitor";
  source: string;
  text: string;
}

export type ZoneType = "торговый_зал" | "склад" | "выдача" | "начальство";

export interface CaseDataPoint {
  label: string;
  costToRequest?: string | null;
}

export interface AcceptedIssue {
  check: "bars_conformance" | "antigaming" | "diagnostics" | "effect_reality";
  cycleId?: string | null;
  optionId?: string | null;
  /** Компетенция замечания — различает несколько замечаний у одного варианта. */
  competencyId?: string | null;
  /** Почему автор считает, что в этом кейсе так и задумано. Обязательно. */
  reason: string;
  /**
   * Формулировка замечания на момент принятия — справочно, в сопоставлении не участвует.
   *
   * Сопоставление идёт по (check, cycleId, optionId) и переживает правки варианта:
   * привязка к тексту сообщения сбрасывала бы принятие от любой мелочи, потому что
   * сообщения содержат изменчивые числа (баллы, длины строк). Чтобы принятие при этом
   * не прикрывало молча другой дефект, исходная формулировка сохраняется и
   * показывается рядом с обоснованием — расхождение видно глазом.
   */
  acceptedForMessage?: string | null;
}

/**
 * Материал справочника, добавленный человеком.
 *
 * Заголовок, краткое описание, содержание и скриншот обязательны: заметка без
 * них не объясняет ничего и только засоряет справочник. Требование проверяется
 * и в форме, и на сервере — форму можно обойти.
 */
export interface WikiNote {
  id: string;
  /** Раздел справочника, к которому относится материал. */
  sectionId: string;
  title: string;
  summary: string;
  body: string;
  imageAssetId: string;
  imageUrl?: string | null;
  author?: string;
  createdAt?: string;
  updatedAt?: string;
}

/** Поля материала, которые обязан заполнить автор. */
export const WIKI_NOTE_REQUIRED_FIELDS = ["title", "summary", "body", "imageAssetId"] as const;

export type CaseQaStatus =
  | "draft"
  | "auto_check_failed"
  | "methodical_review"
  | "ready_prototype"
  | "ready_launch";

/**
 * Одна правка в кейсе-исправлении: что было в оригинале, что стало и почему так вернее.
 *
 * Журнал существует ради доверия к оценке. Управляющие отвергали симуляцию не
 * потому, что веса были неверны, а потому, что происхождение баллов было
 * непрозрачно. Кейс-исправление обязан показывать свою правку целиком: не
 * «система нормализовала баллы», а конкретно — какой вариант, какое было
 * значение, какое стало и какое методическое правило этого требует.
 */
export interface CaseCorrection {
  /** Какая автопроверка этого требовала. `content` — правка смысла, её ни одна проверка не ловит. */
  check: "bars_conformance" | "antigaming" | "diagnostics" | "effect_reality" | "content";
  /** Где именно, человеческим языком: «Цикл 2 · вариант 3» или «Паспорт кейса». */
  scope: string;
  /** Как было в оригинале. */
  was: string;
  /** Как стало в исправленном. */
  became: string;
  /** Почему так вернее — методическое основание, а не пересказ действия. */
  why: string;
}

export interface SimCase {
  id: string;
  title: string;
  description: string;
  primaryCompetencies: string[];
  secondaryCompetencies: string[];
  trigger: CaseTrigger;
  zones_affected: ZoneType[];
  cycles: CaseCycle[];
  businessProblem?: string | null;
  hiddenCause?: string | null;
  dataPoints?: CaseDataPoint[];
  falseTrails?: string[];
  qaStatus?: CaseQaStatus;
  acceptedIssues?: AcceptedIssue[];
  /**
   * Если кейс — исправленный дубль, здесь id оригинала. Оригинал остаётся жить
   * своей жизнью: дубль ничего в нём не меняет и не отменяет.
   */
  correctionOfCaseId?: string | null;
  /** Журнал правок относительно оригинала. Пуст у обычных кейсов. */
  corrections?: CaseCorrection[];
  imageAssetId: string | null;
  imageUrl: string | null;
  audioAssetId: string | null;
  audioUrl: string | null;
  timing?: CaseTimingConfig | null;
  sortOrder: number;
  isActive: boolean;
}

export interface EmailOption extends CaseOption {}

export interface EmailCase {
  id: string;
  subject: string;
  from: string;
  department: string;
  departmentColor: string;
  preview: string;
  body: string;
  arrivalMinute: number;
  options: EmailOption[];
  primaryCompetency: string;
  imageAssetId: string | null;
  imageUrl: string | null;
  audioAssetId: string | null;
  audioUrl: string | null;
  timing?: CaseTimingConfig | null;
  sortOrder: number;
  isActive: boolean;
}

export interface MessengerOption extends CaseOption {}

export interface MessengerCase {
  id: string;
  chatId: string;
  isGroup: boolean;
  senderName: string;
  senderRole: string;
  senderAvatar: string;
  message: string;
  arrivalMinute: number;
  options: MessengerOption[];
  primaryCompetency: string;
  imageAssetId: string | null;
  imageUrl: string | null;
  audioAssetId: string | null;
  audioUrl: string | null;
  timing?: CaseTimingConfig | null;
  sortOrder: number;
  isActive: boolean;
}

export interface ChatInfo {
  id: string;
  name: string;
  isGroup: boolean;
  avatar: string;
  role?: string;
  icon?: string;
  members?: string[];
  sortOrder: number;
}

export interface VideoOption extends CaseOption {}

export interface VideoCase {
  id: string;
  title: string;
  sender: string;
  role: string;
  senderAvatar: string;
  duration: string;
  situation: string;
  arrivalMinute: number;
  options: VideoOption[];
  primaryCompetency: string;
  imageAssetId: string | null;
  imageUrl: string | null;
  videoAssetId: string | null;
  videoUrl: string | null;
  audioAssetId: string | null;
  audioUrl: string | null;
  timing?: CaseTimingConfig | null;
  sortOrder: number;
  isActive: boolean;
}

export interface PublicMediaAsset {
  id: string;
  name: string;
  mimeType: string;
  storagePath: string;
  publicUrl: string;
  kind: "image" | "audio" | "video";
}

export interface PublicSimulationContent {
  competencies: CompetencyDefinition[];
  cases: SimCase[];
  emailCases: EmailCase[];
  messengerCases: MessengerCase[];
  messengerChats: ChatInfo[];
  videoCases: VideoCase[];
  assets: PublicMediaAsset[];
}

export interface SimulationRuntimeSettings {
  firstSignalMinSeconds: number;
  firstSignalMaxSeconds: number;
  signalIntervalMinSeconds: number;
  signalIntervalMaxSeconds: number;
  reminderIntervalSeconds: number;
  easyAutoCaseCount: number;
  mediumAutoCaseCount: number;
  hardAutoCaseCount: number;
  hardSimulationMinutes?: number;
  defaultTimePerCaseMinutes: number;
  minSimulationMinutes: number;
  waitingImageAssetId?: string | null;
  callSoundAssetId?: string | null;
  emailSoundAssetId?: string | null;
  messengerSoundAssetId?: string | null;
  videoSoundAssetId?: string | null;
  preSimulationInstructionHtml?: string | null;
  preSimulationInstructionVideoAssetId?: string | null;
  caseWeights?: Record<string, number>;
  timeInfluenceEnabled?: boolean;
}

export type SessionSourceType = "main_case" | "email" | "messenger" | "video";

export interface TimerSnapshot {
  id: string;
  sourceType: SessionSourceType;
  contentId: string;
  title: string;
  responsibility: string;
  taskType: string;
  zoneLabel: string;
  label: string;
  totalSeconds: number;
  arrivedAtElapsed: number;
  dueAtElapsed: number;
  resolvedAtElapsed: number | null;
  resolvedSimTime: string | null;
  wasOverdue: boolean;
  overdueSeconds: number;
  status: "active" | "resolved" | "overdue";
}

export interface SessionAnswerDetails {
  channelLabel?: string;
  responsibility?: string;
  zoneLabel?: string;
  timer?: TimerSnapshot | null;
  baseScore?: number;
  timerPenalty?: number;
  overdue?: boolean;
}

export interface SessionAnswerPayload {
  sourceType: SessionSourceType;
  contentId: string;
  caseTitle: string;
  cycle: number;
  optionLevel: number;
  optionText: string;
  score: number;
  rawEffects: MetricEffects;
  competencyScores: Record<string, number>;
  timestamp: string;
  simTime: string;
  details?: SessionAnswerDetails;
}

export interface SessionResultPayload {
  totalScore: number;
  averageScore: number;
  competencyAverages: Record<string, number>;
  finalMetrics: Record<string, number>;
  timers: TimerSnapshot[];
  pauses: Array<{
    id: string;
    startedAt: number;
    startedSimTime: string;
    endedAt: number | null;
    endedSimTime: string | null;
    startedAtUnixMs: number;
    endedAtUnixMs: number | null;
    durationSeconds: number;
  }>;
}

export interface SimulationSettingsSnapshot {
  difficulty: "easy" | "medium" | "hard";
  timeLimit: number;
  manualSelection: boolean;
  repeatCases: boolean;
  selectedCaseIds: string[];
  selectedChannelItemIds?: { email: string[]; messenger: string[]; video: string[] };
  isTestMode: boolean;
  speedMultiplier: number;
  enabledChannels: { audio: boolean; email: boolean; messenger: boolean; video: boolean };
}
