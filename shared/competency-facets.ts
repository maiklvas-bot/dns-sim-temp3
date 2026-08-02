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
    const facetValues = facetIds
      .map((id) => competencyAverages[id])
      .filter((value): value is number => typeof value === "number");
    if (facetValues.length === 0) {
      return;
    }

    // Если родитель оценивался и напрямую (так устроен существующий контент), его балл
    // не отбрасывается, а входит в усреднение ещё одним наблюдением — иначе реальный
    // сигнал молча терялся бы при переходе на подпризнаки.
    const directParentValue = competencyAverages[parentId];
    const values = typeof directParentValue === "number" ? [directParentValue, ...facetValues] : facetValues;

    const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
    result[parentId] = Math.round(mean * 10) / 10;
  });

  return result;
}
