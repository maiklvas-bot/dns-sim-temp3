export interface CompetencyDefinition {
  id: string;
  name: string;
  description: string;
  category: "basic" | "advanced" | "leadership";
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
}

export interface CycleSignal {
  type: "message" | "zone_signal" | "email" | "call" | "visitor";
  content: string;
}

export interface CaseCycle {
  id: string;
  cycle: number;
  situation: string;
  signal: CycleSignal;
  options: CaseOption[];
}

export interface CaseTrigger {
  type: "message" | "zone_signal" | "email" | "call" | "visitor";
  source: string;
  text: string;
}

export type ZoneType = "торговый_зал" | "склад" | "выдача" | "начальство";

export interface SimCase {
  id: string;
  title: string;
  description: string;
  primaryCompetencies: string[];
  secondaryCompetencies: string[];
  trigger: CaseTrigger;
  zones_affected: ZoneType[];
  cycles: CaseCycle[];
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
