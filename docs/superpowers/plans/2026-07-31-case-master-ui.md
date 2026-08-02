# UI мастера кейсов: паспорт, BARS-пикер, замечания автопроверки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать методологу интерфейс для работы с уже построенным бэкендом: заполнить паспорт кейса, выставлять баллы компетенций уровнями BARS вместо произвольных чисел и видеть замечания автопроверки **до** сохранения.

**Architecture:** Вся расчётная логика — чистые функции в `shared/` и `case-editor-support.ts`, покрытые tsx-скриптами (в проекте нет vitest/jest для клиента). React-компоненты только отображают результат этих функций. Валидация выполняется на клиенте существующей функцией `validateCase` из `@shared/case-validation` — она уже чистая и доступна фронтенду, поэтому замечания видны сразу, без запроса к серверу.

**Tech Stack:** React + TypeScript, Tailwind (админка использует arbitrary-значения цветов, не токены), shadcn-компоненты в `client/src/components/ui/`, состояние форм — `useState` (react-hook-form в проекте не используется).

## Global Constraints

- НЕ трогать модуль ЗРД (`shared/zrd/*`, `client/src/features/zrd/*`) — отдельный движок.
- НЕ менять `publishCurrentCase` (`AdminWorkspaceRuntime.tsx:1582-1601`) — см. «Осознанные ограничения».
- Расчётная логика — только чистые функции с tsx-тестом по образцу `script/case-validation-parity.ts` (`node:assert/strict`, запуск `npx tsx script/<name>.ts`). React-компоненты логику не содержат.
- Следовать существующим паттернам админки: поля через `Field`/`FieldArea`/`SelectField` из `components/AdminFields.tsx`, состояние через `useState`, стили — Tailwind с hex-значениями как в соседнем коде.
- Каждый шаг с кодом — `npm run check`; финальная проверка — `npm run check && npm test && npm run test:ui`.
- Уровни BARS берутся из `BARS_LEVEL_SCORES` (`shared/case-validation.ts`), не хардкодятся заново.

## Осознанные ограничения (не дефекты — решения)

1. **`publishCurrentCase` не трогаем.** Кнопка «Опубликовать» ставит `isActive: true`, но не меняет `qaStatus`, поэтому гейт её не блокирует. Логически публикация = «готов к запуску», и напрашивается ставить `ready_launch`. **Но** все 14 существующих кейсов сейчас имеют 407 замечаний автопроверки — если публикация начнёт требовать прохождения гейта, переопубликовать их станет невозможно, то есть мы сломаем текущий рабочий процесс. Это отдельное продуктовое решение (мигрировать контент → потом ужесточать публикацию), а не задача UI-плана.
2. **Дебриф** — вне объёма, отдельный план после согласования концепции.
3. **Клиентских unit-тестов нет** (только Playwright-скрипты и статические проверки `check-ui-acceptance.mjs`). Поэтому вся логика выносится в чистые функции с tsx-тестами, а на сами компоненты добавляются статические проверки в существующий `check-ui-acceptance.mjs`.

---

## File Structure

- Modify: `client/src/features/admin/cases/case-editor-support.ts` — добавить `BARS_OPTIONS`, `barsLevelForScore()`, `buildCaseDossierSummary()`; удалить мёртвый экспорт-импорт.
- Create: `script/case-editor-support-parity.ts` — TDD-фикстура для новых чистых функций.
- Modify: `client/src/features/admin/cases/StructuredOptionsEditor.tsx` — BARS-пикер вместо слайдера, убрать мёртвый импорт.
- Create: `client/src/features/admin/cases/CaseValidationPanel.tsx` — панель замечаний автопроверки.
- Create: `client/src/features/admin/cases/CaseDossierEditor.tsx` — редактор паспорта кейса.
- Modify: `client/src/features/admin/components/EntityEditor.tsx` — третья вкладка «Паспорт».
- Modify: `client/src/features/admin/AdminWorkspaceRuntime.tsx` — обработка `validationIssues` из ответа сервера.
- Modify: `script/check-ui-acceptance.mjs` — статические проверки новых компонентов.

---

### Task 1: Чистые функции для BARS и паспорта

**Files:**
- Modify: `client/src/features/admin/cases/case-editor-support.ts`
- Create: `script/case-editor-support-parity.ts`

