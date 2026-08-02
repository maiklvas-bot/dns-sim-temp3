# Мастер кейсов, план 1: каркас — пять этапов и анкета-хаб

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Заменить визард создания и редактор кейса единым мастером из пяти этапов с кликабельной анкетой-хабом, не потеряв ни одной существующей возможности редактирования.

**Architecture:** Мастер — это **компоновка уже существующих редакторов** плюс новая навигация. `CaseDossierEditor`, `StructuredCyclesEditor`, `CaseMediaPanel`, `CaseFlowDiagram`, `CaseValidationPanel` переиспользуются без переписывания. Новое: чистая логика этапов (`case-master-support.ts`), анкета-хаб, оболочка с гибридной навигацией. Вся расчётная часть — чистые функции с tsx-тестом, компоненты только отображают.

**Tech Stack:** React + TypeScript, Tailwind (админка использует hex-значения, не токены), shadcn-компоненты, состояние через `useState`. Тесты — tsx-скрипты (`node:assert/strict`), клиентских unit-тестов в проекте нет.

**Спека:** `docs/superpowers/specs/2026-08-02-case-master-design.md`

## Global Constraints

- НЕ трогать модуль ЗРД (`shared/zrd/*`, `client/src/features/zrd/*`).
- НЕ терять возможности старого редактора: медиа, тайминги, порядок показа, компетенции, ветвление, эффекты, статусы вариантов. Всё должно найти место на одном из пяти этапов.
- `EntityEditor.tsx` **остаётся** и продолжает обслуживать email/messenger/video — из него уходит только ветка `mode === "case"` (проверено: 11 веток для каналов).
- Расчётная логика — только чистые функции с tsx-тестом; React-компоненты логики не содержат.
- Уровни BARS, проверки, `hasMeaningfulText` берутся из `shared/case-validation.ts` — не дублировать.
- Каждый шаг с кодом — `npm run check`; финал — `npm run check && npm test && npm run test:ui`.

## Что этот план НЕ делает

Обучающий слой (объяснения замечаний, визуальный разбор ошибок, механика осознанного отказа) — **план 2**. Библиотека эталонов и «взять за основу» — **план 3**. Здесь только подсказки-строки у полей.

---

## File Structure

- Create: `client/src/features/admin/cases/master/case-master-support.ts` — чистая логика этапов и сводки.
- Create: `script/case-master-parity.ts` — TDD-фикстура для неё.
- Create: `client/src/features/admin/cases/master/CaseSummaryCard.tsx` — анкета-хаб.
- Create: `client/src/features/admin/cases/master/CaseMaster.tsx` — оболочка с навигацией.
- Create: `client/src/features/admin/cases/master/steps/StepIntent.tsx` — этап 1.
- Create: `client/src/features/admin/cases/master/steps/StepSituation.tsx` — этап 2.
- Create: `client/src/features/admin/cases/master/steps/StepStructure.tsx` — этап 3.
- Create: `client/src/features/admin/cases/master/steps/StepDecisions.tsx` — этап 4.
- Create: `client/src/features/admin/cases/master/steps/StepLaunch.tsx` — этап 5.
- Modify: `client/src/features/admin/components/EntityEditor.tsx` — убрать ветку кейса.
- Modify: `client/src/features/admin/AdminWorkspaceRuntime.tsx` — подключить мастер.
- Delete: `client/src/features/admin/cases/CaseCreationWizard.tsx`.
- Modify: `script/check-ui-acceptance.mjs` — контракт мастера.

---

### Task 1: Чистая логика этапов

**Files:**
- Create: `client/src/features/admin/cases/master/case-master-support.ts`
- Create: `script/case-master-parity.ts`

**Interfaces:**
- Consumes: `SimCase` из `@shared/simulation-content`, `validateCase`/`CaseValidationIssue`/`hasMeaningfulText` из `@shared/case-validation`, `buildCaseDossierSummary` из `../case-editor-support`.
- Produces: `MASTER_STEPS`, `MasterStepId`, `buildStepSummaries()`, `issuesForStep()`, `isCaseStructureBranching()` — используются в Task 2–7.

- [ ] **Step 1: Написать падающую фикстуру `script/case-master-parity.ts`**

