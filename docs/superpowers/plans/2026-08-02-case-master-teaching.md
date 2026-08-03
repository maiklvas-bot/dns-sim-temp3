# Мастер кейсов, план 2: обучающий слой

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Превратить замечания автопроверки из списка претензий в обучение: каждое объясняет, что не так, чем это вредит оценке и как починить, показывается там, где живёт ошибка, и может быть осознанно принято автором с обоснованием.

**Architecture:** Объяснения — чистые функции над существующим `CaseValidationIssue` (механику проверок не трогаем). Осознанный отказ требует нового поля `acceptedIssues` в модели кейса: миграция БД → типы → Zod → storage → учёт в `shouldBlockCaseSave`. Визуализация ошибок — отдельные компоненты, встраиваемые в этапы мастера из плана 1.

**Tech Stack:** TypeScript, Drizzle (SQLite), Zod, React. Тесты — tsx-скрипты (`node:assert/strict`).

**Предшественник:** план 1 (`2026-08-02-case-master-shell.md`) должен быть выполнен — этапы мастера и анкета уже существуют.
**Спека:** `docs/superpowers/specs/2026-08-02-case-master-design.md`

## Global Constraints

- НЕ трогать модуль ЗРД (`shared/zrd/*`, `client/src/features/zrd/*`).
- НЕ менять саму механику четырёх проверок в `validateCase` — она вычищена ревью, план меняет только подачу и добавляет учёт принятых замечаний.
- Миграции — только `ALTER TABLE ADD COLUMN` в новом файле `migrations/0012_*.sql`; никогда не редактировать применённые миграции.
- Расчётная логика — чистые функции с tsx-тестом; React-компоненты логики не содержат.
- Каждый шаг с кодом — `npm run check`; финал — `npm run check && npm test && npm run test:ui`.

## Что этот план НЕ делает

Библиотека эталонов и кнопка «взять за основу» — план 3. Здесь кнопка «показать в образце» не реализуется; вместо неё в объяснении даётся текстовая рекомендация.

---

## File Structure

- Create: `shared/case-issue-explanations.ts` — объяснения замечаний (что/почему/как).
- Create: `script/case-explanations-parity.ts` — TDD-фикстура для объяснений и учёта принятых замечаний.
- Create: `migrations/0012_case_accepted_issues.sql` — колонка для принятых замечаний.
- Modify: `shared/schema.ts` — колонка `accepted_issues_json`.
- Modify: `shared/simulation-content.ts` — тип `AcceptedIssue`, поле `acceptedIssues` в `SimCase`.
- Modify: `shared/case-validation.ts` — `isIssueAccepted()`, учёт принятых в `shouldBlockCaseSave()`.
- Modify: `server/middleware/validation.ts` — схема принятых замечаний.
- Modify: `server/content-storage.ts` — персист и чтение поля.
- Create: `client/src/features/admin/cases/master/IssueCard.tsx` — карточка замечания с объяснением и принятием.
- Create: `client/src/features/admin/cases/master/CompetencyLadderHint.tsx` — визуализация «единой шкалы хорошести».
- Modify: `client/src/features/admin/cases/master/steps/StepDecisions.tsx` — встроить лестницу.
- Modify: `client/src/features/admin/cases/master/steps/StepStructure.tsx` — подсветка обрывов.
- Modify: `client/src/features/admin/cases/master/CaseSummaryCard.tsx` — учёт принятых в счётчиках.
- Modify: `script/check-ui-acceptance.mjs` — контракт обучающего слоя.

---

### Task 1: Объяснения замечаний

**Files:**
- Create: `shared/case-issue-explanations.ts`
- Create: `script/case-explanations-parity.ts`

**Interfaces:**
- Consumes: `CaseValidationIssue` из `./case-validation`.
- Produces: `explainIssue(issue): IssueExplanation` с полями `what`/`why`/`how`/`stepId` — используется в Task 5 и 6.

**Зачем:** сейчас автор видит `Вариант "O1": балл компетенции "planning" (2) не соответствует уровню BARS`. Это язык системы. Автор-методолог не знает слова BARS и не понимает, чем это вредно.

