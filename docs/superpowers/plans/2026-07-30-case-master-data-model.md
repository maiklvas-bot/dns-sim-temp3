# Паспорт кейса, подпризнаки компетенций и автопроверки — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Расширить модель данных симуляции «Космонавт» (НЕ ЗРД) паспортом кейса и подпризнаками
компетенций, реализовать 4 автоматические проверки кейса и чистую свёртку подпризнаков в агрегат
компетенции — как тестируемую логику плюс минимальную серверную обвязку. Без изменений UI.

**Architecture:** Backend-first срез: миграция БД → типы → две новые чистые логические библиотеки
(`shared/case-validation.ts`, `shared/competency-facets.ts`, без React, без побочных эффектов) →
Zod-валидация → `content-storage.ts` (персист/чтение новых полей) → `routes.ts` (гейт автопроверки на
сохранении кейса) → расширение `script/ci-smoke.ts`.

**Tech Stack:** TypeScript, Drizzle ORM (better-sqlite3), Express, Zod. Тестирование — tsx-скрипты
(`npm test` = `script/ci-smoke.ts`, без vitest/jest), по прецеденту `script/scoring-parity.ts`.

## Global Constraints

- НЕ трогать модуль ЗРД (`shared/zrd/*`, `zrdSessions`/`zrdMatches` в схеме) — отдельный движок.
- Каждая новая расчётная функция — чистая (без побочных эффектов), с собственным TDD-скриптом по
  образцу `script/scoring-parity.ts` (`assert.deepEqual`/`assert.equal` из `node:assert/strict`, без
  фреймворка).
- Миграции — только через `ALTER TABLE ADD COLUMN` в новом файле `migrations/NNNN_slug.sql`,
  применяются кастомным раннером `server/migrations.ts` (по имени файла, идемпотентно). Никогда не
  редактировать уже применённые файлы миграций.
- Не менять сериализацию `SessionResultPayload`/`competencyAveragesJson` — на неё завязаны PDF-отчёт,
  экран сравнения участников и восстановление live-сессии.
- Каждый шаг с кодом — сразу с `npm run check` (tsc) и релевантным tsx-скриптом; финальная проверка
  всего — `npm run check && npm test`.

## Что этот план НЕ делает (осознанное сужение объёма)

Критерии (`docs/simulation-case-master-criteria.md`, раздел 8) называют 4 части: модель данных,
4 автопроверки, UI мастера, дебриф. Этот план закрывает **первые две**:

1. **БЕЗ дебрифа.** Смысл дебрифа (раздел 6 критериев) требует отдельного согласования: вопросы,
   генерируемые под конкретные слабые компетенции с использованием якорей «слабо», личный вывод
   участника, действие на 7 дней, план мероприятий при красном флаге и связь с контуром закрепления
   7/14/30 — это отдельная подсистема, а не шаблонный список вопросов. Поэтому из плана убраны:
   модуль `shared/simulation-debrief.ts`, поле `debriefQuestions` в паспорте кейса, встраивание в
   `GET /api/staff/results/:id`. Всё это — следующий, отдельный план после согласования концепции.
2. **БЕЗ UI мастера** (новый шаг визарда с полями паспорта, BARS-уровень-пикер вместо ручного ввода
   числа) — самостоятельная, отдельно тестируемая подсистема.

Что план всё-таки даёт по части компенсации: **чистую функцию свёртки подпризнаков**
(`aggregateFacetAverages`) — это ядро модели компенсации §5.2, методологически отдельное от дебрифа
и уже согласованное на конкретном примере (планирование 2 / контроль 4 → агрегат 3.0). Функция
реализуется и покрывается тестом здесь; её применение в API/отчёте — вместе с будущим планом дебрифа.

---

## File Structure

- Create: `migrations/0011_case_dossier_and_facets.sql` — новые колонки БД.
- Modify: `shared/schema.ts` — колонки `simulationCases` (паспорт) и `competencies` (facet/стоп-фактор).
- Modify: `shared/simulation-content.ts` — типы `SimCase`, `CompetencyDefinition`, новый `CaseDataPoint`, `CaseQaStatus`.
- Create: `shared/case-validation.ts` — 4 автопроверки + `validateCase()` + `spearmanRho()`.
- Create: `script/case-validation-parity.ts` — TDD-фикстура для `case-validation.ts`.
- Create: `shared/competency-facets.ts` — `aggregateFacetAverages()` (свёртка подпризнаков, §5.2).
- Create: `script/facet-aggregation-parity.ts` — TDD-фикстура для `competency-facets.ts`.
- Modify: `server/middleware/validation.ts` — новые поля в `editableSimCaseSchema`.
- Modify: `server/content-storage.ts` — `saveCase()` пишет новые поля, `getPublicContent()` их читает.
- Modify: `server/routes.ts` — гейт автопроверки на `POST /api/admin/cases`.
- Modify: `script/ci-smoke.ts` — покрытие паспорта кейса и гейта.

---

### Task 1: Миграция БД — паспорт кейса, подпризнаки, стоп-фактор

**Files:**
- Create: `migrations/0011_case_dossier_and_facets.sql`
- Modify: `shared/schema.ts:88-103` (таблица `simulationCases`), `shared/schema.ts:67-74` (таблица `competencies`)