**Interfaces:**
- Consumes: `BARS_LEVEL_SCORES` из `@shared/case-validation`, `SimCase`/`CaseDataPoint` из `@shared/simulation-content`.
- Produces: `BARS_OPTIONS`, `barsLevelForScore(score)`, `buildCaseDossierSummary(caseInput)` — используются в Task 2, 3, 4.

- [ ] **Step 1: Написать падающую TDD-фикстуру `script/case-editor-support-parity.ts`**

```ts
import assert from "node:assert/strict";
import { BARS_OPTIONS, barsLevelForScore, buildCaseDossierSummary } from "../client/src/features/admin/cases/case-editor-support";
import type { SimCase } from "../shared/simulation-content";

// BARS_OPTIONS: ровно четыре ступени, значения совпадают с BARS_LEVEL_SCORES
assert.equal(BARS_OPTIONS.length, 4);
assert.deepEqual(BARS_OPTIONS.map((option) => option.score), [0, 1, 3, 5]);
assert.equal(BARS_OPTIONS[0].label, "Не влияет");
assert.equal(BARS_OPTIONS[1].label, "Слабо");
assert.equal(BARS_OPTIONS[2].label, "Средне");
assert.equal(BARS_OPTIONS[3].label, "Сильно");

// barsLevelForScore: точные попадания
assert.equal(barsLevelForScore(0), "none");
assert.equal(barsLevelForScore(1), "weak");
assert.equal(barsLevelForScore(3), "mid");
assert.equal(barsLevelForScore(5), "strong");
// значения вне шкалы BARS (легаси-данные со слайдера 0-5) не приводятся к ближайшему,
// а помечаются как несоответствующие — иначе автопроверка и UI разошлись бы в оценке
assert.equal(barsLevelForScore(2), "off_scale");
assert.equal(barsLevelForScore(4), "off_scale");
assert.equal(barsLevelForScore(undefined), "none");

const emptyDossier: SimCase = {
  id: "C1",
  title: "T",
  description: "D",
  primaryCompetencies: [],
  secondaryCompetencies: [],
  trigger: { type: "message", source: "S", text: "T" },
  zones_affected: [],
  cycles: [],
  imageAssetId: null,
  imageUrl: null,
  audioAssetId: null,
  audioUrl: null,
  sortOrder: 0,
  isActive: true,
};

// пустой паспорт: ни одно поле не заполнено
const summaryEmpty = buildCaseDossierSummary(emptyDossier);
assert.equal(summaryEmpty.filled, 0);
assert.equal(summaryEmpty.total, 4);
assert.equal(summaryEmpty.isComplete, false);
assert.deepEqual(summaryEmpty.missing, ["businessProblem", "hiddenCause", "dataPoints", "falseTrails"]);

// частично заполненный: пробелы не считаются заполнением
const summaryPartial = buildCaseDossierSummary({
  ...emptyDossier,
  businessProblem: "Очередь на кассе растёт",
  hiddenCause: "   ",
  dataPoints: [{ label: "Отчёт по смене" }],
  falseTrails: [],
});
assert.equal(summaryPartial.filled, 2);
assert.equal(summaryPartial.isComplete, false);
assert.deepEqual(summaryPartial.missing, ["hiddenCause", "falseTrails"]);

// полностью заполненный
const summaryFull = buildCaseDossierSummary({
  ...emptyDossier,
  businessProblem: "Очередь растёт",
  hiddenCause: "Не хватает людей на выдаче",
  dataPoints: [{ label: "Отчёт по смене", costToRequest: "2 минуты" }],
  falseTrails: ["Кажется, что виновата касса"],
});
assert.equal(summaryFull.filled, 4);
assert.equal(summaryFull.isComplete, true);
assert.deepEqual(summaryFull.missing, []);

console.log("case-editor-support parity checks passed");
```

- [ ] **Step 2: Убедиться, что фикстура падает**

Run: `npx tsx script/case-editor-support-parity.ts`
Expected: ошибка импорта — `BARS_OPTIONS` / `barsLevelForScore` / `buildCaseDossierSummary` ещё не существуют.

- [ ] **Step 3: Реализовать функции в `case-editor-support.ts`**

Добавить в начало файла, после существующих импортов:
```ts
import { BARS_LEVEL_SCORES } from "@shared/case-validation";
import type { SimCase } from "@shared/simulation-content";
```

