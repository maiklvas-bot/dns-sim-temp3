import type { SimCase } from "./simulation-content";
import templatesData from "./case-templates-data.json";

export interface CaseTemplate {
  id: string;
  title: string;
  /** Одна строка для списка выбора. */
  summary: string;
  /** Чему этот эталон учит автора. */
  teaches: string;
  caseData: SimCase;
}

export const CASE_TEMPLATES: ReadonlyArray<CaseTemplate> =
  (templatesData as { templates: CaseTemplate[] }).templates;

/**
 * Создаёт независимую копию эталона под новый идентификатор кейса.
 * Идентификаторы циклов и вариантов пересобираются, иначе два кейса делили бы ключи;
 * копия всегда создаётся черновиком — автор должен сам решить, когда её публиковать.
 */
export function instantiateTemplate(template: CaseTemplate, caseId: string): SimCase {
  const source = template.caseData;
  const cycleIdMap = new Map<string, string>();
  source.cycles.forEach((cycle, index) => {
    cycleIdMap.set(cycle.id, `${caseId}-C${index + 1}`);
  });

  return {
    ...source,
    id: caseId,
    isActive: false,
    qaStatus: "draft",
    acceptedIssues: [],
    cycles: source.cycles.map((cycle, cycleIndex) => ({
      ...cycle,
      id: cycleIdMap.get(cycle.id) as string,
      options: cycle.options.map((option, optionIndex) => ({
        ...option,
        id: `${caseId}-C${cycleIndex + 1}-O${optionIndex + 1}`,
        effects: { ...option.effects },
        competency_scores: { ...option.competency_scores },
        nextCycleId:
          option.nextCycleId && option.nextCycleId !== "__complete"
            ? cycleIdMap.get(option.nextCycleId) || null
            : option.nextCycleId || null,
      })),
      signal: { ...cycle.signal },
    })),
    dataPoints: (source.dataPoints || []).map((point) => ({ ...point })),
    falseTrails: [...(source.falseTrails || [])],
  };
}