**Interfaces:**
- Produces: колонки `simulation_cases.{business_problem, hidden_cause, data_points_json, false_trails_json, qa_status}` и `competencies.{facet_of_competency_id, is_stop_factor}`, доступные через Drizzle как `simulationCases.businessProblem` и т.д.

- [ ] **Step 1: Создать файл миграции**

```sql
ALTER TABLE simulation_cases ADD COLUMN business_problem TEXT;
ALTER TABLE simulation_cases ADD COLUMN hidden_cause TEXT;
ALTER TABLE simulation_cases ADD COLUMN data_points_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE simulation_cases ADD COLUMN false_trails_json TEXT NOT NULL DEFAULT '[]';
ALTER TABLE simulation_cases ADD COLUMN qa_status TEXT NOT NULL DEFAULT 'draft';

ALTER TABLE competencies ADD COLUMN facet_of_competency_id TEXT;
ALTER TABLE competencies ADD COLUMN is_stop_factor INTEGER NOT NULL DEFAULT 0;
```

Сохранить в `migrations/0011_case_dossier_and_facets.sql`.

- [ ] **Step 2: Обновить схему `competencies` в `shared/schema.ts`**

Найти (строки 67-74):
```ts
export const competencies = sqliteTable("competencies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});
```

Заменить на:
```ts
export const competencies = sqliteTable("competencies", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  category: text("category").notNull(),
  facetOfCompetencyId: text("facet_of_competency_id"),
  isStopFactor: integer("is_stop_factor", { mode: "boolean" }).notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
});
```

- [ ] **Step 3: Обновить схему `simulationCases` в `shared/schema.ts`**

Найти (строки 88-103):
```ts
export const simulationCases = sqliteTable("simulation_cases", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  primaryCompetenciesJson: text("primary_competencies_json").notNull().default("[]"),
  secondaryCompetenciesJson: text("secondary_competencies_json").notNull().default("[]"),
  zonesAffectedJson: text("zones_affected_json").notNull().default("[]"),
  imageAssetId: text("image_asset_id"),
  audioAssetId: text("audio_asset_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  orderIdx: index("simulation_cases_order_idx").on(table.sortOrder),
}));
```

Заменить на:
```ts
export const simulationCases = sqliteTable("simulation_cases", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  primaryCompetenciesJson: text("primary_competencies_json").notNull().default("[]"),
  secondaryCompetenciesJson: text("secondary_competencies_json").notNull().default("[]"),
  zonesAffectedJson: text("zones_affected_json").notNull().default("[]"),
  businessProblem: text("business_problem"),
  hiddenCause: text("hidden_cause"),
  dataPointsJson: text("data_points_json").notNull().default("[]"),
  falseTrailsJson: text("false_trails_json").notNull().default("[]"),
  qaStatus: text("qa_status").notNull().default("draft"),
  imageAssetId: text("image_asset_id"),
  audioAssetId: text("audio_asset_id"),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
  orderIdx: index("simulation_cases_order_idx").on(table.sortOrder),
}));
```

- [ ] **Step 4: Проверить, что миграция и схема согласованы**

Run: `npm run check`
Expected: без ошибок типов.

Run: `npm test`
Expected: `CI smoke checks passed` — `runAdminStorageAcceptanceChecks()` внутри поднимает свежую
временную БД и прогоняет `runMigrations(sqlite)` с нуля, включая новый файл `0011_...sql`; если SQL
в миграции некорректен, тест упадёт здесь.

- [ ] **Step 5: Commit**

```bash
git add migrations/0011_case_dossier_and_facets.sql shared/schema.ts
git commit -m "feat(db): паспорт кейса и подпризнаки/стоп-фактор компетенций"
```

---

### Task 2: Типы — паспорт кейса и подпризнаки в `shared/simulation-content.ts`

**Files:**
- Modify: `shared/simulation-content.ts:72-88` (`SimCase`), `shared/simulation-content.ts:1-6` (`CompetencyDefinition`)

**Interfaces:**
- Consumes: ничего нового (чистое расширение существующих типов).
- Produces: `CaseDataPoint`, `CaseQaStatus`, `SimCase.{businessProblem, hiddenCause, dataPoints, falseTrails, qaStatus}`, `CompetencyDefinition.{facetOfCompetencyId, isStopFactor}` — используются в Task 3, 4, 6, 7.

- [ ] **Step 1: Расширить `CompetencyDefinition`**

Найти (строки 1-6):
```ts
export interface CompetencyDefinition {
  id: string;
  name: string;
  description: string;
  category: "basic" | "advanced" | "leadership";
}
```

Заменить на:
```ts
export interface CompetencyDefinition {
  id: string;
  name: string;
  description: string;
  category: "basic" | "advanced" | "leadership";
  facetOfCompetencyId?: string | null;
  isStopFactor?: boolean;
}
```

- [ ] **Step 2: Добавить `CaseDataPoint` и `CaseQaStatus`, расширить `SimCase`**

Найти (строки 72-88):
```ts
export interface SimCase {
  id: string;
  title: string;
  description: string;
  primaryCompetencies: string[];
  secondaryCompetencies: string[];
  trigger: CaseTrigger;
  zones_affected: ZoneType[];
  cycles: CaseCycle[];
  imageAssetId: string | null;
  imageUrl: string | null;
  audioAssetId: string | null;
  audioUrl: string | null;
  timing?: CaseTimingConfig | null;
  sortOrder: number;
  isActive: boolean;
}
```

