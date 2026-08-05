# Мастер кейсов, план 3: библиотека эталонов

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Дать автору 5 выверенных кейсов, которые работают одновременно как учебник («как в образце» на любом этапе) и как точка старта («взять за основу»).

**Architecture:** Эталоны — JSON в репозитории, а не записи в БД: это неизменяемый учебный материал, он версионируется вместе с методологией и не засоряет список рабочих кейсов. Качество гарантируется тестом: каждый эталон обязан проходить `validateCase` без замечаний, иначе учебный материал учит плохому.

**Tech Stack:** TypeScript, React. Тесты — tsx-скрипты (`node:assert/strict`).

**Предшественники:** планы 1 и 2 выполнены — этапы мастера, анкета и обучающий слой существуют.
**Спека:** `docs/superpowers/specs/2026-08-02-case-master-design.md`

## Global Constraints

- НЕ трогать модуль ЗРД (`shared/zrd/*`, `client/src/features/zrd/*`).
- Эталоны хранятся в JSON, **не** в БД и **не** попадают в список рабочих кейсов админки.
- Каждый эталон обязан проходить `validateCase` без единого замечания — это проверяется тестом, а не глазами.
- Расчётная логика — чистые функции с tsx-тестом; React-компоненты логики не содержат.
- Каждый шаг с кодом — `npm run check`; финал — `npm run check && npm test && npm run test:ui`.

## Что этот план НЕ делает

Автогенерация кейсов по параметрам — сознательно вне объёма: эталоны пишутся вручную как выверенный материал. Редактирование эталонов из интерфейса тоже не входит — они правятся в репозитории.

---

## File Structure

- Create: `shared/case-templates.ts` — типы и загрузка эталонов.
- Create: `shared/case-templates-data.json` — сами эталоны.
- Create: `script/case-templates-parity.ts` — тест: все эталоны валидны и разнообразны.
- Create: `client/src/features/admin/cases/master/TemplatePicker.tsx` — выбор эталона как основы.
- Create: `client/src/features/admin/cases/master/TemplatePeek.tsx` — «как в образце» на этапе.
- Modify: `client/src/features/admin/cases/master/steps/StepIntent.tsx` — подключить выбор основы.
- Modify: `client/src/features/admin/cases/master/CaseMaster.tsx` — прокинуть «как в образце» на этапы.
- Modify: `script/check-ui-acceptance.mjs` — контракт библиотеки.

---

### Task 1: Формат эталонов и первые два кейса

**Files:**
- Create: `shared/case-templates.ts`
- Create: `shared/case-templates-data.json`
- Create: `script/case-templates-parity.ts`

**Interfaces:**
- Consumes: `SimCase` из `./simulation-content`, `validateCase` из `./case-validation`.
- Produces: `CASE_TEMPLATES`, `CaseTemplate`, `instantiateTemplate()` — используются в Task 3–4.

**Зачем:** формат и проверка качества должны появиться раньше остального контента — тогда остальные три эталона пишутся уже под работающий тест.

- [ ] **Step 1: Написать падающую фикстуру `script/case-templates-parity.ts`**