```ts
import assert from "node:assert/strict";
import {
  buildStepSummaries,
  isCaseStructureBranching,
  issuesForStep,
  MASTER_STEPS,
} from "../client/src/features/admin/cases/master/case-master-support";
import { validateCase } from "../shared/case-validation";
import type { SimCase } from "../shared/simulation-content";

const baseEffects = { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 };

function buildCase(overrides: Partial<SimCase> = {}): SimCase {
  return {
    id: "CASE-1",
    title: "Очередь на кассе",
    description: "Описание",
    primaryCompetencies: ["org_control"],
    secondaryCompetencies: [],
    trigger: { type: "message", source: "Старший продавец", text: "Очередь растёт" },
    zones_affected: ["торговый_зал"],
    cycles: [{
      id: "C1",
      cycle: 1,
      situation: "Ситуация",
      signal: { type: "message", content: "Сигнал" },
      options: [
        { id: "O1", level: 1, text: "Подождать и посмотреть", score: 1, effects: { ...baseEffects, queue: 5 }, competency_scores: { org_control: 1 } },
        { id: "O2", level: 2, text: "Спросить у коллеги", score: 2, effects: { ...baseEffects, queue: 3 }, competency_scores: { org_control: 3 } },
      ],
    }],
    businessProblem: "Клиенты уходят из очереди",
    hiddenCause: "Кассир не знает про вторую кассу",
    dataPoints: [{ label: "Отчёт по смене" }],
    falseTrails: ["Кажется, что виновата техника"],
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

// Пять этапов в фиксированном порядке
assert.equal(MASTER_STEPS.length, 5);
assert.deepEqual(MASTER_STEPS.map((step) => step.id), ["intent", "situation", "structure", "decisions", "launch"]);
assert.equal(MASTER_STEPS[0].title, "Замысел");
assert.equal(MASTER_STEPS[4].title, "Оформление и запуск");

// Ветвление определяется наличием явных переходов, а не числом циклов
assert.equal(isCaseStructureBranching(buildCase()), false);
const branching = buildCase();
branching.cycles[0].options[0].nextCycleId = "C2";
assert.equal(isCaseStructureBranching(branching), true);
// "__complete" — это тоже явный переход, а не отсутствие ветвления
const terminal = buildCase();
terminal.cycles[0].options[0].nextCycleId = "__complete";
assert.equal(isCaseStructureBranching(terminal), true);

// Сводка по этапам: заполненность считается по содержанию, а не по факту наличия поля
const summaries = buildStepSummaries(buildCase(), []);
assert.equal(summaries.length, 5);
const intent = summaries.find((item) => item.stepId === "intent");
assert.equal(intent?.isFilled, true);
assert.ok(intent?.lines.some((line) => line.includes("Очередь на кассе")), "сводка показывает суть, а не галочку");

const emptyIntent = buildStepSummaries(buildCase({ title: "  ", businessProblem: null }), []);
assert.equal(emptyIntent.find((item) => item.stepId === "intent")?.isFilled, false);

// Замечания раскладываются по этапам: диагностика -> ситуация, BARS/антигейминг/эффекты -> решения
const brokenCase = buildCase({ hiddenCause: null, dataPoints: [], falseTrails: [] });
const brokenIssues = validateCase(brokenCase);
assert.equal(issuesForStep("situation", brokenIssues).length, 3);
assert.equal(issuesForStep("decisions", brokenIssues).length, 0);

const badScores = buildCase();
badScores.cycles[0].options[0].competency_scores = { org_control: 2 };
const scoreIssues = validateCase(badScores);
assert.equal(issuesForStep("decisions", scoreIssues).length, 1);
assert.equal(issuesForStep("situation", scoreIssues).length, 0);

// Сводка несёт число замечаний своего этапа
const withIssues = buildStepSummaries(brokenCase, brokenIssues);
assert.equal(withIssues.find((item) => item.stepId === "situation")?.issueCount, 3);
assert.equal(withIssues.find((item) => item.stepId === "intent")?.issueCount, 0);

console.log("case-master parity checks passed");
```

- [ ] **Step 2: Убедиться, что фикстура падает**

Run: `npx tsx script/case-master-parity.ts`
Expected: ошибка резолва модуля `case-master-support`.

- [ ] **Step 3: Реализовать `case-master-support.ts`**

```ts
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
```

- [ ] **Step 4: Убедиться, что фикстура проходит**

Run: `npx tsx script/case-master-parity.ts`
Expected: `case-master parity checks passed`

- [ ] **Step 5: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/admin/cases/master/case-master-support.ts script/case-master-parity.ts
git commit -m "feat(admin): чистая логика этапов мастера кейсов"
```

---

### Task 2: Анкета-хаб

**Files:**
- Create: `client/src/features/admin/cases/master/CaseSummaryCard.tsx`

**Interfaces:**
- Consumes: `buildStepSummaries`, `MasterStepId` (Task 1); `validateCase` из `@shared/case-validation`.
- Produces: компонент `CaseSummaryCard({ caseInput, onOpenStep })` — используется в Task 3.

- [ ] **Step 1: Создать компонент**

```tsx
import { useMemo } from "react";
import type { SimCase } from "@shared/simulation-content";
import { validateCase } from "@shared/case-validation";
import { buildStepSummaries, type MasterStepId } from "./case-master-support";