Заменить на:
```ts
export interface CaseDataPoint {
  label: string;
  costToRequest?: string | null;
}

export type CaseQaStatus =
  | "draft"
  | "auto_check_failed"
  | "methodical_review"
  | "ready_prototype"
  | "ready_launch";

export interface SimCase {
  id: string;
  title: string;
  description: string;
  primaryCompetencies: string[];
  secondaryCompetencies: string[];
  trigger: CaseTrigger;
  zones_affected: ZoneType[];
  cycles: CaseCycle[];
  businessProblem?: string | null;
  hiddenCause?: string | null;
  dataPoints?: CaseDataPoint[];
  falseTrails?: string[];
  qaStatus?: CaseQaStatus;
  imageAssetId: string | null;
  imageUrl: string | null;
  audioAssetId: string | null;
  audioUrl: string | null;
  timing?: CaseTimingConfig | null;
  sortOrder: number;
  isActive: boolean;
}
```

- [ ] **Step 3: Проверить типы**

Run: `npm run check`
Expected: без ошибок (все поля опциональные — существующие места создания `SimCase`, например
`createEmptyCase` в `case-editor-support.ts`, остаются валидны без изменений).

- [ ] **Step 4: Commit**

```bash
git add shared/simulation-content.ts
git commit -m "feat(types): паспорт кейса и подпризнаки в SimCase/CompetencyDefinition"
```

---

### Task 3: Модуль автопроверки кейса — `shared/case-validation.ts`

**Files:**
- Create: `shared/case-validation.ts`
- Create: `script/case-validation-parity.ts`

**Interfaces:**
- Consumes: `SimCase` из `shared/simulation-content.ts` (Task 2).
- Produces: `validateCase(caseInput: SimCase): CaseValidationIssue[]`, `spearmanRho(a: number[], b: number[]): number`, `BARS_LEVEL_SCORES: { weak: 1, mid: 3, strong: 5 }`, тип `CaseValidationIssue { check, cycleId?, optionId?, message }` — используется в Task 7 (`routes.ts`) и Task 8 (`ci-smoke.ts`).

- [ ] **Step 1: Написать падающую TDD-фикстуру `script/case-validation-parity.ts`**

```ts
import assert from "node:assert/strict";
import { spearmanRho, validateCase } from "../shared/case-validation";
import type { SimCase } from "../shared/simulation-content";

const baseEffects = { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 };

function buildCase(overrides: Partial<SimCase> = {}): SimCase {
  return {
    id: "CASE-1",
    title: "Test case",
    description: "Test",
    primaryCompetencies: [],
    secondaryCompetencies: [],
    trigger: { type: "message", source: "Test", text: "Test" },
    zones_affected: [],
    cycles: [{
      id: "CASE-1-C1",
      cycle: 1,
      situation: "Situation",
      signal: { type: "message", content: "Signal" },
      options: [
        { id: "O1", level: 1, text: "Postpone the decision", score: 1, effects: { ...baseEffects, queue: 5 }, competency_scores: { planning: 1 } },
        { id: "O2", level: 2, text: "Delegate without a deadline", score: 2, effects: { ...baseEffects, queue: 3 }, competency_scores: { planning: 3 } },
        { id: "O3", level: 3, text: "Assign owner and set a check", score: 3, effects: { ...baseEffects, queue: -2 }, competency_scores: { planning: 5 } },
      ],
    }],
    hiddenCause: "Root cause",
    dataPoints: [{ label: "Report" }],
    falseTrails: ["Distraction"],
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

// spearmanRho: perfect ascending correlation
assert.equal(spearmanRho([1, 2, 3], [1, 3, 5]), 1);
// spearmanRho: perfect descending correlation
assert.equal(spearmanRho([1, 2, 3], [5, 3, 1]), -1);
// spearmanRho: mismatched length is neutral
assert.equal(spearmanRho([1, 2], [1, 2, 3]), 0);

// A well-formed case: diagnostics filled; every option moves at least one metric;
// option texts stay within the x2 length ratio; only one competency is scored, so the
// antigaming "single goodness axis" rule (needs >=2 scored competencies) does not fire.
assert.deepEqual(validateCase(buildCase()), []);

// Missing diagnostics fields
const noDiagnostics = buildCase({ hiddenCause: null, dataPoints: [], falseTrails: [] });
const diagnosticsIssues = validateCase(noDiagnostics).filter((issue) => issue.check === "diagnostics");
assert.equal(diagnosticsIssues.length, 3);

// Non-BARS score (2 is not weak=1/mid=3/strong=5)
const badBars = buildCase();
badBars.cycles[0].options[0].competency_scores = { planning: 2 };
const barsIssues = validateCase(badBars).filter((issue) => issue.check === "bars_conformance");
assert.equal(barsIssues.length, 1);

// All-zero effects on one option
const zeroEffects = buildCase();
zeroEffects.cycles[0].options[0].effects = { ...baseEffects };
const effectIssues = validateCase(zeroEffects).filter((issue) => issue.check === "effect_reality");
assert.equal(effectIssues.length, 1);

// Antigaming: two competencies both perfectly rising with level -> single "goodness axis".
// Texts stay within the length ratio and effects stay non-zero, so this fixture isolates
// the correlation rule from the other two antigaming/effect checks.
const antigamingCase = buildCase();
antigamingCase.cycles[0].options = [
  { id: "O1", level: 1, text: "Wait and see how it goes", score: 1, effects: { ...baseEffects, queue: 5 }, competency_scores: { planning: 1, communication: 1 } },
  { id: "O2", level: 2, text: "Ask a colleague for input", score: 2, effects: { ...baseEffects, queue: 3 }, competency_scores: { planning: 3, communication: 3 } },
  { id: "O3", level: 3, text: "Run a two-minute standup", score: 3, effects: { ...baseEffects, queue: -2 }, competency_scores: { planning: 5, communication: 5 } },
];
const antigamingIssues = validateCase(antigamingCase).filter(
  (issue) => issue.check === "antigaming" && issue.message.includes("шкала хорошести"),
);
assert.equal(antigamingIssues.length, 1);

console.log("case-validation parity checks passed");
```