Добавить в конец файла:
```ts
export type BarsLevel = "none" | "weak" | "mid" | "strong" | "off_scale";

export const BARS_OPTIONS: ReadonlyArray<{ level: BarsLevel; score: number; label: string; hint: string }> = [
  { level: "none", score: 0, label: "Не влияет", hint: "Вариант не проявляет эту компетенцию" },
  { level: "weak", score: BARS_LEVEL_SCORES.weak, label: "Слабо", hint: "Поведение из нижнего якоря" },
  { level: "mid", score: BARS_LEVEL_SCORES.mid, label: "Средне", hint: "Формально верно, без глубины" },
  { level: "strong", score: BARS_LEVEL_SCORES.strong, label: "Сильно", hint: "Поведение из верхнего якоря" },
];

export function barsLevelForScore(score: number | undefined | null): BarsLevel {
  const value = Number(score || 0);
  const match = BARS_OPTIONS.find((option) => option.score === value);
  return match ? match.level : "off_scale";
}

export interface CaseDossierSummary {
  filled: number;
  total: number;
  isComplete: boolean;
  missing: string[];
}

export function buildCaseDossierSummary(caseInput: SimCase): CaseDossierSummary {
  const checks: Array<{ key: string; filled: boolean }> = [
    { key: "businessProblem", filled: Boolean(caseInput.businessProblem && caseInput.businessProblem.trim()) },
    { key: "hiddenCause", filled: Boolean(caseInput.hiddenCause && caseInput.hiddenCause.trim()) },
    { key: "dataPoints", filled: Boolean(caseInput.dataPoints && caseInput.dataPoints.length > 0) },
    { key: "falseTrails", filled: Boolean(caseInput.falseTrails && caseInput.falseTrails.length > 0) },
  ];
  const missing = checks.filter((check) => !check.filled).map((check) => check.key);
  const filled = checks.length - missing.length;
  return { filled, total: checks.length, isComplete: missing.length === 0, missing };
}
```

- [ ] **Step 4: Удалить мёртвый импорт в `StructuredOptionsEditor.tsx`**

Найти (строка 23):
```ts
import { createEmptyStructuredOption, formatCompetencyScores, parseCompetencyScores } from "./case-editor-support";
```

Заменить на:
```ts
import { createEmptyStructuredOption } from "./case-editor-support";
```

(`formatCompetencyScores` и `parseCompetencyScores` в этом файле не вызываются — проверено поиском по всему файлу.)

- [ ] **Step 5: Убедиться, что фикстура проходит, и типы целы**

Run: `npx tsx script/case-editor-support-parity.ts`
Expected: `case-editor-support parity checks passed`

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/admin/cases/case-editor-support.ts script/case-editor-support-parity.ts client/src/features/admin/cases/StructuredOptionsEditor.tsx
git commit -m "feat(admin): чистые функции BARS-уровней и сводки паспорта кейса"
```

---

### Task 2: BARS-пикер вместо слайдера 0–5

**Files:**
- Modify: `client/src/features/admin/cases/StructuredOptionsEditor.tsx:181-216`

**Interfaces:**
- Consumes: `BARS_OPTIONS`, `barsLevelForScore` (Task 1).

**Зачем:** сейчас слайдер `min=0 max=5 step=1` позволяет выставить 2 или 4 — значения вне шкалы BARS. Автопроверка `bars_conformance` такой кейс забракует, но автор узнает об этом только при сохранении. Пикер убирает саму возможность ошибки.

- [ ] **Step 1: Заменить блок компетенций**

Найти (строки 190-215):
```tsx
              <div className="grid gap-3 md:grid-cols-2">
                {competencies.map((competency) => {
                  const scoreValue = Number(option.competency_scores?.[competency.id] || 0);

                  return (
                    <div key={competency.id} className="rounded-lg border border-[#223245] bg-[#101826]/80 px-3 py-2">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-white">{competency.name}</div>
                          <div className="text-[10px] uppercase tracking-[0.16em] text-[#70829d]">{competencyCategoryLabel(competency.category)}</div>
                        </div>
                        <div className="rounded-full border border-[#2a3a4e] bg-[#141c2b]/70 px-2 py-1 text-xs font-semibold text-white">
                          {scoreValue}
                        </div>
                      </div>
                      <Slider
                        value={[scoreValue]}
                        onValueChange={([value]) => updateCompetencyScore(index, competency.id, value)}
                        min={0}
                        max={5}
                        step={1}
                      />
                    </div>
                  );
                })}
              </div>
