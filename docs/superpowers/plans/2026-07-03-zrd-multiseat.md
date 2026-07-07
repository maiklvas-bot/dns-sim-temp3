# ЗРД v2 «Мультистол» — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Матч ЗРД на 4 места (человек/ИИ 1–5/пусто), 12 месячных тактов, личные колоды 6×50, чёрные лебеди, миссии, два режима победы, мастер запуска у оценщика, живой борд, мультидевайс по кодам входа.

**Architecture:** Чистый детерминированный движок матча в `shared/zrd/` (новые файлы рядом со старым соло-движком; соло-путь заменяется на финальном этапе). Серверно-авторитетно: состояние в БД, клиенты шлют намерения и поллят версию состояния. UI: существующий борд `client/src/features/zrd/` переключается на seat-view.

**Tech Stack:** TypeScript, tsx-скрипты как тест-раннер (vitest/jest в проекте нет), better-sqlite3-миграции проекта, React + wouter + существующий zrd.css, Playwright для UI-проверки.

**Спека:** `docs/superpowers/specs/2026-07-03-zrd-multiseat-design.md`

## Global Constraints

- Все правила механики → синхронно обновлять `docs/zrd-wiki/*` + строка в `14-changelog.md` (правило проекта).
- Проверки: `npx tsc` · `npm run build` · tsx-харнессы · Playwright-скрипт в `tmp/`.
- Движок чистый и сериализуемый: seeded RNG (mulberry32), никаких Date/Math.random внутри `shared/zrd`.
- Коммиты: маленькие, по задаче, только явные пути (`git add <files>`); в staged лежат чужие файлы — `git add -A` запрещён.
- Никаких новых npm-зависимостей.
- Метрики 0..20 (clamp) — шкала сохраняется; UI показывает % (×5).
- Существующее поведение соло `/zrd` не ломать до Этапа 4 (замена), старые файлы движка не трогать без задачи.
- Тексты RU, стиль DNS (оранжевый/графит; красный только для рисков).

---

## Этап 1 — Движок матча (`shared/zrd`)

Новые файлы (старые не трогаем):

| Файл | Ответственность |
|---|---|
| `shared/zrd/match-types.ts` | Типы матча: места, конфиг, лебеди, миссии, колоды, интенты |
| `shared/zrd/content-decks.ts` | 6 якорных наборов + генератор 50 карт/колоду (300) |
| `shared/zrd/content-swans.ts` | 14 чёрных лебедей |
| `shared/zrd/content-missions.ts` | Каталог миссий + наборы сценариев |
| `shared/zrd/content-scenarios.ts` | 4 сценария (старт, колоды, миссии, лебеди, режим победы) |
| `shared/zrd/kpi.ts` | 6 KPI места, выводимых из состояния (детерминированно) |
| `shared/zrd/match-engine.ts` | initMatch / applySeatIntent / resolveTick / победа / лог |
| `shared/zrd/match-ai.ts` | Политика ИИ уровня 1–5 (ε-шум поверх оценочной функции) |
| `shared/zrd/match-run.ts` | Прогон полного матча для харнесса |
| `script/zrd-match-sim.ts` | Тест-харнесс: детерминизм, инварианты, баланс |

### Task 1.1: Типы матча

**Files:** Create `shared/zrd/match-types.ts`

**Produces (ключевые контракты, используют все последующие задачи):**

