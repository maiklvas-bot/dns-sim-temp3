# Доведение симуляции «Космонавт» — план исправлений

> **Для исполнителей:** используйте `superpowers:subagent-driven-development` (рекомендуется) или `superpowers:executing-plans`. Шаги помечены чекбоксами для отслеживания.

**Цель:** довести оценку управленческой готовности до состояния, когда её результату можно доверять: убрать искажения в подсчёте, вывести сигнал о провале критичной компетенции к людям, которые принимают решение, и включить в работу уже готовый контент.

**Подход:** сначала бесплатные победы (включить готовое, починить искажения), потом изменения интерфейса, потом контроль качества нового контента, и только в конце — дорогой добор кейсов. Каждая фаза даёт работающий результат сама по себе.

**Технологии:** TypeScript, React 18, Express 5, SQLite (better-sqlite3), Drizzle ORM, Tailwind. Тесты — скрипты `tsx` с `node:assert/strict`, не vitest.

## Общие ограничения

- Проверки проекта: `npm run check`, `npm test`, `npm run test:ui`, `npm run test:ops`. Плюс 10 контрактов `script/*-parity.ts` — запускать вручную, они не в CI.
- Изменения структуры базы — **только миграцией** `migrations/NNNN_*.sql`. Она применяется при старте и не должна терять данные. Скрипты в `script/` в production-образ не попадают.
- Каждый новый контракт обязан быть **проверен на слом**: сломать проверяемое условие, убедиться что тест краснеет, вернуть обратно.
- Цвета — только токены из `client/src/styles/admin.css`. Серый (нулевая насыщенность) запрещён.
- Всплывающие окна — только порталом через `client/src/components/floating-card.tsx`.
- Не удалять существующий контент. Старые кейсы выводятся из показа, но остаются в базе.

---

## Что подтверждено проверкой (основание для плана)

Перепроверено по живой базе и коду 6 августа 2026:

| Находка | Состояние |
|---|---|
| Обновлённые кейсы не используются | 0 из 17 активны, работают 17 старых |
| Два пустых кейса в работе | `CASE-18`, `CASE-19` — активны, 0 вариантов ответа |
| Итоговый балл занижается дважды | `qualityRatio` в `shared/simulation-scoring.ts:65` |
| Сигнал о провале не доходит до отчёта | `findRedFlags` не вызывается ни в `server/`, ни в `client/` |
| Рост очереди ускоряет выдачу | `metric-effects.ts:69`, при том что выдача измеряется в минутах |
| Подсказка автору противоречит расчёту | `case-editor-support.ts:20` обещает рост покупателей при queue+ |
| Журнал решений не хранит номер варианта | `session_answers` содержит только текст и уровень |
| «Принятие решений» никуда не засчитывается | 159 решений, нет в профиле и нет в списке исключений |

---

## Структура файлов

**Меняем:**
- `shared/simulation-scoring.ts` — убрать двойной штраф
- `shared/competency-profile.ts` — судьба «Принятия решений»
- `client/src/features/simulation-engine/scoring/metric-effects.ts` — знак очереди
- `client/src/features/admin/cases/case-editor-support.ts` — подсказка автору
- `shared/case-validation.ts` — правило разброса оценок
- `server/session-storage.ts` — запись номера варианта
- `client/src/components/consequence-modal.tsx` — цена выбора вместо цифр
- `client/src/features/simulation/SimulationWorkspace.tsx` — сетка без панели метрик
- `client/src/pages/results.tsx` + `server/generate_pdf.py` — слова вместо десятых долей

**Создаём:**
- `migrations/0017_answer_option_link.sql` — номер варианта в журнале
- `script/scoring-integrity-parity.ts` — контракт целостности подсчёта
- `script/red-flag-parity.ts` — контракт видимости сигнала тревоги
- `script/effects-direction-parity.ts` — контракт направления показателей
- `script/activate-corrected-cases.ts` — ввод обновлённого комплекта

---

# ФАЗА 0. Разблокировка — включить готовое

**Результат фазы:** кандидаты проходят обновлённый комплект, где оценки различаются по компетенциям, а не копируют номер варианта. Пустые кейсы не попадаются.

**Требует решения заказчика до старта:** ввод обновлённого комплекта меняет живой контент. 15 прошлых прохождений станут несопоставимы с новыми. Нужно явное «да» и решение, как пометить прошлые результаты.

### Задача 0.1: Ввод обновлённого комплекта кейсов

**Файлы:**
- Создать: `script/activate-corrected-cases.ts`
- Создать: `migrations/0017_activate_corrected_cases.sql`

**Интерфейсы:**
- Использует: таблицу `simulation_cases`, поля `id`, `is_active`, `qa_status`
- Даёт: 17 обновлённых кейсов активны, 17 старых выведены из показа

- [ ] **Шаг 1: Написать контракт, который сейчас краснеет**

Создать `script/corrected-activation-parity.ts`:

```typescript
import assert from "node:assert/strict";
import Database from "better-sqlite3";

const db = new Database("data.db", { readonly: true });
const count = (sql: string) => (db.prepare(sql).get() as { c: number }).c;

const fixActive = count("SELECT COUNT(*) c FROM simulation_cases WHERE id LIKE '%-FIX' AND is_active=1");
const fixTotal = count("SELECT COUNT(*) c FROM simulation_cases WHERE id LIKE '%-FIX'");
assert.equal(fixActive, fixTotal, `обновлённых кейсов активно ${fixActive} из ${fixTotal}`);

const oldActive = count("SELECT COUNT(*) c FROM simulation_cases WHERE id NOT LIKE '%-FIX' AND id LIKE 'CASE-%' AND is_active=1");
assert.equal(oldActive, 0, `старых кейсов всё ещё показывается: ${oldActive}`);

// Пустой кейс в показе — кандидат открывает ситуацию без единого варианта ответа.
const emptyActive = count(`
  SELECT COUNT(*) c FROM simulation_cases sc
  WHERE sc.is_active = 1
    AND (SELECT COUNT(*) FROM case_options co JOIN case_cycles cy ON co.cycle_id = cy.id WHERE cy.case_id = sc.id) = 0
`);
assert.equal(emptyActive, 0, `в показе пустых кейсов: ${emptyActive}`);

db.close();
console.log(`corrected-activation parity passed (обновлённых активно ${fixActive}, старых в показе ${oldActive}, пустых ${emptyActive})`);
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Запуск: `npx tsx script/corrected-activation-parity.ts`
Ожидается: FAIL — «обновлённых кейсов активно 0 из 17»

- [ ] **Шаг 3: Написать миграцию**

Создать `migrations/0017_activate_corrected_cases.sql`:

```sql
-- Ввод обновлённого комплекта кейсов.
--
-- В старом комплекте 91% вариантов ответа выставляли одну и ту же оценку
-- всем своим компетенциям — оценка компетенции повторяла номер варианта,
-- а не описывала поведение. В обновлённом комплекте таких вариантов 9%.
--
-- Старые кейсы не удаляются: они остаются в базе для истории прошлых
-- прохождений, но выводятся из показа кандидатам.

UPDATE simulation_cases SET is_active = 1 WHERE id LIKE '%-FIX';
UPDATE simulation_cases SET is_active = 0 WHERE id LIKE 'CASE-%' AND id NOT LIKE '%-FIX';