```ts
import assert from "node:assert/strict";
import { CASE_TEMPLATES, instantiateTemplate } from "../shared/case-templates";
import { validateCase } from "../shared/case-validation";

// Библиотека непустая и покрывает разные ситуации розницы
assert.ok(CASE_TEMPLATES.length >= 2, "в библиотеке минимум два эталона на этом этапе");

const ids = CASE_TEMPLATES.map((template) => template.id);
assert.equal(new Set(ids).size, ids.length, "идентификаторы эталонов уникальны");

for (const template of CASE_TEMPLATES) {
  assert.ok(template.title.trim().length > 0, `${template.id}: есть название`);
  assert.ok(template.summary.trim().length > 0, `${template.id}: есть краткое описание для выбора`);
  assert.ok(template.teaches.trim().length > 0, `${template.id}: сказано, чему учит`);

  // Главное требование: эталон не может учить плохому
  const issues = validateCase(template.caseData);
  assert.deepEqual(
    issues,
    [],
    `${template.id}: эталон обязан проходить автопроверку чисто, найдено: ${issues.map((i) => i.check).join(", ")}`,
  );
}

// Хотя бы один эталон показывает ветвление, хотя бы один — линейный путь
const branching = CASE_TEMPLATES.filter((template) =>
  template.caseData.cycles.some((cycle) => cycle.options.some((option) => Boolean(option.nextCycleId))),
);
assert.ok(branching.length >= 1, "есть эталон с ветвлением");
assert.ok(branching.length < CASE_TEMPLATES.length, "есть эталон с линейным путём");

// Взятие за основу даёт независимую копию с новым идентификатором
const source = CASE_TEMPLATES[0];
const created = instantiateTemplate(source, "CASE-42");
assert.equal(created.id, "CASE-42");
assert.notEqual(created.cycles[0].id, source.caseData.cycles[0].id, "идентификаторы циклов пересобраны");
assert.equal(created.isActive, false, "копия создаётся черновиком, а не сразу в эфире");
assert.equal(created.qaStatus, "draft");
// Копия не делит ссылки с эталоном
created.cycles[0].situation = "изменено";
assert.notEqual(source.caseData.cycles[0].situation, "изменено", "эталон не мутируется");
// Копия эталона тоже обязана быть валидной
assert.deepEqual(validateCase(created), []);

console.log("case-templates parity checks passed");
```

- [ ] **Step 2: Убедиться, что фикстура падает**

Run: `npx tsx script/case-templates-parity.ts`
Expected: ошибка резолва `../shared/case-templates`.

- [ ] **Step 3: Создать `shared/case-templates-data.json` с двумя эталонами**

Первый — линейный, второй — с ветвлением. Оба выверены под все четыре проверки: баллы строго 1/3/5, у каждого варианта ненулевой эффект, длина текстов в пределах двукратной разницы, компетенции не растут монотонно все вместе, диагностика заполнена.