```ts
import type { Resources, Metrics, MetricKey, Difficulty, CompetencyKey, TurnLogEntry, EventOption, EventCard } from "./types";

export type RrsId = "ekb" | "chel" | "tmn" | "perm";
export const RRS_IDS: RrsId[] = ["ekb", "chel", "tmn", "perm"];

export type SeatController =
  | { kind: "human"; name: string }
  | { kind: "ai"; level: 1 | 2 | 3 | 4 | 5 }
  | { kind: "off" };

export type DeckId = "promo" | "service" | "logistics" | "goods" | "staff" | "projects";
export const DECK_IDS: DeckId[] = ["promo", "service", "logistics", "goods", "staff", "projects"];

export type CardTier = 1 | 2 | 3;
export interface MatchCardDef {
  id: string;            // напр. "promo_ad_t2_v1"
  deck: DeckId;
  anchorId: string;      // якорь для арта (9 листов Canva на колоду)
  tier: CardTier;
  title: string;
  cost: Partial<Resources>;
  condition?: { minMetric?: Partial<Metrics>; minResource?: Partial<Resources> };
  effects: { resources?: Partial<Resources>; resourceProd?: Partial<Resources>; metrics?: Partial<Metrics>; metricProd?: Partial<Metrics> };
  durationWeeks: number; // 0 = мгновенно; >0 = проект (эффект по завершении)
  competencyTags: CompetencyKey[];
}

export type SwanScope = "local" | "global";
export type SwanFrequency = "off" | "rare" | "standard" | "storm";
export interface BlackSwanDef {
  id: string; title: string; description: string;
  scope: SwanScope;
  weight: number;            // вес при выборе из пула
  durationWeeks: number;     // сколько недель действует штраф
  tickPenalty: { metrics?: Partial<Metrics>; resources?: Partial<Resources> }; // за каждый такт действия
  options: EventOption[];    // реакция места (для local — только цели)
}
export interface ActiveSwan { swanId: string; scope: SwanScope; targetRrs: RrsId | null; weeksLeft: number; reactedSeats: number[] }

export type KpiId = "sales_growth" | "market_coverage" | "efficiency" | "service_level" | "logistics" | "staffing";
export interface MissionDef {
  id: string; label: string; kpi: KpiId;
  /** целевые значения KPI (0..100) на конец кварталов 1..4; авто-режим двигает цели по ним */
  quarterTargets: [number, number, number, number];
  weight: number;            // бонус к ТР за выполнение финальной цели
}

export type WinMode = "year" | "race";
export type MissionMode = "auto" | "manual";
export type ScenarioId = "conquest" | "crisis" | "race" | "efficiency";

export interface ScenarioDef {
  id: ScenarioId; title: string; tagline: string;
  winModeDefault: WinMode;
  swanFrequencyDefault: SwanFrequency;
  missionIds: string[];      // авто-набор
  keyMissionId: string;      // ключевая миссия для режима race
  /** веса колод при доборе (сдвиг состава руки под сценарий) */
  deckWeights: Record<DeckId, number>;
  startTweak?: { resources?: Partial<Resources>; metrics?: Partial<Metrics> };
}

export interface SeatSetup { rrsId: RrsId; controller: SeatController }
export interface MatchConfig {
  scenario: ScenarioId;
  difficulty: Difficulty;
  winMode: WinMode;
  missionMode: MissionMode;
  missionIds: string[];      // выбранные (manual) или из сценария (auto)
  keyMissionId: string;
  swanFrequency: SwanFrequency;
  minutesPerTick: number;    // темп (сервер следит за дедлайном; движок не знает о реальном времени)
  seats: SeatSetup[];        // ровно 4, порядок = RRS_IDS
  seed: number;
}

export interface ActiveProject { cardId: string; title: string; deck: DeckId; weeksLeft: number; totalWeeks: number }

export interface SeatState {
  rrsId: RrsId;
  controller: SeatController;
  resources: Resources;
  incomeMonthly: number;         // капитал в месяц (v3-экономика)
  resourceProd: Resources;       // применяется на квартальных рубежах
  metrics: Metrics;
  metricProd: Metrics;           // применяется на квартальных рубежах
  deck: string[];                // id карт (порядок скрыт от клиента)
  hand: string[];
  discard: string[];
  activeProjects: ActiveProject[];
  actionsLeft: number;
  passed: boolean;
  spentTotal: number;            // суммарно потраченные ресурсы (тай-брейк)
  actionsTotal: number;          // число совершённых действий (тай-брейк)
  missionDone: Record<string, boolean>;
  pendingEvent: EventCard | null;
  log: TurnLogEntry[];
}

export type MatchPhase = "action" | "ended";
export interface SeatOutcome { tr: number; kpi: Record<KpiId, number>; missionsCompleted: string[]; raceWinner: boolean }

export interface MatchState {
  config: MatchConfig;
  tick: number;                  // 1..12 (месяц)
  phase: MatchPhase;
  seats: SeatState[];
  activeSwans: ActiveSwan[];
  eventDeck: string[];           // id событий-дилемм (квартальные)
  rng: number;
  ended: boolean;
  outcomes?: SeatOutcome[];      // индекс = место
  winnerSeat?: number | null;    // null = ничья даже после тай-брейка
}

export const quarterOfTick = (tick: number) => Math.ceil(tick / 3);       // 1..4
export const monthOfQuarter = (tick: number) => ((tick - 1) % 3) + 1;      // 1..3
export const weekOfTick = (tick: number) => (tick - 1) * 4 + 1;            // 1..45 (старт месяца)

export type SeatIntent =
  | { kind: "playCard"; cardId: string }
  | { kind: "standard"; action: import("./types").StandardAction }
  | { kind: "eventChoice"; optionId: string }
  | { kind: "swanChoice"; swanId: string; optionId: string }
  | { kind: "viewData" }
  | { kind: "pass" };
```

