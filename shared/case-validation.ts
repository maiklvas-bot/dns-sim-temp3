import type { SimCase } from "./simulation-content";

export const BARS_LEVEL_SCORES = { weak: 1, mid: 3, strong: 5 } as const;
const BARS_SCORE_VALUES: number[] = Object.values(BARS_LEVEL_SCORES);
const BARS_TOLERANCE = 0.001;
const ANTIGAMING_RHO_THRESHOLD = 0.9;
const ANTIGAMING_LENGTH_RATIO_LIMIT = 2;

export interface CaseValidationIssue {
  check: "bars_conformance" | "antigaming" | "diagnostics" | "effect_reality";
  cycleId?: string;
  optionId?: string;
  message: string;
}

function isBarsConformant(score: number): boolean {
  return BARS_SCORE_VALUES.some((value) => Math.abs(value - score) <= BARS_TOLERANCE);
}

function checkBarsConformance(caseInput: SimCase): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];
  caseInput.cycles.forEach((cycle) => {
    cycle.options.forEach((option) => {
      Object.entries(option.competency_scores || {}).forEach(([competencyId, score]) => {
        if (!isBarsConformant(Number(score))) {
          issues.push({
            check: "bars_conformance",
            cycleId: cycle.id,
            optionId: option.id,
            message: `Вариант "${option.id}": балл компетенции "${competencyId}" (${score}) не соответствует уровню BARS (1 слабо / 3 средне / 5 сильно).`,
          });
        }
      });
    });
  });
  return issues;
}

export function spearmanRho(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2 || b.length !== n) return 0;
  const rank = (values: number[]): number[] => {
    const sorted = values.map((value, index) => ({ value, index })).sort((x, y) => x.value - y.value);
    const ranks = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && sorted[j + 1].value === sorted[i].value) j++;
      const averageRank = (i + j) / 2 + 1;
      for (let k = i; k <= j; k++) ranks[sorted[k].index] = averageRank;
      i = j + 1;
    }
    return ranks;
  };
  const rankA = rank(a);
  const rankB = rank(b);
  const meanA = rankA.reduce((sum, v) => sum + v, 0) / n;
  const meanB = rankB.reduce((sum, v) => sum + v, 0) / n;
  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = rankA[i] - meanA;
    const db = rankB[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  if (varA === 0 || varB === 0) return 0;
  return cov / Math.sqrt(varA * varB);
}

function checkAntigaming(caseInput: SimCase): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];
  caseInput.cycles.forEach((cycle) => {
    const options = cycle.options;

    if (options.length >= 2) {
      const lengths = options.map((option) => option.text.length);
      const maxLength = Math.max(...lengths);
      const minLength = Math.max(1, Math.min(...lengths));
      if (maxLength / minLength > ANTIGAMING_LENGTH_RATIO_LIMIT) {
        issues.push({
          check: "antigaming",
          cycleId: cycle.id,
          message: `Цикл "${cycle.id}": разброс длины текста вариантов превышает допуск (${maxLength} / ${minLength} символов).`,
        });
      }
    }

    if (options.length >= 3) {
      const levels = options.map((option) => option.level);
      const competencyIds = new Set<string>();
      options.forEach((option) => Object.keys(option.competency_scores || {}).forEach((id) => competencyIds.add(id)));
      const scoredEverywhere = Array.from(competencyIds).filter((id) =>
        options.every((option) => typeof (option.competency_scores || {})[id] === "number"),
      );
      if (scoredEverywhere.length >= 2) {
        const allTightlyCorrelated = scoredEverywhere.every((competencyId) => {
          const scores = options.map((option) => Number(option.competency_scores[competencyId]));
          return Math.abs(spearmanRho(levels, scores)) >= ANTIGAMING_RHO_THRESHOLD;
        });
        if (allTightlyCorrelated) {
          issues.push({
            check: "antigaming",
            cycleId: cycle.id,
            message: `Цикл "${cycle.id}": все компетенции монотонно растут вместе с уровнем варианта — единая "шкала хорошести" вместо реального профиля.`,
          });
        }
      }
    }
  });
  return issues;
}

function checkDiagnostics(caseInput: SimCase): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];
  // Пустые строки-заглушки не считаются заполнением: они не дают участнику материала
  // для диагностики, а автору позволили бы пройти проверку добавлением пустых строк.
  const meaningfulDataPoints = (caseInput.dataPoints || []).filter((point) => Boolean(point.label && point.label.trim()));
  const meaningfulFalseTrails = (caseInput.falseTrails || []).filter((trail) => Boolean(trail && trail.trim()));

  if (!caseInput.hiddenCause || !caseInput.hiddenCause.trim()) {
    issues.push({ check: "diagnostics", message: "Не заполнена скрытая причина кейса." });
  }
  if (meaningfulDataPoints.length === 0) {
    issues.push({ check: "diagnostics", message: "Не добавлено ни одной записи данных для запроса." });
  }
  if (meaningfulFalseTrails.length === 0) {
    issues.push({ check: "diagnostics", message: "Не добавлено ни одного ложного следа." });
  }
  return issues;
}

function checkEffectReality(caseInput: SimCase): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];
  caseInput.cycles.forEach((cycle) => {
    cycle.options.forEach((option) => {
      const hasNonZeroEffect = Object.values(option.effects).some((value) => Number(value) !== 0);
      if (!hasNonZeroEffect) {
        issues.push({
          check: "effect_reality",
          cycleId: cycle.id,
          optionId: option.id,
          message: `Вариант "${option.id}": все эффекты на состояние равны нулю — декоративный выбор.`,
        });
      }
    });
  });
  return issues;
}

export function validateCase(caseInput: SimCase): CaseValidationIssue[] {
  return [
    ...checkBarsConformance(caseInput),
    ...checkAntigaming(caseInput),
    ...checkDiagnostics(caseInput),
    ...checkEffectReality(caseInput),
  ];
}

const BLOCKING_QA_STATUSES: ReadonlySet<string> = new Set([
  "methodical_review",
  "ready_prototype",
  "ready_launch",
]);

export function shouldBlockCaseSave(qaStatus: string | undefined, issues: CaseValidationIssue[]): boolean {
  return issues.length > 0 && BLOCKING_QA_STATUSES.has(qaStatus || "draft");
}
