import type { CaseCycle, CompetencyDefinition } from "@shared/simulation-content";
import type { CaseValidationIssue } from "@shared/case-validation";

/**
 * Данные для таблицы «вариант × компетенция» на этапе «Решения».
 *
 * Здесь только раскладка чисел для показа. Вердикт «это лестница» **не считается
 * заново**: он берётся из самой автопроверки (`findLadderIssue`). Своя формула
 * означала бы, что картинка и механика расходятся — визуализация показывала бы
 * «всё хорошо» там, где проверка выдаёт замечание.
 */

export interface LadderRow {
  competencyId: string;
  name: string;
  scores: number[];
  /** Строка не убывает и не стоит на месте — визуальный признак «растёт». */
  rising: boolean;
}

export interface LadderView {
  rows: LadderRow[];
  optionLabels: string[];
}

export function buildLadderView(cycle: CaseCycle, competencies: CompetencyDefinition[]): LadderView | null {
  const options = [...(cycle.options || [])].sort((a, b) => a.level - b.level);
  if (options.length < 2) return null;

  const usedIds = Array.from(
    new Set(options.flatMap((option) => Object.keys(option.competency_scores || {}))),
  );
  if (usedIds.length === 0) return null;

  const rows = usedIds.map((competencyId) => {
    const scores = options.map((option) => Number((option.competency_scores || {})[competencyId] || 0));
    const notFalling = scores.every((value, index) => index === 0 || value >= scores[index - 1]);
    const flat = scores.every((value) => value === scores[0]);
    return {
      competencyId,
      name: competencies.find((item) => item.id === competencyId)?.name || competencyId,
      scores,
      rising: notFalling && !flat,
    };
  });

  return {
    rows,
    optionLabels: options.map((option, index) => option.text?.trim() || `вариант ${index + 1}`),
  };
}

/** Признак, по которому автопроверка называет набор вариантов «шкалой хорошести». */
const LADDER_MARKER = "шкала хорошести";

/**
 * Замечание автопроверки про лестницу для конкретного шага — источник вердикта.
 * Если проверка сменит критерий, картинка поедет за ней автоматически.
 */
export function findLadderIssue(
  cycleId: string | undefined,
  issues: CaseValidationIssue[],
): CaseValidationIssue | null {
  return (
    issues.find(
      (issue) =>
        issue.check === "antigaming"
        && issue.message.includes(LADDER_MARKER)
        && (issue.cycleId ?? null) === (cycleId ?? null),
    ) || null
  );
}