```json
{
  "templates": [
    {
      "id": "tpl-queue",
      "title": "Очередь на кассе в час пик",
      "summary": "Линейный кейс: три шага без ветвления, участник ищет причину затора",
      "teaches": "Отделять симптом от причины и не бросаться чинить видимое",
      "caseData": {
        "id": "TPL-QUEUE",
        "title": "Очередь на кассе в час пик",
        "description": "Пятница, вечер. У касс собралась очередь, клиенты недовольны.",
        "primaryCompetencies": ["org_control"],
        "secondaryCompetencies": ["communication"],
        "trigger": {
          "type": "message",
          "source": "Старший продавец Артём",
          "text": "У касс очередь на десять человек, клиенты начинают ругаться. Что делаем?"
        },
        "zones_affected": ["торговый_зал"],
        "businessProblem": "Клиенты уходят из очереди, выручка вечера проседает",
        "hiddenCause": "Вторая касса закрыта: кассир ушёл разбирать поставку, потому что кладовщик не вышел",
        "dataPoints": [
          { "label": "График смены на сегодня", "costToRequest": "минута" },
          { "label": "Отчёт по скорости обслуживания за час", "costToRequest": "две минуты" }
        ],
        "falseTrails": [
          "Кажется, что касса тормозит из-за сбоя программы",
          "Похоже, кассир работает медленно и его надо поторопить"
        ],
        "qaStatus": "ready_launch",
        "cycles": [
          {
            "id": "TPL-QUEUE-C1",
            "cycle": 1,
            "situation": "Очередь растёт, работает одна касса из двух.",
            "signal": { "type": "message", "content": "Артём ждёт решения, клиенты смотрят на вас." },
            "options": [
              {
                "id": "TPL-QUEUE-C1-O1",
                "level": 1,
                "text": "Встать на вторую кассу самому",
                "score": 1,
                "effects": { "queue": -3, "conversion": 0, "morale": -2, "revenue_impact": 0, "delivery_status": -3 },
                "competency_scores": { "org_control": 1, "communication": 3 }
              },
              {
                "id": "TPL-QUEUE-C1-O2",
                "level": 2,
                "text": "Поторопить кассира по громкой связи",
                "score": 2,
                "effects": { "queue": -1, "conversion": 0, "morale": -4, "revenue_impact": 0, "delivery_status": 0 },
                "competency_scores": { "org_control": 3, "communication": 1 }
              },
              {
                "id": "TPL-QUEUE-C1-O3",
                "level": 3,
                "text": "Посмотреть график смены и отчёт",
                "score": 3,
                "effects": { "queue": 1, "conversion": 0, "morale": 0, "revenue_impact": 0, "delivery_status": 1 },
                "competency_scores": { "org_control": 5, "communication": 3 }
              }
            ]
          },
          {
            "id": "TPL-QUEUE-C2",
            "cycle": 2,
            "situation": "Выяснилось: вторая касса закрыта, кассир разбирает поставку вместо кладовщика.",
            "signal": { "type": "message", "content": "Кассир пишет: «Я на складе, некому принимать»." },
            "options": [
              {
                "id": "TPL-QUEUE-C2-O1",
                "level": 1,
                "text": "Оставить как есть до конца смены",
                "score": 1,
                "effects": { "queue": 5, "conversion": -3, "morale": -2, "revenue_impact": -4, "delivery_status": 2 },
                "competency_scores": { "org_control": 1, "communication": 1 }
              },
              {
                "id": "TPL-QUEUE-C2-O2",
                "level": 2,
                "text": "Вернуть кассира и отложить поставку",
                "score": 2,
                "effects": { "queue": -4, "conversion": 2, "morale": 1, "revenue_impact": 3, "delivery_status": -4 },
                "competency_scores": { "org_control": 3, "communication": 3 }
              },
              {
                "id": "TPL-QUEUE-C2-O3",
                "level": 3,
                "text": "Вернуть кассира, поставку передать продавцу зала",
                "score": 3,
                "effects": { "queue": -5, "conversion": 3, "morale": 1, "revenue_impact": 4, "delivery_status": -1 },
                "competency_scores": { "org_control": 5, "communication": 5 }
              }
            ]
          }
        ],
        "imageAssetId": null,
        "imageUrl": null,
        "audioAssetId": null,
        "audioUrl": null,
        "sortOrder": 0,
        "isActive": false
      }
    },
    {
      "id": "tpl-claim",
      "title": "Претензия клиента на выдаче",
      "summary": "Кейс с ветвлением: первый ответ определяет, каким будет разговор дальше",
      "teaches": "Выбирать уместный ресурс: решить самому, поднять по регламенту или подключить руководителя",
      "caseData": {
        "id": "TPL-CLAIM",
        "title": "Претензия клиента на выдаче",
        "description": "Клиент забрал заказ и вернулся через час: товар с царапиной.",
        "primaryCompetencies": ["communication"],
        "secondaryCompetencies": ["business_processes"],
        "trigger": {
          "type": "visitor",
          "source": "Клиент на выдаче",
          "text": "Мне выдали товар с царапиной. Я хочу вернуть деньги прямо сейчас."
        },
        "zones_affected": ["выдача"],
        "businessProblem": "Неверно закрытая претензия возвращается жалобой и потерей лояльности",
        "hiddenCause": "Царапина была до выдачи: сотрудник не проверил товар при клиенте и не отметил это в акте",
        "dataPoints": [
          { "label": "Акт приёма-передачи заказа", "costToRequest": "минута" },
          { "label": "Запись камеры зоны выдачи", "costToRequest": "десять минут" }
        ],
        "falseTrails": [
          "Кажется, что клиент повредил товар сам и теперь хитрит",
          "Похоже, брак пришёл со склада и виноват поставщик"
        ],
        "qaStatus": "ready_launch",
        "cycles": [
          {
            "id": "TPL-CLAIM-C1",
            "cycle": 1,
            "situation": "Клиент настроен решительно, рядом ждут другие покупатели.",
            "signal": { "type": "visitor", "content": "Клиент повышает голос, очередь на выдаче слушает." },
            "options": [
              {
                "id": "TPL-CLAIM-C1-O1",
                "level": 1,
                "text": "Пообещать возврат денег сразу",
                "score": 1,
                "effects": { "queue": -1, "conversion": 0, "morale": -1, "revenue_impact": -4, "delivery_status": 0 },
                "competency_scores": { "communication": 3, "business_processes": 1 },
                "nextCycleId": "TPL-CLAIM-C2"
              },
              {
                "id": "TPL-CLAIM-C1-O2",
                "level": 2,
                "text": "Сказать, что это не наша вина",
                "score": 2,
                "effects": { "queue": 2, "conversion": -2, "morale": -3, "revenue_impact": -1, "delivery_status": 0 },
                "competency_scores": { "communication": 1, "business_processes": 3 },
                "nextCycleId": "TPL-CLAIM-C3"
              },
              {
                "id": "TPL-CLAIM-C1-O3",
                "level": 3,
                "text": "Выслушать, поднять акт приёма-передачи",
                "score": 3,
                "effects": { "queue": 1, "conversion": 1, "morale": 1, "revenue_impact": 0, "delivery_status": 1 },
                "competency_scores": { "communication": 5, "business_processes": 5 },
                "nextCycleId": "TPL-CLAIM-C2"
              }
            ]
          },
          {
            "id": "TPL-CLAIM-C2",
            "cycle": 2,
            "situation": "В акте нет отметки о проверке товара при клиенте. Формально претензия обоснована.",
            "signal": { "type": "message", "content": "Сотрудник выдачи признаёт: товар при клиенте не разворачивал." },
            "options": [
              {
                "id": "TPL-CLAIM-C2-O1",
                "level": 1,
                "text": "Отчитать сотрудника при клиенте",
                "score": 1,
                "effects": { "queue": 1, "conversion": -1, "morale": -5, "revenue_impact": -1, "delivery_status": 0 },
                "competency_scores": { "communication": 1, "business_processes": 3 },
                "nextCycleId": "__complete"
              },
              {
                "id": "TPL-CLAIM-C2-O2",
                "level": 2,
                "text": "Оформить возврат и закрыть вопрос",
                "score": 2,
                "effects": { "queue": -2, "conversion": 1, "morale": 0, "revenue_impact": -3, "delivery_status": 1 },
                "competency_scores": { "communication": 3, "business_processes": 3 },
                "nextCycleId": "__complete"
              },
              {
                "id": "TPL-CLAIM-C2-O3",
                "level": 3,
                "text": "Оформить возврат, с сотрудником разобрать после",
                "score": 3,
                "effects": { "queue": -2, "conversion": 2, "morale": 3, "revenue_impact": -3, "delivery_status": 2 },
                "competency_scores": { "communication": 5, "business_processes": 5 },
                "nextCycleId": "__complete"
              }
            ]
          },
          {
            "id": "TPL-CLAIM-C3",
            "cycle": 3,
            "situation": "Клиент требует книгу отзывов и говорит, что напишет жалобу.",
            "signal": { "type": "visitor", "content": "Клиент достаёт телефон и начинает снимать." },
            "options": [
              {
                "id": "TPL-CLAIM-C3-O1",
                "level": 1,
                "text": "Настаивать на своей позиции",
                "score": 1,
                "effects": { "queue": 3, "conversion": -3, "morale": -3, "revenue_impact": -2, "delivery_status": 0 },
                "competency_scores": { "communication": 1, "business_processes": 1 },
                "nextCycleId": "__complete"
              },
              {
                "id": "TPL-CLAIM-C3-O2",
                "level": 2,
                "text": "Извиниться и поднять акт приёма",
                "score": 2,
                "effects": { "queue": -1, "conversion": 1, "morale": 1, "revenue_impact": 0, "delivery_status": 1 },
                "competency_scores": { "communication": 5, "business_processes": 3 },
                "nextCycleId": "TPL-CLAIM-C2"
              }
            ]
          }
        ],
        "imageAssetId": null,
        "imageUrl": null,
        "audioAssetId": null,
        "audioUrl": null,
        "sortOrder": 0,
        "isActive": false
      }
    }
  ]
}
```

