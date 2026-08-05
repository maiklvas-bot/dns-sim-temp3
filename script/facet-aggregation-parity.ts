import assert from "node:assert/strict";
import { aggregateFacetAverages, findFacetConflicts, getFacetIds } from "../shared/competency-facets";
import type { CompetencyDefinition } from "../shared/simulation-content";

const definitions: CompetencyDefinition[] = [
  { id: "org_control", name: "Организация и контроль работы", description: "", category: "advanced", isStopFactor: true },
  { id: "planning", name: "Планирование", description: "", category: "advanced", facetOfCompetencyId: "org_control" },
  { id: "task_setting", name: "Постановка задач", description: "", category: "advanced", facetOfCompetencyId: "org_control" },
  { id: "control", name: "Контроль", description: "", category: "advanced", facetOfCompetencyId: "org_control" },
  { id: "result_orientation", name: "Направленность на результат", description: "", category: "leadership", isStopFactor: true },
  { id: "communication", name: "Коммуникабельность", description: "", category: "advanced" },
];

// getFacetIds returns only the facets of the requested parent
assert.deepEqual(getFacetIds("org_control", definitions).sort(), ["control", "planning", "task_setting"]);
assert.deepEqual(getFacetIds("communication", definitions), []);

// Worked example from docs/simulation-case-master-criteria.md §5.2:
// planning=2, task_setting=3, control=4 -> aggregate 3.0 (simple mean)
const averages = { planning: 2, task_setting: 3, control: 4, result_orientation: 4, communication: 3 };
const aggregated = aggregateFacetAverages(averages, definitions);
assert.equal(aggregated.org_control, 3);
// non-facet competencies pass through untouched
assert.equal(aggregated.result_orientation, 4);
assert.equal(aggregated.communication, 3);
// facet values stay visible in the result (layer A: "видно раздельно")
assert.equal(aggregated.planning, 2);
assert.equal(aggregated.task_setting, 3);
assert.equal(aggregated.control, 4);

// Partial facet data: aggregate over the facets that exist
const partial = aggregateFacetAverages({ planning: 2, control: 4 }, definitions);
assert.equal(partial.org_control, 3);

// No facet data at all: parent gets no derived value
const empty = aggregateFacetAverages({ communication: 5 }, definitions);
assert.equal(empty.org_control, undefined);

// Rounding to one decimal place
const rounding = aggregateFacetAverages({ planning: 1, task_setting: 2, control: 2 }, definitions);
assert.equal(rounding.org_control, 1.7);

// The aggregate follows the agreed methodology (§5.2) literally: the mean of the FACETS only.
// A directly scored parent does not join the average — otherwise the worked example agreed with
// the stakeholder would produce a different number than the document states.
// (org_control=4, planning=2, control=4) -> (2+4)/2 = 3.0, the direct 4 is not averaged in
const parentAndFacets = aggregateFacetAverages({ org_control: 4, planning: 2, control: 4 }, definitions);
assert.equal(parentAndFacets.org_control, 3);

// But the discarded value must not vanish silently: a parent scored both directly and through
// facets means the content contradicts itself, and that has to be visible to whoever reads the
// profile. findFacetConflicts is how that signal is retrieved.
const conflicts = findFacetConflicts({ org_control: 4, planning: 2, control: 4 }, definitions);
assert.equal(conflicts.length, 1);
assert.equal(conflicts[0].parentId, "org_control");
assert.equal(conflicts[0].directScore, 4);
assert.equal(conflicts[0].facetAverage, 3);
assert.deepEqual(conflicts[0].facetIds.sort(), ["control", "planning"]);

// No conflict when only facets are scored
assert.deepEqual(findFacetConflicts({ planning: 2, control: 4 }, definitions), []);
// No conflict when only the parent is scored
assert.deepEqual(findFacetConflicts({ org_control: 4 }, definitions), []);
// No conflict for competencies without facets at all
assert.deepEqual(findFacetConflicts({ communication: 3 }, definitions), []);

// A directly scored parent with no facet data at all stays exactly as it was
const parentOnly = aggregateFacetAverages({ org_control: 4 }, definitions);
assert.equal(parentOnly.org_control, 4);

// The input object is never mutated
const source = { planning: 2, control: 4 };
aggregateFacetAverages(source, definitions);
assert.deepEqual(source, { planning: 2, control: 4 });

console.log("facet-aggregation parity checks passed");