- [ ] **Step 1: Написать падающую фикстуру `script/case-explanations-parity.ts`**

```ts
import assert from "node:assert/strict";
import { explainIssue } from "../shared/case-issue-explanations";
import type { CaseValidationIssue } from "../shared/case-validation";

function issue(check: CaseValidationIssue["check"], message = "деталь"): CaseValidationIssue {
  return { check, message, cycleId: "C1", optionId: "O1" };
}

// Каждая проверка объясняется тремя частями и знает свой этап
for (const check of ["bars_conformance", "antigaming", "diagnostics", "effect_reality"] as const) {
  const explanation = explainIssue(issue(check));
  assert.ok(explanation.what.length > 0, `${check}: есть «что не так»`);
  assert.ok(explanation.why.length > 0, `${check}: есть «почему это вредно»`);
  assert.ok(explanation.how.length > 0, `${check}: есть «как исправить»`);
  assert.ok(["situation", "decisions"].includes(explanation.stepId), `${check}: привязан к этапу`);
}

// Объяснения написаны языком автора, а не системы
const bars = explainIssue(issue("bars_conformance"));
assert.equal(bars.what.includes("BARS"), false, "в тексте для автора нет внутренних терминов");
assert.equal(bars.stepId, "decisions");

const diagnostics = explainIssue(issue("diagnostics"));
assert.equal(diagnostics.stepId, "situation");

// Исходная техническая формулировка сохраняется отдельным полем — она нужна для точной привязки
assert.equal(explainIssue(issue("antigaming", "Цикл C1: все компетенции монотонны")).detail, "Цикл C1: все компетенции монотонны");

console.log("case-explanations parity checks passed");
```

- [ ] **Step 2: Убедиться, что фикстура падает**

Run: `npx tsx script/case-explanations-parity.ts`
Expected: ошибка резолва `../shared/case-issue-explanations`.

- [ ] **Step 3: Реализовать `shared/case-issue-explanations.ts`**

```ts
import type { CaseValidationIssue } from "./case-validation";

export interface IssueExplanation {
  /** Что не так — языком автора, без терминов системы. */
  what: string;
  /** Почему это ломает оценку участника. */
  why: string;
  /** Что конкретно сделать. */
  how: string;
  /** Исходная техническая формулировка — для точной привязки к варианту или циклу. */
  detail: string;
  /** Этап мастера, на котором это чинится. */
  stepId: "situation" | "decisions";
}

const EXPLANATIONS: Record<CaseValidationIssue["check"], Omit<IssueExplanation, "detail">> = {
  bars_conformance: {
    what: "У варианта выставлен балл, которого нет в шкале уровней.",
    why: "Оценка участника собирается из уровней «слабо / средне / сильно». Промежуточное значение непонятно куда отнести, и вклад этого варианта в профиль окажется случайным.",
    how: "Откройте вариант и выберите один из четырёх уровней вместо произвольного числа.",
    stepId: "decisions",
  },
  antigaming: {
    what: "Правильный ответ можно угадать по форме, не разбираясь в ситуации.",
    why: "Если «лучший» вариант заметно длиннее остальных или все компетенции растут вместе с его номером, участник выберет последний пункт не думая. Кейс перестанет измерять поведение и начнёт измерять насмотренность.",
    how: "Сделайте варианты сопоставимыми по длине и уверенности. Пусть сильный по одной компетенции ответ будет средним по другой — тогда получится профиль, а не лестница.",
    stepId: "decisions",
  },
  diagnostics: {
    what: "Участнику нечего расследовать: нет скрытой причины, данных или ложных следов.",
    why: "Без них кейс решается с первого экрана и проверяет память на «хорошие практики», а не умение отделить симптом от причины.",
    how: "Вернитесь к этапу «Ситуация» и заполните: что на самом деле стоит за симптомом, какие данные участник может запросить и какое объяснение выглядит правдоподобным, но неверно.",
    stepId: "situation",
  },
  effect_reality: {
    what: "Вариант ничего не меняет в состоянии магазина.",
    why: "Если выбор не двигает ни очередь, ни настрой команды, ни выручку — он декоративный. Участник не увидит последствий решения, а значит не научится их предвидеть.",
    how: "Задайте варианту хотя бы один ненулевой эффект: что станет лучше или хуже, если участник поступит так.",
    stepId: "decisions",
  },
};

export function explainIssue(issue: CaseValidationIssue): IssueExplanation {
  return { ...EXPLANATIONS[issue.check], detail: issue.message };
}
```

