import assert from "node:assert/strict";
import { spearmanRho, validateCase, shouldBlockCaseSave } from "../shared/case-validation";
import type { SimCase } from "../shared/simulation-content";

const baseEffects = { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 };

function buildCase(overrides: Partial<SimCase> = {}): SimCase {
  return {
    id: "CASE-1",
    title: "Test case",
    description: "Test",
    primaryCompetencies: [],
    secondaryCompetencies: [],
    trigger: { type: "message", source: "Test", text: "Test" },
    zones_affected: [],
    cycles: [{
      id: "CASE-1-C1",
      cycle: 1,
      situation: "Situation",
      signal: { type: "message", content: "Signal" },
      options: [
        { id: "O1", level: 1, text: "Postpone the decision", score: 1, effects: { ...baseEffects, queue: 5 }, competency_scores: { planning: 1 } },
        { id: "O2", level: 2, text: "Delegate without a deadline", score: 2, effects: { ...baseEffects, queue: 3 }, competency_scores: { planning: 3 } },
        { id: "O3", level: 3, text: "Assign owner and set a check", score: 3, effects: { ...baseEffects, queue: -2 }, competency_scores: { planning: 5 } },
      ],
    }],
    hiddenCause: "Root cause",
    dataPoints: [{ label: "Report" }],
    falseTrails: ["Distraction"],
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

// spearmanRho: perfect ascending correlation
assert.equal(spearmanRho([1, 2, 3], [1, 3, 5]), 1);
// spearmanRho: perfect descending correlation
assert.equal(spearmanRho([1, 2, 3], [5, 3, 1]), -1);
// spearmanRho: mismatched length is neutral
assert.equal(spearmanRho([1, 2], [1, 2, 3]), 0);

// A well-formed case: diagnostics filled; every option moves at least one metric;
// option texts stay within the x2 length ratio; only one competency is scored, so the
// antigaming "single goodness axis" rule (needs >=2 scored competencies) does not fire.
assert.deepEqual(validateCase(buildCase()), []);

// Missing diagnostics fields
const noDiagnostics = buildCase({ hiddenCause: null, dataPoints: [], falseTrails: [] });
const diagnosticsIssues = validateCase(noDiagnostics).filter((issue) => issue.check === "diagnostics");
assert.equal(diagnosticsIssues.length, 3);

// Non-BARS score (2 is not weak=1/mid=3/strong=5)
const badBars = buildCase();
badBars.cycles[0].options[0].competency_scores = { planning: 2 };
const barsIssues = validateCase(badBars).filter((issue) => issue.check === "bars_conformance");
assert.equal(barsIssues.length, 1);

// All-zero effects on one option
const zeroEffects = buildCase();
zeroEffects.cycles[0].options[0].effects = { ...baseEffects };
const effectIssues = validateCase(zeroEffects).filter((issue) => issue.check === "effect_reality");
assert.equal(effectIssues.length, 1);

// Antigaming: two competencies both perfectly rising with level -> single "goodness axis".
// Texts stay within the length ratio and effects stay non-zero, so this fixture isolates
// the correlation rule from the other two antigaming/effect checks.
const antigamingCase = buildCase();
antigamingCase.cycles[0].options = [
  { id: "O1", level: 1, text: "Wait and see how it goes", score: 1, effects: { ...baseEffects, queue: 5 }, competency_scores: { planning: 1, communication: 1 } },
  { id: "O2", level: 2, text: "Ask a colleague for input", score: 2, effects: { ...baseEffects, queue: 3 }, competency_scores: { planning: 3, communication: 3 } },
  { id: "O3", level: 3, text: "Run a two-minute standup", score: 3, effects: { ...baseEffects, queue: -2 }, competency_scores: { planning: 5, communication: 5 } },
];
const antigamingIssues = validateCase(antigamingCase).filter(
  (issue) => issue.check === "antigaming" && issue.message.includes("шкала хорошести"),
);
assert.equal(antigamingIssues.length, 1);

// shouldBlockCaseSave composition tests: the gate in POST /api/admin/cases
// ensures that if there are validation issues AND the QA status is blocking, we reject the save.

// Case 1: issues + blocking status -> should block (true)
const caseWithIssues = buildCase({ hiddenCause: null }); // triggers diagnostics issue
const issuesFromBadCase = validateCase(caseWithIssues);
assert.ok(issuesFromBadCase.length > 0, "should produce validation issues");
assert.equal(shouldBlockCaseSave("ready_launch", issuesFromBadCase), true);

// Case 2: issues + draft status -> should NOT block (false)
assert.equal(shouldBlockCaseSave("draft", issuesFromBadCase), false);

// Case 3: no issues + blocking status -> should NOT block (false)
const goodCase = buildCase();
const noIssues = validateCase(goodCase);
assert.equal(noIssues.length, 0, "good case should have no issues");
assert.equal(shouldBlockCaseSave("ready_launch", noIssues), false);

// Case 4: undefined qaStatus (backward compatibility for existing admin clients) + issues -> should NOT block (false)
assert.equal(shouldBlockCaseSave(undefined, issuesFromBadCase), false);

// Diagnostics must judge content, not just array length. A dossier filled with blank
// placeholders provides no material to diagnose, so it must not pass the gate — otherwise
// an author could satisfy the check by adding empty rows.
const blankDossier = buildCase({
  hiddenCause: "Root cause",
  dataPoints: [{ label: "   " }],
  falseTrails: ["  "],
});
const blankDossierIssues = validateCase(blankDossier).filter((issue) => issue.check === "diagnostics");
assert.equal(blankDossierIssues.length, 2);

// A dossier where only some rows are blank still counts as filled — the author supplied real material.
const partiallyBlankDossier = buildCase({
  hiddenCause: "Root cause",
  dataPoints: [{ label: "   " }, { label: "Отчёт по смене" }],
  falseTrails: ["", "Кажется, виновата касса"],
});
assert.equal(
  validateCase(partiallyBlankDossier).filter((issue) => issue.check === "diagnostics").length,
  0,
);

// Whitespace-only hiddenCause was already covered by trim; keep it pinned so the three
// diagnostics sub-checks stay symmetric.
const blankCause = buildCase({ hiddenCause: "   " });
assert.equal(
  validateCase(blankCause).filter((issue) => issue.check === "diagnostics").length,
  1,
);

console.log("case-validation parity checks passed");