- [ ] **Step 2: Убедиться, что фикстура падает (модуля ещё нет)**

Run: `npx tsx script/case-validation-parity.ts`
Expected: `Cannot find module '../shared/case-validation'` (или аналогичная ошибка компиляции/резолва).

- [ ] **Step 3: Реализовать `shared/case-validation.ts`**

```ts
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
  if (!caseInput.hiddenCause || !caseInput.hiddenCause.trim()) {
    issues.push({ check: "diagnostics", message: "Не заполнена скрытая причина кейса." });
  }
  if (!caseInput.dataPoints || caseInput.dataPoints.length === 0) {
    issues.push({ check: "diagnostics", message: "Не добавлено ни одной записи данных для запроса." });
  }
  if (!caseInput.falseTrails || caseInput.falseTrails.length === 0) {
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
```

- [ ] **Step 4: Убедиться, что фикстура проходит**

Run: `npx tsx script/case-validation-parity.ts`
Expected: `case-validation parity checks passed`

- [ ] **Step 5: Типы и проверка**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add shared/case-validation.ts script/case-validation-parity.ts
git commit -m "feat(cases): 4 автопроверки конструктора кейсов (BARS, антигейминг, диагностика, эффекты)"
```

---

### Task 4: Свёртка подпризнаков компетенции — `shared/competency-facets.ts`

**Files:**
- Create: `shared/competency-facets.ts`
- Create: `script/facet-aggregation-parity.ts`

**Interfaces:**
- Consumes: `CompetencyDefinition` из `shared/simulation-content.ts` (Task 2, поле `facetOfCompetencyId`).
- Produces: `aggregateFacetAverages(competencyAverages, definitions): Record<string, number>`,
  `getFacetIds(parentId, definitions): string[]` — чистые функции модели компенсации §5.2; будут
  использованы будущим планом (дебриф/отчёт), в этом плане покрываются только тестом.

- [ ] **Step 1: Написать падающую TDD-фикстуру `script/facet-aggregation-parity.ts`**

```ts
import assert from "node:assert/strict";
import { aggregateFacetAverages, getFacetIds } from "../shared/competency-facets";
import type { CompetencyDefinition } from "../shared/simulation-content";

const definitions: CompetencyDefinition[] = [
  { id: "org_control", name: "Организация и контроль работы", description: "", category: "advanced", isStopFactor: true },
  { id: "planning", name: "Планирование", description: "", category: "advanced", facetOfCompetencyId: "org_control" },
  { id: "task_setting", name: "Постановка задач", description: "", category: "advanced", facetOfCompetencyId: "org_control" },
  { id: "control", name: "Контроль", description: "", category: "advanced", facetOfCompetencyId: "org_control" },
  { id: "result_orientation", name: "Направленность на результат", description: "", category: "leadership", isStopFactor: true },
  { id: "communication", name: "Коммуникабельность", description: "", category: "advanced" },
];

// getFacetIds returns only the facets of the requested parent
assert.deepEqual(getFacetIds("org_control", definitions).sort(), ["control", "planning", "task_setting"]);
assert.deepEqual(getFacetIds("communication", definitions), []);

// Worked example from docs/simulation-case-master-criteria.md §5.2:
// planning=2, task_setting=3, control=4 -> aggregate 3.0 (simple mean)
const averages = { planning: 2, task_setting: 3, control: 4, result_orientation: 4, communication: 3 };
const aggregated = aggregateFacetAverages(averages, definitions);
assert.equal(aggregated.org_control, 3);
// non-facet competencies pass through untouched
assert.equal(aggregated.result_orientation, 4);
assert.equal(aggregated.communication, 3);
// facet values stay visible in the result (layer A: "видно раздельно")
assert.equal(aggregated.planning, 2);
assert.equal(aggregated.task_setting, 3);
assert.equal(aggregated.control, 4);

// Partial facet data: aggregate over the facets that exist
const partial = aggregateFacetAverages({ planning: 2, control: 4 }, definitions);
assert.equal(partial.org_control, 3);

// No facet data at all: parent gets no derived value
const empty = aggregateFacetAverages({ communication: 5 }, definitions);
assert.equal(empty.org_control, undefined);

// Rounding to one decimal place
const rounding = aggregateFacetAverages({ planning: 1, task_setting: 2, control: 2 }, definitions);
assert.equal(rounding.org_control, 1.7);

