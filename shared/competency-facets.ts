import type { CompetencyDefinition } from "./simulation-content";

export function getFacetIds(parentId: string, definitions: CompetencyDefinition[]): string[] {
  return definitions
    .filter((definition) => definition.facetOfCompetencyId === parentId)
    .map((definition) => definition.id);
}

export interface FacetConflict {
  parentId: string;
  /** Балл, выставленный компетенции-родителю напрямую. */
  directScore: number;
  /** Агрегат, посчитанный по подпризнакам (именно он идёт в профиль). */
  facetAverage: number;
  /** Подпризнаки, участвовавшие в агрегате. */
  facetIds: string[];
}

/**
 * Находит компетенции, оценённые одновременно напрямую и через подпризнаки.
 *
 * Такой контент противоречит сам себе: по методологии подпризнаки заменяют прямую оценку,
 * поэтому в профиль идёт только их среднее. Прямой балл при этом не участвует в расчёте —
 * и, чтобы он не пропал молча, конфликт можно получить этой функцией и показать человеку.
 */
export function findFacetConflicts(
  competencyAverages: Record<string, number>,
  definitions: CompetencyDefinition[],
): FacetConflict[] {
  const conflicts: FacetConflict[] = [];
  const parentIds = new Set(
    definitions.map((definition) => definition.facetOfCompetencyId).filter((id): id is string => Boolean(id)),
  );

  parentIds.forEach((parentId) => {
    const directScore = competencyAverages[parentId];
    if (typeof directScore !== "number") {
      return;
    }
    const facetIds = getFacetIds(parentId, definitions).filter(
      (id) => typeof competencyAverages[id] === "number",
    );
    if (facetIds.length === 0) {
      return;
    }
    const mean = facetIds.reduce((sum, id) => sum + competencyAverages[id], 0) / facetIds.length;
    conflicts.push({
      parentId,
      directScore,
      facetAverage: Math.round(mean * 10) / 10,
      facetIds,
    });
  });

  return conflicts;
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

    // Строго по методологии (§5.2): агрегат — среднее ТОЛЬКО подпризнаков. Прямая оценка
    // родителя в усреднение не входит. Если она есть, это противоречие в контенте —
    // его не глушим, а делаем видимым через findFacetConflicts.
    const mean = facetValues.reduce((sum, value) => sum + value, 0) / facetValues.length;
    result[parentId] = Math.round(mean * 10) / 10;
  });

  return result;
}
