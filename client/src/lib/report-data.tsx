import type { ReactNode } from "react";
import { COMPETENCIES } from "@/data/competencies";
import type { SimulationRuntimeSettings } from "@shared/simulation-content";
import type { SimulationState } from "@/context/SimulationContext";
import { BarChart3, Brain, Target, Users } from "lucide-react";
import { calculateSimulationScoreSummary } from "@shared/simulation-scoring";

const EXPECTED_COMPETENCY_LEVEL = 4.0;

function normalizeClientRating(value: unknown, fallback = 3.3) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return fallback;
  }

  const scaled = numeric > 10 ? numeric / 20 : numeric > 5 ? numeric / 2 : numeric;
  return Math.round(Math.max(1, Math.min(5, scaled)) * 100) / 100;
}

function buildExpectedCompetencyScores() {
  return Object.fromEntries(COMPETENCIES.map((competency) => [competency.id, EXPECTED_COMPETENCY_LEVEL]));
}

export function getVerdict(avgScore: number): { level: string; color: string; description: string } {
  if (avgScore >= 4.2) return {
    level: "Высокая готовность",
    color: "#00d4aa",
    description: "Участник демонстрирует системный подход к управлению, уверенно принимает решения в сложных ситуациях. Рекомендуется к назначению на должность ЗУМ с минимальным сопровождением.",
  };
  if (avgScore >= 3.5) return {
    level: "Хорошая готовность",
    color: "#00d4aa",
    description: "Участник хорошо справляется с большинством управленческих задач. Есть зоны роста, но общий уровень позволяет работать на позиции ЗУМ при наличии наставника.",
  };
  if (avgScore >= 2.5) return {
    level: "Средняя готовность",
    color: "#ffc107",
    description: "Участник справляется с типовыми задачами, но испытывает затруднения в сложных ситуациях. Рекомендуется программа развития с повторным тестированием через 3 месяца.",
  };
  if (avgScore >= 1.5) return {
    level: "Низкая готовность",
    color: "#FF6B00",
    description: "Требуется значительное развитие управленческих компетенций. Рекомендуется интенсивная программа обучения и стажировка под руководством опытного управляющего.",
  };
  return {
    level: "Критически низкая",
    color: "#ff4444",
    description: "Участник не готов к управленческой роли на текущем этапе. Необходима базовая подготовка по всем ключевым компетенциям.",
  };
}

export function analyzePatterns(decisions: any[]): { label: string; value: string; icon: ReactNode }[] {
  if (!decisions || decisions.length === 0) return [];
  const patterns: { label: string; value: string; icon: ReactNode }[] = [];

  const delegationScores = decisions
    .filter((d) => d.competencyScores?.delegation != null)
    .map((d) => d.competencyScores.delegation);
  const avgDelegation = delegationScores.length > 0
    ? delegationScores.reduce((a, b) => a + b, 0) / delegationScores.length
    : 2.5;

  patterns.push({
    label: "Стиль управления",
    value: avgDelegation >= 3.5 ? "Склонность к делегированию" : "Склонность делать всё самому",
    icon: <Users className="w-4 h-4" />,
  });

  const planningScores = decisions
    .filter((d) => d.competencyScores?.planning != null)
    .map((d) => d.competencyScores.planning);
  const avgPlanning = planningScores.length > 0
    ? planningScores.reduce((a, b) => a + b, 0) / planningScores.length
    : 2.5;

  patterns.push({
    label: "Подход к работе",
    value: avgPlanning >= 3.5 ? "Системный подход" : "Реактивное управление",
    icon: <Brain className="w-4 h-4" />,
  });

  const moraleEffects = decisions.map((d) => Number(d.rawEffects?.morale || 0));
  const convEffects = decisions.map((d) => Number(d.rawEffects?.conversion || 0));
  const avgMoraleEffect = moraleEffects.reduce((a, b) => a + b, 0) / moraleEffects.length;
  const avgConvEffect = convEffects.reduce((a, b) => a + b, 0) / convEffects.length;

  patterns.push({
    label: "Фокус внимания",
    value: avgMoraleEffect > avgConvEffect ? "Фокус на людях" : "Фокус на процессах",
    icon: <Target className="w-4 h-4" />,
  });

  const avgScore = decisions.reduce((a, d) => a + Number(d.score || 0), 0) / decisions.length;
  patterns.push({
    label: "Качество решений",
    value: avgScore >= 3.5 ? "Высокое качество решений" : avgScore >= 2.5 ? "Среднее качество решений" : "Требуется улучшение",
    icon: <BarChart3 className="w-4 h-4" />,
  });

  return patterns;
}