- [x] Step 1: написать файл целиком (типы выше + docstring-шапка).
- [x] Step 2: `npx tsc --noEmit` — PASS (ошибок нет).
- [x] Step 3: `git add shared/zrd/match-types.ts && git commit -m "feat(zrd): типы матча мультистола (места, лебеди, миссии, сценарии)"`.

### Task 1.2: Контент колод — 6×50=300

**Files:** Create `shared/zrd/content-decks.ts`; Test `script/zrd-decks-check.ts`

**Produces:** `MATCH_DECK_CARDS: MatchCardDef[]` (ровно 300), `getMatchCard(id)`, `DECK_ANCHORS: Record<DeckId, AnchorDef[]>` (по 9, id якоря = имя арт-файла из `zrd-decks.ts`).

Генерация: у каждого якоря — базовые cost/effects/durationWeeks/competencyTags; генератор раскладывает якорь в варианты тиров:
- tier 1 (×2 варианта): cost ×0.7 (окр. вверх), эффект базовый, duration 0–2 нед.
- tier 2 (×2): базовые значения, duration 2–4 нед, у половины condition.
- tier 3 (×1–2): cost ×1.6, эффект ×1.8 (окр.), duration 4–8 нед, condition обязателен.
Вариантные названия — суффиксы из массива якоря (напр. «Реклама: соцсети», «Реклама: наружная», «Реклама: федеральная кампания»); нехватка — римские цифры. Ровно 50 на колоду добивается репликацией вариантов с новым суффиксом (без повторов id).

Якорные наборы — из существующих 54 артов (`zrd-decks.ts`): promo (Реклама, Акция распродажа, Вирусный ролик, Отзывы, Промоутер, Брендинг, ТВ реклама, Лояльность, Сократить бюджеты), service (Сервисные операции, Ремонт, Восстановление, Замена, Претензия, Гарантия, Не гарантия, Суд, Экстремист), logistics (Поставка, Транспортировка, Складирование, Распределение, Приёмка, Комплектация, Отгрузка, Доставка, Инвентаризация), goods (Ассортимент, Закупка, Поступление, Приёмка, Хранение, Ценообразование, Выкладка, Маркировка, Инвентаризация), staff (Развивать компетенции, Адаптивное обучение, Нанять персонал, Мотивация, Рекрут, Наставничество, Оценка навыков, Собрать команду, Удержать/Конфликт), projects (Открытие магазина, Изменение площади, Закрытие магазина, Переезд, Расширение склада, Модернизация зала, Пункт выдачи, Новая локация, Потенциал РРС).

Тематика эффектов: promo→sales/coverage; service→nps; logistics→warehouse prod + защита от лебедей логистики; goods→sales+warehouse; staff→staff prod+nps; projects→coverage/крупные длительные.

- [x] Step 1: тест `script/zrd-decks-check.ts`: 300 карт; по 50 в колоде; id уникальны; у каждой карты cost.capital>0 или иная цена; у tier3 есть condition; у всех есть competencyTags; anchorId ∈ 9 якорей колоды. Запуск: `npx tsx script/zrd-decks-check.ts` — падает (файла нет).
- [x] Step 2: реализовать `content-decks.ts` (якоря + генератор `expandAnchor`).
- [x] Step 3: `npx tsx script/zrd-decks-check.ts` — PASS; `npx tsc --noEmit` — PASS.
- [x] Step 4: коммит `feat(zrd): контент колод 6×50 (генератор от 54 якорных артов)`.

### Task 1.3: Чёрные лебеди (14)

**Files:** Create `shared/zrd/content-swans.ts`

