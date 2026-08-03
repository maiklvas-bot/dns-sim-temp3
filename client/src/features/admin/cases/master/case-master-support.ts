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

const SIGNAL_TYPE_LABELS: Record<string, string> = {
  call: "звонок",
  message: "сообщение",
  zone_signal: "сигнал зоны",
  email: "почта",
  visitor: "посетитель",
};

export function signalTypeLabel(type: string | undefined): string {
  return SIGNAL_TYPE_LABELS[type || ""] || type || "не выбран";
}

/**
 * Шаг, на который ведёт ответ, но которого нет в кейсе, — оборванная ветка.
 * Участник упрётся в неё и кейс закончится не там, где задумано.
 */
export function findBrokenTransitions(caseInput: SimCase): number {
  const cycles = caseInput.cycles || [];
  const knownIds = new Set(cycles.map((cycle) => cycle.id).filter(Boolean));
  return cycles.reduce(
    (count, cycle) =>
      count
      + (cycle.options || []).filter((option) => {
        const target = option.nextCycleId;
        if (!target || target === "__complete") return false;
        return !knownIds.has(target);
      }).length,
    0,
  );
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

/** Короткие имена этапов для меток на замечаниях. */
export const MASTER_STEP_TITLES: Record<MasterStepId, string> = {
  intent: "Замысел",
  situation: "Ситуация",
  structure: "Структура",
  decisions: "Решения",
  launch: "Запуск",
};

/** Замечание готовности с адресом: клик по нему открывает этап, где его чинят. */
export interface SetupIssue {
  text: string;
  step: MasterStepId;
}

/**
 * Проверка готовности к запуску — отдельная от `validateCase`: та смотрит на качество
 * методологии, эта на то, заполнено ли вообще необходимое. Каждый пункт знает свой этап,
 * иначе автор читает «не заполнена ситуация» и не понимает, где её заполнять.
 */
export function buildCaseSetupIssues(caseInput: SimCase | null | undefined): SetupIssue[] {
  if (!caseInput) return [];

  const issues: SetupIssue[] = [];
  const add = (step: MasterStepId, text: string) => issues.push({ step, text });

  if (!hasMeaningfulText(caseInput.title)) add("intent", "Не заполнено название кейса.");
  if (!hasMeaningfulText(caseInput.trigger?.text)) add("situation", "Не заполнен стартовый сигнал кейса.");
  if (!hasMeaningfulText(caseInput.trigger?.source)) add("situation", "Не заполнен источник сигнала.");
  if (!caseInput.timing?.decisionDeadlineSeconds) add("launch", "Не задан срок решения.");
  if (!caseInput.cycles?.length) add("structure", "Не создан ни один шаг.");

  (caseInput.cycles || []).forEach((cycle, cycleIndex) => {
    const at = `Шаг ${cycleIndex + 1}`;
    // Ситуация и сигнал шага правятся в редакторе циклов — это этап «Решения»,
    // а не «Ситуация»: там описан кейс целиком, здесь обстановка одного шага.
    if (!hasMeaningfulText(cycle.situation)) add("decisions", `${at}: не заполнена ситуация шага.`);
    if (!hasMeaningfulText(cycle.signal?.content)) add("decisions", `${at}: не заполнен текст сигнала шага.`);

    const activeOptions = (cycle.options || []).filter((option) => (option.status || "active") === "active");
    if (activeOptions.length === 0) add("decisions", `${at}: нет активных вариантов ответа.`);

    activeOptions.forEach((option, optionIndex) => {
      const where = `${at}, ответ ${optionIndex + 1}`;
      if (!hasMeaningfulText(option.text)) add("decisions", `${where}: не заполнен текст ответа.`);
      if (Object.keys(option.competency_scores || {}).length === 0) {
        add("decisions", `${where}: не выбран уровень ни по одной компетенции.`);
      }
      if (
        option.nextCycleId
        && option.nextCycleId !== "__complete"
        && !(caseInput.cycles || []).some((item) => item.id === option.nextCycleId)
      ) {
        add("structure", `${where}: переход ведёт на шаг, которого нет.`);
      }
    });
  });

  return issues;
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
  const brokenTransitions = findBrokenTransitions(caseInput);
  const stepsWithoutSituation = cycles.filter((cycle) => !hasMeaningfulText(cycle.situation)).length;
  const cyclesWithoutOptions = cycles.filter((cycle) => (cycle.options || []).length === 0).length;

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
        hasMeaningfulText(caseInput.trigger?.text)
          ? `Сигнал: ${signalTypeLabel(caseInput.trigger?.type)}`
          : "Сигнал не описан",
        hasMeaningfulText(caseInput.hiddenCause) ? "Скрытая причина задана" : "Скрытой причины нет",
        `Данных: ${(caseInput.dataPoints || []).length}, ложных следов: ${(caseInput.falseTrails || []).length}`,
      ],
      isFilled: dossier.isComplete && hasMeaningfulText(caseInput.trigger?.text),
    },
    structure: {
      lines: [
        branching ? "С ветвлением" : "Линейный путь",
        `Шагов: ${cycles.length}`,
        ...(brokenTransitions > 0 ? [`Оборванных переходов: ${brokenTransitions}`] : []),
        ...(stepsWithoutSituation > 0 ? [`Шагов без описания: ${stepsWithoutSituation}`] : []),
      ],
      // Шаг существует ≠ шаг описан. Пустой шаг участнику показать нечего.
      isFilled: cycles.length > 0 && stepsWithoutSituation === 0 && brokenTransitions === 0,
    },
    decisions: {
      lines: [
        optionCount > 0 ? `Вариантов ответа: ${optionCount}` : "Варианты не заданы",
        ...(cyclesWithoutOptions > 0 ? [`Шагов без вариантов: ${cyclesWithoutOptions}`] : []),
      ],
      isFilled: optionCount > 0 && cyclesWithoutOptions === 0,
    },
    launch: {
      lines: [
        caseInput.isActive ? "Опубликован" : "Черновик",
        caseInput.imageAssetId || caseInput.audioAssetId ? "Медиа добавлено" : "Без медиа",
        issues.length > 0 ? `Замечаний автопроверки: ${issues.length}` : "Автопроверка без замечаний",
      ],
      // «Готово» здесь означает «кейс можно выпускать», а не «экран открывался».
      isFilled: issues.length === 0,
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