console.log("facet-aggregation parity checks passed");
```

- [ ] **Step 2: Убедиться, что фикстура падает**

Run: `npx tsx script/facet-aggregation-parity.ts`
Expected: ошибка резолва модуля `../shared/competency-facets`.

- [ ] **Step 3: Реализовать `shared/competency-facets.ts`**

```ts
import type { CompetencyDefinition } from "./simulation-content";

export function getFacetIds(parentId: string, definitions: CompetencyDefinition[]): string[] {
  return definitions
    .filter((definition) => definition.facetOfCompetencyId === parentId)
    .map((definition) => definition.id);
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
    const values = facetIds
      .map((id) => competencyAverages[id])
      .filter((value): value is number => typeof value === "number");
    if (values.length > 0) {
      const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
      result[parentId] = Math.round(mean * 10) / 10;
    }
  });

  return result;
}
```

- [ ] **Step 4: Убедиться, что фикстура проходит**

Run: `npx tsx script/facet-aggregation-parity.ts`
Expected: `facet-aggregation parity checks passed`

- [ ] **Step 5: Типы и проверка**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 6: Commit**

```bash
git add shared/competency-facets.ts script/facet-aggregation-parity.ts
git commit -m "feat(cases): свёртка подпризнаков компетенции в агрегат (модель компенсации)"
```

---

### Task 5: Zod-схема — паспорт кейса в `server/middleware/validation.ts`

**Files:**
- Modify: `server/middleware/validation.ts:338-355` (`editableSimCaseSchema`)

**Interfaces:**
- Consumes: `safeLooseTextSchema`, `idStringSchema`, `boundedIntSchema` — уже определены выше в файле (используются существующими схемами на строках 299-336, не создаются заново).
- Produces: `editableSimCaseSchema` c полями паспорта — потребляется `routes.ts` (`POST /api/admin/cases`, уже существующий вызов `validateBody(editableSimCaseSchema)`).

- [ ] **Step 1: Добавить схему точки данных и расширить `editableSimCaseSchema`**

Найти (строки 338-355):
```ts
export const editableSimCaseSchema = z.object({
  id: emptyOrIdStringSchema.optional().default(""),
  title: safeLooseTextSchema(300),
  description: safeLooseTextSchema(10_000),
  primaryCompetencies: z.array(idStringSchema).max(50).default([]),
  secondaryCompetencies: z.array(idStringSchema).max(50).default([]),
  trigger: z.object({
    type: signalTypeSchema,
    source: safeLooseTextSchema(300),
    text: safeLooseTextSchema(5_000),
  }),
  zones_affected: z.array(zoneTypeSchema).max(10).default([]),
  cycles: z.array(caseCycleSchema).min(1).max(50),
  imageAssetId: nullableIdStringSchema.optional().default(null),
  audioAssetId: nullableIdStringSchema.optional().default(null),
  timing: timingConfigSchema,
  sortOrder: boundedIntSchema(0, 100_000).optional().default(0),
```

Заменить на:
```ts
const caseDataPointSchema = z.object({
  label: safeLooseTextSchema(500),
  costToRequest: safeLooseTextSchema(300).nullable().optional().default(null),
});

const caseQaStatusSchema = z.enum([
  "draft",
  "auto_check_failed",
  "methodical_review",
  "ready_prototype",
  "ready_launch",
]);

export const editableSimCaseSchema = z.object({
  id: emptyOrIdStringSchema.optional().default(""),
  title: safeLooseTextSchema(300),
  description: safeLooseTextSchema(10_000),
  primaryCompetencies: z.array(idStringSchema).max(50).default([]),
  secondaryCompetencies: z.array(idStringSchema).max(50).default([]),
  trigger: z.object({
    type: signalTypeSchema,
    source: safeLooseTextSchema(300),
    text: safeLooseTextSchema(5_000),
  }),
  zones_affected: z.array(zoneTypeSchema).max(10).default([]),
  cycles: z.array(caseCycleSchema).min(1).max(50),
  businessProblem: safeLooseTextSchema(5_000).nullable().optional().default(null),
  hiddenCause: safeLooseTextSchema(5_000).nullable().optional().default(null),
  dataPoints: z.array(caseDataPointSchema).max(30).optional().default([]),
  falseTrails: z.array(safeLooseTextSchema(1_000)).max(30).optional().default([]),
  qaStatus: caseQaStatusSchema.optional().default("draft"),
  imageAssetId: nullableIdStringSchema.optional().default(null),
  audioAssetId: nullableIdStringSchema.optional().default(null),
  timing: timingConfigSchema,
  sortOrder: boundedIntSchema(0, 100_000).optional().default(0),
```

(Оставшаяся часть объекта — `isActive: z.boolean().optional().default(true),` и закрывающая `});` — не
меняется, идёт сразу следом без изменений.)

- [ ] **Step 2: Проверить типы**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 3: Commit**

```bash
git add server/middleware/validation.ts
git commit -m "feat(validation): поля паспорта кейса в схеме создания/редактирования"
```

---

### Task 6: `server/content-storage.ts` — сохранение и чтение новых полей

**Files:**
- Modify: `server/content-storage.ts:538-550` (`saveCase`, объект `record`)
- Modify: `server/content-storage.ts:316-325` (`getPublicContent`, конец маппинга кейса)
- Modify: `server/content-storage.ts:338-343` (`getPublicContent`, маппинг компетенций)

**Interfaces:**
- Consumes: `EditableSimCase` (уже `extends SimCase`, новые поля Task 2 наследуются автоматически, без правки объявления типа), `parseJsonArray` (уже импортирован и используется в файле).
- Produces: сохранённые и читаемые обратно поля паспорта кейса и `facetOfCompetencyId`/`isStopFactor`
  компетенций — потребляются Task 7 (`routes.ts`) и Task 8 (`ci-smoke.ts`).

- [ ] **Step 1: Записывать паспорт кейса в `saveCase`**

Найти (строки 538-550):
```ts
      const record = {
        id: caseId,
        title: input.title,
        description: input.description,
        primaryCompetenciesJson: JSON.stringify(input.primaryCompetencies),
        secondaryCompetenciesJson: JSON.stringify(input.secondaryCompetencies),
        zonesAffectedJson: JSON.stringify(input.zones_affected),
        imageAssetId: input.imageAssetId,
        audioAssetId: input.audioAssetId,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        updatedAt: new Date().toISOString(),
      };
```

Заменить на:
```ts
      const record = {
        id: caseId,
        title: input.title,
        description: input.description,
        primaryCompetenciesJson: JSON.stringify(input.primaryCompetencies),
        secondaryCompetenciesJson: JSON.stringify(input.secondaryCompetencies),
        zonesAffectedJson: JSON.stringify(input.zones_affected),
        businessProblem: input.businessProblem || null,
        hiddenCause: input.hiddenCause || null,
        dataPointsJson: JSON.stringify(input.dataPoints || []),
        falseTrailsJson: JSON.stringify(input.falseTrails || []),
        qaStatus: input.qaStatus || "draft",
        imageAssetId: input.imageAssetId,
        audioAssetId: input.audioAssetId,
        sortOrder: input.sortOrder ?? 0,
        isActive: input.isActive ?? true,
        updatedAt: new Date().toISOString(),
      };
```

- [ ] **Step 2: Отдавать паспорт кейса из `getPublicContent`**

Найти (строки 316-325, конец маппинга одного кейса):
```ts
        }),
        imageAssetId: row.imageAssetId,
        imageUrl: image?.publicUrl || null,
        audioAssetId: row.audioAssetId,
        audioUrl: audio?.publicUrl || null,
        timing: buildPublicTiming("main_case", timing, null),
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      };
    });