```

Заменить на:
```tsx
              <div className="grid gap-3 md:grid-cols-2">
                {competencies.map((competency) => {
                  const scoreValue = Number(option.competency_scores?.[competency.id] || 0);
                  const currentLevel = barsLevelForScore(scoreValue);

                  return (
                    <div key={competency.id} className="rounded-lg border border-[#223245] bg-[#101826]/80 px-3 py-2">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-white">{competency.name}</div>
                          <div className="text-[10px] uppercase tracking-[0.16em] text-[#70829d]">{competencyCategoryLabel(competency.category)}</div>
                        </div>
                        {currentLevel === "off_scale" && (
                          <div className="shrink-0 rounded-full border border-[#ffb27a]/40 bg-[#FF6B00]/12 px-2 py-1 text-[10px] font-semibold text-[#ffb27a]">
                            {scoreValue} — вне шкалы
                          </div>
                        )}
                      </div>
                      <div className="grid grid-cols-4 gap-1.5" role="group" aria-label={`Уровень влияния: ${competency.name}`}>
                        {BARS_OPTIONS.map((barsOption) => {
                          const active = barsOption.score === scoreValue;
                          return (
                            <button
                              key={barsOption.level}
                              type="button"
                              title={barsOption.hint}
                              aria-pressed={active}
                              onClick={() => updateCompetencyScore(index, competency.id, barsOption.score)}
                              className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition ${
                                active
                                  ? "border-[#4a9eff] bg-[#4a9eff]/15 text-white"
                                  : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#8aa2c4] hover:border-[#3b5878]"
                              }`}
                            >
                              {barsOption.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
```

- [ ] **Step 2: Обновить импорты в том же файле**

Найти (строка 23, после правки Task 1):
```tsx
import { createEmptyStructuredOption } from "./case-editor-support";
```

Заменить на:
```tsx
import { barsLevelForScore, BARS_OPTIONS, createEmptyStructuredOption } from "./case-editor-support";
```

Найти (строка 7):
```tsx
import { Slider } from "@/components/ui/slider";
```

Удалить эту строку целиком — `Slider` больше не используется в файле.

- [ ] **Step 3: Обновить подсказку над блоком**

Найти (строки 185-187):
```tsx
                  <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
                    Настройте силу влияния ответа на каждую компетенцию. `0` означает, что этот вариант не влияет на выбранную компетенцию.
                  </div>
```

Заменить на:
```tsx
                  <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
                    Выберите уровень проявления компетенции в этом варианте. Уровни соответствуют якорям поведения: слабо — нижний якорь, сильно — верхний. Промежуточные значения не используются, иначе автопроверка забракует кейс.
                  </div>
```

- [ ] **Step 4: Проверить типы**

Run: `npm run check`
Expected: без ошибок (в частности, неиспользуемый импорт `Slider` удалён).

- [ ] **Step 5: Commit**

```bash
git add client/src/features/admin/cases/StructuredOptionsEditor.tsx
git commit -m "feat(admin): выбор уровня BARS вместо слайдера произвольных баллов"
```

---

### Task 3: Панель замечаний автопроверки

**Files:**
- Create: `client/src/features/admin/cases/CaseValidationPanel.tsx`

**Interfaces:**
- Consumes: `validateCase`, `CaseValidationIssue` из `@shared/case-validation`; `SimCase` из `@shared/simulation-content`.
- Produces: компонент `CaseValidationPanel({ caseInput })` — используется в Task 4.

**Зачем:** автор должен видеть замечания **до** сохранения. `validateCase` — чистая функция без побочных эффектов, доступная фронтенду, поэтому проверка выполняется прямо в браузере на каждом изменении черновика.

- [ ] **Step 1: Создать компонент**

```tsx
import { useMemo } from "react";
import type { SimCase } from "@shared/simulation-content";
import { validateCase, type CaseValidationIssue } from "@shared/case-validation";

const CHECK_LABELS: Record<CaseValidationIssue["check"], string> = {
  bars_conformance: "Уровни BARS",
  antigaming: "Антигейминг",
  diagnostics: "Диагностика",
  effect_reality: "Влияние на состояние",
};

const CHECK_HINTS: Record<CaseValidationIssue["check"], string> = {
  bars_conformance: "Баллы компетенций должны совпадать с уровнями якорей поведения",
  antigaming: "Правильный ответ не должен угадываться по форме варианта",
  diagnostics: "Без скрытой причины и данных кейс проходится без диагностики",
  effect_reality: "Каждый вариант должен менять состояние магазина",
};

export function CaseValidationPanel({ caseInput }: { caseInput: SimCase | null }) {
  const issues = useMemo(() => (caseInput ? validateCase(caseInput) : []), [caseInput]);

  const grouped = useMemo(() => {
    const map = new Map<CaseValidationIssue["check"], CaseValidationIssue[]>();
    issues.forEach((issue) => {
      const list = map.get(issue.check) || [];
      list.push(issue);
      map.set(issue.check, list);
    });
    return Array.from(map.entries());
  }, [issues]);

  if (!caseInput) {
    return null;
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-[#2f6b2f]/40 bg-[#2f6b2f]/10 p-4">
        <div className="text-sm font-semibold text-[#54d28c]">Автопроверка пройдена</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8aa2c4]">
          Кейс можно переводить в статус готовности к прототипу или запуску.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#ffb27a]/35 bg-[#FF6B00]/8 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-[#ffb27a]">Замечания автопроверки</div>
        <div className="text-[11px] font-semibold text-[#ffb27a]">{issues.length}</div>
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-[#b8c7df]">
        Пока замечания не устранены, кейс нельзя пометить готовым. Черновик сохраняется свободно.
      </div>
      <div className="mt-3 space-y-3">
        {grouped.map(([check, checkIssues]) => (
          <div key={check} className="rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xs font-semibold text-white">{CHECK_LABELS[check]}</div>
              <div className="text-[10px] text-[#70829d]">{checkIssues.length}</div>
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-[#70829d]">{CHECK_HINTS[check]}</div>
            <ul className="mt-2 space-y-1">
              {checkIssues.slice(0, 5).map((issue, issueIndex) => (
                <li key={`${check}-${issueIndex}`} className="text-[11px] leading-relaxed text-[#b8c7df]">
                  • {issue.message}
                </li>
              ))}
            </ul>
            {checkIssues.length > 5 && (
              <div className="mt-1 text-[10px] text-[#70829d]">…и ещё {checkIssues.length - 5}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

Сохранить как `client/src/features/admin/cases/CaseValidationPanel.tsx`.

- [ ] **Step 2: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add client/src/features/admin/cases/CaseValidationPanel.tsx
git commit -m "feat(admin): панель замечаний автопроверки кейса"
```

---

### Task 4: Редактор паспорта кейса + третья вкладка

**Files:**
- Create: `client/src/features/admin/cases/CaseDossierEditor.tsx`
- Modify: `client/src/features/admin/components/EntityEditor.tsx:106-126` (вкладки), `:192-222` (рендер секции)

**Interfaces:**
- Consumes: `buildCaseDossierSummary` (Task 1), `CaseValidationPanel` (Task 3), `Field`/`FieldArea`/`SelectField` из `../components/AdminFields`.
- Produces: компонент `CaseDossierEditor({ entity, onChange })`.

- [ ] **Step 1: Создать редактор паспорта**

```tsx
import type { CaseDataPoint, CaseQaStatus, SimCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { FieldArea, SelectField } from "../components/AdminFields";
import { buildCaseDossierSummary } from "./case-editor-support";
import { CaseValidationPanel } from "./CaseValidationPanel";

const QA_STATUS_OPTIONS: Array<{ value: CaseQaStatus; label: string }> = [
  { value: "draft", label: "Черновик" },
  { value: "auto_check_failed", label: "Автопроверка не пройдена" },
  { value: "methodical_review", label: "На методической проверке" },
  { value: "ready_prototype", label: "Готов к прототипу" },
  { value: "ready_launch", label: "Готов к запуску" },
];

export function CaseDossierEditor({
  entity,
  onChange,
}: {
  entity: SimCase;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  const summary = buildCaseDossierSummary(entity);
  const dataPoints = entity.dataPoints || [];
  const falseTrails = entity.falseTrails || [];

  const updateDataPoint = (index: number, patch: Partial<CaseDataPoint>) => {
    onChange({
      dataPoints: dataPoints.map((point, pointIndex) => (pointIndex === index ? { ...point, ...patch } : point)),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="flex items-baseline justify-between gap-3">
          <div className="text-sm font-semibold text-white">Паспорт кейса</div>
          <div className={`text-xs font-semibold ${summary.isComplete ? "text-[#54d28c]" : "text-[#ffb27a]"}`}>
            {summary.filled} из {summary.total}
          </div>
        </div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Скрытая причина, данные и ложные следы — то, что заставляет участника диагностировать ситуацию, а не угадывать «правильную кнопку». Без них автопроверка не пропустит кейс дальше черновика.
        </div>
      </div>

      <FieldArea
        label="Бизнес-проблема"
        value={entity.businessProblem || ""}
        onChange={(value) => onChange({ businessProblem: value })}
      />
      <FieldArea
        label="Скрытая причина (участник её не видит)"
        value={entity.hiddenCause || ""}
        onChange={(value) => onChange({ hiddenCause: value })}
      />

      <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Данные для запроса</div>
            <div className="mt-1 text-[11px] text-[#8890a8]">Что участник может запросить, чтобы понять причину.</div>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => onChange({ dataPoints: [...dataPoints, { label: "", costToRequest: null }] })}
          >
            Добавить
          </Button>
        </div>
        <div className="space-y-2">
          {dataPoints.map((point, index) => (
            <div key={`data-point-${index}`} className="grid gap-2 md:grid-cols-[2fr,1fr,auto]">
              <div>
                <Label className="mb-1.5 block text-xs text-[#8890a8]">Что доступно</Label>
                <Input
                  value={point.label}
                  onChange={(event) => updateDataPoint(index, { label: event.target.value })}
                  className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
                />
              </div>
              <div>
                <Label className="mb-1.5 block text-xs text-[#8890a8]">Цена запроса</Label>
                <Input
                  value={point.costToRequest || ""}
                  onChange={(event) => updateDataPoint(index, { costToRequest: event.target.value || null })}
                  className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="self-end border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                onClick={() => onChange({ dataPoints: dataPoints.filter((_, pointIndex) => pointIndex !== index) })}
              >
                Удалить
              </Button>
            </div>
          ))}
          {dataPoints.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-4 text-center text-[11px] text-[#8aa2c4]">
              Пока не добавлено ни одной записи данных.
            </div>
          )}
        </div>
      </div>

      <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="mb-2 flex items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold text-white">Ложные следы</div>
            <div className="mt-1 text-[11px] text-[#8890a8]">Правдоподобные, но неверные объяснения ситуации.</div>
          </div>
          <Button
            type="button"
            size="sm"
            className="shrink-0"
            onClick={() => onChange({ falseTrails: [...falseTrails, ""] })}
          >
            Добавить
          </Button>
        </div>
        <div className="space-y-2">
          {falseTrails.map((trail, index) => (
            <div key={`false-trail-${index}`} className="flex items-end gap-2">
              <div className="flex-1">
                <Label className="mb-1.5 block text-xs text-[#8890a8]">Ложный след {index + 1}</Label>
                <Input
                  value={trail}
                  onChange={(event) =>
                    onChange({
                      falseTrails: falseTrails.map((item, itemIndex) => (itemIndex === index ? event.target.value : item)),
                    })
                  }
                  className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
                />
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                onClick={() => onChange({ falseTrails: falseTrails.filter((_, itemIndex) => itemIndex !== index) })}
              >
                Удалить
              </Button>
            </div>
          ))}
          {falseTrails.length === 0 && (
            <div className="rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-4 text-center text-[11px] text-[#8aa2c4]">
              Пока не добавлено ни одного ложного следа.
            </div>
          )}
        </div>
      </div>

      <SelectField
        label="Статус готовности"
        value={entity.qaStatus || "draft"}
        onChange={(value) => onChange({ qaStatus: value as CaseQaStatus })}
        options={QA_STATUS_OPTIONS}
      />

      <CaseValidationPanel caseInput={entity} />
    </div>
  );
}
```

Сохранить как `client/src/features/admin/cases/CaseDossierEditor.tsx`.

- [ ] **Step 2: Добавить третью вкладку в `EntityEditor.tsx`**

Найти (строки 108-111):
```tsx
          {([
            ["details", "Карточка кейса"],
            ["cycles", "Циклы и медиа"],
          ] as const).map(([section, label]) => (
```

Заменить на:
```tsx
          {([
            ["details", "Карточка кейса"],
            ["dossier", "Паспорт"],
            ["cycles", "Циклы и медиа"],
          ] as const).map(([section, label]) => (
```

- [ ] **Step 3: Отрендерить секцию паспорта**

Найти (строки 222-223):
```tsx
          )}
          {caseEditorSection === "cycles" && (
```

Заменить на:
```tsx
          )}
          {caseEditorSection === "dossier" && (
            <CaseDossierEditor entity={entity} onChange={(patch) => update(patch)} />
          )}
          {caseEditorSection === "cycles" && (
```

- [ ] **Step 4: Импортировать компонент в `EntityEditor.tsx`**

Найти (строка 7):
```tsx
import { CaseMediaPanel, StructuredCyclesEditor, StructuredOptionsEditor } from "../cases/CaseEditors";
```

Добавить сразу после неё:
```tsx
import { CaseDossierEditor } from "../cases/CaseDossierEditor";
```

- [ ] **Step 5: Проверить тип секции**

Run: `npm run check`
Expected: возможна ошибка типа для `caseEditorSection` — тип секции задан в `AdminWorkspaceRuntime.tsx` или `admin-types.ts` и не знает про `"dossier"`. Найти объявление (`grep -rn "caseEditorSection" client/src/features/admin/ | grep -i "usestate\|type"`) и добавить `"dossier"` в union-тип. Если ошибки нет — тип выведен автоматически, ничего не менять.

Run: `npm run check` (повторно, после правки типа)
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add client/src/features/admin/cases/CaseDossierEditor.tsx client/src/features/admin/components/EntityEditor.tsx
git commit -m "feat(admin): вкладка «Паспорт» с полями диагностики и живой автопроверкой"
```

---

### Task 5: Обработка `validationIssues` из ответа сервера

**Files:**
- Modify: `client/src/features/admin/AdminWorkspaceRuntime.tsx:1546-1550` (`saveCurrent`), `:1805-1817` (`confirmCaseWizard`)

**Interfaces:**
- Consumes: ответ `POST /api/admin/cases` вида `{ id, validationIssues }`.

**Зачем:** сервер уже возвращает `validationIssues`, но клиент их отбрасывает (`payload.id` берётся, остальное игнорируется). При блокирующем статусе сервер отвечает 400 — сейчас пользователь увидит общее «Запрос заполнен некорректно» из `throwIfResNotOk`, без указания, что именно не так.

- [ ] **Step 1: Показывать количество замечаний после сохранения из редактора**

Найти (строки 1546-1550):
```tsx
      if (tab === "cases" && caseDraft) {
        const response = await apiRequest("POST", "/api/admin/cases", caseDraft);
        const payload = await response.json();
        setSelectedCaseId(payload.id);
      }
```

Заменить на:
```tsx
      if (tab === "cases" && caseDraft) {
        const response = await apiRequest("POST", "/api/admin/cases", caseDraft);
        const payload = await response.json();
        setSelectedCaseId(payload.id);
        const issueCount = Array.isArray(payload.validationIssues) ? payload.validationIssues.length : 0;
        if (issueCount > 0) {
          setError(`Кейс сохранён как черновик. Автопроверка нашла замечаний: ${issueCount}. Откройте вкладку «Паспорт», чтобы посмотреть список.`);
        }
      }
```

- [ ] **Step 2: То же для визарда**

Найти (строки 1805-1812):
```tsx
      const response = await apiRequest("POST", "/api/admin/cases", nextDraft);
      const payload = await response.json();
      const savedId = payload.id || nextDraft.id;
      clearDraftFromStorage(DRAFT_STORAGE_KEYS.caseWizard);
      await invalidateRuntimeContent();
      setSelectedCaseId(savedId);
      setCaseDraft({ ...nextDraft, id: savedId });
      setCaseWizardOpen(false);
```

Заменить на:
```tsx
      const response = await apiRequest("POST", "/api/admin/cases", nextDraft);
      const payload = await response.json();
      const savedId = payload.id || nextDraft.id;
      clearDraftFromStorage(DRAFT_STORAGE_KEYS.caseWizard);
      await invalidateRuntimeContent();
      setSelectedCaseId(savedId);
      setCaseDraft({ ...nextDraft, id: savedId });
      setCaseWizardOpen(false);
      const issueCount = Array.isArray(payload.validationIssues) ? payload.validationIssues.length : 0;
      if (issueCount > 0) {
        setError(`Кейс создан как черновик. Автопроверка нашла замечаний: ${issueCount}. Откройте вкладку «Паспорт», чтобы посмотреть список.`);
      }
```

- [ ] **Step 3: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/admin/AdminWorkspaceRuntime.tsx
git commit -m "feat(admin): показывать замечания автопроверки после сохранения кейса"
```

---

### Task 6: Статические проверки UI и финальная верификация

**Files:**
- Modify: `script/check-ui-acceptance.mjs`

**Interfaces:**
- Consumes: файлы, созданные в Task 2-4.

- [ ] **Step 1: Изучить формат существующих проверок**

Прочитать `script/check-ui-acceptance.mjs` целиком (120 строк). Проверки построены как `assertCondition(<текст файла>.includes("…"), "<сообщение>")` над содержимым файлов, прочитанных через `readText`. Добавлять новые проверки нужно в том же стиле, рядом с существующими блоками для админки.

- [ ] **Step 2: Добавить проверки нового UI**

Добавить в конец файла, перед финальным `console.log` (если он есть — иначе в самый конец):

```js
const caseUi = [
  "client/src/features/admin/cases/StructuredOptionsEditor.tsx",
  "client/src/features/admin/cases/CaseDossierEditor.tsx",
  "client/src/features/admin/cases/CaseValidationPanel.tsx",
  "client/src/features/admin/components/EntityEditor.tsx",
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
  caseUi.includes('"dossier"'),
  "В редакторе кейса должна быть отдельная вкладка паспорта",
);
```

- [ ] **Step 3: Финальная верификация**

Run: `npm run check`
Expected: без ошибок типов.

Run: `npx tsx script/case-editor-support-parity.ts`
Expected: `case-editor-support parity checks passed`

Run: `npm run test:ui`
Expected: скрипт завершается без ошибок (все `assertCondition` проходят).

Run: `npm test`
Expected: `CI smoke checks passed`

- [ ] **Step 4: Commit**

```bash
git add script/check-ui-acceptance.mjs
git commit -m "test(admin): статические проверки UI паспорта кейса и BARS-пикера"
```

---

## Self-Review

**Spec coverage:**
- Поля паспорта в интерфейсе → Task 4 (вкладка «Паспорт» с бизнес-проблемой, скрытой причиной, данными, ложными следами, статусом).
- BARS-уровни вместо ручного ввода баллов → Task 1 (справочник + чистая функция), Task 2 (пикер вместо слайдера).
- Показ замечаний автору → Task 3 (живая панель до сохранения), Task 5 (ответ сервера после сохранения).
- Не трогать ЗРД → ни один файл плана не относится к `shared/zrd/*` или `client/src/features/zrd/*`.
- Логика в чистых функциях с tsx-тестом → Task 1; компоненты Task 2-4 логики не содержат, только отображение.

**Placeholder scan:** пройден — везде полный код, точные пути и номера строк, команды с ожидаемым выводом. Единственное место с условной формулировкой — Task 4 Step 5 (тип `caseEditorSection`): точное имя типа неизвестно до запуска `tsc`, поэтому дана команда поиска и оба возможных исхода.

**Type consistency:** `BarsLevel`, `CaseDossierSummary`, `BARS_OPTIONS` объявлены один раз (Task 1) и используются с теми же именами в Task 2 и 4. `CaseValidationPanel` принимает `SimCase | null` и вызывается с `SimCase` (Task 4) — совместимо.

## Что дальше после этого плана

- **Дебриф** — после согласования концепции со стейкхолдером.
- **Пилотный кейс** — собрать один эталонный кейс уже в новом интерфейсе, проверить, что паспорт и BARS-уровни работают на реальном содержании.
- **Продуктовое решение по публикации:** должна ли кнопка «Опубликовать» ставить `qaStatus: ready_launch` и проходить гейт. Сейчас не ставит — иначе 14 существующих кейсов с 407 замечаниями стало бы невозможно переопубликовать.
