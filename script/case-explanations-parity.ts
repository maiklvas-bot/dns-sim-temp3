import assert from "node:assert/strict";
import { explainIssue } from "../shared/case-issue-explanations";
import type { CaseValidationIssue } from "../shared/case-validation";

function issue(check: CaseValidationIssue["check"], message = "деталь"): CaseValidationIssue {
  return { check, message, cycleId: "C1", optionId: "O1" };
}

// Каждая проверка объясняется тремя частями и знает свой этап
for (const check of ["bars_conformance", "antigaming", "diagnostics", "effect_reality"] as const) {
  const explanation = explainIssue(issue(check));
  assert.ok(explanation.what.length > 0, `${check}: есть «что не так»`);
  assert.ok(explanation.why.length > 0, `${check}: есть «почему это вредно»`);
  assert.ok(explanation.how.length > 0, `${check}: есть «как исправить»`);
  assert.ok(["situation", "decisions"].includes(explanation.stepId), `${check}: привязан к этапу`);
}

// Объяснения написаны языком автора, а не системы
const bars = explainIssue(issue("bars_conformance"));
assert.equal(bars.what.includes("BARS"), false, "в тексте для автора нет внутренних терминов");
assert.equal(bars.stepId, "decisions");

const diagnostics = explainIssue(issue("diagnostics"));
assert.equal(diagnostics.stepId, "situation");

// Исходная техническая формулировка сохраняется отдельным полем — она нужна для точной привязки
assert.equal(explainIssue(issue("antigaming", "Цикл C1: все компетенции монотонны")).detail, "Цикл C1: все компетенции монотонны");

console.log("case-explanations parity checks passed");