**Produces:** `BLACK_SWANS: BlackSwanDef[]` (14), `SWAN_TICK_PROBABILITY: Record<SwanFrequency, number>` = { off: 0, rare: 0.10, standard: 0.22, storm: 0.40 }, `getSwan(id)`.

Пул (id · масштаб · длительность нед. · штраф/такт · суть): proverka_organov·local·2·metrics.sales−1·внеплановая проверка; postavshik_bankrot·local·4·warehouse−1·банкротство поставщика; kiberataka·global·2·sales−1,nps−1·ИТ-инцидент; epidemiya·global·8·sales−2·эпидемия в регионе; valutnyi_shok·global·4·resources.capital−3·курс валют; zabastovka_perevozchikov·local·3·warehouse−1,sales−1; pozhar_sklada·local·6·warehouse−2; reputatsionnyi_krizis·local·4·nps−2; novyi_federalnyi_konkurent·global·6·sales−1,coverage−1; defitsit_kadrov·global·4·staff−1; sboy_it_platformy·local·1·sales−2; arenda_x2·local·6·capital−2; marketpleis_demping·global·3·sales−1; blokirovka_reklamy·global·2·coverage−1 (штраф применяется к целевым местам каждый такт, weeksLeft−4/такт). У каждого 2–3 опции реакции (EventOption с fitsWhen/weak, есть бесплатная).

- [x] Step 1: написать файл; инвариант-тест добавить в `zrd-decks-check.ts` (секция swans: 14 шт, у каждого ≥2 опций, есть бесплатная опция, durationWeeks>0).
- [x] Step 2: `npx tsx script/zrd-decks-check.ts` + `npx tsc --noEmit` — PASS.
- [x] Step 3: коммит `feat(zrd): пул 14 чёрных лебедей с профилями частоты`.

### Task 1.4: KPI, миссии, сценарии

**Files:** Create `shared/zrd/kpi.ts`, `shared/zrd/content-missions.ts`, `shared/zrd/content-scenarios.ts`

**Produces:**
```ts
// kpi.ts — 0..100, детерминированно из SeatState
export function computeKpi(seat: SeatState): Record<KpiId, number>;
// sales_growth = sales*5; market_coverage = coverage*5; service_level = nps*5;
// efficiency = clamp( 40 + tech*8 + incomeMonthly*4 − activeProjects.length*2 );
// logistics = clamp( 35 + warehouse*9 + resourceProd.warehouse*6 );
// staffing = clamp( 40 + staff*7 + resourceProd.staff*8 );
export const KPI_LABEL: Record<KpiId, string>;
```
`content-missions.ts`: `MISSION_CATALOG: MissionDef[]` — 10 миссий (по одной-двум на KpiId), quarterTargets растут (напр. sales_growth: [35,50,65,80]), weight 2–4. `content-scenarios.ts`: `SCENARIOS: Record<ScenarioId, ScenarioDef>` по спеке §6 (conquest — базовый; crisis — startTweak минус, swan storm, миссии удержания; race — winMode race + keyMission; efficiency — урезанный старт, deckWeights к logistics/goods).

- [x] Step 1: написать 3 файла; тест-секция в `zrd-decks-check.ts` (10 миссий, 4 сценария, у сценариев missionIds ⊂ каталога, deckWeights заданы для 6 колод).
- [x] Step 2: проверки PASS.
- [x] Step 3: коммит `feat(zrd): KPI(6), каталог миссий(10), 4 сценария`.

### Task 1.5: Движок матча

**Files:** Create `shared/zrd/match-engine.ts`; Test — расширение `script/zrd-match-sim.ts` (создаётся здесь)