```

Заменить на:
```ts
        }),
        businessProblem: row.businessProblem || null,
        hiddenCause: row.hiddenCause || null,
        dataPoints: parseJsonArray<NonNullable<SimCase["dataPoints"]>[number]>(row.dataPointsJson, []),
        falseTrails: parseJsonArray<string>(row.falseTrailsJson, []),
        qaStatus: (row.qaStatus as SimCase["qaStatus"]) || "draft",
        imageAssetId: row.imageAssetId,
        imageUrl: image?.publicUrl || null,
        audioAssetId: row.audioAssetId,
        audioUrl: audio?.publicUrl || null,
        timing: buildPublicTiming("main_case", timing, null),
        sortOrder: row.sortOrder,
        isActive: row.isActive,
      };
    });
```

- [ ] **Step 3: Отдавать `facetOfCompetencyId`/`isStopFactor` из маппинга компетенций**

Найти (строки 338-343):
```ts
      competencies: competencyRows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category as "basic" | "advanced" | "leadership",
      })),
```

Заменить на:
```ts
      competencies: competencyRows.map((row) => ({
        id: row.id,
        name: row.name,
        description: row.description,
        category: row.category as "basic" | "advanced" | "leadership",
        facetOfCompetencyId: row.facetOfCompetencyId || null,
        isStopFactor: Boolean(row.isStopFactor),
      })),
```

- [ ] **Step 4: Проверить типы и сквозной сценарий**

Run: `npm run check`
Expected: без ошибок.

Run: `npm test`
Expected: `CI smoke checks passed` (существующий тест `runAdminStorageAcceptanceChecks` создаёт кейс без
паспорта — новые поля опциональны и по умолчанию пустые, регрессии быть не должно; полное покрытие
новых полей добавляется в Task 8).

- [ ] **Step 5: Commit**

```bash
git add server/content-storage.ts
git commit -m "feat(storage): персист и чтение паспорта кейса, facet/стоп-фактор компетенций"
```

---

### Task 7: `server/routes.ts` — гейт автопроверки на сохранении кейса

**Files:**
- Modify: `server/routes.ts:6` (импорты)
- Modify: `server/routes.ts:1459-1474` (`POST /api/admin/cases`)

**Interfaces:**
- Consumes: `validateCase` из `@shared/case-validation` (Task 3).
- Produces: `POST /api/admin/cases` возвращает `{ id, validationIssues }` и отклоняет `400` при
  блокирующих проверках для статусов `methodical_review`/`ready_prototype`/`ready_launch`.

- [ ] **Step 1: Импортировать модуль автопроверки**

Найти (строка 6):
```ts
import { accumulateCompetencyTotals } from "@shared/simulation-scoring";
```

Заменить на:
```ts
import { accumulateCompetencyTotals } from "@shared/simulation-scoring";
import { validateCase } from "@shared/case-validation";
```

- [ ] **Step 2: Добавить гейт автопроверки на `POST /api/admin/cases`**

Найти (строки 1459-1474):
```ts
  app.post("/api/admin/cases", requireAdmin, adminRateLimiter, validateBody(editableSimCaseSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof editableSimCaseSchema>;
    const before = body.id ? getCaseSnapshot(body.id) : null;
    const id = contentStorage.saveCase(body as EditableSimCase);
    const after = getCaseSnapshot(id);
    recordAudit(req, {
      area: "admin",
      action: before ? "case_updated" : "case_created",
      entityType: "case",
      entityId: id,
      summary: `${before ? "Изменен" : "Создан"} кейс: ${after?.title || id}`,
      before,
      after,
    });
    res.json({ id });
  });
