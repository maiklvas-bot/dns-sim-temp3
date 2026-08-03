import assert from "node:assert/strict";
import {
  buildStepSummaries,
  isCaseStructureBranching,
  issuesForStep,
  MASTER_STEPS,
} from "../client/src/features/admin/cases/master/case-master-support";
import { validateCase } from "../shared/case-validation";
import type { SimCase } from "../shared/simulation-content";

const baseEffects = { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 };

function buildCase(overrides: Partial<SimCase> = {}): SimCase {
  return {
    id: "CASE-1",
    title: "Очередь на кассе",
    description: "Описание",
    primaryCompetencies: ["org_control"],
    secondaryCompetencies: [],
    trigger: { type: "message", source: "Старший продавец", text: "Очередь растёт" },
    zones_affected: ["торговый_зал"],
    cycles: [{
      id: "C1",
      cycle: 1,
      situation: "Ситуация",
      signal: { type: "message", content: "Сигнал" },
      options: [
        { id: "O1", level: 1, text: "Подождать и посмотреть", score: 1, effects: { ...baseEffects, queue: 5 }, competency_scores: { org_control: 1 } },
        { id: "O2", level: 2, text: "Спросить у коллеги", score: 2, effects: { ...baseEffects, queue: 3 }, competency_scores: { org_control: 3 } },
      ],
    }],
    businessProblem: "Клиенты уходят из очереди",
    hiddenCause: "Кассир не знает про вторую кассу",
    dataPoints: [{ label: "Отчёт по смене" }],
    falseTrails: ["Кажется, что виновата техника"],
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

// Пять этапов в фиксированном порядке
assert.equal(MASTER_STEPS.length, 5);
assert.deepEqual(MASTER_STEPS.map((step) => step.id), ["intent", "situation", "structure", "decisions", "launch"]);
assert.equal(MASTER_STEPS[0].title, "Замысел");
assert.equal(MASTER_STEPS[4].title, "Оформление и запуск");

// Ветвление определяется наличием явных переходов, а не числом циклов
assert.equal(isCaseStructureBranching(buildCase()), false);
const branching = buildCase();
branching.cycles[0].options[0].nextCycleId = "C2";
assert.equal(isCaseStructureBranching(branching), true);
// "__complete" — это тоже явный переход, а не отсутствие ветвления
const terminal = buildCase();
terminal.cycles[0].options[0].nextCycleId = "__complete";
assert.equal(isCaseStructureBranching(terminal), true);

// Сводка по этапам: заполненность считается по содержанию, а не по факту наличия поля
const summaries = buildStepSummaries(buildCase(), []);
assert.equal(summaries.length, 5);
const intent = summaries.find((item) => item.stepId === "intent");
assert.equal(intent?.isFilled, true);
assert.ok(intent?.lines.some((line) => line.includes("Очередь на кассе")), "сводка показывает суть, а не галочку");

const emptyIntent = buildStepSummaries(buildCase({ title: "  ", businessProblem: null }), []);
assert.equal(emptyIntent.find((item) => item.stepId === "intent")?.isFilled, false);

// Замечания раскладываются по этапам: диагностика -> ситуация, BARS/антигейминг/эффекты -> решения
const brokenCase = buildCase({ hiddenCause: null, dataPoints: [], falseTrails: [] });
const brokenIssues = validateCase(brokenCase);
assert.equal(issuesForStep("situation", brokenIssues).length, 3);
assert.equal(issuesForStep("decisions", brokenIssues).length, 0);

const badScores = buildCase();
badScores.cycles[0].options[0].competency_scores = { org_control: 2 };
const scoreIssues = validateCase(badScores);
assert.equal(issuesForStep("decisions", scoreIssues).length, 1);
assert.equal(issuesForStep("situation", scoreIssues).length, 0);

// Сводка несёт число замечаний своего этапа
const withIssues = buildStepSummaries(brokenCase, brokenIssues);
assert.equal(withIssues.find((item) => item.stepId === "situation")?.issueCount, 3);
assert.equal(withIssues.find((item) => item.stepId === "intent")?.issueCount, 0);

console.log("case-master parity checks passed");