export function CaseSummaryCard({
  caseInput,
  onOpenStep,
}: {
  caseInput: SimCase;
  onOpenStep: (stepId: MasterStepId) => void;
}) {
  const issues = useMemo(() => validateCase(caseInput), [caseInput]);
  const summaries = useMemo(() => buildStepSummaries(caseInput, issues), [caseInput, issues]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">{caseInput.title || "Новый кейс"}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Карточка кейса. Нажмите на любой блок, чтобы вернуться к его настройке.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {summaries.map((summary, index) => {
          const isLast = index === summaries.length - 1;
          return (
            <button
              key={summary.stepId}
              type="button"
              onClick={() => onOpenStep(summary.stepId)}
              className={`rounded-xl border p-3 text-left transition ${isLast ? "md:col-span-2" : ""} ${
                summary.issueCount > 0
                  ? "border-[#ffb27a]/40 bg-[#FF6B00]/8 hover:border-[#ffb27a]"
                  : "border-[#243244] bg-[#101826]/60 hover:border-[#3b5878]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#70829d]">
                  {index + 1}. {summary.title}
                </div>
                {summary.issueCount > 0 ? (
                  <div className="shrink-0 text-[11px] font-semibold text-[#ffb27a]">⚠ {summary.issueCount}</div>
                ) : (
                  <div className={`shrink-0 text-[11px] ${summary.isFilled ? "text-[#54d28c]" : "text-[#70829d]"}`}>
                    {summary.isFilled ? "готово" : "не заполнено"}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-0.5">
                {summary.lines.map((line, lineIndex) => (
                  <div key={`${summary.stepId}-${lineIndex}`} className="truncate text-[12px] text-[#b8c7df]">
                    {line}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/admin/cases/master/CaseSummaryCard.tsx
git commit -m "feat(admin): анкета-хаб кейса с переходом в этапы"
```

---

### Task 3: Этапы 1 и 2 — Замысел и Ситуация

**Files:**
- Create: `client/src/features/admin/cases/master/steps/StepIntent.tsx`
- Create: `client/src/features/admin/cases/master/steps/StepSituation.tsx`

**Interfaces:**
- Consumes: `Field`/`FieldArea`/`SelectField`/`SuggestField`/`MultiSelectField`/`CompetencyRoleSelector` из `../../../components/AdminFields`; `CaseDossierEditor` из `../../CaseDossierEditor`; `CASE_SIGNAL_TYPE_OPTIONS`/`STORE_ZONE_OPTIONS` из `../../case-editor-support`.
- Produces: `StepIntent`, `StepSituation` — используются в Task 6.

**Зачем:** оба этапа собираются из существующих полей — переписывать редакторы не нужно, нужно разложить их по смыслу и добавить подсказки простым языком.

- [ ] **Step 1: Создать `StepIntent.tsx`**

```tsx
import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { CompetencyRoleSelector, Field, FieldArea } from "../../../components/AdminFields";

export function StepIntent({
  entity,
  competencies,
  onChange,
}: {
  entity: SimCase;
  competencies: CompetencyDefinition[];
  onChange: (patch: Partial<SimCase>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Зачем этот кейс и что он проверяет?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Начните с того, какую рабочую ситуацию воспроизводит кейс и какое поведение вы хотите увидеть.
          Всё остальное — сигнал, варианты ответа, эффекты — будет строиться вокруг этого.
        </div>
      </div>

      <Field label="Название кейса" value={entity.title} onChange={(value) => onChange({ title: value })} />
      <div className="text-[11px] text-[#70829d]">Коротко и по делу: «Очередь на кассе в час пик».</div>

      <FieldArea label="Описание" value={entity.description} onChange={(value) => onChange({ description: value })} />
      <div className="text-[11px] text-[#70829d]">Что происходит в подразделении. Это увидит оценщик, не участник.</div>

      <FieldArea
        label="Бизнес-проблема"
        value={entity.businessProblem || ""}
        onChange={(value) => onChange({ businessProblem: value })}
      />
      <div className="text-[11px] text-[#70829d]">
        Чем эта ситуация вредит магазину, если её решают плохо: теряем клиентов, растут потери, выгорает смена.
      </div>

      <CompetencyRoleSelector
        primaryValues={entity.primaryCompetencies || []}
        secondaryValues={entity.secondaryCompetencies || []}
        onChange={(next) => onChange(next)}
        competencies={competencies}
      />
      <div className="text-[11px] text-[#70829d]">
        Основные — то, ради чего кейс существует. Дополнительные проявятся попутно.
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Создать `StepSituation.tsx`**

```tsx
import type { SimCase } from "@shared/simulation-content";
import { FieldArea, MultiSelectField, SelectField, SuggestField } from "../../../components/AdminFields";
import { CASE_SIGNAL_TYPE_OPTIONS, STORE_ZONE_OPTIONS } from "../../case-editor-support";
import { CaseDossierEditor } from "../../CaseDossierEditor";

export function StepSituation({
  entity,
  caseSourceOptions,
  onChange,
}: {
  entity: SimCase;
  caseSourceOptions: Array<{ value: string; label: string }>;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Что видит участник и что от него скрыто?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Участник видит только симптом. Настоящая причина, доступные данные и ложные следы — то, что превращает
          кейс в расследование, а не в угадывание правильной кнопки.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <SuggestField
          label="Источник сигнала"
          value={entity.trigger.source}
          onChange={(value) => onChange({ trigger: { ...entity.trigger, source: value } })}
          options={caseSourceOptions}
        />
        <SelectField
          label="Тип сигнала"
          value={entity.trigger.type}
          onChange={(value) => onChange({ trigger: { ...entity.trigger, type: value } })}
          options={[...CASE_SIGNAL_TYPE_OPTIONS]}
        />
        <MultiSelectField
          label="Зоны магазина"
          values={entity.zones_affected || []}
          onChange={(values) => onChange({ zones_affected: values })}
          options={[...STORE_ZONE_OPTIONS]}
        />
      </div>

      <FieldArea
        label="Текст сигнала"
        value={entity.trigger.text}
        onChange={(value) => onChange({ trigger: { ...entity.trigger, text: value } })}
      />
      <div className="text-[11px] text-[#70829d]">
        Первое, что получит участник. Здесь только симптом — причину он должен найти сам.
      </div>

      <CaseDossierEditor entity={entity} onChange={onChange} />
    </div>
  );
}
```

- [ ] **Step 3: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/admin/cases/master/steps/StepIntent.tsx client/src/features/admin/cases/master/steps/StepSituation.tsx
git commit -m "feat(admin): этапы мастера «Замысел» и «Ситуация»"
```

---

### Task 4: Этапы 3 и 4 — Структура и Решения

**Files:**
- Create: `client/src/features/admin/cases/master/steps/StepStructure.tsx`
- Create: `client/src/features/admin/cases/master/steps/StepDecisions.tsx`

**Interfaces:**
- Consumes: `isCaseStructureBranching` (Task 1); `CaseFlowDiagram` из `../../../components/CaseFlowDiagram`; `StructuredCyclesEditor` из `../../CaseEditors`.
- Produces: `StepStructure`, `StepDecisions` — используются в Task 6.

**Зачем:** структура и решения живут в одних и тех же данных (`cycles`), но отвечают на разные вопросы. Структура показывает **схему** и позволяет добавлять/удалять шаги; решения — редактор вариантов внутри шагов. `CaseFlowDiagram` уже умеет рисовать ветвление, `__complete` и переходы по порядку — используем как есть.

- [ ] **Step 1: Создать `StepStructure.tsx`**

```tsx
import type { SimCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { CaseFlowDiagram } from "../../../components/CaseFlowDiagram";
import { isCaseStructureBranching } from "../case-master-support";

export function StepStructure({
  entity,
  onChange,
}: {
  entity: SimCase;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  const cycles = entity.cycles || [];
  const branching = isCaseStructureBranching(entity);

  const addCycle = () => {
    const nextNumber = cycles.length + 1;
    onChange({
      cycles: [
        ...cycles,
        {
          id: `${entity.id || "CASE"}-C${nextNumber}`,
          cycle: nextNumber,
          situation: "",
          signal: { type: "message" as const, content: "" },
          options: [],
        },
      ],
    });
  };

  const removeCycle = (index: number) => {
    onChange({
      cycles: cycles
        .filter((_, cycleIndex) => cycleIndex !== index)
        .map((cycle, cycleIndex) => ({ ...cycle, cycle: cycleIndex + 1 })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Как кейс разворачивается?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Кейс может идти одной линией — шаг за шагом, — или ветвиться, когда ответ участника определяет,
          что случится дальше. Ветвление задаётся на этапе «Решения»: у каждого варианта можно выбрать,
          какой шаг он запускает.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="text-xs font-semibold text-white">
          Сейчас: {branching ? "кейс с ветвлением" : "линейный путь"}
        </div>
        <div className="text-[11px] text-[#8890a8]">Шагов: {cycles.length}</div>
        <Button type="button" size="sm" className="ml-auto shrink-0" onClick={addCycle}>
          Добавить шаг
        </Button>
      </div>

      {cycles.length > 0 ? (
        <>
          <CaseFlowDiagram caseItem={entity} />
          <div className="space-y-2">
            {cycles.map((cycle, index) => (
              <div
                key={cycle.id || `cycle-${index}`}
                className="flex items-center gap-3 rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2"
              >
                <div className="text-xs font-semibold text-white">Шаг {cycle.cycle}</div>
                <div className="min-w-0 flex-1 truncate text-[11px] text-[#8aa2c4]">
                  {cycle.situation || "Ситуация не описана"}
                </div>
                <div className="shrink-0 text-[11px] text-[#70829d]">
                  вариантов: {(cycle.options || []).length}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                  onClick={() => removeCycle(index)}
                >
                  Удалить
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-6 text-center text-[12px] text-[#8aa2c4]">
          Пока нет ни одного шага. Добавьте первый — это то, с чего начнётся кейс.
        </div>
      )}
    </div>
  );
}
```

Сигнатура сверена с исходником: `export function CaseFlowDiagram({ caseItem }: { caseItem: SimCase | null | undefined })` (`CaseFlowDiagram.tsx:32`). Компонент сам обрабатывает случай пустых циклов, поэтому дополнительная защита не нужна.

- [ ] **Step 2: Создать `StepDecisions.tsx`**

```tsx
import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { StructuredCyclesEditor } from "../../CaseEditors";

export function StepDecisions({
  entity,
  competencies,
  assets,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex,
  onSelectedCycleIndexChange,
  onChange,
}: {
  entity: SimCase;
  competencies: CompetencyDefinition[];
  assets: any[];
  onUploadAsset: (file: File, kind: string) => Promise<any>;
  onTogglePreviewAudio: (key: string, url: string) => void;
  activePreviewKey: string | null;
  selectedCycleIndex: number;
  onSelectedCycleIndexChange: (index: number) => void;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Что может сделать участник?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Варианты должны быть похожи по форме: если «правильный» длиннее и звучит грамотнее остальных,
          участник выберет его не думая. Уровень проявления компетенции задаётся отдельно от текста —
          именно он идёт в оценку.
        </div>
      </div>

      <StructuredCyclesEditor
        cycles={entity.cycles || []}
        competencies={competencies}
        assets={assets}
        onUploadAsset={onUploadAsset}
        onTogglePreviewAudio={onTogglePreviewAudio}
        activePreviewKey={activePreviewKey}
        selectedCycleIndex={selectedCycleIndex}
        onSelectedCycleIndexChange={onSelectedCycleIndexChange}
        onChange={(cycles) => onChange({ cycles })}
      />
    </div>
  );
}
```

- [ ] **Step 3: Проверить типы**

Run: `npm run check`
Expected: без ошибок. Если `tsc` ругается на пропсы `CaseFlowDiagram` или `StructuredCyclesEditor` — привести вызов в соответствие фактической сигнатуре компонента.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/admin/cases/master/steps/StepStructure.tsx client/src/features/admin/cases/master/steps/StepDecisions.tsx
git commit -m "feat(admin): этапы мастера «Структура» и «Решения»"
```

---

### Task 5: Этап 5 — Оформление и запуск

**Files:**
- Create: `client/src/features/admin/cases/master/steps/StepLaunch.tsx`

**Interfaces:**
- Consumes: `CaseMediaPanel` из `../../CaseEditors`; `Field` из `../../../components/AdminFields`; `CaseValidationPanel` из `../../CaseValidationPanel`.
- Produces: `StepLaunch` — используется в Task 6.

**Зачем:** сюда переезжает всё, что умел старый редактор помимо содержания — медиа, тайминги, порядок показа, активность. Без этого этапа мастер не сможет заменить редактор.

- [ ] **Step 1: Создать компонент**

```tsx
import type { SimCase } from "@shared/simulation-content";
import { Field } from "../../../components/AdminFields";
import { CaseMediaPanel } from "../../CaseEditors";
import { CaseValidationPanel } from "../../CaseValidationPanel";

export function StepLaunch({
  entity,
  assets,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  onChange,
}: {
  entity: SimCase;
  assets: any[];
  onUploadAsset: (file: File, kind: string) => Promise<any>;
  onTogglePreviewAudio: (key: string, url: string) => void;
  activePreviewKey: string | null;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  const updateTiming = (patch: Record<string, number | null>) => {
    onChange({ timing: { ...(entity.timing || {}), ...patch } });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Готов ли кейс к участникам?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Последний шаг: как кейс выглядит и когда приходит. Ниже — результат автопроверки: пока есть
          замечания, кейс нельзя пометить готовым, но черновик сохраняется свободно.
        </div>
      </div>

      <CaseMediaPanel
        title="Медиа кейса по умолчанию"
        helper="Используется, если у конкретного шага не выбраны свои изображение или озвучка."
        target={entity}
        assets={assets}
        onChange={(patch: Partial<SimCase>) => onChange(patch)}
        onUploadAsset={onUploadAsset}
        onTogglePreviewAudio={onTogglePreviewAudio}
        activePreviewKey={activePreviewKey}
        previewKey={`case-default:${entity.id}`}
      />

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
        <Field
          label="Мин. интервал, сек"
          value={entity.timing?.minIntervalSeconds ?? ""}
          onChange={(value) => updateTiming({ minIntervalSeconds: value ? Number(value) : null })}
        />
        <Field
          label="Макс. интервал, сек"
          value={entity.timing?.maxIntervalSeconds ?? ""}
          onChange={(value) => updateTiming({ maxIntervalSeconds: value ? Number(value) : null })}
        />
        <Field
          label="Срок решения, сек"
          value={entity.timing?.decisionDeadlineSeconds ?? ""}
          onChange={(value) => updateTiming({ decisionDeadlineSeconds: value ? Number(value) : null })}
        />
        <Field
          label="Интервал напоминания, сек"
          value={entity.timing?.reminderIntervalSeconds ?? ""}
          onChange={(value) => updateTiming({ reminderIntervalSeconds: value ? Number(value) : null })}
        />
      </div>

      <Field
        label="Порядок показа"
        value={entity.sortOrder}
        onChange={(value) => onChange({ sortOrder: Number(value) })}
      />

      <CaseValidationPanel caseInput={entity} />
    </div>
  );
}
```

Пропсы сверены с исходником (`CaseMediaPanel.tsx:23-33`): `title`, `helper`, `target`, `assets`, `onChange`, `onUploadAsset`, `onTogglePreviewAudio`, `activePreviewKey`, `previewKey` — вызов выше совпадает.

- [ ] **Step 2: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/admin/cases/master/steps/StepLaunch.tsx
git commit -m "feat(admin): этап мастера «Оформление и запуск»"
```

---

### Task 6: Оболочка мастера с гибридной навигацией

**Files:**
- Create: `client/src/features/admin/cases/master/CaseMaster.tsx`

**Interfaces:**
- Consumes: все пять этапов (Task 3–5), `CaseSummaryCard` (Task 2), `MASTER_STEPS`/`MasterStepId` (Task 1).
- Produces: компонент `CaseMaster` — подключается в Task 7.

**Поведение навигации:** новый кейс (`isNew`) открывается на первом этапе и ведётся по шагам; существующий открывается на анкете. Кнопка «К карточке кейса» доступна с любого этапа. Клик по блоку анкеты открывает соответствующий этап.

- [ ] **Step 1: Создать оболочку**

```tsx
import { useState } from "react";
import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { CaseSummaryCard } from "./CaseSummaryCard";
import { MASTER_STEPS, type MasterStepId } from "./case-master-support";
import { StepIntent } from "./steps/StepIntent";
import { StepSituation } from "./steps/StepSituation";
import { StepStructure } from "./steps/StepStructure";
import { StepDecisions } from "./steps/StepDecisions";
import { StepLaunch } from "./steps/StepLaunch";

type MasterView = { kind: "summary" } | { kind: "step"; stepId: MasterStepId };

export function CaseMaster({
  entity,
  competencies,
  assets,
  caseSourceOptions,
  isNew,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex,
  onSelectedCycleIndexChange,
  onChange,
}: {
  entity: SimCase;
  competencies: CompetencyDefinition[];
  assets: any[];
  caseSourceOptions: Array<{ value: string; label: string }>;
  isNew: boolean;
  onUploadAsset: (file: File, kind: string) => Promise<any>;
  onTogglePreviewAudio: (key: string, url: string) => void;
  activePreviewKey: string | null;
  selectedCycleIndex: number;
  onSelectedCycleIndexChange: (index: number) => void;
  onChange: (next: SimCase) => void;
}) {
  const [view, setView] = useState<MasterView>(() =>
    isNew ? { kind: "step", stepId: "intent" } : { kind: "summary" },
  );

  const patch = (partial: Partial<SimCase>) => onChange({ ...entity, ...partial });

  const stepIndex = view.kind === "step" ? MASTER_STEPS.findIndex((step) => step.id === view.stepId) : -1;
  const currentStep = stepIndex >= 0 ? MASTER_STEPS[stepIndex] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#243244] bg-[#101826]/60 p-2">
        <button
          type="button"
          onClick={() => setView({ kind: "summary" })}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            view.kind === "summary"
              ? "border-[#FF6B00] bg-[#FF6B00]/15 text-white"
              : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#9aabc6] hover:border-[#3b5878]"
          }`}
        >
          Карточка кейса
        </button>
        {MASTER_STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setView({ kind: "step", stepId: step.id })}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              view.kind === "step" && view.stepId === step.id
                ? "border-[#FF6B00] bg-[#FF6B00]/15 text-white"
                : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#9aabc6] hover:border-[#3b5878]"
            }`}
          >
            {index + 1}. {step.title}
          </button>
        ))}
      </div>

      {view.kind === "summary" && (
        <CaseSummaryCard caseInput={entity} onOpenStep={(stepId) => setView({ kind: "step", stepId })} />
      )}

      {view.kind === "step" && currentStep && (
        <>
          {currentStep.id === "intent" && (
            <StepIntent entity={entity} competencies={competencies} onChange={patch} />
          )}
          {currentStep.id === "situation" && (
            <StepSituation entity={entity} caseSourceOptions={caseSourceOptions} onChange={patch} />
          )}
          {currentStep.id === "structure" && <StepStructure entity={entity} onChange={patch} />}
          {currentStep.id === "decisions" && (
            <StepDecisions
              entity={entity}
              competencies={competencies}
              assets={assets}
              onUploadAsset={onUploadAsset}
              onTogglePreviewAudio={onTogglePreviewAudio}
              activePreviewKey={activePreviewKey}
              selectedCycleIndex={selectedCycleIndex}
              onSelectedCycleIndexChange={onSelectedCycleIndexChange}
              onChange={patch}
            />
          )}
          {currentStep.id === "launch" && (
            <StepLaunch
              entity={entity}
              assets={assets}
              onUploadAsset={onUploadAsset}
              onTogglePreviewAudio={onTogglePreviewAudio}
              activePreviewKey={activePreviewKey}
              onChange={patch}
            />
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#243244] pt-3">
            <Button
              type="button"
              variant="outline"
              className="border-[#2a3a4e] bg-transparent text-[#9aabc6]"
              disabled={stepIndex <= 0}
              onClick={() => setView({ kind: "step", stepId: MASTER_STEPS[stepIndex - 1].id })}
            >
              Назад
            </Button>
            <div className="text-[11px] text-[#70829d]">
              Шаг {stepIndex + 1} из {MASTER_STEPS.length}
            </div>
            {stepIndex < MASTER_STEPS.length - 1 ? (
              <Button
                type="button"
                className="bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90"
                onClick={() => setView({ kind: "step", stepId: MASTER_STEPS[stepIndex + 1].id })}
              >
                Далее
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90"
                onClick={() => setView({ kind: "summary" })}
              >
                К карточке кейса
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/admin/cases/master/CaseMaster.tsx
git commit -m "feat(admin): оболочка мастера кейсов с гибридной навигацией"
```

---

### Task 7: Подключение мастера и удаление старого пути

**Files:**
- Modify: `client/src/features/admin/AdminWorkspaceRuntime.tsx`
- Modify: `client/src/features/admin/components/EntityEditor.tsx`
- Delete: `client/src/features/admin/cases/CaseCreationWizard.tsx`
- Modify: `script/check-ui-acceptance.mjs`

**Interfaces:**
- Consumes: `CaseMaster` (Task 6).

**Зачем:** до этой задачи мастер существует, но им нельзя пользоваться. Здесь он занимает место визарда и кейсовой ветки редактора.

- [ ] **Step 1: Заменить `EntityEditor` на `CaseMaster` в диалоге редактора**

В `AdminWorkspaceRuntime.tsx` найти блок с `<EntityEditor ... mode="case" ...>` (около строки 2446, внутри `<Dialog open={caseEditorOpen}>`). Заменить весь элемент `<EntityEditor .../>` на:

```tsx
                  <CaseMaster
                    entity={caseDraft}
                    competencies={competencies}
                    assets={assets}
                    caseSourceOptions={caseSourceOptions}
                    isNew={!caseDraft.id}
                    onUploadAsset={handleUploadAsset}
                    onTogglePreviewAudio={togglePreviewAudio}
                    activePreviewKey={activePreviewKey}
                    selectedCycleIndex={selectedCaseCycleIndex}
                    onSelectedCycleIndexChange={setSelectedCaseCycleIndex}
                    onChange={setCaseDraft}
                  />
```

Добавить импорт рядом с существующими импортами компонентов кейсов:
```tsx
import { CaseMaster } from "./cases/master/CaseMaster";
```

- [ ] **Step 2: Перевести кнопку создания кейса на мастер**

Найти обработчик, открывающий визард (ищет `setCaseWizardOpen(true)`), и заменить логику: вместо открытия визарда создаётся пустой черновик и открывается диалог редактора.

Найти в `AdminWorkspaceRuntime.tsx` вызов `setCaseWizardOpen(true)` и заменить содержащую его функцию на:

```tsx
  const startCaseCreation = () => {
    const draft = createEmptyCase((contentQuery.data?.cases?.length || 0) + 1);
    setCaseDraft(draft);
    setSelectedCaseId("");
    setSelectedCaseCycleIndex(0);
    setCaseEditorOpen(true);
  };
```

Заменить все обращения к старому обработчику на `startCaseCreation`. Если кнопка вызывала его инлайн — подставить `startCaseCreation`.

- [ ] **Step 3: Удалить визард и его состояния**

Удалить файл:
```bash
git rm client/src/features/admin/cases/CaseCreationWizard.tsx
```

В `AdminWorkspaceRuntime.tsx` удалить:
- импорт `CaseCreationWizard`
- рендер `<CaseCreationWizard ... />`
- состояния `caseWizardOpen`, `caseWizardStep`, `caseWizardDraft` и их `setState`
- функцию `confirmCaseWizard`
- `useEffect`, сохраняющий `caseWizardDraft` в storage
- запись `caseWizard` в `DRAFT_STORAGE_KEYS`, если она больше нигде не используется

`npm run check` покажет все места, где остались ссылки.

- [ ] **Step 4: Убрать кейсовую ветку из `EntityEditor`**

В `EntityEditor.tsx` удалить:
- переключатель секций `details/dossier/cycles` (блок `{mode === "case" && (...)}` с кнопками)
- блок `{mode === "case" && (<>...</>)}`, рендерящий `CaseMediaPanel`, поля кейса, `CaseDossierEditor`, `StructuredCyclesEditor`
- состояние `caseEditorSection`
- импорты, которые стали неиспользуемыми (`CaseDossierEditor`, `StructuredCyclesEditor`, `CaseMediaPanel`, `CompetencyRoleSelector` и др. — по подсказкам `tsc`)
- ветки `mode === "case"` в блоке таймингов (строки ~140-170): оставить только логику каналов

Ветки `mode === "email" | "messenger" | "video"` **не трогать** — они продолжают работать.

- [ ] **Step 5: Обновить контракт UI**

В `script/check-ui-acceptance.mjs` найти блок проверок `caseUi` (добавлен ранее) и заменить список файлов и проверки на:

```js
const caseUi = [
  "client/src/features/admin/cases/StructuredOptionsEditor.tsx",
  "client/src/features/admin/cases/CaseDossierEditor.tsx",
  "client/src/features/admin/cases/CaseValidationPanel.tsx",
  "client/src/features/admin/cases/master/CaseMaster.tsx",
  "client/src/features/admin/cases/master/CaseSummaryCard.tsx",
  "client/src/features/admin/cases/master/case-master-support.ts",
].map(readText).join("\n");

assertCondition(
  !caseUi.includes("max={5}"),
  "Баллы компетенций больше не выставляются слайдером 0-5 — должен использоваться выбор уровня BARS",
);
assertCondition(
  caseUi.includes("BARS_OPTIONS"),
  "Редактор вариантов должен предлагать уровни BARS из общего справочника",
);
assertCondition(
  caseUi.includes("hiddenCause") && caseUi.includes("falseTrails") && caseUi.includes("dataPoints"),
  "Редактор паспорта должен закрывать скрытую причину, данные и ложные следы",
);
assertCondition(
  caseUi.includes("validateCase"),
  "Автор кейса должен видеть замечания автопроверки до сохранения",
);
assertCondition(
  caseUi.includes("MASTER_STEPS") && caseUi.includes("CaseSummaryCard"),
  "Кейс редактируется через мастер с этапами и карточкой-хабом",
);
assertCondition(
  !existsSync("client/src/features/admin/cases/CaseCreationWizard.tsx"),
  "Старый визард создания кейса заменён мастером",
);
```

- [ ] **Step 6: Финальная верификация**

Run: `npm run check`
Expected: без ошибок типов.

Run: `npx tsx script/case-master-parity.ts`
Expected: `case-master parity checks passed`

Run: `npm run test:ui`
Expected: `UI acceptance checks passed…`

Run: `npm test`
Expected: `CI smoke checks passed`

- [ ] **Step 7: Проверить, что контракт способен упасть**

Временно переименовать `MASTER_STEPS` в проверке на несуществующую строку, убедиться, что `npm run test:ui` краснеет с ожидаемым сообщением, вернуть как было.

- [ ] **Step 8: Commit**

```bash
git add client/src/features/admin/AdminWorkspaceRuntime.tsx client/src/features/admin/components/EntityEditor.tsx script/check-ui-acceptance.mjs
git commit -m "feat(admin): мастер кейсов заменяет визард и редактор кейса"
```

---

## Self-Review

**Spec coverage:**
- Пять этапов → Task 1 (логика), 3–5 (компоненты).
- Анкета-хаб, показывающая суть и кликабельная → Task 2.
- Гибридная навигация (шаги для нового, хаб для существующего) → Task 6.
- Мастер заменяет визард и редактор → Task 7.
- Сохранение всех возможностей старого редактора → Task 5 (медиа, тайминги, порядок) + Task 4 (циклы, варианты, ветвление).
- `EntityEditor` остаётся для каналов → Task 7 Step 4 (удаляется только ветка кейса).
- Подсказки простым языком → Task 3–5, в каждом этапе.
- Обучающий слой и эталоны → **не входят**, планы 2 и 3.

**Placeholder scan:** пройден, плейсхолдеров нет. Сигнатуры `CaseFlowDiagram` и `CaseMediaPanel` сверены с исходниками при написании плана — в первом проп называется `caseItem` (не `caseData`, как было в черновике), во втором набор пропсов совпал. Обе правки внесены в код задач.

**Type consistency:** `MasterStepId`, `MasterStep`, `StepSummary` объявлены один раз (Task 1) и используются с теми же именами в Task 2 и 6. Все пять компонентов этапов принимают `entity: SimCase` и `onChange: (patch: Partial<SimCase>) => void` — одинаковая сигнатура, кроме `StepDecisions`/`StepLaunch`, которым дополнительно нужны медиа-пропсы.

## Риски

**Самый вероятный источник проблем — Task 7.** Удаление визарда и кейсовой ветки редактора затрагивает большой файл `AdminWorkspaceRuntime.tsx` (свыше 3800 строк) со множеством связанных состояний. Стратегия: опираться на `tsc` — он покажет каждую оставшуюся ссылку. Не удалять состояния «на глаз».

**Что проверить вручную после Task 7:** открыть админку, создать кейс с нуля через мастер, открыть существующий кейс, убедиться, что редактирование email/messenger/video-кейсов не сломалось.