```

Заменить на:
```ts
  app.post("/api/admin/cases", requireAdmin, adminRateLimiter, validateBody(editableSimCaseSchema), (req, res) => {
    const body = req.validatedBody as z.infer<typeof editableSimCaseSchema>;
    const validationIssues = validateCase(body as EditableSimCase);
    const blockingStatuses = new Set(["methodical_review", "ready_prototype", "ready_launch"]);
    if (validationIssues.length > 0 && blockingStatuses.has(body.qaStatus)) {
      return res.status(400).json({ error: "case_validation_failed", issues: validationIssues });
    }
    const before = body.id ? getCaseSnapshot(body.id) : null;
    const id = contentStorage.saveCase(body as EditableSimCase);
    const after = getCaseSnapshot(id);
    recordAudit(req, {
      area: "admin",
      action: before ? "case_updated" : "case_created",
      entityType: "case",
      entityId: id,
      summary: `${before ? "Изменен" : "Создан"} кейс: ${after?.title || id}`,
      before,
      after,
    });
    res.json({ id, validationIssues });
  });
```

- [ ] **Step 3: Проверить типы и смоук**

Run: `npm run check`
Expected: без ошибок.

Run: `npm test`
Expected: `CI smoke checks passed`.

- [ ] **Step 4: Commit**

```bash
git add server/routes.ts
git commit -m "feat(api): гейт автопроверки на сохранении кейса"
```

---

### Task 8: Расширить `script/ci-smoke.ts` — сквозное покрытие паспорта и гейта

**Files:**
- Modify: `script/ci-smoke.ts:1130-1134` (после существующей проверки `editableSimCaseSchema`)
- Modify: `script/ci-smoke.ts:267-269` (после существующего блока `contentStorage.saveCase`/`getPublicContent` внутри `runAdminStorageAcceptanceChecks`)

**Interfaces:**
- Consumes: `editableSimCaseSchema` (Task 5), `contentStorage` (Task 6), `validateCase` (Task 3),
  `assertSchemaAccepts`/`assertSchemaRejects`/`assertCondition` (уже определены в файле).

- [ ] **Step 1: Добавить схемные проверки паспорта кейса**

Найти (строки 1130-1134, сразу после первой проверки `editableSimCaseSchema`):
```ts
assertSchemaRejects(
  editableSimCaseSchema,
  { ...validCasePayload, cycles: "not-an-array" },
  "Editable case schema must reject malformed cycles",
);
```

Заменить на:
```ts
assertSchemaRejects(
  editableSimCaseSchema,
  { ...validCasePayload, cycles: "not-an-array" },
  "Editable case schema must reject malformed cycles",
);
assertSchemaAccepts(
  editableSimCaseSchema,
  { ...validCasePayload, hiddenCause: "Root cause", dataPoints: [{ label: "Report" }], falseTrails: ["Distraction"], qaStatus: "methodical_review" },
  "Editable case schema must accept a filled case dossier",
);
assertSchemaRejects(
  editableSimCaseSchema,
  { ...validCasePayload, qaStatus: "not-a-real-status" },
  "Editable case schema must reject unknown QA statuses",
);
```

- [ ] **Step 2: Добавить сквозную проверку гейта и персиста паспорта внутри `runAdminStorageAcceptanceChecks`**

Найти (строки 267-269, конец существующего блока проверки `TASK-CYCLE-META`):
```ts
    const persistedCase = contentStorage.getPublicContent(true).cases.find((item) => item.id === "TASK-CYCLE-META");
    const persistedCycle = persistedCase?.cycles[0];
    assertCondition(persistedCycle?.title === "Escalation", "Cycle title must survive persistence");
