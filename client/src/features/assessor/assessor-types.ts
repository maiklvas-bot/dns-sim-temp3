import type { RealisticMetrics } from "@/context/SimulationContext";

export type AssessorPanel = "participant" | "scenario" | "composition" | "review" | "sessions" | "results";
export type AssessorSetupMode = "recommended" | "expert";
export type AssessorDifficulty = "easy" | "medium" | "hard";
export type AssessorChannels = { audio: boolean; email: boolean; messenger: boolean; video: boolean };
export type AssessorChannelItemIds = { email: string[]; messenger: string[]; video: string[] };
export type AssessorSimulationRoleId = "participant" | "deputy-manager" | "manager" | "regional-deputy";

export interface AssessorParticipantConfig {
  id: string;
  name: string;
  simulationRole: AssessorSimulationRoleId;
  difficulty: AssessorDifficulty;
  setupMode: AssessorSetupMode;
  scenarioConfirmed: boolean;
  compositionConfirmed: boolean;
  channelReviewDone: boolean;
  showAdvanced: boolean;
  manualSelection: boolean;
  repeatCases: boolean;
  selectedCases: string[];
  channels: AssessorChannels;
  selectedChannelItemIds: AssessorChannelItemIds;
  initialMetrics: RealisticMetrics;
  isTestMode: boolean;
  speedMultiplier: number;
}

export interface AssessorLaunchResult {
  participantName: string;
  liveSessionId: string;
  accessCode: string;
}
