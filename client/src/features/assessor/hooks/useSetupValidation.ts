import type { RealisticMetrics } from "@/context/SimulationContext";
import { CASES_DATA } from "@/data/cases";
import { DEFAULT_METRICS, SIMULATION_ROLE_CARDS } from "../assessor-constants";
import type { AssessorParticipantConfig } from "../assessor-types";

interface UseSetupValidationOptions {
  assessorName: string;
  easyCount: number;
  mediumCount: number;
  hardCount: number;
}

export function useSetupValidation({
  assessorName,
  easyCount,
  mediumCount,
  hardCount,
}: UseSetupValidationOptions) {
  const getAutoCases = (difficulty: string): string[] => {
    if (difficulty === "easy") return CASES_DATA.slice(0, easyCount).map((item) => item.id);
    if (difficulty === "hard") return CASES_DATA.slice(0, hardCount).map((item) => item.id);
    return CASES_DATA.slice(0, mediumCount).map((item) => item.id);
  };

  const getCasesForSetup = (setup: AssessorParticipantConfig) => (
    setup.manualSelection ? setup.selectedCases : getAutoCases(setup.difficulty)
  );

  const getSetupValidation = (setup: AssessorParticipantConfig) => {
    const issues: string[] = [];
    const nameReady = assessorName.trim().length > 0 && setup.name.trim().length > 0;
    const roleReady = SIMULATION_ROLE_CARDS.some((item) => item.id === setup.simulationRole && item.available);
    const scenarioReady = setup.scenarioConfirmed && Boolean(setup.difficulty);
    const casesReady = getCasesForSetup(setup).length > 0;
    const enabledChannelIssues = [
      setup.channels.email && setup.selectedChannelItemIds.email.length === 0 ? "выберите письма или выключите почту" : "",
      setup.channels.messenger && setup.selectedChannelItemIds.messenger.length === 0 ? "выберите сообщения или выключите ТёрКограмм" : "",
      setup.channels.video && setup.selectedChannelItemIds.video.length === 0 ? "выберите видео или выключите видеоканал" : "",
    ].filter(Boolean);
    const metricsReady = (Object.keys(DEFAULT_METRICS) as Array<keyof RealisticMetrics>).every((key) => {
      const value = Number(setup.initialMetrics[key]);
      if (!Number.isFinite(value)) return false;
      if (key === "nps") return value >= 1 && value <= 5;
      return value >= 0;
    });

    if (!nameReady) issues.push("заполните ФИО оценщика и участника");
    if (!roleReady) issues.push("выберите доступный тип симуляции");
    if (!scenarioReady) issues.push("выберите сценарий оценки");
    if (!casesReady) issues.push("выберите хотя бы одну ситуацию");
    issues.push(...enabledChannelIssues);
    if (!metricsReady) issues.push("проверьте стартовые метрики магазина");

    const compositionReady = casesReady && enabledChannelIssues.length === 0 && metricsReady;

    return {
      nameReady,
      roleReady,
      scenarioReady,
      compositionReady,
      channelReviewReady: compositionReady,
      readyToLaunch: nameReady && roleReady && scenarioReady && compositionReady,
      issues,
    };
  };

  return { getAutoCases, getCasesForSetup, getSetupValidation };
}