- [ ] **Step 4: Реализовать `shared/case-templates.ts`**

```ts
import type { SimCase } from "./simulation-content";
import templatesData from "./case-templates-data.json";

export interface CaseTemplate {
  id: string;
  title: string;
  /** Одна строка для списка выбора. */
  summary: string;
  /** Чему этот эталон учит автора. */
  teaches: string;
  caseData: SimCase;
}

export const CASE_TEMPLATES: ReadonlyArray<CaseTemplate> =
  (templatesData as { templates: CaseTemplate[] }).templates;

/**
 * Создаёт независимую копию эталона под новый идентификатор кейса.
 * Идентификаторы циклов и вариантов пересобираются, иначе два кейса делили бы ключи;
 * копия всегда создаётся черновиком — автор должен сам решить, когда её публиковать.
 */
export function instantiateTemplate(template: CaseTemplate, caseId: string): SimCase {
  const source = template.caseData;
  const cycleIdMap = new Map<string, string>();
  source.cycles.forEach((cycle, index) => {
    cycleIdMap.set(cycle.id, `${caseId}-C${index + 1}`);
  });

  return {
    ...source,
    id: caseId,
    isActive: false,
    qaStatus: "draft",
    acceptedIssues: [],
    cycles: source.cycles.map((cycle, cycleIndex) => ({
      ...cycle,
      id: cycleIdMap.get(cycle.id) as string,
      options: cycle.options.map((option, optionIndex) => ({
        ...option,
        id: `${caseId}-C${cycleIndex + 1}-O${optionIndex + 1}`,
        effects: { ...option.effects },
        competency_scores: { ...option.competency_scores },
        nextCycleId:
          option.nextCycleId && option.nextCycleId !== "__complete"
            ? cycleIdMap.get(option.nextCycleId) || null
            : option.nextCycleId || null,
      })),
      signal: { ...cycle.signal },
    })),
    dataPoints: (source.dataPoints || []).map((point) => ({ ...point })),
    falseTrails: [...(source.falseTrails || [])],
  };
}
```

