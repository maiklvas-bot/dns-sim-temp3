import type { CompetencyDefinition } from "./simulation-content";

export function getFacetIds(parentId: string, definitions: CompetencyDefinition[]): string[] {
  return definitions
    .filter((definition) => definition.facetOfCompetencyId === parentId)
    .map((definition) => definition.id);
}

export function aggregateFacetAverages(
  competencyAverages: Record<string, number>,
  definitions: CompetencyDefinition[],
): Record<string, number> {
  const result: Record<string, number> = { ...competencyAverages };
  const facetsByParent = new Map<string, string[]>();

  definitions.forEach((definition) => {
    if (definition.facetOfCompetencyId) {
      const list = facetsByParent.get(definition.facetOfCompetencyId) || [];
      list.push(definition.id);
      facetsByParent.set(definition.facetOfCompetencyId, list);
    }
  });

  facetsByParent.forEach((facetIds, parentId) => {
    const values = facetIds
      .map((id) => competencyAverages[id])
      .filter((value): value is number => typeof value === "number");
    if (values.length > 0) {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      result[parentId] = Math.round(mean * 10) / 10;
    }
  });

  return result;
}
