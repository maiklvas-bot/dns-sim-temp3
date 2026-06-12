import assert from "node:assert/strict";
import {
  accumulateCompetencyTotals,
  buildCompetencyAverageMap,
  calculateSimulationScoreSummary,
  getCaseWeightRatio,
  getTimeEvaluationCoefficient,
} from "../shared/simulation-scoring";

const decisions = [
  {
    caseId: "CASE-01",
    sourceType: "main_case",
    score: 4,
    competencyScores: { planning: 4 },
  },
  {
    caseId: "EMAIL-01",
    sourceType: "email",
    score: 2,
    competencyScores: { planning: 3, communication: 2 },
  },
];
const settings = {
  caseWeights: { "CASE-01": 2 },
  timeInfluenceEnabled: true,
};

assert.equal(getCaseWeightRatio("CASE-01", "main_case", settings), 0.02);
assert.equal(getCaseWeightRatio("EMAIL-01", "email", settings), 1);
assert.equal(getTimeEvaluationCoefficient("hard", true), 1.08);

const totals = decisions.reduce(
  (current, decision) => accumulateCompetencyTotals(
    current,
    decision.competencyScores,
    decision.caseId,
    decision.sourceType,
    decision.score,
    settings,
  ),
  {},
);
assert.deepEqual(buildCompetencyAverageMap(totals), {
  planning: 1.2,
  communication: 0.8,
});

assert.deepEqual(
  calculateSimulationScoreSummary({
    decisions,
    difficulty: "hard",
    settings,
  }),
  {
    totalScore: 2,
    averageScore: 2.2,
    competencyAverages: {
      planning: 1.3,
      communication: 0.9,
    },
    timeCoefficient: 1.08,
  },
);

console.log("Scoring parity checks passed: weights, time coefficient, and competencies share one formula.");