```

Заменить на:
```ts
    const persistedCase = contentStorage.getPublicContent(true).cases.find((item) => item.id === "TASK-CYCLE-META");
    const persistedCycle = persistedCase?.cycles[0];
    assertCondition(persistedCycle?.title === "Escalation", "Cycle title must survive persistence");

    const { validateCase } = await import("../shared/case-validation");
    const incompleteDossierCase = {
      id: "TASK-030-DOSSIER-INCOMPLETE",
      title: "Dossier gate acceptance",
      description: "Checks the 4 auto-checks gate",
      primaryCompetencies: [],
      secondaryCompetencies: [],
      trigger: { type: "message" as const, source: "Acceptance", text: "Start" },
      zones_affected: [],
      cycles: [{
        id: "TASK-030-DOSSIER-INCOMPLETE-C1",
        cycle: 1,
        situation: "Situation",
        signal: { type: "message" as const, content: "Signal" },
        options: [
          { id: "OPT-1", level: 1, text: "Option one", score: 1, effects: { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 }, competency_scores: {} },
        ],
      }],
      imageAssetId: null,
      imageUrl: null,
      audioAssetId: null,
      audioUrl: null,
      sortOrder: 2,
      isActive: true,
    };
    const gateIssues = validateCase(incompleteDossierCase as Parameters<typeof validateCase>[0]);
    assertCondition(
      gateIssues.some((issue) => issue.check === "diagnostics") && gateIssues.some((issue) => issue.check === "effect_reality"),
      "Case missing dossier and real effects must fail diagnostics and effect_reality checks",
    );

    contentStorage.saveCase({
      id: "TASK-030-DOSSIER-COMPLETE",
      title: "Dossier persistence acceptance",
      description: "Checks case dossier persists end to end",
      primaryCompetencies: [],
      secondaryCompetencies: [],
      trigger: { type: "message", source: "Acceptance", text: "Start" },
      zones_affected: [],
      cycles: [{
        id: "TASK-030-DOSSIER-COMPLETE-C1",
        cycle: 1,
        situation: "Situation",
        signal: { type: "message", content: "Signal" },
        options: [
          { id: "OPT-2", level: 1, text: "Option one", score: 1, effects: { queue: 5, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 }, competency_scores: { planning: 1 } },
        ],
      }],
      businessProblem: "Test business problem",
      hiddenCause: "Root cause",
      dataPoints: [{ label: "Report", costToRequest: null }],
      falseTrails: ["Distraction"],
      qaStatus: "ready_prototype",
      imageAssetId: null,
      audioAssetId: null,
      sortOrder: 3,
      isActive: true,
    });
    const persistedDossierCase = contentStorage.getPublicContent(true).cases.find((item) => item.id === "TASK-030-DOSSIER-COMPLETE");
    assertCondition(persistedDossierCase?.hiddenCause === "Root cause", "Hidden cause must survive persistence");
    assertCondition(persistedDossierCase?.dataPoints?.length === 1, "Data points must survive persistence");
    assertCondition(persistedDossierCase?.falseTrails?.length === 1, "False trails must survive persistence");
    assertCondition(persistedDossierCase?.qaStatus === "ready_prototype", "QA status must survive persistence");
```

- [ ] **Step 3: Финальная верификация всего плана**

Run: `npm run check`
Expected: без ошибок типов по всему проекту.

Run: `npx tsx script/case-validation-parity.ts`
Expected: `case-validation parity checks passed`

Run: `npx tsx script/facet-aggregation-parity.ts`
Expected: `facet-aggregation parity checks passed`

Run: `npm test`
Expected: `CI smoke checks passed`

- [ ] **Step 4: Commit**

```bash
git add script/ci-smoke.ts
git commit -m "test(cases): сквозное покрытие паспорта кейса и гейта автопроверки"
```

---

## Self-Review

**Spec coverage:**
- Паспорт кейса (бизнес-проблема, скрытая причина, данные, ложные следы, QA-статус) → Task 1, 2, 5, 6.
- Подпризнаки `org_control` (planning/task_setting/control), видны раздельно → Task 1 (`facetOfCompetencyId`), 4 (`aggregateFacetAverages` сохраняет значения подпризнаков в результате).
- Свёртка в агрегат простым средним (§5.2) → Task 4, подтверждено worked-example тестом (2/3/4 → 3.0).
- 4 автопроверки (BARS, антигейминг, диагностика, реальность эффектов) → Task 3, гейт на сохранении → Task 7.
- Стоп-фактор как признак компетенции → Task 1 (`isStopFactor`), Task 6 (отдаётся в API). Само
  применение порога θ — вместе с планом дебрифа (осознанно отложено).
- Дебриф → **вне объёма**, отдельный план (см. «Что этот план НЕ делает»).
- НЕ трогать ЗРД → нигде в плане не затронуты `shared/zrd/*`, `zrdSessions`, `zrdMatches`.

**Placeholder scan:** пройден — везде полный код, точные пути и номера строк, точные команды с
ожидаемым выводом; открытых «TODO»/«добавить обработку» нет.

**Type consistency:** `CaseValidationIssue`, `CaseDataPoint`, `CaseQaStatus` объявлены один раз каждый
(Task 2–3) и используются с одинаковыми именами полей во всех задачах, включая Task 7 (`routes.ts`) и
Task 8 (`ci-smoke.ts`). `aggregateFacetAverages`/`getFacetIds` (Task 4) не потребляются другими
задачами этого плана — это осознанно (см. Interfaces Task 4).

## Что дальше после этого плана

Два отдельных плана, оба — после верификации этого:
1. **Дебриф** — требует предварительного согласования концепции (вопросы под конкретные слабые
   компетенции на основе якорей «слабо», личный вывод участника, действие на 7 дней, план мероприятий
   при красном флаге, контур закрепления 7/14/30). Технически будет опираться на
   `aggregateFacetAverages` (Task 4) и `isStopFactor` (Task 1).
2. **UI мастера** — пятый шаг `CaseCreationWizard.tsx` с полями паспорта, BARS-уровень-пикер вместо
   `parseCompetencyScores`/`formatCompetencyScores` в `case-editor-support.ts`, отображение
   `validationIssues` из ответа `POST /api/admin/cases`.
