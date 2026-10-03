import assert from "node:assert/strict";
import {
  accumulateCompetencyTotals,
  buildCompetencyAverageMap,
  buildCompetencyCoverage,
  calculateSimulationScoreSummary,
  getCaseWeightRatio,
  getTimeEvaluationCoefficient,
} from "../shared/simulation-scoring";
import { RELIABLE_CASE_COUNT, isReliablyMeasured } from "../shared/competency-profile";

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

// ── Шкала оценки компетенции ────────────────────────────────────────────────
// Разметка варианта уже говорит, насколько поведение сильное: слабо=1,
// средне=3, сильно=5. Домножать её ещё и на «качество варианта» нельзя —
// это штрафует слабый ответ дважды и выносит итог за пределы шкалы.

function averageFor(marks: Array<{ competency: number; option: number }>) {
  const totals = marks.reduce(
    (current, mark) => accumulateCompetencyTotals(
      current,
      { control: mark.competency },
      "CASE-SCALE",
      "main_case",
      mark.option,
      null,
    ),
    {},
  );
  return buildCompetencyAverageMap(totals).control;
}

assert.equal(
  averageFor(Array.from({ length: 15 }, () => ({ competency: 1, option: 1 }))),
  1,
  "пятнадцать «слабо» дают ровно 1 — нижнюю границу шкалы, а не долю от неё",
);
assert.equal(
  averageFor(Array.from({ length: 15 }, () => ({ competency: 5, option: 5 }))),
  5,
  "пятнадцать «сильно» дают ровно 5 — верхнюю границу шкалы",
);
assert.equal(
  averageFor([
    { competency: 1, option: 1 },
    { competency: 5, option: 5 },
  ]),
  3,
  "«слабо» и «сильно» поровну дают середину шкалы",
);
assert.equal(
  averageFor([
    { competency: 5, option: 1 },
    { competency: 5, option: 1 },
  ]),
  5,
  "сильная компетенция внутри слабого в целом варианта остаётся сильной",
);

// ── Вес кейса ───────────────────────────────────────────────────────────────
// Вес входит и в числитель, и в знаменатель: он меняет долю кейса в среднем,
// но не сдвигает саму шкалу.

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
  planning: 3,
  communication: 2,
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
      planning: 3.2,
      communication: 2.2,
    },
    timeCoefficient: 1.08,
  },
);

// ── Охват компетенции ───────────────────────────────────────────────────────
// Кейсы считаются по уникальным идентификаторам: пятнадцать решений внутри
// одного кейса — это один кейс, а не пятнадцать подтверждений.

const coverage = buildCompetencyCoverage([
  { caseId: "CASE-01", competencyScores: { control: 1 } },
  { caseId: "CASE-01", competencyScores: { control: 3 } },
  { caseId: "CASE-01", competencyScores: { control: 5 } },
  { caseId: "CASE-02", competencyScores: { control: 3, planning: 5 } },
]);

assert.deepEqual(
  coverage.control,
  { decisions: 4, cases: 2 },
  "четыре решения в двух кейсах — четыре решения и ДВА кейса, не четыре",
);
assert.deepEqual(coverage.planning, { decisions: 1, cases: 1 });
assert.equal(coverage.communication, undefined, "неизмерявшаяся компетенция в охват не попадает");

assert.equal(isReliablyMeasured(coverage.control.cases), false, "два кейса — на решение не тянет");
assert.equal(isReliablyMeasured(RELIABLE_CASE_COUNT), true, "порог достигнут — оценке можно верить");

console.log("Scoring parity checks passed: weights, time coefficient, and competencies share one formula.");