export function getImpactfulDecisions(decisions: any[]) {
  return [...decisions]
    .map((decision) => {
      const impactMagnitude =
        Math.abs(Number(decision.rawEffects?.queue || 0)) * 1.1 +
        Math.abs(Number(decision.rawEffects?.conversion || 0)) * 1.4 +
        Math.abs(Number(decision.rawEffects?.morale || 0)) * 1.2 +
        Math.abs(Number(decision.rawEffects?.revenue_impact || 0)) * 1.3 +
        Math.abs(Number(decision.rawEffects?.delivery_status || 0)) * 1.15;

      return {
        ...decision,
        impactMagnitude: Math.round(impactMagnitude * 10) / 10,
      };
    })
    .sort((left, right) => right.impactMagnitude - left.impactMagnitude)
    .slice(0, 5);
}

function getRetestDateLabel() {
  const retestDate = new Date();
  retestDate.setMonth(retestDate.getMonth() + 3);
  return retestDate.toLocaleDateString("ru-RU");
}

function buildCompetencyRows(source: Record<string, number>) {
  const compScores = COMPETENCIES.map((c) => ({
    ...c,
    avg: Number(source[c.id] || 0),
  }));
  const overallAvg = compScores.filter((c) => c.avg > 0).length > 0
    ? Math.round((compScores.filter((c) => c.avg > 0).reduce((a, c) => a + c.avg, 0) / compScores.filter((c) => c.avg > 0).length) * 10) / 10
    : 0;
  const sorted = [...compScores].filter((c) => c.avg > 0).sort((a, b) => b.avg - a.avg);

  return {
    compScores,
    compScoresMap: Object.fromEntries(compScores.map((item) => [item.id, item.avg])),
    overallAvg,
    strengths: sorted.slice(0, 3),
    weaknesses: sorted.slice(-3).reverse(),
    weakForPlan: [...sorted].reverse().filter((c) => c.avg < 5),
  };
}

export function buildReportFromState(
  state: SimulationState,
  getCompetencyAverage: (compId: string) => number,
  runtimeSettings: SimulationRuntimeSettings | null | undefined,
) {
  const decisions = state.decisions as any[];
  const scoreSummary = calculateSimulationScoreSummary({
    decisions,
    difficulty: state.difficulty,
    settings: runtimeSettings,
    competencyTotals: state.competencyTotals,
  });

  const directCompetencySource = Object.fromEntries(COMPETENCIES.map((competency) => [competency.id, getCompetencyAverage(competency.id)]));
  const hasDirectCompetencies = Object.values(directCompetencySource).some((value) => Number(value) > 0);
  const competencySource = hasDirectCompetencies ? directCompetencySource : scoreSummary.competencyAverages;
  const competencyRows = buildCompetencyRows(competencySource);
  const expectedCompScoresMap = buildExpectedCompetencyScores();
  const totalTime = state.timeLimit * 60 - state.timeRemaining;
  const pauseEntries = state.pauses.filter((pause) => pause.durationSeconds > 0);
  const totalPauseSeconds = pauseEntries.reduce((sum, pause) => sum + pause.durationSeconds, 0);

  return {
    participantName: state.participantName || "Участник",
    assessorName: state.assessorName || "",
    difficulty: state.difficulty,
    isTestMode: state.isTestMode,
    decisions,
    totalDecisions: decisions.length,
    totalScore: scoreSummary.totalScore,
    avgScore: scoreSummary.averageScore,
    totalMinutes: Math.floor(totalTime / 60),
    pauseEntries,
    totalPauseSeconds,
    impactfulDecisions: getImpactfulDecisions(decisions),
    patterns: analyzePatterns(decisions),
    verdict: getVerdict(competencyRows.overallAvg),
    finalMetrics: {
      customersInStore: state.metrics.customersInStore,
      avgCheck: state.metrics.avgCheck,
      conversion: state.metrics.conversion,
      nps: normalizeClientRating(state.metrics.nps),
      pickupSpeed: state.metrics.pickupSpeed,
      warehouseLoad: state.metrics.warehouseLoad,
      teamMorale: state.metrics.teamMorale,
      dailyRevenue: state.metrics.dailyRevenue,
    },
    retestDate: getRetestDateLabel(),
    sessionId: state.sessionId || 0,
    expectedCompScoresMap,
    ...competencyRows,
  };
}