- [ ] **Step 5: Убедиться, что фикстура проходит**

Run: `npx tsx script/case-templates-parity.ts`
Expected: `case-templates parity checks passed`

Если тест сообщает, что эталон не проходит автопроверку — **править эталон, а не тест**: требование «эталон не учит плохому» и есть смысл этой задачи. Типичные причины: балл не из набора 1/3/5, вариант без ненулевого эффекта, тексты вариантов различаются по длине больше чем вдвое, все компетенции растут вместе с уровнем.

Run: `npm run check`
Expected: без ошибок. Если `tsc` ругается на импорт JSON — проверить `resolveJsonModule` в `tsconfig.json`; при отсутствии добавить `"resolveJsonModule": true` в `compilerOptions`.

- [ ] **Step 6: Commit**

```bash
git add shared/case-templates.ts shared/case-templates-data.json script/case-templates-parity.ts
git commit -m "feat(cases): формат эталонных кейсов и первые два образца"
```

---

### Task 2: Ещё три эталона

**Files:**
- Modify: `shared/case-templates-data.json`
- Modify: `script/case-templates-parity.ts`

**Interfaces:**
- Consumes: формат из Task 1.

**Зачем:** пять сюжетов покрывают разные типы управленческих ситуаций, чтобы автор нашёл близкий к своему.

- [ ] **Step 1: Ужесточить требование к количеству**

В `script/case-templates-parity.ts` найти:
```ts
assert.ok(CASE_TEMPLATES.length >= 2, "в библиотеке минимум два эталона на этом этапе");
```

Заменить на:
```ts
assert.equal(CASE_TEMPLATES.length, 5, "библиотека содержит пять эталонов");

// Сюжеты не повторяются: каждый эталон учит своему
const lessons = CASE_TEMPLATES.map((template) => template.teaches);
assert.equal(new Set(lessons).size, lessons.length, "каждый эталон учит своему");

// Разные эталоны опираются на разные ведущие компетенции
const primary = CASE_TEMPLATES.map((template) => template.caseData.primaryCompetencies[0]);
assert.ok(new Set(primary).size >= 3, "эталоны покрывают минимум три разные ведущие компетенции");
```

- [ ] **Step 2: Убедиться, что тест падает**

Run: `npx tsx script/case-templates-parity.ts`
Expected: падение на `assert.equal(CASE_TEMPLATES.length, 5)` — эталонов пока два.

- [ ] **Step 3: Добавить три эталона в `shared/case-templates-data.json`**

Дописать в массив `templates` три записи в том же формате, что и существующие. Сюжеты и ведущие компетенции:

1. **`tpl-delegation`** — «Задача, которую проще сделать самому».
   Ведущая компетенция: `org_control`. Учит: ставить задачу с образом результата и точкой контроля вместо того, чтобы делать за сотрудника.
   Структура: линейная, 2 цикла.

