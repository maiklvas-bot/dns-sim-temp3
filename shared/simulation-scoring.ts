export type SimulationDifficulty = "easy" | "medium" | "hard";

export interface SimulationScoringSettings {
  caseWeights?: Record<string, number> | null;
  timeInfluenceEnabled?: boolean | null;
}

export interface SimulationScoringDecision {
  caseId?: string | null;
  contentId?: string | null;
  sourceType?: string | null;
  score?: number | null;
  competencyScores?: Record<string, number> | null;
}

export type CompetencyTotals = Record<string, { total: number; count: number }>;

const TIME_PROFILE_EVALUATION_COEFFICIENT: Record<SimulationDifficulty, number> = {
  easy: 0.95,
  medium: 1,
  hard: 1.08,
};

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function roundToTenth(value: number) {
  return Math.round(value * 10) / 10;
}

export function getCaseWeightRatio(
  caseId: string,
  sourceType: string | null | undefined,
  settings: SimulationScoringSettings | null | undefined,
) {
  if (sourceType !== "main_case") {
    return 1;
  }

  const explicitWeight = Number(settings?.caseWeights?.[caseId]);
  if (!Number.isFinite(explicitWeight)) {
    return 1;
  }

  return clamp(explicitWeight / 100, 0, 1);
}

export function getTimeEvaluationCoefficient(
  difficulty: SimulationDifficulty,
  timeInfluenceEnabled: boolean,
) {
  return timeInfluenceEnabled ? TIME_PROFILE_EVALUATION_COEFFICIENT[difficulty] : 1;
}

export function accumulateCompetencyTotals(
  currentTotals: CompetencyTotals,
  competencyScores: Record<string, number> | null | undefined,
  caseId: string,
  sourceType: string | null | undefined,
  resolvedScore: number,
  settings: SimulationScoringSettings | null | undefined,
): CompetencyTotals {
  const weightRatio = getCaseWeightRatio(caseId, sourceType, settings);
  const qualityRatio = clamp(Number(resolvedScore || 0) / 5, 0.1, 1);
  const nextTotals = { ...currentTotals };

  Object.entries(competencyScores || {}).forEach(([competencyId, rawScore]) => {
    const score = Number(rawScore || 0);
    const current = nextTotals[competencyId] || { total: 0, count: 0 };
    nextTotals[competencyId] = {
      total: current.total + score * weightRatio * qualityRatio,
      count: current.count + weightRatio,
    };
  });

  return nextTotals;
}

export function buildCompetencyAverageMap(totals: CompetencyTotals): Record<string, number> {
  return Object.fromEntries(
    Object.entries(totals)
      .filter(([, value]) => value.count > 0)
      .map(([key, value]) => [key, roundToTenth(value.total / value.count)]),
  );
}

export function calculateSimulationScoreSummary(input: {
  decisions: SimulationScoringDecision[];
  difficulty: SimulationDifficulty;
  settings?: SimulationScoringSettings | null;
  competencyTotals?: CompetencyTotals | null;
}) {
  const timeCoefficient = getTimeEvaluationCoefficient(
    input.difficulty,
    Boolean(input.settings?.timeInfluenceEnabled),
  );
  let weightedScoreTotal = 0;
  let weightedDecisionCount = 0;

  const reconstructedTotals = input.decisions.reduce<CompetencyTotals>((totals, decision) => {
    const caseId = String(decision.caseId || decision.contentId || "");
    const weightRatio = getCaseWeightRatio(caseId, decision.sourceType, input.settings);
    weightedScoreTotal += Number(decision.score || 0) * weightRatio;
    weightedDecisionCount += weightRatio;
    return accumulateCompetencyTotals(
      totals,
      decision.competencyScores,
      caseId,
      decision.sourceType,
      Number(decision.score || 0),
      input.settings,
    );
  }, {});

  const effectiveCompetencyTotals = input.competencyTotals && Object.keys(input.competencyTotals).length > 0
    ? input.competencyTotals
    : reconstructedTotals;
  const competencyAverages = Object.fromEntries(
    Object.entries(buildCompetencyAverageMap(effectiveCompetencyTotals)).map(([competencyId, value]) => [
      competencyId,
      roundToTenth(clamp(value * timeCoefficient, 0, 5)),
    ]),
  );

  return {
    totalScore: input.decisions.length > 0 ? Math.round(weightedScoreTotal * timeCoefficient) : 0,
    averageScore: weightedDecisionCount > 0
      ? roundToTenth(clamp((weightedScoreTotal / weightedDecisionCount) * timeCoefficient, 0, 5))
      : 0,
    competencyAverages,
    timeCoefficient,
  };
}