-- Два кейса без единого варианта ответа: кандидат открывал ситуацию,
-- в которой нечего выбрать.
UPDATE simulation_cases SET is_active = 0 WHERE id IN ('CASE-18', 'CASE-19');
```

- [ ] **Шаг 4: Проверить миграцию на копии базы**

```bash
cp data.db storage/_test-0017.db
npx tsx -e "
import Database from 'better-sqlite3';
import { runMigrations } from './server/migrations';
const db = new Database('storage/_test-0017.db');
const c = (s) => db.prepare(s).get().c;
console.log('ДО: активных обновлённых', c(\"SELECT COUNT(*) c FROM simulation_cases WHERE id LIKE '%-FIX' AND is_active=1\"));
runMigrations(db);
console.log('ПОСЛЕ: активных обновлённых', c(\"SELECT COUNT(*) c FROM simulation_cases WHERE id LIKE '%-FIX' AND is_active=1\"));
console.log('старых в показе', c(\"SELECT COUNT(*) c FROM simulation_cases WHERE id LIKE 'CASE-%' AND id NOT LIKE '%-FIX' AND is_active=1\"));
console.log('вариантов ответа всего', c('SELECT COUNT(*) c FROM case_options'));
console.log('прошлых прохождений', c('SELECT COUNT(*) c FROM session_results'));
db.close();
"
rm -f storage/_test-0017.db
```

Ожидается: ДО 0, ПОСЛЕ 17, старых в показе 0, вариантов 450 (не изменилось), прохождений 14 (не изменилось).

- [ ] **Шаг 5: Применить к рабочей базе и прогнать контракт**

```bash
npx tsx script/migrate-db.ts
npx tsx script/corrected-activation-parity.ts
```

Ожидается: PASS.

- [ ] **Шаг 6: Проверить сборку образа — миграция не должна ломать первичную установку**

```bash
mkdir -p storage/_bt && rm -f storage/_bt/data.db*
SQLITE_PATH=storage/_bt/data.db npx tsx script/migrate-db.ts
SQLITE_PATH=storage/_bt/data.db npx tsx script/seed-simulation-content.ts
echo "код выхода сида: $?"
rm -f storage/_bt/data.db*
```

Ожидается: код выхода 0. Это тот шаг, на котором сборка уже падала однажды.

- [ ] **Шаг 7: Коммит**

```bash
git add migrations/0017_activate_corrected_cases.sql script/corrected-activation-parity.ts
git commit -m "feat(content): в работу вводится обновлённый комплект кейсов

В старом комплекте 91% вариантов ответа выставляли одну оценку всем своим
компетенциям — оценка повторяла номер варианта, а не описывала поведение.
В обновлённом таких вариантов 9%. Комплект был готов и лежал выключенным.

Старые кейсы остаются в базе для истории, но выводятся из показа.
Заодно скрыты два кейса без единого варианта ответа."
```

### Задача 0.2: Пометка несопоставимых прохождений

**Файлы:**
- Создать: `migrations/0018_mark_legacy_results.sql`
- Изменить: `client/src/pages/results.tsx`

**Интерфейсы:**
- Даёт: поле `content_generation` в `session_results` со значениями `legacy` | `current`

- [ ] **Шаг 1: Написать миграцию**

```sql
-- Прохождения, оценённые по старому комплекту, нельзя сравнивать с новыми:
-- там оценка компетенции повторяла номер варианта. Помечаем их, чтобы
-- сравнение кандидатов случайно не смешало две разные системы оценки.

ALTER TABLE session_results ADD COLUMN content_generation TEXT NOT NULL DEFAULT 'current';

UPDATE session_results SET content_generation = 'legacy'
WHERE created_at < (SELECT COALESCE(MAX(applied_at), CURRENT_TIMESTAMP) FROM app_migrations WHERE name LIKE '0017%');
```

- [ ] **Шаг 2: Проверить на копии базы**

```bash
cp data.db storage/_test-0018.db
npx tsx -e "
import Database from 'better-sqlite3';
import { runMigrations } from './server/migrations';
const db = new Database('storage/_test-0018.db');
runMigrations(db);
const rows = db.prepare('SELECT content_generation, COUNT(*) c FROM session_results GROUP BY content_generation').all();
console.log(rows);
db.close();
"
rm -f storage/_test-0018.db
```

Ожидается: все 14 записей помечены `legacy`.

- [ ] **Шаг 3: Показать пометку в интерфейсе**

В `client/src/pages/results.tsx`, рядом с заголовком результата, добавить предупреждение для старых прохождений:

```tsx
{result.contentGeneration === "legacy" && (
  <div className="dns-legacy-notice">
    Это прохождение оценивалось по прежнему комплекту кейсов.
    Сравнивать его с более поздними кандидатами напрямую нельзя.
  </div>
)}
```

Стиль в `client/src/styles/admin.css`, в конец файла:

```css
/* Прохождения по прежнему комплекту: оценка компетенции там повторяла
   номер варианта, поэтому прямое сравнение с новыми вводит в заблуждение. */
.dns-legacy-notice {
  padding: 0.6rem 0.9rem;
  border: 1px solid var(--dns-admin-border);
  border-left: 3px solid hsl(var(--primary));
  border-radius: 0.5rem;
  font-size: 0.83rem;
  color: var(--dns-admin-text-muted);
}
```

- [ ] **Шаг 4: Проверки и коммит**

```bash
npm run check && npm run test:ui
git add migrations/0018_mark_legacy_results.sql client/src/pages/results.tsx client/src/styles/admin.css
git commit -m "feat(results): прохождения по прежнему комплекту помечены как несопоставимые"
```

---

# ФАЗА 1. Целостность подсчёта — чтобы числу можно было верить

**Результат фазы:** итоговый балл остаётся на своей шкале, а провал по критичной компетенции виден тем, кто принимает решение по кандидату.

### Задача 1.1: Убрать двойной штраф в итоговом балле

**Файлы:**
- Изменить: `shared/simulation-scoring.ts:64-75`
- Создать: `script/scoring-integrity-parity.ts`

**Интерфейсы:**
- Использует: `accumulateCompetencyTotals(currentTotals, competencyScores, caseId, sourceType, resolvedScore, settings)`
- Даёт: итоговый балл компетенции в границах исходной шкалы 1..5

- [ ] **Шаг 1: Написать контракт, который сейчас краснеет**

Создать `script/scoring-integrity-parity.ts`:

```typescript
import assert from "node:assert/strict";
import { accumulateCompetencyTotals, buildCompetencyAverageMap } from "../shared/simulation-scoring";

/**
 * Контракт целостности подсчёта.
 *
 * Оценка каждого решения идёт по шкале 1..5. Итоговый балл — среднее по
 * решениям, поэтому он обязан остаться в тех же границах. Если человек
 * везде получил слабую оценку, его итог равен 1, а не 0.2: ниже минимума
 * шкалы опускаться некуда, и порог тревоги 2.0 сравнивается именно с этой шкалой.
 */

// Слабое поведение во всех трёх решениях: оценка 1 из 5 каждый раз.
let totals = {};
for (let i = 0; i < 3; i++) {
  totals = accumulateCompetencyTotals(totals, { planning: 1 }, "CASE-01-FIX", "main_case", 1, null);
}
const weak = buildCompetencyAverageMap(totals);
assert.equal(weak.planning, 1, `три слабых решения должны дать 1, получено ${weak.planning}`);

// Сильное поведение: оценка 5 из 5.
let strongTotals = {};
for (let i = 0; i < 3; i++) {
  strongTotals = accumulateCompetencyTotals(strongTotals, { planning: 5 }, "CASE-01-FIX", "main_case", 5, null);
}
const strong = buildCompetencyAverageMap(strongTotals);
assert.equal(strong.planning, 5, `три сильных решения должны дать 5, получено ${strong.planning}`);

// Смешанное: слабое и сильное дают середину шкалы.
let mixed = {};
mixed = accumulateCompetencyTotals(mixed, { planning: 1 }, "CASE-01-FIX", "main_case", 1, null);
mixed = accumulateCompetencyTotals(mixed, { planning: 5 }, "CASE-01-FIX", "main_case", 5, null);
const mixedAvg = buildCompetencyAverageMap(mixed);
assert.equal(mixedAvg.planning, 3, `слабое и сильное должны дать 3, получено ${mixedAvg.planning}`);

// Ни при каком сочетании итог не уходит за границы шкалы.
for (const level of [1, 3, 5]) {
  let t = {};
  t = accumulateCompetencyTotals(t, { control: level }, "CASE-02-FIX", "main_case", level, null);
  const avg = buildCompetencyAverageMap(t).control;
  assert.ok(avg >= 1 && avg <= 5, `оценка ${level} дала итог ${avg} вне шкалы 1..5`);
}

console.log("scoring-integrity parity passed (итоговый балл остаётся на шкале 1..5)");
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Запуск: `npx tsx script/scoring-integrity-parity.ts`
Ожидается: FAIL — «три слабых решения должны дать 1, получено 0.2»

- [ ] **Шаг 3: Убрать множитель качества**

В `shared/simulation-scoring.ts` заменить тело `accumulateCompetencyTotals`:

```typescript
export function accumulateCompetencyTotals(
  currentTotals: CompetencyTotals,
  competencyScores: Record<string, number> | null | undefined,
  caseId: string,
  sourceType: string | null | undefined,
  resolvedScore: number,
  settings: SimulationScoringSettings | null | undefined,
): CompetencyTotals {
  const weightRatio = getCaseWeightRatio(caseId, sourceType, settings);
  // Оценка компетенции уже описывает силу поведения: слабое размечено единицей,
  // сильное — пятёркой. Домножение на «качество варианта» штрафовало слабый
  // ответ второй раз и уводило итог ниже минимума шкалы — до 0.2 при минимуме 1.
  // Порог тревоги 2.0 сравнивался с величиной, которая шкалой уже не была.
  const nextTotals = { ...currentTotals };

  Object.entries(competencyScores || {}).forEach(([competencyId, rawScore]) => {
    const score = Number(rawScore || 0);
    const current = nextTotals[competencyId] || { total: 0, count: 0 };
    nextTotals[competencyId] = {
      total: current.total + score * weightRatio,
      count: current.count + weightRatio,
    };
  });

  return nextTotals;
}
```

Убрать ставший неиспользуемым параметр нельзя — он часть подписи, вызываемой из движка. Оставить его и пометить в комментарии, либо удалить и поправить все места вызова (проверить `grep -rn "accumulateCompetencyTotals" client/ server/ shared/`).

- [ ] **Шаг 4: Запустить, убедиться что проходит**

```bash
npx tsx script/scoring-integrity-parity.ts
npm run check
```

Ожидается: PASS, типы без ошибок.

- [ ] **Шаг 5: Проверить, как сдвинулись реальные прохождения**

```bash
npx tsx -e "
import Database from 'better-sqlite3';
const db = new Database('data.db', { readonly: true });
const rows = db.prepare('SELECT id, competency_scores_json FROM session_results').all();
let below = 0;
for (const r of rows) {
  const s = JSON.parse(r.competency_scores_json || '{}');
  for (const [k, v] of Object.entries(s)) if (Number(v) > 0 && Number(v) < 1) below++;
}
console.log('оценок ниже минимума шкалы в прошлых прохождениях:', below);
db.close();
"
```

Это диагностика: показывает масштаб искажения в уже сохранённых результатах. Пересчитывать их не нужно — они помечены как несопоставимые в задаче 0.2.

- [ ] **Шаг 6: Проверка на слом**

Временно вернуть `qualityRatio` в формулу, запустить контракт — должен покраснеть. Вернуть исправление.

- [ ] **Шаг 7: Коммит**

```bash
git add shared/simulation-scoring.ts script/scoring-integrity-parity.ts
git commit -m "fix(scoring): итоговый балл больше не занижается ниже минимума шкалы

Оценка компетенции уже описывает силу поведения: слабое — единица, сильное —
пятёрка. Сверх этого итог домножался на «качество варианта», из-за чего слабый
ответ штрафовался дважды и итог падал до 0.2 при минимуме шкалы 1.

Порог тревоги 2.0 сравнивался с величиной, которая шкалой уже не являлась."
```

### Задача 1.2: Вывести сигнал тревоги в отчёт

**Файлы:**
- Изменить: `server/routes.ts` (обработчик выдачи результата)
- Изменить: `client/src/pages/results.tsx`
- Изменить: `server/generate_pdf.py`
- Создать: `script/red-flag-parity.ts`

**Интерфейсы:**
- Использует: `findRedFlags(measured: Record<string, number>)` из `shared/competency-profile.ts` → `Array<{ id: string; score: number }>`
- Даёт: поле `redFlags` в ответе результата и блок предупреждения в отчёте

- [ ] **Шаг 1: Написать контракт**

Создать `script/red-flag-parity.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { findRedFlags, CRITICAL_COMPETENCIES, CRITICAL_THRESHOLD } from "../shared/competency-profile";

/**
 * Контракт видимости сигнала тревоги.
 *
 * Провал по критичной компетенции не закрывается средним по остальным.
 * Логика существует давно, но вызывалась только из служебного скрипта —
 * то есть комиссия о провале не узнавала. Проверяем и саму логику,
 * и то, что она подключена к отчёту.
 */

// Логика: ниже порога — тревога, ровно на пороге — нет.
assert.equal(findRedFlags({ control: CRITICAL_THRESHOLD - 0.1 }).length, 1, "ниже порога тревога обязана сработать");
assert.equal(findRedFlags({ control: CRITICAL_THRESHOLD }).length, 0, "ровно на пороге тревоги нет");
assert.equal(findRedFlags({ flexibility: 0.5 }).length, 0, "некритичная компетенция тревоги не даёт");
assert.equal(CRITICAL_COMPETENCIES.length, 5, "критичных компетенций пять");

const read = (rel: string) => fs.readFileSync(path.resolve(rel), "utf8");

// Подключение: сервер обязан считать тревогу и отдавать её наружу.
const routes = read("server/routes.ts");
assert.ok(routes.includes("findRedFlags("), "сервер не вызывает расчёт тревоги — комиссия её не увидит");

// Отчёт обязан её показывать.
const results = read("client/src/pages/results.tsx");
assert.ok(results.includes("redFlags"), "экран результата не показывает тревогу");

const pdf = read("server/generate_pdf.py");
assert.ok(pdf.includes("red_flags"), "печатный отчёт не показывает тревогу");

console.log(`red-flag parity passed (порог ${CRITICAL_THRESHOLD}, критичных ${CRITICAL_COMPETENCIES.length}, подключено к отчёту)`);
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Запуск: `npx tsx script/red-flag-parity.ts`
Ожидается: FAIL — «сервер не вызывает расчёт тревоги»

- [ ] **Шаг 3: Подключить на сервере**

В `server/routes.ts`, в обработчике выдачи результата (`/api/staff/results/:id`), после получения результата добавить расчёт:

```typescript
import { findRedFlags } from "@shared/competency-profile";

// … внутри обработчика, после того как получен result:
const measured = JSON.parse(result.competencyScoresJson || "{}") as Record<string, number>;
const redFlags = findRedFlags(measured);
res.json({ ...result, redFlags });
```

- [ ] **Шаг 4: Показать на экране результата**

В `client/src/pages/results.tsx`, перед блоком компетенций:

```tsx
{(data.redFlags?.length ?? 0) > 0 && (
  <section className="dns-red-flags">
    <h3 className="dns-red-flags-title">Требует отдельного разговора</h3>
    <p className="dns-red-flags-lede">
      По этим компетенциям результат ниже порога готовности. Сильные стороны
      в других областях этого не компенсируют: работа руководителя упрётся
      именно сюда.
    </p>
    <ul className="dns-red-flags-list">
      {data.redFlags.map((flag) => (
        <li key={flag.id}>
          <strong>{competencyNameById(flag.id)}</strong>
          <span>{flag.score.toFixed(1)} при пороге 2,0</span>
        </li>
      ))}
    </ul>
  </section>
)}
```

Стиль в конец `client/src/styles/admin.css`:

```css
/* Провал по критичной компетенции. Красный здесь оправдан: это одна из
   немногих ситуаций, где цвет обязан остановить читателя. */
.dns-red-flags {
  padding: 1rem 1.15rem;
  border: 1px solid rgba(255, 153, 153, 0.4);
  border-left: 3px solid var(--dns-admin-accent-danger);
  border-radius: 0.6rem;
  background: rgba(255, 153, 153, 0.08);
}
.dns-red-flags-title {
  margin: 0 0 0.35rem;
  font-size: 0.95rem;
  font-weight: 700;
  color: var(--dns-admin-accent-danger);
}
.dns-red-flags-lede {
  margin: 0 0 0.6rem;
  font-size: 0.85rem;
  color: var(--dns-admin-text-muted);
}
.dns-red-flags-list {
  display: flex;
  flex-direction: column;
  gap: 0.3rem;
  margin: 0;
  padding: 0;
  list-style: none;
}
.dns-red-flags-list li {
  display: flex;
  justify-content: space-between;
  gap: 0.75rem;
  font-size: 0.86rem;
  color: var(--dns-admin-text-soft);
}
```

- [ ] **Шаг 5: Показать в печатном отчёте**

В `server/generate_pdf.py` добавить блок перед таблицей компетенций (взять `red_flags` из входных данных, отрисовать заголовком и списком тем же красным, что используется для критичных отклонений).

- [ ] **Шаг 6: Проверить на реальных прохождениях**

```bash
npx tsx -e "
import Database from 'better-sqlite3';
import { findRedFlags } from './shared/competency-profile';
const db = new Database('data.db', { readonly: true });
const rows = db.prepare('SELECT id, competency_scores_json FROM session_results').all();
let withFlags = 0;
for (const r of rows) {
  const flags = findRedFlags(JSON.parse(r.competency_scores_json || '{}'));
  if (flags.length) { withFlags++; console.log('прохождение', r.id, '→', flags.map(f => f.id + ' ' + f.score.toFixed(1)).join(', ')); }
}
console.log('всего с тревогой:', withFlags, 'из', rows.length);
db.close();
"
```

- [ ] **Шаг 7: Контракт, проверки, коммит**

```bash
npx tsx script/red-flag-parity.ts
npm run check && npm test && npm run test:ui
git add server/routes.ts client/src/pages/results.tsx client/src/styles/admin.css server/generate_pdf.py script/red-flag-parity.ts
git commit -m "feat(results): провал по критичной компетенции виден в отчёте

Логика тревоги существовала, но вызывалась только из служебного скрипта.
Комиссия о провале не узнавала: в отчёте его не было ни на экране, ни в печати."
```

### Задача 1.3: Решить судьбу «Принятия решений»

**Файлы:**
- Изменить: `shared/competency-profile.ts`
- Изменить: `script/competency-profile-parity.ts`

**Требует решения методиста:** компетенция набрала 159 решений, но не входит ни в профиль выпускника, ни в список исключений. Два варианта: включить в пункт 7 «Системность мышления» (близко по смыслу, и тогда у пункта появляются данные вместо нуля) либо явно вынести за скобки.

**Рекомендация:** включить в «Системность мышления» как второе измерение. Пункт сейчас имеет ноль наблюдений, а «Принятие решений» — 159; смысловое пересечение есть (обоснованность выбора), и это единственный способ дать пункту данные без написания новых кейсов.

- [ ] **Шаг 1: Ужесточить контракт профиля**

В `script/competency-profile-parity.ts` добавить:

```typescript
// Каждая компетенция справочника обязана иметь адрес: либо она входит в
// пункт профиля, либо явно объявлена вне профиля. Молчаливый пропуск
// означает, что данные копятся и никуда не попадают.
import { OUT_OF_PROFILE_COMPETENCIES } from "../shared/competency-profile";

const addressed = new Set<string>([
  ...PROFILE_COMPETENCIES.flatMap((item) => item.measuredBy),
  ...OUT_OF_PROFILE_COMPETENCIES,
]);

for (const row of competencies) {
  assert.ok(
    addressed.has(row.id),
    `компетенция «${row.name}» измеряется, но никуда не засчитывается: нет ни в одном пункте профиля и не объявлена вне профиля`,
  );
}
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Запуск: `npx tsx script/competency-profile-parity.ts`
Ожидается: FAIL — «компетенция „Принятие решений" измеряется, но никуда не засчитывается»

- [ ] **Шаг 3: Внести решение**

В `shared/competency-profile.ts`, пункт 7:

```typescript
  {
    id: "systems_thinking",
    number: 7,
    name: "Системность мышления",
    block: "skills",
    // «Принятие решений» — про обоснованность выбора под давлением, и это
    // ближайшее к системности из того, что кейсы уже измеряют (159 решений).
    // Без него пункт профиля остаётся с нулём наблюдений.
    measuredBy: ["systems_thinking", "decision_making"],
  },
```

- [ ] **Шаг 4: Проверить и закоммитить**

```bash
npx tsx script/competency-profile-parity.ts
npm run check
git add shared/competency-profile.ts script/competency-profile-parity.ts
git commit -m "fix(profile): «Принятие решений» больше не пропадает из отчёта

159 решений копились впустую: компетенция не входила ни в один пункт профиля
и не была объявлена вне профиля. Контракт теперь требует адрес для каждой."
```

---

# ФАЗА 2. Показатели магазина — убрать искажения и дать объяснение

**Результат фазы:** кандидат после решения читает, чем именно он заплатил, вместо случайной фразы. Ни один показатель не хвалит слабое решение.

### Задача 2.1: Исправить направление показателя очереди

**Файлы:**
- Изменить: `client/src/features/simulation-engine/scoring/metric-effects.ts:69`
- Изменить: `client/src/features/admin/cases/case-editor-support.ts:20`
- Создать: `script/effects-direction-parity.ts`

**Подтверждённая проблема:** скорость выдачи измеряется в минутах (`${m.pickupSpeed} мин`, зелёный при ≤10 — то есть меньше значит лучше). Формула `effects.queue * -0.35` при росте очереди минуты **уменьшает**, то есть рисует ускорение выдачи. Все остальные показатели при росте очереди ухудшаются. Отдельно: подсказка автору обещает, что рост очереди усилит поток покупателей, а формула покупателей уменьшает.

- [ ] **Шаг 1: Написать контракт**

Создать `script/effects-direction-parity.ts`:

```typescript
import assert from "node:assert/strict";
import { applyMetricEffects } from "../client/src/features/simulation-engine/scoring/metric-effects";

/**
 * Контракт направления показателей.
 *
 * Рост очереди — это ухудшение обстановки. Он обязан ухудшать все связанные
 * показатели одинаково. Скорость выдачи измеряется в минутах ожидания:
 * меньше минут значит лучше, поэтому при росте очереди минут должно
 * становиться больше, а не меньше.
 */

const base = {
  customersInStore: 18, avgCheck: 7200, conversion: 48, nps: 4.5,
  pickupSpeed: 12, warehouseLoad: 40, teamMorale: 7, dailyRevenue: 1500,
};
const noEffect = { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 };

const worse = applyMetricEffects(base, { ...noEffect, queue: 8 }, "medium", null);
const better = applyMetricEffects(base, { ...noEffect, queue: -8 }, "medium", null);

assert.ok(worse.customersInStore < base.customersInStore, "рост очереди обязан уменьшать число покупателей");
assert.ok(worse.conversion < base.conversion, "рост очереди обязан снижать конверсию");
assert.ok(worse.teamMorale < base.teamMorale, "рост очереди обязан ухудшать настроение команды");
assert.ok(
  worse.pickupSpeed > base.pickupSpeed,
  `рост очереди обязан увеличивать время ожидания на выдаче, получено ${worse.pickupSpeed} против ${base.pickupSpeed}`,
);

assert.ok(better.pickupSpeed < base.pickupSpeed, "падение очереди обязано сокращать время ожидания");
assert.ok(better.conversion > base.conversion, "падение очереди обязано повышать конверсию");

console.log("effects-direction parity passed (рост очереди ухудшает все связанные показатели)");
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Запуск: `npx tsx script/effects-direction-parity.ts`
Ожидается: FAIL — «рост очереди обязан увеличивать время ожидания на выдаче, получено 9 против 12»

- [ ] **Шаг 3: Исправить знак**

В `client/src/features/simulation-engine/scoring/metric-effects.ts` строка 69:

```typescript
  // Скорость выдачи измеряется в минутах ожидания: меньше значит лучше.
  // Рост очереди обязан эти минуты увеличивать. Прежний знак делал обратное —
  // и слабый ответ, наращивающий очередь, получал зелёную строку «выдача
  // ускорилась» в окне последствий.
  const nextPickupSpeed = Math.round(metrics.pickupSpeed + effects.queue * 0.35 * weights.pickupSpeed + effects.delivery_status * -0.12 * weights.pickupSpeed);
```

- [ ] **Шаг 4: Исправить подсказку автору кейса**

В `client/src/features/admin/cases/case-editor-support.ts` строка 20:

```typescript
  { key: "queue", label: "Торг. зал / очередь", zone: "Торг. зал", metric: "Очередь и поток", helper: "Положительное значение наращивает очередь: покупателей в зале меньше, конверсия ниже, выдача дольше. Отрицательное — очередь тает." },
```

- [ ] **Шаг 5: Проверить масштаб на реальных данных**

```bash
npx tsx -e "
import Database from 'better-sqlite3';
const db = new Database('data.db', { readonly: true });
const rows = db.prepare('SELECT COUNT(*) c FROM case_options WHERE effect_queue > 0').get();
console.log('вариантов, наращивающих очередь:', rows.c);
console.log('они больше не будут получать похвалу за скорость выдачи');
db.close();
"
```

- [ ] **Шаг 6: Контракт, проверка на слом, коммит**

Вернуть прежний знак, убедиться что контракт краснеет, вернуть исправление.

```bash
npx tsx script/effects-direction-parity.ts
npm run check && npm run test:ui
git add client/src/features/simulation-engine/scoring/metric-effects.ts client/src/features/admin/cases/case-editor-support.ts script/effects-direction-parity.ts
git commit -m "fix(metrics): рост очереди больше не ускоряет выдачу

Скорость выдачи измеряется в минутах ожидания: меньше значит лучше. Прежний
знак при росте очереди эти минуты сокращал, и слабый ответ получал зелёную
строку «выдача ускорилась». Подсказка автору кейса обещала обратное тому,
что делает расчёт — исправлена вслед за формулой."
```

### Задача 2.2: Связать журнал решений с вариантом ответа

**Файлы:**
- Создать: `migrations/0019_answer_option_link.sql`
- Изменить: `shared/schema.ts` (описание `sessionAnswers`)
- Изменить: `server/session-storage.ts` (запись ответа)
- Изменить: `client/src/features/simulation-engine/SimulationProviderRuntime.tsx` (передача номера варианта)

**Зачем:** журнал хранит текст варианта, но не его номер. Из-за этого нельзя достать авторское пояснение «Цена выбора», привязанное к конкретному варианту. Это блокирует и задачу 2.3, и разбор после прохождения.

**Интерфейсы:**
- Даёт: поле `option_id` в `session_answers`, заполняется при записи ответа

- [ ] **Шаг 1: Написать миграцию**

```sql
-- Журнал решений хранил текст варианта, но не его номер, поэтому достать
-- авторское пояснение «чем вы платите» было не от чего. Поле необязательное:
-- у прошлых прохождений его нет и не будет.

ALTER TABLE session_answers ADD COLUMN option_id TEXT;
CREATE INDEX IF NOT EXISTS session_answers_option_idx ON session_answers (option_id);
```

- [ ] **Шаг 2: Описать поле в схеме**

В `shared/schema.ts`, в `sessionAnswers`, после `optionText`:

```typescript
  // Номер варианта. Нужен, чтобы достать авторское пояснение «Цена выбора»
  // и разбирать конкретный ход после прохождения. У прошлых записей пусто.
  optionId: text("option_id"),
```

- [ ] **Шаг 3: Написать контракт**

Создать `script/answer-option-link-parity.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";

const read = (rel: string) => fs.readFileSync(path.resolve(rel), "utf8");

// Поле существует в базе.
const db = new Database("data.db", { readonly: true });
const columns = (db.prepare("PRAGMA table_info(session_answers)").all() as Array<{ name: string }>).map((c) => c.name);
assert.ok(columns.includes("option_id"), "в журнале решений нет номера варианта");
db.close();

// И заполняется при записи, а не остаётся мёртвым.
const storage = read("server/session-storage.ts");
assert.ok(storage.includes("optionId"), "запись ответа не сохраняет номер варианта");

console.log("answer-option-link parity passed (журнал решений связан с вариантом ответа)");
```

- [ ] **Шаг 4: Сохранять номер при записи ответа**

Запись ответа (`server/session-storage.ts:72`) устроена как сквозная передача:

```typescript
return db.insert(sessionAnswers).values(input).returning().get();
```

Отдельного перечисления полей нет, поэтому после расширения схемы из шага 2 поле сохранится само — но только если оно дойдёт от клиента и переживёт проверку входных данных.

Проверить схему проверки в `server/middleware/validation.ts`: найти схему тела запроса на запись ответа и добавить `optionId: z.string().max(120).optional()`. Без этого поле будет отброшено ещё до записи.

В `client/src/features/simulation-engine/SimulationProviderRuntime.tsx` при отправке ответа добавить `optionId: option.id` в тело запроса — для всех четырёх источников. Точки отправки соответствуют местам, где уже вызывается пересчёт метрик: строки около 1721 (основной кейс), 2004 (почта), 2088 (мессенджер), 2181 (видео).

- [ ] **Шаг 5: Проверить сквозным прогоном**

Запустить приложение, пройти один кейс, проверить:

```bash
npx tsx -e "
import Database from 'better-sqlite3';
const db = new Database('data.db', { readonly: true });
const row = db.prepare('SELECT option_id, option_text FROM session_answers ORDER BY id DESC LIMIT 1').get();
console.log('последний ответ:', row);
db.close();
"
```

Ожидается: `option_id` заполнен.

- [ ] **Шаг 6: Проверки и коммит**

```bash
npx tsx script/answer-option-link-parity.ts
npm run check && npm test
git add migrations/0019_answer_option_link.sql shared/schema.ts server/session-storage.ts client/src/features/simulation-engine/SimulationProviderRuntime.tsx script/answer-option-link-parity.ts
git commit -m "feat(journal): журнал решений связан с вариантом ответа

Хранился только текст варианта, поэтому авторское пояснение «Цена выбора»
достать было не от чего. Это блокировало и показ цены кандидату, и разбор
конкретного хода после прохождения."
```

### Задача 2.3: Показать цену выбора вместо случайной фразы

**Файлы:**
- Изменить: `client/src/components/consequence-modal.tsx`
- Изменить: `client/src/features/simulation/SimulationWorkspace.tsx:115`
- Изменить: `client/src/data/consequences.ts`

**Подтверждённая проблема:** пояснение после решения выбирается случайно из 48 универсальных фраз (`pickRandom` в `consequences.ts:169`), одинаковых для любого решения в любом кейсе. Настоящее авторское пояснение заполнено у всех 225 вариантов обновлённого комплекта, доходит до браузера, но показывается только автору в редакторе.

**Требует решения заказчика:** убирается ли живая панель показателей с экрана прохождения. Это заметное изменение впечатления от продукта. Рекомендация — убрать: на обновлённом комплекте панель повторяет то, что видно по компетенциям, в 88% случаев, а сама «приборность» вводила в заблуждение.

- [ ] **Шаг 1: Написать контракт**

Создать `script/consequence-explanation-parity.ts`:

```typescript
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { contentStorage } from "../server/content-storage";

const read = (rel: string) => fs.readFileSync(path.resolve(rel), "utf8");

// Окно последствий показывает авторское пояснение, а не случайную фразу.
const modal = read("client/src/components/consequence-modal.tsx");
assert.ok(modal.includes("comment"), "окно последствий не показывает авторское пояснение");

// Случайный выбор фразы больше не используется для объяснения решения.
const consequences = read("client/src/data/consequences.ts");
assert.ok(
  !consequences.includes("pickRandom(getExplanationPool"),
  "объяснение решения по-прежнему выбирается случайно",
);

// У активных кейсов пояснение действительно заполнено — иначе показывать нечего.
const cases = contentStorage.getPublicContent(false).cases as Array<{ cycles: Array<{ options: Array<{ comment?: string }> }> }>;
let total = 0;
let filled = 0;
for (const c of cases) for (const cy of c.cycles) for (const o of cy.options) {
  total++;
  if ((o.comment || "").trim().length > 20) filled++;
}
assert.ok(total > 0, "активных вариантов ответа нет");
assert.equal(filled, total, `пояснение заполнено у ${filled} из ${total} активных вариантов`);

console.log(`consequence-explanation parity passed (пояснение у ${filled} из ${total} вариантов)`);
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Запуск: `npx tsx script/consequence-explanation-parity.ts`
Ожидается: FAIL — «окно последствий не показывает авторское пояснение»

- [ ] **Шаг 3: Переписать окно последствий**

В `client/src/components/consequence-modal.tsx` заменить список числовых изменений на авторский текст:

```tsx
export function ConsequenceModal({ open, comment, onClose }: ConsequenceModalProps) {
  // Без авторского пояснения показывать нечего: случайная фраза из общего
  // набора не относилась к принятому решению и мешала разбору.
  if (!open || !comment?.trim()) return null;

  return (
    <div className="dns-consequence-overlay" role="dialog" aria-modal="true" aria-labelledby="consequence-title">
      <div className="dns-consequence-card">
        <h3 id="consequence-title" className="dns-consequence-title">Цена выбора</h3>
        <p className="dns-consequence-text">{comment}</p>
        <button type="button" className="dns-consequence-close" onClick={onClose} autoFocus>
          Дальше
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Шаг 4: Убрать колонку показателей из сетки прохождения**

В `client/src/features/simulation/SimulationWorkspace.tsx:115` заменить сетку:

```tsx
// Было четыре колонки: рельса, карта зон, сигналы, панель показателей.
// Панель показателей повторяла то, что видно по компетенциям, в 88% случаев,
// и занимала около 40% ширины экрана. Расчёт показателей остался — он нужен
// итоговому отчёту, — но кандидат во время прохождения думает о ситуации,
// а не следит за приборами.
const panelGridClass = "xl:grid-cols-[76px_minmax(200px,0.85fr)_minmax(0,2.6fr)]";
```

- [ ] **Шаг 5: Убрать случайные фразы**

В `client/src/data/consequences.ts` удалить `pickRandom(getExplanationPool(...))` из построения записи; словарь из 48 фраз и сам `getExplanationPool` удалить, если больше нигде не используются (`grep -rn "getExplanationPool" client/`).

- [ ] **Шаг 6: Проверить в браузере**

Запустить приложение, пройти один кейс. Проверить: после выбора появляется окно с авторским текстом, панели показателей на экране нет, горизонтального скролла нет, окно закрывается по кнопке и по Esc.

- [ ] **Шаг 7: Контракт, проверки, коммит**

```bash
npx tsx script/consequence-explanation-parity.ts
npm run check && npm run test:ui && npm test
git add client/src/components/consequence-modal.tsx client/src/features/simulation/SimulationWorkspace.tsx client/src/data/consequences.ts script/consequence-explanation-parity.ts
git commit -m "feat(simulation): после решения показывается его цена, а не случайная фраза

Пояснение выбиралось случайно из 48 универсальных фраз, одинаковых для любого
решения в любом кейсе. Авторский текст «чем вы платите» был написан у всех
225 вариантов обновлённого комплекта и доходил до браузера, но показывался
только автору в редакторе.

Живая панель показателей убрана с экрана прохождения: на обновлённом комплекте
она повторяла оценку по компетенциям в 88% случаев. Расчёт показателей
сохранён — он нужен итоговому отчёту."
```

### Задача 2.4: Показать результат словами, а не десятыми долями

**Файлы:**
- Изменить: `client/src/lib/report-data.tsx`
- Изменить: `client/src/pages/results.tsx`
- Изменить: `server/generate_pdf.py`

**Обоснование:** различимость оценки — три уровня, а отчёт печатает десятую долю и тут же сам сворачивает её в четыре словесных ведра. Десятую на разборе защитить нечем.

- [ ] **Шаг 1: Добавить словесный уровень**

В `client/src/lib/report-data.tsx`:

```tsx
/**
 * Оценка различима по трём уровням поведения, а не по десятым долям.
 * Отчёт говорит теми же словами, что и разметка кейса, — тогда на разборе
 * можно процитировать формулировку уровня, а не защищать цифру.
 */
export function competencyLevelLabel(score: number | null): string {
  if (score === null) return "не измерялось";
  if (score >= 4) return "сильно";
  if (score >= 2.5) return "средне";
  return "слабо";
}

/** Сколько решений пришлось на каждый уровень — это и есть содержание разбора. */
export function competencyLevelBreakdown(scores: number[]): { weak: number; mid: number; strong: number } {
  return {
    weak: scores.filter((s) => s < 2.5).length,
    mid: scores.filter((s) => s >= 2.5 && s < 4).length,
    strong: scores.filter((s) => s >= 4).length,
  };
}
```

- [ ] **Шаг 2: Заменить вывод на экране**

В `client/src/pages/results.tsx` заменить `avg.toFixed(1)` на `competencyLevelLabel(avg)`, а рядом показать разбивку: «слабо 2 · средне 3 · сильно 1».

- [ ] **Шаг 3: Заменить в печатном отчёте**

В `server/generate_pdf.py` в таблице компетенций убрать колонку с `{score:.1f}`, оставить словесный уровень и разбивку по числу решений.

- [ ] **Шаг 4: Ограничить план развития**

В `server/generate_pdf.py` блок плана развития строится для всех компетенций с `0 < score < 5.0`, из-за чего план выписывается почти по всему профилю. Ограничить порогом «ниже сильного»:

```python
# План развития нужен там, где поведение слабое или формальное. Прежнее
# условие включало в план почти весь профиль, и он переставал быть планом.
development_items = [c for c in competencies if 0 < c["score"] < 4.0]
```

- [ ] **Шаг 5: Проверки и коммит**

```bash
npm run check && npm run test:ui
git add client/src/lib/report-data.tsx client/src/pages/results.tsx server/generate_pdf.py
git commit -m "feat(report): результат называется словами уровня, а не десятой долей

Различимость оценки — три уровня. Отчёт печатал десятую долю и тут же сам
сворачивал её в словесные ведра; на разборе с кандидатом десятую защитить
нечем. Заодно план развития перестал включать почти весь профиль."
```

---

# ФАЗА 3. Качество будущего контента

**Результат фазы:** ошибку «одна оценка на все компетенции» нельзя внести заново — редактор не даст сохранить.

### Задача 3.1: Правило разброса оценок внутри варианта

**Файлы:**
- Изменить: `shared/case-validation.ts`
- Изменить: `script/case-validation-parity.ts`

**Обоснование:** в старом комплекте 91% вариантов выставляли одинаковую оценку всем своим компетенциям. Ограничивать число компетенций не нужно (в обновлённом комплекте их ровно 4, это нормально) — нужно требовать, чтобы вариант, претендующий на несколько компетенций, различал их.

**Как устроены проверки:** `validateCase(caseInput: SimCase)` в `shared/case-validation.ts:184` собирает результат из отдельных проверок — `checkBarsConformance`, `checkAntigaming`, `checkDiagnostics`, `checkEffectReality`. Каждая принимает кейс целиком и возвращает `CaseValidationIssue[]`. Новая проверка добавляется тем же образом.

- [ ] **Шаг 1: Написать контракт**

В `script/case-validation-parity.ts` добавить:

```typescript
import { validateCase } from "../shared/case-validation";

/** Кейс с одним циклом — минимальная заготовка для проверки правила. */
function caseWithOptions(options: Array<{ level: number; scores: Record<string, number> }>) {
  return {
    id: "TEST-SPREAD",
    title: "Проверочный кейс",
    situation: "Ситуация для проверки правила разброса оценок.",
    cycles: [{
      id: "TEST-SPREAD__cycle_1",
      cycle: 1,
      options: options.map((o, index) => ({
        id: `TEST-SPREAD__cycle_1__option_${index + 1}`,
        level: o.level,
        score: o.level,
        text: `Вариант уровня ${o.level} с достаточно длинным текстом для проверки.`,
        comment: "Пояснение о том, чем приходится платить за этот выбор.",
        competency_scores: o.scores,
        effects: { queue: 1, conversion: -1, morale: 0, revenue_impact: 0, delivery_status: 0 },
      })),
    }],
  } as never;
}

// Оценка оптом: все компетенции варианта получили одно и то же число.
const flatIssues = validateCase(caseWithOptions([
  { level: 5, scores: { planning: 5, control: 5, communication: 5, delegation: 5 } },
  { level: 3, scores: { planning: 3, control: 1, communication: 5, delegation: 3 } },
]));
assert.ok(
  flatIssues.some((i) => i.check === "score_spread"),
  "вариант с одинаковой оценкой по четырём компетенциям обязан не пройти проверку",
);

// Различающиеся оценки — норма: сильное планирование при слабой коммуникации
// это осмысленное описание поведения.
const spreadIssues = validateCase(caseWithOptions([
  { level: 5, scores: { planning: 5, control: 5, communication: 1, delegation: 1 } },
  { level: 3, scores: { planning: 3, control: 1, communication: 5, delegation: 3 } },
]));
assert.ok(
  !spreadIssues.some((i) => i.check === "score_spread"),
  "вариант с различающимися оценками обязан проходить проверку",
);

// Две компетенции — правило не применяется: там совпадение может быть осмысленным.
const twoIssues = validateCase(caseWithOptions([
  { level: 5, scores: { planning: 3, control: 3 } },
  { level: 1, scores: { planning: 1, control: 3 } },
]));
assert.ok(
  !twoIssues.some((i) => i.check === "score_spread"),
  "правило разброса не должно применяться к двум компетенциям",
);
```

- [ ] **Шаг 2: Запустить, убедиться что падает**

Запуск: `npx tsx script/case-validation-parity.ts`
Ожидается: FAIL — «вариант с одинаковой оценкой по четырём компетенциям обязан не пройти проверку»

- [ ] **Шаг 3: Добавить правило**

В `shared/case-validation.ts`, рядом с `checkAntigaming`:

```typescript
/**
 * Оценка оптом: вариант выставляет одну и ту же оценку всем своим
 * компетенциям. Тогда оценка компетенции ничего не говорит о компетенции —
 * она повторяет, какой это по счёту вариант в ряду от слабого к сильному.
 *
 * Порог в три компетенции не случаен: у двух совпадение может быть
 * осмысленным, а начиная с трёх это признак того, что автор не различал,
 * что именно вариант показывает по каждой.
 */
const SCORE_SPREAD_MIN_COMPETENCIES = 3;

export function checkScoreSpread(caseInput: SimCase): CaseValidationIssue[] {
  const issues: CaseValidationIssue[] = [];

  for (const cycle of caseInput.cycles || []) {
    for (const option of cycle.options || []) {
      const scores = Object.values(option.competency_scores || {})
        .map(Number)
        .filter((n) => n > 0);
      if (scores.length < SCORE_SPREAD_MIN_COMPETENCIES) continue;
      if (Math.max(...scores) > Math.min(...scores)) continue;

      issues.push({
        check: "score_spread",
        severity: "error",
        scope: `Цикл ${cycle.cycle} · вариант ${option.level}`,
        cycleId: cycle.id,
        optionId: option.id,
        message: `Все ${scores.length} компетенций получили одинаковую оценку ${scores[0]}. `
          + "Решение, сильное в одном, обычно чем-то жертвует в другом: "
          + "поставьте разные уровни или уберите лишние компетенции.",
      });
    }
  }

  return issues;
}
```

Подключить в `validateCase`:

```typescript
export function validateCase(caseInput: SimCase): CaseValidationIssue[] {
  return [
    ...checkBarsConformance(caseInput),
    ...checkAntigaming(caseInput),
    ...checkScoreSpread(caseInput),
    ...checkDiagnostics(caseInput),
    ...checkEffectReality(caseInput),
  ];
}
```

Поля `cycleId` и `optionId` в замечании обязательны: без них принятие замечания автором действует на весь кейс, а не на конкретный вариант — эта ошибка уже допускалась раньше и описана в комментарии к `isIssueAccepted`.

- [ ] **Шаг 4: Проверить обновлённый комплект на соответствие**

```bash
npx tsx -e "
import { contentStorage } from './server/content-storage';
const cases = contentStorage.getPublicContent(true).cases;
let flat = 0, total = 0;
for (const c of cases) {
  if (!c.id.endsWith('-FIX')) continue;
  for (const cy of c.cycles) for (const o of cy.options) {
    const s = Object.values(o.competency_scores || {}).map(Number).filter(n => n > 0);
    if (s.length < 3) continue;
    total++;
    if (Math.max(...s) === Math.min(...s)) flat++;
  }
}
console.log('в обновлённом комплекте нарушают правило:', flat, 'из', total);
"
```

Ожидается: около 9% — это те 20 вариантов из 225, которые уже известны. Их нужно передать методисту на доработку, но они не блокируют ввод правила: правило применяется при сохранении кейса, то есть к новому и редактируемому контенту.

- [ ] **Шаг 5: Проверки и коммит**

```bash
npx tsx script/case-validation-parity.ts
npm run check && npm test
git add shared/case-validation.ts script/case-validation-parity.ts
git commit -m "feat(validation): вариант не может выставить одну оценку всем компетенциям

В прежнем комплекте так было у 91% вариантов: оценка компетенции повторяла
номер варианта, а не описывала поведение. Правило применяется от трёх
компетенций — у двух совпадение может быть осмысленным."
```

### Задача 3.2: Подключить контракты к сборке

**Файлы:**
- Изменить: `package.json`
- Изменить: `.github/workflows/ci.yml`

**Обоснование:** в проекте 10 контрактов, ни один не запускается автоматически. После этой фазы их станет 15, и без автозапуска они будут гнить.

- [ ] **Шаг 1: Добавить команду**

В `package.json`:

```json
    "test:contracts": "tsx script/run-all-parity.ts",
```

Создать `script/run-all-parity.ts`:

```typescript
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

/**
 * Прогон всех контрактов. Они проверяют договорённости, которые нельзя
 * выразить типами: что правило подключено, что цифра осталась на шкале,
 * что обещание в интерфейсе совпадает с расчётом.
 */
const dir = path.resolve("script");
const files = fs.readdirSync(dir).filter((f) => f.endsWith("-parity.ts")).sort();

let failed = 0;
for (const file of files) {
  process.stdout.write(file.padEnd(44));
  try {
    execFileSync("npx", ["tsx", path.join(dir, file)], { stdio: "pipe" });
    console.log("OK");
  } catch (error) {
    console.log("ПРОВАЛ");
    console.log(String((error as { stdout?: Buffer }).stdout || "").slice(-600));
    failed++;
  }
}

console.log(`\nконтрактов: ${files.length}, провалов: ${failed}`);
if (failed > 0) process.exit(1);
```

- [ ] **Шаг 2: Запустить локально**

```bash
npm run test:contracts
```

Ожидается: все контракты OK.

- [ ] **Шаг 3: Подключить к сборке**

В `.github/workflows/ci.yml` после шага `Test`:

```yaml
      - name: Verify contracts
        run: npm run test:contracts
```

- [ ] **Шаг 4: Коммит**

```bash
git add package.json script/run-all-parity.ts .github/workflows/ci.yml
git commit -m "ci: контракты проекта запускаются автоматически

15 контрактов проверяли договорённости, которые нельзя выразить типами,
и ни один не запускался без ручного вызова."
```

---

# ФАЗА 4. Аналитика — что показывать комиссии

**Результат фазы:** отчёт честно говорит, по чему можно судить, а по чему данных мало.

### Задача 4.1: Показать надёжность оценки

**Файлы:**
- Изменить: `shared/competency-profile.ts`
- Изменить: `client/src/pages/results.tsx`

**Обоснование:** «Ориентация на результат» проверяется в 3 кейсах, «Контроль» и «Ответственность» — в 5. Это три из пяти критичных компетенций. Сигнал тревоги по ним сейчас выглядит так же уверенно, как по «Коммуникации» с её 11 кейсами. Комиссия должна видеть разницу.

- [ ] **Шаг 1: Добавить расчёт охвата**

В `shared/competency-profile.ts`:

```typescript
/**
 * Порог, ниже которого оценка компетенции — повод для разговора,
 * а не основание для решения. Уверенно отделить кандидата на грани
 * от прошедшего можно примерно с восьми разных ситуаций: меньше —
 * и разброс перекрывает разницу между ними.
 */
export const RELIABLE_CASE_COUNT = 8;

export function assessReliability(caseCount: number): "reliable" | "thin" {
  return caseCount >= RELIABLE_CASE_COUNT ? "reliable" : "thin";
}
```

- [ ] **Шаг 2: Показать в отчёте**

Рядом с компетенциями, у которых охват тонкий, показывать пометку: «данных мало: N ситуаций». Для тревоги по такой компетенции добавить строку: «повод для разговора, не основание для отказа».

- [ ] **Шаг 3: Проверки и коммит**

```bash
npm run check && npm run test:ui
git add shared/competency-profile.ts client/src/pages/results.tsx
git commit -m "feat(report): видно, где данных мало для уверенного вывода

Три из пяти критичных компетенций проверяются в 3-5 ситуациях. Тревога по
ним выглядела так же уверенно, как по компетенции с одиннадцатью."
```

---

# ФАЗА 5. Контент — закрыть пробелы

**Результат фазы:** каждая компетенция профиля, которую симуляция берётся оценивать, имеет достаточно наблюдений.

**Требует решения директора:** это единственная фаза, которая заметно удлиняет прохождение — с примерно часа до полутора. Альтернатива: явно зафиксировать, что симуляция закрывает 9 пунктов профиля из 14, а остальные оценивает комиссия и разбор.

### Задача 5.1: Кейсы под непроверяемые компетенции

**Файлы:**
- Создать: контент через редактор кейсов (не код)

**Что нужно:** 8-10 новых кейсов. Распределение слотов:

| Компетенция | Сейчас кейсов | Нужно | Кейсов добрать |
|---|---|---|---|
| Мотивация сотрудников | 0 | 8 | 8 слотов |
| Обучение сотрудников | 0 | 8 | 8 слотов |
| Системность мышления | 0 (своих) | 8 | 8 слотов |
| Ориентация на результат | 3 | 8 | 5 слотов |
| Контроль | 5 | 8 | 3 слота |
| Ответственность | 5 | 8 | 3 слота |

Итого 35 слотов при 4 компетенциях на кейс — **9 новых кейсов**.

- [ ] **Шаг 1: Написать контракт охвата**

Создать `script/coverage-parity.ts`:

```typescript
import assert from "node:assert/strict";
import { contentStorage } from "../server/content-storage";
import { CRITICAL_COMPETENCIES, RELIABLE_CASE_COUNT } from "../shared/competency-profile";

/**
 * Контракт охвата критичных компетенций.
 *
 * По критичной компетенции ставится тревога, влияющая на решение о кандидате.
 * Основание для такого вывода — наблюдения в разных ситуациях, а не много
 * решений внутри одной.
 */
const cases = contentStorage.getPublicContent(false).cases as Array<{
  id: string;
  cycles: Array<{ options: Array<{ competency_scores?: Record<string, number> }> }>;
}>;

const casesPerCompetency = new Map<string, Set<string>>();
for (const c of cases) {
  for (const cy of c.cycles) for (const o of cy.options) {
    for (const id of Object.keys(o.competency_scores || {})) {
      if (!casesPerCompetency.has(id)) casesPerCompetency.set(id, new Set());
      casesPerCompetency.get(id)!.add(c.id);
    }
  }
}

const thin: string[] = [];
for (const id of CRITICAL_COMPETENCIES) {
  const count = casesPerCompetency.get(id)?.size ?? 0;
  if (count < RELIABLE_CASE_COUNT) thin.push(`${id}: ${count} из ${RELIABLE_CASE_COUNT}`);
}

assert.equal(thin.length, 0, `критичные компетенции с недостаточным охватом — ${thin.join(", ")}`);
console.log(`coverage parity passed (все критичные компетенции покрыты минимум ${RELIABLE_CASE_COUNT} кейсами)`);
```

- [ ] **Шаг 2: Запустить, зафиксировать разрыв**

Запуск: `npx tsx script/coverage-parity.ts`
Ожидается: FAIL со списком — это рабочее задание методисту.

- [ ] **Шаг 3: Написать кейсы**

Через редактор кейсов, по правилам: 4 компетенции на кейс, оценки внутри варианта различаются, у каждого варианта заполнено пояснение «Цена выбора», у лучшего варианта хотя бы один показатель ухудшается.

- [ ] **Шаг 4: Прогнать контракт до зелёного**

```bash
npx tsx script/coverage-parity.ts
npm run test:contracts
```

---

# Что нужно от заказчика

Три решения блокируют работу:

1. **Ввод обновлённого комплекта** (фаза 0). Меняет живой контент, 15 прошлых прохождений становятся несопоставимы. Нужно «да» и решение, как поступить с историей.
2. **Убрать живую панель показателей** (задача 2.3). Заметно меняет впечатление от продукта. Рекомендация — убрать.
3. **Удлинение прохождения** (фаза 5). С часа до полутора, либо честно зафиксировать охват 9 из 14 пунктов профиля.

Одно решение нужно от методиста:

4. **«Принятие решений»** (задача 1.3) — включить в «Системность мышления» или вынести за скобки. Рекомендация — включить.

# Чего не хватает в инструментах

**Figma не подключается.** Причина найдена: в настройках один и тот же каталог записан дважды, различаясь регистром буквы диска, и подключение уходит не в тот проект. Пока это не поправлено, сверка с макетом один в один невозможна — оформление берётся из тёмной темы, уже реализованной в продукте.

**Python — заглушка из магазина приложений.** Мешает двум вещам: скрипту подбора оформления и печати отчёта, если она когда-нибудь переедет на локальный запуск. Обходится, но каждый раз стоит времени.

**Нет проверки интерфейса в браузере на сборке.** `test:browser` есть, но проверяет узкий набор. После фазы 2 интерфейс прохождения меняется заметно, и стоило бы добавить сквозной прогон: пройти кейс, увидеть окно цены, убедиться что панели показателей нет.

**Нет данных о том, как кандидаты воспринимают изменения.** Всё, что здесь предложено, опирается на разбор данных и кода. Влияние на восприятие (станет ли разбор содержательнее, не потеряется ли вовлечённость без приборной панели) проверяется только живыми прохождениями — стоит запланировать 3-5 после фазы 2.