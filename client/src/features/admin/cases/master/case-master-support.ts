import type { SimCase } from "@shared/simulation-content";
import { hasMeaningfulText, type CaseValidationIssue } from "@shared/case-validation";
import { buildCaseDossierSummary } from "../case-editor-support";

export type MasterStepId = "intent" | "situation" | "structure" | "decisions" | "launch";

export interface MasterStep {
  id: MasterStepId;
  title: string;
  question: string;
}

/** Порядок этапов фиксирован: каждый отвечает на один вопрос автора. */
export const MASTER_STEPS: ReadonlyArray<MasterStep> = [
  { id: "intent", title: "Замысел", question: "Зачем этот кейс и что он проверяет?" },
  { id: "situation", title: "Ситуация", question: "Что видит участник и что от него скрыто?" },
  { id: "structure", title: "Структура", question: "Как кейс разворачивается?" },
  { id: "decisions", title: "Решения", question: "Что может сделать участник?" },
  { id: "launch", title: "Оформление и запуск", question: "Готов ли кейс к участникам?" },
];

/** Замечания каждой проверки принадлежат тому этапу, где их можно исправить. */
const STEP_BY_CHECK: Record<CaseValidationIssue["check"], MasterStepId> = {
  diagnostics: "situation",
  bars_conformance: "decisions",
  antigaming: "decisions",
  effect_reality: "decisions",
};

export function issuesForStep(stepId: MasterStepId, issues: CaseValidationIssue[]): CaseValidationIssue[] {
  return issues.filter((issue) => STEP_BY_CHECK[issue.check] === stepId);
}

/**
 * Кейс считается ветвящимся, если хотя бы один вариант задаёт явный переход.
 * Число циклов само по себе ветвления не означает: три цикла подряд — это линейный путь.
 */
export function isCaseStructureBranching(caseInput: SimCase): boolean {
  return (caseInput.cycles || []).some((cycle) =>
    (cycle.options || []).some((option) => Boolean(option.nextCycleId)),
  );
}

export interface StepSummary {
  stepId: MasterStepId;
  title: string;
  /** Строки с сутью заполненного — не отметка «готово», а реальное содержание. */
  lines: string[];
  isFilled: boolean;
  issueCount: number;
}

export function buildStepSummaries(caseInput: SimCase, issues: CaseValidationIssue[]): StepSummary[] {
  const dossier = buildCaseDossierSummary(caseInput);
  const cycles = caseInput.cycles || [];
  const optionCount = cycles.reduce((sum, cycle) => sum + (cycle.options || []).length, 0);
  const branching = isCaseStructureBranching(caseInput);

  const competencyLine = [...(caseInput.primaryCompetencies || []), ...(caseInput.secondaryCompetencies || [])];

  const byStep: Record<MasterStepId, { lines: string[]; isFilled: boolean }> = {
    intent: {
      lines: [
        hasMeaningfulText(caseInput.title) ? caseInput.title : "Название не задано",
        competencyLine.length > 0 ? `Компетенции: ${competencyLine.length}` : "Компетенции не выбраны",
        hasMeaningfulText(caseInput.businessProblem) ? "Бизнес-проблема описана" : "Бизнес-проблема не описана",
      ],
      isFilled:
        hasMeaningfulText(caseInput.title)
        && competencyLine.length > 0
        && hasMeaningfulText(caseInput.businessProblem),
    },
    situation: {
      lines: [
        hasMeaningfulText(caseInput.trigger?.text) ? `Сигнал: ${caseInput.trigger.type}` : "Сигнал не описан",
        hasMeaningfulText(caseInput.hiddenCause) ? "Скрытая причина задана" : "Скрытой причины нет",
        `Данных: ${(caseInput.dataPoints || []).length}, ложных следов: ${(caseInput.falseTrails || []).length}`,
      ],
      isFilled: dossier.isComplete && hasMeaningfulText(caseInput.trigger?.text),
    },
    structure: {
      lines: [
        branching ? "С ветвлением" : "Линейный путь",
        `Шагов: ${cycles.length}`,
      ],
      isFilled: cycles.length > 0,
    },
    decisions: {
      lines: [
        optionCount > 0 ? `Вариантов ответа: ${optionCount}` : "Варианты не заданы",
      ],
      isFilled: optionCount > 0,
    },
    launch: {
      lines: [
        caseInput.isActive ? "Опубликован" : "Черновик",
        caseInput.imageAssetId || caseInput.audioAssetId ? "Медиа добавлено" : "Без медиа",
      ],
      isFilled: true,
    },
  };

  return MASTER_STEPS.map((step) => ({
    stepId: step.id,
    title: step.title,
    lines: byStep[step.id].lines,
    isFilled: byStep[step.id].isFilled,
    issueCount: issuesForStep(step.id, issues).length,
  }));
}