2. **`tpl-newcomer`** — «Новичок ошибается второй раз подряд».
   Ведущая компетенция: `staff_training`. Учит: разбирать причину ошибки и давать обратную связь по фактам, а не по эмоциям.
   Структура: с ветвлением, 3 цикла — разговор идёт по-разному в зависимости от первого хода.

3. **`tpl-priority`** — «Три срочных задачи одновременно».
   Ведущая компетенция: `systems_thinking`. Учит: отделять срочное от важного и объяснять свой выбор команде.
   Структура: линейная, 2 цикла.

Обязательные требования к каждому (их проверяет тест):
- заполнены `businessProblem`, `hiddenCause`, минимум по одному содержательному `dataPoints` и `falseTrails`;
- баллы компетенций только из набора `1`, `3`, `5`;
- у каждого варианта хотя бы один ненулевой эффект;
- длина текстов вариантов внутри цикла различается не более чем вдвое;
- компетенции не растут монотонно все вместе: если по одной вариант сильный, по другой он должен быть средним или слабым;
- `isActive: false`, `qaStatus: "ready_launch"`, `imageAssetId`/`audioAssetId`/`imageUrl`/`audioUrl` — `null`.

- [ ] **Step 4: Убедиться, что тест проходит**

Run: `npx tsx script/case-templates-parity.ts`
Expected: `case-templates parity checks passed`

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add shared/case-templates-data.json script/case-templates-parity.ts
git commit -m "feat(cases): библиотека из пяти эталонных кейсов"
```

---

### Task 3: Выбор эталона как основы

**Files:**
- Create: `client/src/features/admin/cases/master/TemplatePicker.tsx`
- Modify: `client/src/features/admin/cases/master/steps/StepIntent.tsx`

**Interfaces:**
- Consumes: `CASE_TEMPLATES`, `instantiateTemplate` (Task 1).
- Produces: компонент `TemplatePicker`.

- [ ] **Step 1: Создать `TemplatePicker.tsx`**

```tsx
import { useState } from "react";
import type { SimCase } from "@shared/simulation-content";
import { CASE_TEMPLATES, instantiateTemplate, type CaseTemplate } from "@shared/case-templates";
import { Button } from "@/components/ui/button";

