import type { AcceptedIssue, SimCase } from "./simulation-content";

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

// Невидимые символы (zero-width space, joiner, BOM) не убираются String.trim(), поэтому
// текст из них проходил бы как содержательный. Единый источник истины для механики и
// для сводки заполненности в админке — иначе интерфейс и проверка разойдутся.
const INVISIBLE_CHARACTERS = /[\u200B-\u200F\u00A0\u2060\uFEFF]/g;

export function hasMeaningfulText(value: string | null | undefined): boolean {
  if (!value) return false;
  return value.replace(INVISIBLE_CHARACTERS, "").trim().length > 0;
}

export function spearmanRho(a: number[], b: number[]): number {
  const n = a.length;
  if (n < 2 || b.length !== n) return 0;
  // NaN сортируется непредсказуемо и давал «идеальную корреляцию» из мусора,
  // Infinity — частичную. Сломанные данные не должны выглядеть как сигнал.
  if (!a.every(Number.isFinite) || !b.every(Number.isFinite)) return 0;
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
      // Проверяются только компетенции, оценённые во всех вариантах цикла. Приравнивать
      // пропуск к нулю нельзя: правило требует, чтобы монотонными были ВСЕ компетенции,
      // поэтому одна некоррелирующая (полученная из пропусков) заглушила бы проверку целиком —
      // это более простой обход, чем тот, который такая замена пытается закрыть.
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
  const meaningfulDataPoints = (caseInput.dataPoints || []).filter((point) => hasMeaningfulText(point.label));
  const meaningfulFalseTrails = (caseInput.falseTrails || []).filter((trail) => hasMeaningfulText(trail));

  if (!hasMeaningfulText(caseInput.hiddenCause)) {
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
      // Number.isFinite обязателен: NaN !== 0 истинно в JS, поэтому сломанный эффект
      // раньше засчитывался как реальное изменение состояния.
      const hasNonZeroEffect = Object.values(option.effects || {}).some(
        (value) => Number.isFinite(Number(value)) && Number(value) !== 0,
      );
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

/**
 * Замечание считается принятым, если автор отметил ровно его — с обоснованием.
 * Пустое обоснование не принимается: отказ должен быть осознанным, а не кликом.
 */
export function isIssueAccepted(issue: CaseValidationIssue, accepted: AcceptedIssue[] | undefined): boolean {
  return (accepted || []).some((item) => {
    if (item.check !== issue.check) return false;
    if (!item.reason || !item.reason.trim()) return false;
    if (item.cycleId && item.cycleId !== issue.cycleId) return false;
    if (item.optionId && item.optionId !== issue.optionId) return false;
    return true;
  });
}

export function shouldBlockCaseSave(
  qaStatus: string | undefined,
  issues: CaseValidationIssue[],
  accepted?: AcceptedIssue[],
): boolean {
  const blocking = issues.filter((issue) => !isIssueAccepted(issue, accepted));
  return blocking.length > 0 && BLOCKING_QA_STATUSES.has(qaStatus || "draft");
}