- [ ] **Step 4: Убедиться, что фикстура проходит**

Run: `npx tsx script/case-explanations-parity.ts`
Expected: `case-explanations parity checks passed`

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add shared/case-issue-explanations.ts script/case-explanations-parity.ts
git commit -m "feat(cases): объяснения замечаний языком автора"
```

---

### Task 2: Модель принятых замечаний

**Files:**
- Create: `migrations/0012_case_accepted_issues.sql`
- Modify: `shared/schema.ts` (таблица `simulationCases`)
- Modify: `shared/simulation-content.ts` (тип `AcceptedIssue`, поле в `SimCase`)

**Interfaces:**
- Produces: колонка `simulation_cases.accepted_issues_json`, тип `AcceptedIssue`, поле `SimCase.acceptedIssues` — используются в Task 3, 4, 5.

- [ ] **Step 1: Создать миграцию**

```sql
ALTER TABLE simulation_cases ADD COLUMN accepted_issues_json TEXT NOT NULL DEFAULT '[]';
```

Сохранить в `migrations/0012_case_accepted_issues.sql`.

- [ ] **Step 2: Добавить колонку в `shared/schema.ts`**

В таблице `simulationCases` найти строку:
```ts
  qaStatus: text("qa_status").notNull().default("draft"),
```

Добавить сразу после неё:
```ts
  acceptedIssuesJson: text("accepted_issues_json").notNull().default("[]"),
```

- [ ] **Step 3: Добавить тип в `shared/simulation-content.ts`**

Найти:
```ts
export type CaseQaStatus =
```

Добавить перед ним:
```ts
export interface AcceptedIssue {
  check: "bars_conformance" | "antigaming" | "diagnostics" | "effect_reality";
  cycleId?: string | null;
  optionId?: string | null;
  /** Почему автор считает, что в этом кейсе так и задумано. Обязательно. */
  reason: string;
}

```

В интерфейсе `SimCase` найти:
```ts
  qaStatus?: CaseQaStatus;
```

Добавить сразу после:
```ts
  acceptedIssues?: AcceptedIssue[];
```

- [ ] **Step 4: Проверить**

Run: `npm run check`
Expected: без ошибок (поле опциональное — существующий код не ломается).

Run: `npm test`
Expected: `CI smoke checks passed` — смоук поднимает временную БД и прогоняет миграции с нуля, включая новую.

- [ ] **Step 5: Commit**

```bash
git add migrations/0012_case_accepted_issues.sql shared/schema.ts shared/simulation-content.ts
git commit -m "feat(db): принятые автором замечания в модели кейса"
```

---

### Task 3: Учёт принятых замечаний в гейте

**Files:**
- Modify: `shared/case-validation.ts`
- Modify: `script/case-validation-parity.ts`

**Interfaces:**
- Consumes: `AcceptedIssue` (Task 2).
- Produces: `isIssueAccepted()`, обновлённый `shouldBlockCaseSave()` — используются в Task 5 и в серверном гейте.

**Зачем:** без этого кнопка «принять замечание» ничего не изменит — гейт продолжит блокировать.

- [ ] **Step 1: Добавить падающие тесты в `script/case-validation-parity.ts`**

Найти в файле строку:
```ts
console.log("case-validation parity checks passed");
```

Вставить перед ней:

```ts
// Осознанный отказ: автор может принять замечание с обоснованием, и оно перестаёт
// блокировать сохранение — но только ровно то замечание, которое принято.
const acceptedCase = buildCase({ hiddenCause: null });
const acceptedIssues = validateCase(acceptedCase);
assert.ok(acceptedIssues.length > 0, "кейс без скрытой причины даёт замечания");