**Produces:**
```ts
export function initMatch(config: MatchConfig): MatchState;
export function applySeatIntent(state: MatchState, seatIdx: number, intent: SeatIntent): { state: MatchState; ok: boolean; error?: string };
/** Все активные места pass/без действий → добор, лебеди, события(кв. рубеж), производство, миссии, конец */
export function resolveTickIfReady(state: MatchState): MatchState;
export function toSeatView(state: MatchState, seatIdx: number): ZrdSeatView;   // рука/колода только свои; чужое — публичная сводка
export function toObserverView(state: MatchState): ZrdObserverView;            // всё, для оценщика
export function triggerSwanManually(state: MatchState, swanId: string, target: RrsId | "all"): MatchState;
export interface ZrdSeatPublicSummary { rrsId; controllerKind; metrics; kpi; missionsDone: number; discardCount: number }
export interface ZrdSeatView { tick; quarter; month; phase; you: {…SeatState без deck-порядка, deckCounts: Record<DeckId, number>}; others: ZrdSeatPublicSummary[]; swans: ActiveSwan[]; missions: {def, progress, done}[]; ended; outcomes? }
```
Правила: экономика v3 — `incomeMonthly` по сложности [6,5,4,4,3]; `actionsPerTick` [2,2,2,1,1]; добор/такт [3,3,2,2,2] карт из личных колод по deckWeights сценария (seeded); resourceProd/metricProd применяются на квартальных рубежах (тик 3/6/9/12); проекты: durationWeeks>0 → в activeProjects, −4 нед/такт, эффект по завершении; лебеди: бросок 1/такт по частоте, вес→выбор, local→случайная активная РРС; события-дилеммы: на квартальном рубеже каждому активному месту (из EVENT_CARDS соло-движка, переиспользуем); победа по спеке §2 (режимы year/race, тай-брейк spentTotal→actionsTotal); ранняя победа race завершает матч немедленно.

- [x] Step 1: тест `script/zrd-match-sim.ts`, секция инвариантов: (а) initMatch детерминирован (два вызова с одним seed → JSON-равенство); (б) полный автопрогон 4×AI до конца ≤12 тиков, ended=true, outcomes на 4 места; (в) карты не повторяются в руке/сбросе; (г) off-место не получает ходов; (д) toSeatView не содержит чужих рук и порядка своей колоды. Запуск падает (нет модуля).
- [x] Step 2: реализовать движок.
- [x] Step 3: `npx tsx script/zrd-match-sim.ts` PASS, `npx tsc --noEmit` PASS.
- [x] Step 4: коммит `feat(zrd): движок матча — 12 тактов, лебеди, миссии, победа, seat-view`.

### Task 1.6: ИИ уровня 1–5

**Files:** Create `shared/zrd/match-ai.ts`, `shared/zrd/match-run.ts`

**Produces:**
```ts
export function chooseSeatIntent(state: MatchState, seatIdx: number, rngRoll: number): SeatIntent; // уровень из controller
export const AI_EPSILON: Record<1|2|3|4|5, number> = { 1: 0.6, 2: 0.4, 3: 0.25, 4: 0.1, 5: 0 };
// match-run.ts:
export function playFullMatch(config: MatchConfig): MatchState; // AI за все места, для харнесса/баланса
```
Оценочная функция карт — адаптация `cardValue` из `ai.ts` (+бонус за отстающую миссию, +реакция на активный лебедь своего места). ε-шум: с вероятностью ε выбирается случайный доступный ход вместо лучшего (rngRoll из seeded RNG матча — детерминизм сохраняется).

- [x] Step 1: тест-секция в `zrd-match-sim.ts`: средний ТР 20 прогонов уровня 5 > уровня 1 (разница ≥ 15%); прогон детерминирован по seed.
- [x] Step 2: реализация; PASS + tsc PASS.
- [x] Step 3: коммит `feat(zrd): ИИ-управленец уровней 1–5 (ε-жадная политика)`.

### Task 1.7: Скоринг per-seat + балансовый харнесс

**Files:** Modify `shared/zrd/scoring.ts` (экспорт-обёртка `computeSeatCompetencies(seat: SeatState, config)` поверх текущей логики по логу), финальные секции `script/zrd-match-sim.ts`.

- [x] Step 1: тест: скоринг human-места после прогона возвращает 12 компетенций 0..5; weak-ИИ (ур.1) < сильного (ур.5) по среднему баллу.
- [x] Step 2: баланс-секция: 30 сидов × 4 сценария, все места AI-5: разброс среднего ТР между 4 РРС < 25% (нет доминирующего места); партия всегда ≤ 12 тиков. Числа v3 тюнить до зелёного.
- [x] Step 3: PASS; коммит `feat(zrd): скоринг per-seat + баланс-харнесс (v3-экономика)`.

---

## Этап 2 — Сервер и API мультидевайса