export function TemplatePicker({
  caseId,
  onApply,
}: {
  caseId: string;
  onApply: (next: SimCase) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<CaseTemplate | null>(null);

  if (!open) {
    return (
      <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Начать с готового образца</div>
            <div className="mt-1 text-[11px] text-[#8890a8]">
              Пять выверенных кейсов со всей структурой и связями. Тексты потом перепишете под свою ситуацию.
            </div>
          </div>
          <Button type="button" size="sm" className="ml-auto shrink-0" onClick={() => setOpen(true)}>
            Посмотреть образцы
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">Выберите образец</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-[#2a3a4e] bg-transparent text-[#9aabc6]"
          onClick={() => { setOpen(false); setConfirming(null); }}
        >
          Свернуть
        </Button>
      </div>

      <div className="space-y-2">
        {CASE_TEMPLATES.map((template) => (
          <div key={template.id} className="rounded-lg border border-[#243244] bg-[#0d1522]/70 p-3">
            <div className="text-[13px] font-semibold text-white">{template.title}</div>
            <div className="mt-1 text-[11.5px] text-[#b8c7df]">{template.summary}</div>
            <div className="mt-1 text-[11px] text-[#70829d]">Учит: {template.teaches}</div>

            {confirming?.id === template.id ? (
              <div className="mt-2 rounded-md border border-[#ffb27a]/35 bg-[#FF6B00]/8 p-2">
                <div className="text-[11.5px] leading-relaxed text-[#ffd77a]">
                  Текущее содержимое кейса будет заменено структурой образца. Это действие нельзя отменить.
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onApply(instantiateTemplate(template, caseId));
                      setConfirming(null);
                      setOpen(false);
                    }}
                  >
                    Заменить и продолжить
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-[#2a3a4e] bg-transparent text-[#9aabc6]"
                    onClick={() => setConfirming(null)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 border-[#2a3a4e] bg-transparent text-[#9aabc6]"
                onClick={() => setConfirming(template)}
              >
                Взять за основу
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Подключить в `StepIntent.tsx`**

Расширить пропсы, добавив в тип:
```tsx
  onReplaceCase: (next: SimCase) => void;
```
и в деструктуризацию: `onReplaceCase`.

Добавить импорт:
```tsx
import { TemplatePicker } from "../TemplatePicker";
```

В разметке, сразу после блока-заголовка «Зачем этот кейс и что он проверяет?», добавить:
```tsx
      <TemplatePicker caseId={entity.id} onApply={onReplaceCase} />
```

- [ ] **Step 3: Пробросить в `CaseMaster.tsx`**

В вызове `StepIntent` добавить проп:
```tsx
              onReplaceCase={(next) => onChange(next)}
```

- [ ] **Step 4: Проверить**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 5: Commit**

```bash
git add client/src/features/admin/cases/master/TemplatePicker.tsx client/src/features/admin/cases/master/steps/StepIntent.tsx client/src/features/admin/cases/master/CaseMaster.tsx
git commit -m "feat(admin): выбор эталонного кейса как основы"
```

---

### Task 4: «Как в образце» на этапах

**Files:**
- Create: `client/src/features/admin/cases/master/TemplatePeek.tsx`
- Modify: `client/src/features/admin/cases/master/steps/StepSituation.tsx`
- Modify: `client/src/features/admin/cases/master/steps/StepDecisions.tsx`

**Interfaces:**
- Consumes: `CASE_TEMPLATES` (Task 1), `MasterStepId` (план 1).
- Produces: компонент `TemplatePeek`.

**Зачем:** второй уровень обучения из спеки — показать, как выглядит хорошо заполненный этап, не уводя автора со страницы.

- [ ] **Step 1: Создать `TemplatePeek.tsx`**

```tsx
import { useState } from "react";
import { CASE_TEMPLATES } from "@shared/case-templates";
import type { MasterStepId } from "./case-master-support";

/** Что показываем из эталона на каждом этапе. */
function peekContent(stepId: MasterStepId, templateIndex: number): Array<{ label: string; value: string }> {
  const template = CASE_TEMPLATES[templateIndex];
  const caseData = template.caseData;
  const firstCycle = caseData.cycles[0];

  if (stepId === "situation") {
    return [
      { label: "Текст сигнала", value: caseData.trigger.text },
      { label: "Скрытая причина", value: caseData.hiddenCause || "" },
      { label: "Данные для запроса", value: (caseData.dataPoints || []).map((point) => point.label).join(" · ") },
      { label: "Ложные следы", value: (caseData.falseTrails || []).join(" · ") },
    ];
  }

  if (stepId === "decisions") {
    return (firstCycle?.options || []).map((option) => ({
      label: `Вариант ${option.level}`,
      value: `${option.text} — ${Object.entries(option.competency_scores || {}).map(([id, score]) => `${id}: ${score}`).join(", ")}`,
    }));
  }

  return [];
}

export function TemplatePeek({ stepId }: { stepId: MasterStepId }) {
  const [open, setOpen] = useState(false);
  const [templateIndex, setTemplateIndex] = useState(0);

  const rows = peekContent(stepId, templateIndex);
  if (rows.length === 0) {
    return null;
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-[11px] text-[#8aa2c4] underline decoration-dotted underline-offset-2 hover:text-white"
      >
        Как это выглядит в образце
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-[#243244] bg-[#0d1522]/70 p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#70829d]">Образец</div>
        <select
          value={templateIndex}
          onChange={(event) => setTemplateIndex(Number(event.target.value))}
          className="rounded-md border border-[#2a3a4e] bg-[#141c2b] px-2 py-1 text-[11px] text-white"
        >
          {CASE_TEMPLATES.map((template, index) => (
            <option key={template.id} value={index}>{template.title}</option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="ml-auto text-[11px] text-[#8aa2c4] hover:text-white"
        >
          Свернуть
        </button>
      </div>
      <div className="space-y-1.5">
        {rows.map((row, index) => (
          <div key={`peek-${index}`}>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[#70829d]">{row.label}</div>
            <div className="text-[11.5px] leading-relaxed text-[#cbd8ef]">{row.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Встроить в оба этапа**

В `StepSituation.tsx` добавить импорт:
```tsx
import { TemplatePeek } from "../TemplatePeek";
```
и вставить сразу после блока-заголовка:
```tsx
      <TemplatePeek stepId="situation" />
```

В `StepDecisions.tsx` добавить импорт:
```tsx
import { TemplatePeek } from "../TemplatePeek";
```
и вставить сразу после блока-заголовка:
```tsx
      <TemplatePeek stepId="decisions" />
```

- [ ] **Step 3: Проверить**

Run: `npm run check`
Expected: без ошибок.

- [ ] **Step 4: Commit**

```bash
git add client/src/features/admin/cases/master/TemplatePeek.tsx client/src/features/admin/cases/master/steps/StepSituation.tsx client/src/features/admin/cases/master/steps/StepDecisions.tsx
git commit -m "feat(admin): просмотр эталона прямо на этапе мастера"
```

---

### Task 5: Контракт библиотеки и финальная верификация

**Files:**
- Modify: `script/check-ui-acceptance.mjs`

- [ ] **Step 1: Расширить контракт**

В массив `caseUi` добавить:
```js
  "client/src/features/admin/cases/master/TemplatePicker.tsx",
  "client/src/features/admin/cases/master/TemplatePeek.tsx",
```

После существующих проверок добавить:
```js
assertCondition(
  caseUi.includes("instantiateTemplate"),
  "Эталон можно взять за основу нового кейса",
);
assertCondition(
  caseUi.includes("TemplatePeek"),
  "Образец показывается прямо на этапе, без ухода со страницы",
);
assertCondition(
  existsSync("shared/case-templates-data.json"),
  "Библиотека эталонов хранится в репозитории, а не в базе",
);
```

- [ ] **Step 2: Финальная верификация**

Run: `npm run check`
Expected: без ошибок.

Run: `npx tsx script/case-templates-parity.ts`
Expected: `case-templates parity checks passed`

Run: `npx tsx script/case-master-parity.ts`
Expected: `case-master parity checks passed`

Run: `npx tsx script/case-explanations-parity.ts`
Expected: `case-explanations parity checks passed`

Run: `npx tsx script/case-validation-parity.ts`
Expected: `case-validation parity checks passed`

Run: `npm test`
Expected: `CI smoke checks passed`

Run: `npm run test:ui`
Expected: `UI acceptance checks passed…`

- [ ] **Step 3: Проверить falsifiability**

Временно испортить один эталон в JSON (например, убрать `hiddenCause`), убедиться, что `case-templates-parity` краснеет с сообщением про автопроверку, вернуть как было.

- [ ] **Step 4: Commit**

```bash
git add script/check-ui-acceptance.mjs
git commit -m "test(admin): контракт библиотеки эталонных кейсов"
```

---

## Self-Review

**Spec coverage:**
- 4–5 эталонов в идеальной логике → Task 1–2 (ровно пять, проверяется тестом).
- Эталон как учебник → Task 4 («как в образце» на этапах).
- Эталон как точка старта → Task 3 («взять за основу»).
- Хранение вне БД → Task 1 (JSON в репозитории), проверяется контрактом в Task 5.
- Гарантия качества эталонов → Task 1 Step 1 (тест требует нулевых замечаний).
- Автогенерация по параметрам → **не входит**, объявлено в начале плана.

**Placeholder scan:** пройден. В Task 2 Step 3 сюжеты трёх эталонов заданы описанием, а не готовым JSON — это осознанно: пять полных кейсов в тексте плана сделали бы его нечитаемым, а объективный критерий приёмки даёт тест (нулевые замечания автопроверки, уникальные уроки, три разные ведущие компетенции). Формат задан двумя полными образцами в Task 1.

**Type consistency:** `CaseTemplate` объявлен один раз (Task 1) и используется в Task 3–4. `instantiateTemplate` возвращает `SimCase` — тот же тип, что принимает `onChange` мастера.

## Риски

**Импорт JSON в TypeScript** может потребовать `resolveJsonModule` в `tsconfig.json` — проверка включена в Task 1 Step 5.

**Написание трёх эталонов (Task 2)** — единственная задача с творческим содержанием. Если тест не проходит, причина почти всегда в одном из пяти требований списка; править нужно контент, а не тест.