const accepted = [{ check: "diagnostics" as const, reason: "Причина очевидна из сигнала, расследование не нужно" }];
assert.equal(isIssueAccepted(acceptedIssues[0], accepted), true);
assert.equal(isIssueAccepted(acceptedIssues[0], []), false);
// Принятие без обоснования не считается принятием
assert.equal(isIssueAccepted(acceptedIssues[0], [{ check: "diagnostics" as const, reason: "  " }]), false);

// Принятое замечание другой проверки не влияет
const barsIssue = { check: "bars_conformance" as const, message: "деталь", cycleId: "C1", optionId: "O1" };
assert.equal(isIssueAccepted(barsIssue, accepted), false);

// Гейт: все замечания приняты -> не блокирует даже при статусе готовности
const allAccepted = acceptedIssues.map((item) => ({ check: item.check, cycleId: item.cycleId, optionId: item.optionId, reason: "осознанно" }));
assert.equal(shouldBlockCaseSave("ready_launch", acceptedIssues, allAccepted), false);
// Часть принята, часть нет -> блокирует
assert.equal(shouldBlockCaseSave("ready_launch", acceptedIssues, [allAccepted[0]]), acceptedIssues.length > 1);
// Без списка принятых поведение прежнее (обратная совместимость)
assert.equal(shouldBlockCaseSave("ready_launch", acceptedIssues), true);
```

Обновить импорт в начале файла:
```ts
import { hasMeaningfulText, isIssueAccepted, spearmanRho, validateCase, shouldBlockCaseSave } from "../shared/case-validation";
```

- [ ] **Step 2: Убедиться, что фикстура падает**

Run: `npx tsx script/case-validation-parity.ts`
Expected: ошибка — `isIssueAccepted` не экспортируется.

- [ ] **Step 3: Реализовать в `shared/case-validation.ts`**

Добавить импорт типа в начало файла (рядом с существующим импортом `SimCase`):
```ts
import type { AcceptedIssue, SimCase } from "./simulation-content";
```

Найти:
```ts
export function shouldBlockCaseSave(qaStatus: string | undefined, issues: CaseValidationIssue[]): boolean {
  return issues.length > 0 && BLOCKING_QA_STATUSES.has(qaStatus || "draft");
}
```

Заменить на:
```ts
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
```

- [ ] **Step 4: Передать принятые замечания в серверный гейт**

В `server/routes.ts` найти:
```ts
    if (shouldBlockCaseSave(body.qaStatus, validationIssues)) {
```

Заменить на:
```ts
    if (shouldBlockCaseSave(body.qaStatus, validationIssues, body.acceptedIssues)) {
```

- [ ] **Step 5: Проверить**

Run: `npx tsx script/case-validation-parity.ts`
Expected: `case-validation parity checks passed`

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add shared/case-validation.ts script/case-validation-parity.ts server/routes.ts
git commit -m "feat(cases): осознанно принятое замечание перестаёт блокировать"
```

---

### Task 4: Персистентность принятых замечаний

**Files:**
- Modify: `server/middleware/validation.ts`
- Modify: `server/content-storage.ts`
- Modify: `script/ci-smoke.ts`

**Interfaces:**
- Consumes: `AcceptedIssue` (Task 2).

- [ ] **Step 1: Добавить схему в `server/middleware/validation.ts`**

Найти:
```ts
const caseQaStatusSchema = z.enum([
```

Добавить перед ним:
```ts
const acceptedIssueSchema = z.object({
  check: z.enum(["bars_conformance", "antigaming", "diagnostics", "effect_reality"]),
  cycleId: emptyOrIdStringSchema.nullable().optional().default(null),
  optionId: emptyOrIdStringSchema.nullable().optional().default(null),
  reason: safeLooseTextSchema(1_000),
});

```

В `editableSimCaseSchema` найти:
```ts
  qaStatus: caseQaStatusSchema.optional().default("draft"),
```

Добавить сразу после:
```ts
  acceptedIssues: z.array(acceptedIssueSchema).max(50).optional().default([]),
```

- [ ] **Step 2: Записывать поле в `server/content-storage.ts`**

В методе `saveCase`, в объекте `record`, найти:
```ts
        qaStatus: input.qaStatus || "draft",
```

Добавить сразу после:
```ts
        acceptedIssuesJson: JSON.stringify(input.acceptedIssues || []),
```

- [ ] **Step 3: Читать поле в `getPublicContent`**

В маппинге кейса найти:
```ts
        qaStatus: (row.qaStatus as SimCase["qaStatus"]) || "draft",
```

Добавить сразу после:
```ts
        acceptedIssues: parseJsonArray<NonNullable<SimCase["acceptedIssues"]>[number]>(row.acceptedIssuesJson, []),
```

- [ ] **Step 4: Покрыть круговорот в `script/ci-smoke.ts`**

Найти:
```ts
    assertCondition(persistedDossierCase?.qaStatus === "ready_prototype", "QA status must survive persistence");
```

Добавить сразу после:
```ts
    assertCondition(
      persistedDossierCase?.acceptedIssues?.length === 0,
      "Accepted issues default to an empty list for cases that never used them",
    );
```

И в объект кейса `TASK-030-DOSSIER-COMPLETE` (выше в том же блоке) добавить перед `imageAssetId: null`:
```ts
      acceptedIssues: [{ check: "antigaming" as const, cycleId: null, optionId: null, reason: "Кейс проверяет одну компетенцию намеренно" }],
```

и заменить только что добавленную проверку на:
```ts
    assertCondition(
      persistedDossierCase?.acceptedIssues?.[0]?.reason === "Кейс проверяет одну компетенцию намеренно",
      "Accepted issue reason must survive persistence",
    );
```

- [ ] **Step 5: Проверить**

Run: `npm run check`
Expected: без ошибок.

Run: `npm test`
Expected: `CI smoke checks passed`

- [ ] **Step 6: Commit**

```bash
git add server/middleware/validation.ts server/content-storage.ts script/ci-smoke.ts
git commit -m "feat(storage): персист принятых замечаний кейса"
```

---

### Task 5: Карточка замечания с объяснением и принятием

**Files:**
- Create: `client/src/features/admin/cases/master/IssueCard.tsx`
- Modify: `client/src/features/admin/cases/master/CaseSummaryCard.tsx`

**Interfaces:**
- Consumes: `explainIssue` (Task 1), `isIssueAccepted` (Task 3), `AcceptedIssue` (Task 2).
- Produces: компонент `IssueCard` — используется в Task 6.

- [ ] **Step 1: Создать `IssueCard.tsx`**

```tsx
import { useState } from "react";
import type { AcceptedIssue } from "@shared/simulation-content";
import { isIssueAccepted, type CaseValidationIssue } from "@shared/case-validation";
import { explainIssue } from "@shared/case-issue-explanations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function IssueCard({
  issue,
  accepted,
  onAccept,
  onRevoke,
}: {
  issue: CaseValidationIssue;
  accepted: AcceptedIssue[];
  onAccept: (entry: AcceptedIssue) => void;
  onRevoke: (issue: CaseValidationIssue) => void;
}) {
  const explanation = explainIssue(issue);
  const isAccepted = isIssueAccepted(issue, accepted);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  if (isAccepted) {
    return (
      <div className="rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] text-[#8aa2c4]">{explanation.what}</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-[#2a3a4e] bg-transparent text-[#9aabc6]"
            onClick={() => onRevoke(issue)}
          >
            Вернуть в работу
          </Button>
        </div>
        <div className="mt-1 text-[10px] text-[#70829d]">Принято автором</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ffb27a]/35 bg-[#FF6B00]/8 px-3 py-2.5">
      <div className="text-[12.5px] font-semibold text-white">{explanation.what}</div>
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-[#b8c7df]">{explanation.why}</div>
      <div className="mt-2 rounded-md border border-[#243244] bg-[#0d1522]/60 px-2.5 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#70829d]">Как исправить</div>
        <div className="mt-1 text-[11.5px] leading-relaxed text-[#cbd8ef]">{explanation.how}</div>
      </div>
      <div className="mt-2 text-[10px] text-[#70829d]">{explanation.detail}</div>

      {showReason ? (
        <div className="mt-2 space-y-2">
          <Input
            value={reason}
            placeholder="Почему в этом кейсе так и задумано?"
            onChange={(event) => setReason(event.target.value)}
            className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!reason.trim()}
              onClick={() => {
                onAccept({
                  check: issue.check,
                  cycleId: issue.cycleId || null,
                  optionId: issue.optionId || null,
                  reason: reason.trim(),
                });
                setShowReason(false);
                setReason("");
              }}
            >
              Принять замечание
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#2a3a4e] bg-transparent text-[#9aabc6]"
              onClick={() => setShowReason(false)}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowReason(true)}
          className="mt-2 text-[11px] text-[#8aa2c4] underline decoration-dotted underline-offset-2 hover:text-white"
        >
          Так и задумано — принять замечание
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Учесть принятые замечания в анкете**

В `CaseSummaryCard.tsx` найти:
```tsx
  const issues = useMemo(() => validateCase(caseInput), [caseInput]);
```

Заменить на:
```tsx
  const issues = useMemo(
    () => validateCase(caseInput).filter((issue) => !isIssueAccepted(issue, caseInput.acceptedIssues)),
    [caseInput],
  );
  const acceptedCount = (caseInput.acceptedIssues || []).length;
```

Обновить импорт:
```tsx
import { isIssueAccepted, validateCase } from "@shared/case-validation";
```

В шапке карточки найти:
```tsx
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Карточка кейса. Нажмите на любой блок, чтобы вернуться к его настройке.
        </div>
```

Заменить на:
```tsx
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Карточка кейса. Нажмите на любой блок, чтобы вернуться к его настройке.
        </div>
        {acceptedCount > 0 && (
          <div className="mt-2 text-[11px] text-[#8aa2c4]">
            Замечаний принято автором: {acceptedCount}
          </div>
        )}
```

- [ ] **Step 3: Проверить**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/admin/cases/master/IssueCard.tsx client/src/features/admin/cases/master/CaseSummaryCard.tsx
git commit -m "feat(admin): карточка замечания с объяснением и осознанным принятием"
```

---

### Task 6: Разбор ошибок в контексте этапа

**Files:**
- Create: `client/src/features/admin/cases/master/CompetencyLadderHint.tsx`
- Modify: `client/src/features/admin/cases/master/steps/StepDecisions.tsx`
- Modify: `client/src/features/admin/cases/master/steps/StepStructure.tsx`

**Interfaces:**
- Consumes: `IssueCard` (Task 5), `issuesForStep` (план 1, Task 1), `validateCase`, `isIssueAccepted`.

**Зачем:** ключевое требование спеки — ошибка показывается там, где живёт, средствами оформления, а не абзацем текста.

- [ ] **Step 1: Создать `CompetencyLadderHint.tsx`**

```tsx
import type { CaseCycle, CompetencyDefinition } from "@shared/simulation-content";

/**
 * Показывает, как баллы компетенций меняются от варианта к варианту.
 * Когда все строки растут вместе — это и есть «единая шкала хорошести»,
 * которую участник читает по форме, не разбираясь в ситуации.
 */
export function CompetencyLadderHint({
  cycle,
  competencies,
}: {
  cycle: CaseCycle;
  competencies: CompetencyDefinition[];
}) {
  const options = [...(cycle.options || [])].sort((a, b) => a.level - b.level);
  if (options.length < 2) {
    return null;
  }

  const usedIds = Array.from(
    new Set(options.flatMap((option) => Object.keys(option.competency_scores || {}))),
  );
  if (usedIds.length === 0) {
    return null;
  }

  const rows = usedIds.map((id) => {
    const scores = options.map((option) => Number((option.competency_scores || {})[id] || 0));
    const rising = scores.every((value, index) => index === 0 || value >= scores[index - 1]);
    const flat = scores.every((value) => value === scores[0]);
    return {
      id,
      name: competencies.find((item) => item.id === id)?.name || id,
      scores,
      rising: rising && !flat,
    };
  });

  const allRising = rows.length >= 2 && rows.every((row) => row.rising);

  return (
    <div className="rounded-xl border border-[#243244] bg-[#0d1522]/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#70829d]">
        Как читается набор вариантов
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <div className="w-40 shrink-0 truncate text-[11.5px] text-[#b8c7df]">{row.name}</div>
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-white">
              {row.scores.map((score, index) => (
                <span key={`${row.id}-${index}`}>
                  {index > 0 && <span className="mx-1 text-[#70829d]">→</span>}
                  {score}
                </span>
              ))}
            </div>
            {row.rising && <div className="text-[11px] text-[#ffb27a]">↗ растёт</div>}
          </div>
        ))}
      </div>
      {allRising && (
        <div className="mt-2 rounded-md border border-[#ffb27a]/35 bg-[#FF6B00]/10 px-2.5 py-2 text-[11.5px] leading-relaxed text-[#ffd77a]">
          Все строки растут вместе с номером варианта. Участнику достаточно выбрать последний пункт,
          чтобы получить максимум по всем компетенциям — думать не обязательно.
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Встроить в `StepDecisions.tsx`**

Добавить импорты:
```tsx
import { useMemo } from "react";
import { isIssueAccepted, validateCase } from "@shared/case-validation";
import type { AcceptedIssue } from "@shared/simulation-content";
import { issuesForStep } from "../case-master-support";
import { CompetencyLadderHint } from "../CompetencyLadderHint";
import { IssueCard } from "../IssueCard";
```

Расширить пропсы компонента, добавив в тип:
```tsx
  onAcceptIssue: (entry: AcceptedIssue) => void;
  onRevokeIssue: (issue: import("@shared/case-validation").CaseValidationIssue) => void;
```
и в деструктуризацию параметров: `onAcceptIssue`, `onRevokeIssue`.

Внутри компонента, перед `return`, добавить:
```tsx
  const stepIssues = useMemo(
    () => issuesForStep("decisions", validateCase(entity)),
    [entity],
  );
  const activeIssues = stepIssues.filter((issue) => !isIssueAccepted(issue, entity.acceptedIssues));
```

В разметке, сразу после блока-заголовка «Что может сделать участник?», добавить:
```tsx
      {(entity.cycles || []).map((cycle) => (
        <CompetencyLadderHint key={`ladder-${cycle.id}`} cycle={cycle} competencies={competencies} />
      ))}

      {activeIssues.length > 0 && (
        <div className="space-y-2">
          {activeIssues.map((issue, index) => (
            <IssueCard
              key={`decisions-issue-${index}`}
              issue={issue}
              accepted={entity.acceptedIssues || []}
              onAccept={onAcceptIssue}
              onRevoke={onRevokeIssue}
            />
          ))}
        </div>
      )}
```

- [ ] **Step 3: Подсветить обрывы в `StepStructure.tsx`**

В списке шагов найти строку, показывающую число вариантов:
```tsx
                <div className="shrink-0 text-[11px] text-[#70829d]">
                  вариантов: {(cycle.options || []).length}
                </div>
```

Заменить на:
```tsx
                <div className="shrink-0 text-[11px] text-[#70829d]">
                  вариантов: {(cycle.options || []).length}
                </div>
                {(cycle.options || []).length === 0 && (
                  <div className="shrink-0 text-[11px] font-semibold text-[#ffb27a]">
                    тупик: участнику некуда пойти
                  </div>
                )}
```

- [ ] **Step 4: Пробросить обработчики в `CaseMaster.tsx`**

В `CaseMaster.tsx` добавить перед `return`:
```tsx
  const acceptIssue = (entry: import("@shared/simulation-content").AcceptedIssue) => {
    patch({ acceptedIssues: [...(entity.acceptedIssues || []), entry] });
  };

  const revokeIssue = (issue: import("@shared/case-validation").CaseValidationIssue) => {
    patch({
      acceptedIssues: (entity.acceptedIssues || []).filter(
        (item) =>
          !(
            item.check === issue.check
            && (item.cycleId || null) === (issue.cycleId || null)
            && (item.optionId || null) === (issue.optionId || null)
          ),
      ),
    });
  };
```

И передать их в `StepDecisions`, добавив к существующим пропсам:
```tsx
              onAcceptIssue={acceptIssue}
              onRevokeIssue={revokeIssue}
```

- [ ] **Step 5: Проверить**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/admin/cases/master/CompetencyLadderHint.tsx client/src/features/admin/cases/master/steps/StepDecisions.tsx client/src/features/admin/cases/master/steps/StepStructure.tsx client/src/features/admin/cases/master/CaseMaster.tsx
git commit -m "feat(admin): разбор ошибок в контексте этапа — лестница компетенций и тупики"
```

---

### Task 7: Контракт обучающего слоя и финальная верификация

**Files:**
- Modify: `script/check-ui-acceptance.mjs`

- [ ] **Step 1: Расширить контракт**

В `script/check-ui-acceptance.mjs` в массив `caseUi` добавить новые файлы:
```js
  "client/src/features/admin/cases/master/IssueCard.tsx",
  "client/src/features/admin/cases/master/CompetencyLadderHint.tsx",
```

После существующих проверок блока добавить:
```js
assertCondition(
  caseUi.includes("explainIssue"),
  "Замечание должно объясняться автору, а не показываться технической строкой",
);
assertCondition(
  caseUi.includes("isIssueAccepted"),
  "Автор должен иметь возможность осознанно принять замечание",
);
assertCondition(
  caseUi.includes("CompetencyLadderHint"),
  "Единая «шкала хорошести» показывается наглядно на этапе решений",
);
```

- [ ] **Step 2: Финальная верификация**

Run: `npm run check`
Expected: без ошибок.

Run: `npx tsx script/case-explanations-parity.ts`
Expected: `case-explanations parity checks passed`

Run: `npx tsx script/case-validation-parity.ts`
Expected: `case-validation parity checks passed`

Run: `npx tsx script/case-master-parity.ts`
Expected: `case-master parity checks passed`

Run: `npm test`
Expected: `CI smoke checks passed`

Run: `npm run test:ui`
Expected: `UI acceptance checks passed…`

- [ ] **Step 3: Проверить falsifiability**

Временно заменить в `shouldBlockCaseSave` фильтр принятых замечаний на пустой (`const blocking = issues;`), убедиться, что `case-validation-parity` краснеет на проверке принятия, вернуть как было.

- [ ] **Step 4: Commit**

```bash
git add script/check-ui-acceptance.mjs
git commit -m "test(admin): контракт обучающего слоя мастера кейсов"
```

---

## Self-Review

**Spec coverage:**
- Объяснение «что не так → почему → как исправить» → Task 1.
- Привязка замечания к этапу → Task 1 (`stepId`), Task 6 (рендер на этапе).
- Визуальный разбор вместо текста → Task 6 (`CompetencyLadderHint`, подсветка тупиков).
- Осознанный отказ с обязательным обоснованием → Task 2–5.
- Видимость принятых в анкете → Task 5 Step 2.
- Эталоны и «показать в образце» → **не входят**, план 3.

**Placeholder scan:** пройден, плейсхолдеров нет.

**Type consistency:** `AcceptedIssue` объявлен один раз (Task 2) и используется с тем же именем в Task 3–6. `IssueExplanation.stepId` ограничен `"situation" | "decisions"` — совпадает с `MasterStepId` из плана 1 в части, где замечания вообще возникают.

## Риски

**Task 3 меняет сигнатуру `shouldBlockCaseSave`** — третий параметр опционален, поэтому существующие вызовы продолжают работать. Тест на обратную совместимость включён в Step 1.

**Task 6 правит файлы из плана 1** — если план 1 выполнен с отклонениями, точные фрагменты для поиска могут не совпасть. В этом случае ориентироваться на смысл: лестница встраивается в этап решений после заголовка, карточки замечаний — под ней.