export function buildReportFromSessionDetails(
  detail: any,
  runtimeSettings: SimulationRuntimeSettings | null | undefined,
) {
  const session = detail?.session || {};
  const decisions = (detail?.answers || []).map((answer: any) => ({
    ...answer,
    rawEffects: answer.rawEffects || {},
    competencyScores: answer.competencyScores || {},
    timer: answer.details?.timer || null,
    timerPenalty: Number(answer.details?.timerPenalty || 0),
    baseScore: Number(answer.details?.baseScore ?? answer.score ?? 0),
    taskType: answer.details?.channelLabel || answer.sourceType,
    responsibility: answer.details?.responsibility || "",
    zoneLabel: answer.details?.zoneLabel || "",
  }));
  const persistedCompetencySource = detail?.result?.competencyAverages || {};
  const hasPersistedCompetencies = Object.values(persistedCompetencySource).some((value: any) => Number(value) > 0);
  const scoringDifficulty = ["easy", "medium", "hard"].includes(session.difficulty)
    ? session.difficulty as "easy" | "medium" | "hard"
    : "medium";
  const fallbackSummary = calculateSimulationScoreSummary({
    decisions,
    difficulty: scoringDifficulty,
    settings: runtimeSettings,
  });
  const competencySource = hasPersistedCompetencies
    ? persistedCompetencySource
    : fallbackSummary.competencyAverages;
  const competencyRows = buildCompetencyRows(competencySource);
  const expectedCompScoresMap = buildExpectedCompetencyScores();
  const startedAtMs = session.startedAt ? new Date(session.startedAt).getTime() : 0;
  const completedAtMs = session.completedAt ? new Date(session.completedAt).getTime() : 0;
  const totalMinutes = startedAtMs && completedAtMs ? Math.max(0, Math.round((completedAtMs - startedAtMs) / 60000)) : Number(session.timeLimit || 0);
  const pauseEntries = (detail?.result?.pauses || []).filter((pause: any) => Number(pause.durationSeconds || 0) > 0);
  const totalPauseSeconds = pauseEntries.reduce((sum: number, pause: any) => sum + Number(pause.durationSeconds || 0), 0);
  const averageScore = Number(detail?.result?.averageScore || 0) || fallbackSummary.averageScore;

  return {
    participantName: session.participantName || "Участник",
    assessorName: session.evaluatorName || "",
    difficulty: session.difficulty || "medium",
    isTestMode: Boolean(session.isTestMode),
    decisions,
    totalDecisions: decisions.length,
    totalScore: Number(detail?.result?.totalScore || 0) || fallbackSummary.totalScore,
    avgScore: averageScore,
    totalMinutes,
    pauseEntries,
    totalPauseSeconds,
    impactfulDecisions: getImpactfulDecisions(decisions),
    patterns: analyzePatterns(decisions),
    verdict: getVerdict(competencyRows.overallAvg || averageScore),
    finalMetrics: {
      ...(detail?.result?.finalMetrics || {}),
      nps: normalizeClientRating(detail?.result?.finalMetrics?.nps),
    },
    retestDate: getRetestDateLabel(),
    sessionId: Number(session.id || 0),
    technicalStatus: session.technicalStatus || "completed",
    startedAt: session.startedAt || "",
    completedAt: session.completedAt || "",
    expectedCompScoresMap,
    ...competencyRows,
  };
}

export function buildPdfPayloadFromReport(report: ReturnType<typeof buildReportFromState> | ReturnType<typeof buildReportFromSessionDetails>) {
  return {
    sessionId: report.sessionId || undefined,
    participantName: report.participantName,
    assessorName: report.assessorName,
    difficulty: report.difficulty,
    decisions: report.decisions.map((d: any) => ({
      caseTitle: d.caseTitle,
      cycle: d.cycle,
      optionText: d.optionText,
      score: d.score,
      simTime: d.simTime,
      competencyScores: d.competencyScores || {},
      rawEffects: d.rawEffects || {},
      taskType: d.taskType || d.sourceType,
    })),
    competencyScores: report.compScoresMap,
    expectedCompetencyScores: report.expectedCompScoresMap,
    finalMetrics: report.finalMetrics,
    patterns: report.patterns.map((pattern) => ({ label: pattern.label, value: pattern.value })),
    avgScore: report.overallAvg,
    totalTimeMinutes: report.totalMinutes,
    pauses: report.pauseEntries,
    verdict: { level: report.verdict.level, description: report.verdict.description },
    retestDate: report.retestDate,
    impactfulDecisions: report.impactfulDecisions.map((decision: any) => ({
      caseTitle: decision.caseTitle,
      score: decision.score,
      simTime: decision.simTime,
      optionText: decision.optionText,
      taskType: decision.taskType,
      impactMagnitude: decision.impactMagnitude,
    })),
  };
}