| Файл | Ответственность |
|---|---|
| `server/migrations.ts` | +миграция `0009_zrd_match`: `zrd_matches`, `zrd_match_seats`, `zrd_match_turns`, `zrd_match_results` |
| `server/zrd-match-storage.ts` | CRUD поверх таблиц (по образцу `zrd-storage.ts`) |
| `server/zrd-match-service.ts` | Оркестрация: create/join/view/intent/deadline/manual-swan/pause |
| `server/routes.ts` | Маршруты `/api/zrd/match/*` (по образцу существующих `/api/zrd/*`) |
| `script/zrd-match-api-smoke.ts` | Smoke: полный цикл по HTTP |

### Task 2.1: Схема и storage
Таблицы: `zrd_matches(id, config_json, state_json, state_version, status, paused, tick_deadline_at, created_at, completed_at, evaluator_account_id, evaluator_name)`; `zrd_match_seats(id, match_id, seat_idx, rrs_id, controller_kind, ai_level, participant_name, token_hash, access_code UNIQUE)`; `zrd_match_turns(id, match_id, seat_idx, seq, tick, intent_json, log_type, detail)`; `zrd_match_results(id, match_id, seat_idx, tr, winner, kpi_json, competencies_json, outcome_json)`.
- [x] Тест `script/zrd-match-db-check.ts`: миграция применяется на чистой tmp-БД, insert/get матча и 4 мест. PASS → коммит `feat(zrd): схема и storage матчей (0009)`.

### Task 2.2: Сервис матча
`createMatch(input)` → initMatch + токены/коды на human-места (по образцу `createSimulationSessionToken`/`generateZrdAccessCode`) → `{ match, seats: [{seatIdx, accessCode, joinUrl}] }`. `joinSeat(code)` → seat-token. `getSeatView(matchId, seatIdx)` / `getObserverView(matchId)`. `applyIntent(matchId, seatIdx, intent)`: применяет, инкремент `state_version`, пишет turn; после каждого intent — прогон ИИ-мест, если фаза позволяет, затем `resolveTickIfReady`; на `ended` — скоринг+`zrd_match_results`. `forceTickDeadline(matchId)`: авто-pass непоходивших (вызывает роут по таймеру клиента оценщика или lazy-проверка дедлайна при любом запросе — v1 lazy). `triggerSwan(matchId, swanId, target)` (staff). `setPaused(matchId, bool)` (staff).
- [x] Тест `script/zrd-match-service-check.ts`: create (2 human + 1 ai + 1 off) → join по коду → интенты человека → ИИ отвечает → тик продвигается → финал → результаты по 2 human-местам. PASS → коммит.

### Task 2.3: HTTP-маршруты + smoke
`POST /api/zrd/match` (requireStaff) · `POST /api/zrd/match/join {code}` · `GET /api/zrd/match/:id/seat` (заголовок `x-zrd-seat-token`) · `GET /api/zrd/match/:id/version` (лёгкий поллинг `{version, deadlineAt, paused}`) · `POST /api/zrd/match/:id/intent` · `GET /api/zrd/match/:id/observer` (staff) · `POST /api/zrd/match/:id/swan` (staff) · `POST /api/zrd/match/:id/pause` (staff).
- [x] Smoke `script/zrd-match-api-smoke.ts` против dev-сервера — полный цикл зелёный → коммит `feat(zrd): API матчей /api/zrd/match/*`.

---

## Этап 3 — Мастер запуска у оценщика

**Files:** Create `client/src/features/assessor/ZrdLaunchWizard.tsx` (+`zrd-launch-api.ts`); Modify `AssessorWorkspaceRuntime.tsx` (ветка `regional-deputy` → рендер мастера вместо `navigate("/zrd")`), `assessor-constants.ts` (описание карточки).

Шаги мастера (5, по спеке §9): сценарий+сложность+режим победы → состав стола (4 строки РРС: человек-имя / ИИ-уровень / выкл) → миссии (auto/manual чекбоксы каталога, ключевая — radio при race) → лебеди (частота + тумблер ручных триггеров) → темп (мин/такт, 3–10) → «Создать матч» → экран кодов (код + копируемая ссылка `/?id=<id>&seat=<code>#/zrd` на каждое human-место) + кнопка «Панель наблюдения».
Мини-наблюдение (в том же файле, вкладка): поллинг observer-view — тик/фаза, 4 места (метрики, статус хода), кнопки «Лебедь вручную» (выбор из пула + цель), «Пауза».
- [x] Проверки: tsc, build, Playwright-скрипт `tmp/zrd-wizard-check.ts` (открыть кабинет → карточка ЗРД → пройти мастер → увидеть коды; консоль без ошибок) → коммит `feat(assessor): мастер запуска ЗРД + коды входа + мини-наблюдение`.

