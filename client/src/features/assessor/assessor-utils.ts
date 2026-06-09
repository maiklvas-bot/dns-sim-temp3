import type { RealisticMetrics } from "@/context/SimulationContext";
import { CASES_DATA } from "@/data/cases";
import { EMAIL_CASES } from "@/data/email-cases";
import { MESSENGER_CASES } from "@/data/messenger-cases";
import { VIDEO_CASES } from "@/data/video-cases";
import { DEFAULT_METRICS, DIFFICULTY_INFO } from "./assessor-constants";
import type { AssessorChannelItemIds, AssessorParticipantConfig } from "./assessor-types";

export function createAssessorParticipantId() {
  return `participant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function cloneMetrics(metrics: RealisticMetrics): RealisticMetrics {
  return { ...metrics };
}

export function cloneChannelItemIds(ids: AssessorChannelItemIds): AssessorChannelItemIds {
  return {
    email: [...ids.email],
    messenger: [...ids.messenger],
    video: [...ids.video],
  };
}

export function createDefaultParticipantSetup(id = createAssessorParticipantId(), name = ""): AssessorParticipantConfig {
  return {
    id,
    name,
    simulationRole: "participant",
    difficulty: "medium",
    setupMode: "recommended",
    scenarioConfirmed: false,
    compositionConfirmed: false,
    channelReviewDone: false,
    showAdvanced: false,
    manualSelection: false,
    repeatCases: false,
    selectedCases: CASES_DATA.map((item) => item.id),
    channels: { ...DIFFICULTY_INFO.medium.channels },
    selectedChannelItemIds: {
      email: EMAIL_CASES.map((item) => item.id),
      messenger: MESSENGER_CASES.map((item) => item.id),
      video: VIDEO_CASES.map((item) => item.id),
    },
    initialMetrics: cloneMetrics(DEFAULT_METRICS),
    isTestMode: false,
    speedMultiplier: 1,
  };
}