---

## Этап 4 — Живой борд (per-seat)

**Files:** Modify `client/src/features/zrd/useZrdGame.ts`→`useZrdMatch.ts` (join по `?seat=`, поллинг version→refetch seat-view), `zrd-api.ts` (+match-эндпоинты), `ZrdGameWorkspace.tsx`, `zrd-board-data.ts` (все build* переводятся на ZrdSeatView, showcase-константы удаляются), организмы панелей (`ZrdPanelRegionStats`, `ZrdPanelAvailableActions`, `ZrdPanelActions`, `ZrdPanelResources`, `ZrdPanelProjects`, `ZrdMissionPanel`, `ZrdTopStrip`, `ZrdClosingBlock`, `ZrdTerritories`, `ZrdDiscard`, `ZrdDeck`, `ZrdRoundBadge`), `ZrdLobby.tsx` (вход по коду вместо самостоятельного создания).

Соответствие «блок → данные» — таблица §10 спеки. Ключевое: шапка «Кв N · Месяц M/12» + таймер дедлайна такта; колоды справа = свои `deckCounts`, клик → рука этой колоды (реальные MatchCardDef, арт по anchorId из существующих импортов `zrd-decks.ts`); сброс кликом открывает список сброшенного; территории = `others` публичная сводка + своё место подсвечено; лебедь = `swans` (активные, с оставшимися неделями, локальный — с меткой РРС); миссии = прогресс/done, ключевая — корона; проекты = activeProjects с неделями; событие квартала = pendingEvent (модал как сейчас); экран результатов = таблица 4 мест + радар компетенций своего места.
- [x] Проверки: tsc, build, Playwright `tmp/zrd-board-check.ts`: оценщик создаёт матч (1 human + 3 AI) → вход по ссылке → сыграть карту → pass → тик продвинулся ИИ → скриншот борда, консоль чистая; сравнить с макетом (без горизонтального скролла) → коммит `feat(zrd): живой борд per-seat (мультидевайс)`.

---

## Этап 5 — Баланс, замена соло-пути, документация

- [x] 5.1 Прогнать `script/zrd-match-sim.ts` (30 сидов × 4 сценария × сложности 1/3/5), затюнить константы до зелёного; калибровка скоринга по образцу `script/zrd-calibrate.ts`.
- [x] 5.2 Удалить соло-точку входа: `ZrdLobby` больше не создаёт соло-сессию (вход только по коду; демо-кнопка для staff создаёт матч 1 human + 3 AI через новый API). Старые соло-файлы движка остаются (используются переиспользуемые EVENT_CARDS/скоринг) — пометить шапкой «соло-путь legacy».
- [x] 5.3 Wiki: обновить `docs/zrd-wiki/` (02-как-играть: 12 тактов/недели; 05-карты: 6×50; 07-события: +лебеди; 08-сложность: v3; 11-победа: режимы+тай-брейк; 12-ai: уровни 1–5; +15-multiplayer.md) + строки в `14-changelog.md`; зеркало-канон: промоут решений в Obsidian `claude-kb` (`proekt-zrd` + пометить raw-заметку принятой).
- [x] 5.4 Финальный прогон: `npx tsc` · `npm run build` · все tsx-харнессы · Playwright. Отчёт по формату пользователя (что изменено/команды/результаты/не проверено/риски).

## Self-Review

- Покрытие спеки: §2 время/победа → 1.1/1.5; §3 колоды → 1.2; §4 лебеди → 1.3/1.5/2.2; §5 миссии → 1.4/1.5; §6 сценарии → 1.4; §7 ИИ → 1.6; §8 мультидевайс → 2.*; §9 оценщик → 3; §10 борд → 4; §11 проверки → в каждой задаче; §12 соло-замена → 5.2. Пробелов нет.
- Типы: `MatchCardDef.anchorId` ↔ арт `zrd-decks.ts` (этап 4); `ZrdSeatView` производится движком (1.5) и потребляется UI (4) — контракт в 1.1/1.5.
- Плейсхолдеров нет; числа v3 помечены как тюнингуемые харнессом (осознанно: баланс — итеративный, критерий зелёного задан).
