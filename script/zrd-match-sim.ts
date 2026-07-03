/**
 * ЗРД v2 — харнесс движка матча: детерминизм, инварианты, приватность seat-view.
 * Запуск: npx tsx script/zrd-match-sim.ts
 * Секции ИИ/баланса добавляются задачами 1.6–1.7 плана.
 */
import {
  initMatch, applySeatIntent, resolveTickIfReady, toSeatView, toObserverView,
} from "../shared/zrd/match-engine";
import { getMatchCard } from "../shared/zrd/content-decks";
import { playFullMatch } from "../shared/zrd/match-run";
import { computeSeatCompetencies } from "../shared/zrd/match-scoring";
import { SCENARIOS, SCENARIO_IDS } from "../shared/zrd/content-scenarios";
import type { MatchConfig, MatchState, SeatIntent } from "../shared/zrd/match-types";
import { RRS_IDS, TICKS_TOTAL } from "../shared/zrd/match-types";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

function baseConfig(seed = 42): MatchConfig {
  return {
    scenario: "conquest",
    difficulty: 3,
    winMode: "year",
    missionMode: "auto",
    missionIds: ["m_sales_growth", "m_coverage_expand", "m_service_lead"],
    keyMissionId: "m_coverage_expand",
    swanFrequency: "standard",
    minutesPerTick: 6,
    seats: [
      { rrsId: RRS_IDS[0], controller: { kind: "human", name: "Тест" } },
      { rrsId: RRS_IDS[1], controller: { kind: "ai", level: 3 } },
      { rrsId: RRS_IDS[2], controller: { kind: "ai", level: 3 } },
      { rrsId: RRS_IDS[3], controller: { kind: "off" } },
    ],
    seed,
  };
}

/** простая детерминированная политика для инвариантов (настоящий ИИ — задача 1.6) */
function simpleIntent(state: MatchState, seatIdx: number): SeatIntent {
  const seat = state.seats[seatIdx];
  if (seat.pendingEvent) {
    const free = seat.pendingEvent.options.find((o) => !o.cost || Object.values(o.cost).every((v) => !v));
    return { kind: "eventChoice", optionId: (free ?? seat.pendingEvent.options[0]).id };
  }
  if (seat.actionsLeft > 0) {
    for (const id of seat.hand) {
      const c = getMatchCard(id);
      if (!c) continue;
      const affordable = Object.entries(c.cost).every(([k, v]) => (seat.resources as Record<string, number>)[k] >= (v ?? 0));
      const condOk = !c.condition
        || ((!c.condition.minMetric || Object.entries(c.condition.minMetric).every(([k, v]) => (seat.metrics as Record<string, number>)[k] >= (v ?? 0)))
          && (!c.condition.minResource || Object.entries(c.condition.minResource).every(([k, v]) => (seat.resources as Record<string, number>)[k] >= (v ?? 0))));
      if (affordable && condOk) return { kind: "playCard", cardId: id };
    }
    if (seat.resources.capital >= 4) return { kind: "standard", action: "promo" };
  }
  return { kind: "pass" };
}

function playFull(seed: number): MatchState {
  let s = initMatch(baseConfig(seed));
  let guard = 0;
  while (!s.ended && guard++ < 2000) {
    for (let i = 0; i < 4; i++) {
      const seat = s.seats[i];
      if (seat.controller.kind === "off") continue;
      let inner = 0;
      while (!s.seats[i].passed && !s.ended && inner++ < 50) {
        const intent = simpleIntent(s, i);
        const res = applySeatIntent(s, i, intent);
        if (res.ok) { s = res.state; }
        else if (intent.kind !== "pass") { const p = applySeatIntent(s, i, { kind: "pass" }); s = p.ok ? p.state : s; }
        else break;
      }
    }
    s = resolveTickIfReady(s);
  }
  return s;
}

console.log("── Детерминизм ──");
const a = initMatch(baseConfig(7));
const b = initMatch(baseConfig(7));
check("initMatch детерминирован", JSON.stringify(a) === JSON.stringify(b));
const f1 = playFull(7);
const f2 = playFull(7);
check("полный прогон детерминирован", JSON.stringify(f1) === JSON.stringify(f2));
const f3 = playFull(8);
check("другой seed → другое состояние", JSON.stringify(f1) !== JSON.stringify(f3));

console.log("── Полный прогон ──");
check("матч завершён", f1.ended === true);
check(`не больше ${TICKS_TOTAL} тактов`, f1.tick <= TICKS_TOTAL, `tick=${f1.tick}`);
check("outcomes на 4 места", (f1.outcomes?.length ?? 0) === 4);
check("winnerSeat определён (или явная ничья null)", f1.winnerSeat !== undefined);
check("победитель — не выключенное место", f1.winnerSeat == null || f1.seats[f1.winnerSeat].controller.kind !== "off");

console.log("── Инварианты карт ──");
for (let i = 0; i < 3; i++) {
  const seat = f1.seats[i];
  const all = [...seat.deck, ...seat.hand, ...seat.discard, ...seat.activeProjects.map((p) => p.cardId)];
  check(`место ${i}: карты не дублируются`, new Set(all).size === all.length, `${all.length - new Set(all).size} дублей`);
  check(`место ${i}: карты играны`, seat.discard.length + seat.activeProjects.length > 0);
}

console.log("── Выключенное место ──");
const offSeat = f1.seats[3];
check("off: рука пуста", offSeat.hand.length === 0);
check("off: нет сыгранных карт", offSeat.discard.length === 0 && offSeat.activeProjects.length === 0);
const offTry = applySeatIntent(initMatch(baseConfig(7)), 3, { kind: "pass" });
check("off: интент отклоняется", !offTry.ok && offTry.error === "SEAT_OFF");

console.log("── Приватность видов ──");
const mid = initMatch(baseConfig(9));
const view = toSeatView(mid, 0);
check("seat-view: нет порядка своей колоды", !("deck" in view.you));
check("seat-view: есть deckCounts по 6 колодам", Object.keys(view.you.deckCounts).length === 6);
check("seat-view: своя рука видна", Array.isArray(view.you.hand) && view.you.hand.length > 0);
const othersJson = JSON.stringify(view.others);
const otherHand = mid.seats[1].hand[0];
check("seat-view: чужая рука не утекает", !othersJson.includes(otherHand));
check("seat-view: сводка по остальным местам", view.others.length === 3);
const obs = toObserverView(mid);
check("observer-view: 4 места со счётчиками рук", obs.seats.length === 4 && obs.seats.every((s) => typeof s.handCount === "number"));

console.log("── Дилемма блокирует pass ──");
let ev = initMatch(baseConfig(11));
let guard = 0;
// докрутить до первого квартального рубежа, чтобы появились дилеммы
while (!ev.ended && ev.tick <= 3 && !ev.seats[0].pendingEvent && guard++ < 500) {
  for (let i = 0; i < 3; i++) {
    if (!ev.seats[i].passed) { const r = applySeatIntent(ev, i, { kind: "pass" }); if (r.ok) ev = r.state; }
  }
  ev = resolveTickIfReady(ev);
}
if (ev.seats[0].pendingEvent) {
  const blocked = applySeatIntent(ev, 0, { kind: "pass" });
  check("pass при pendingEvent → EVENT_PENDING", !blocked.ok && blocked.error === "EVENT_PENDING");
  const optId = ev.seats[0].pendingEvent.options[0].id;
  const chosen = applySeatIntent(ev, 0, { kind: "eventChoice", optionId: optId });
  check("eventChoice разрешает ход", chosen.ok);
} else {
  check("дилемма появилась на квартальном рубеже", false, `tick=${ev.tick}`);
}

console.log("── ИИ уровней 1–5 ──");
function aiConfig(seed: number, level1: 1 | 5): MatchConfig {
  return {
    ...baseConfig(seed),
    seats: [
      { rrsId: RRS_IDS[0], controller: { kind: "ai", level: level1 } },
      { rrsId: RRS_IDS[1], controller: { kind: "ai", level: 3 } },
      { rrsId: RRS_IDS[2], controller: { kind: "ai", level: 3 } },
      { rrsId: RRS_IDS[3], controller: { kind: "ai", level: 3 } },
    ],
  };
}
{
  const d1 = playFullMatch(aiConfig(100, 5));
  const d2 = playFullMatch(aiConfig(100, 5));
  check("playFullMatch детерминирован", JSON.stringify(d1) === JSON.stringify(d2));

  const SEEDS = Array.from({ length: 20 }, (_, i) => 1000 + i * 17);
  const avgTr = (level: 1 | 5): number => {
    let sum = 0;
    for (const seed of SEEDS) {
      const end = playFullMatch(aiConfig(seed, level));
      sum += end.outcomes?.[0].tr ?? 0;
    }
    return sum / SEEDS.length;
  };
  const tr5 = avgTr(5);
  const tr1 = avgTr(1);
  console.log(`  avg ТР: уровень 5 = ${tr5.toFixed(1)}, уровень 1 = ${tr1.toFixed(1)}`);
  check("уровень 5 сильнее уровня 1 (≥15%)", tr5 >= tr1 * 1.15, `5:${tr5.toFixed(1)} vs 1:${tr1.toFixed(1)}`);
  check("матчи ИИ завершаются", playFullMatch(aiConfig(555, 5)).ended);
}

console.log("── Скоринг per-seat ──");
{
  const SEEDS = Array.from({ length: 10 }, (_, i) => 3000 + i * 31);
  const avgScore = (level: 1 | 5): number => {
    let sum = 0; let n = 0;
    for (const seed of SEEDS) {
      const cfg = aiConfig(seed, level);
      const end = playFullMatch(cfg);
      const scores = computeSeatCompetencies(end.seats[0], cfg);
      const vals = Object.values(scores);
      check(`скоринг seed=${seed} ур.${level}: 12 компетенций в 0..5`,
        vals.length === 12 && vals.every((v) => v >= 0 && v <= 5));
      sum += vals.reduce((a, v) => a + v, 0) / vals.length; n++;
    }
    return sum / n;
  };
  const s5 = avgScore(5);
  const s1 = avgScore(1);
  console.log(`  средний балл: уровень 5 = ${s5.toFixed(2)}, уровень 1 = ${s1.toFixed(2)}`);
  check("скоринг различает силу игры (ур.5 > ур.1)", s5 > s1 + 0.25, `${s5.toFixed(2)} vs ${s1.toFixed(2)}`);
  check("средний балл сильной игры в разумной зоне (2.5..4.6)", s5 >= 2.5 && s5 <= 4.6, s5.toFixed(2));
}

console.log("── Баланс: сценарии × сложности × места ──");
{
  const SEEDS = Array.from({ length: 15 }, (_, i) => 7000 + i * 13);
  for (const scenario of SCENARIO_IDS) {
    for (const difficulty of [1, 3, 5] as const) {
      const trBySeat = [0, 0, 0, 0];
      let maxTick = 0;
      for (const seed of SEEDS) {
        const sc = SCENARIOS[scenario];
        const cfg: MatchConfig = {
          ...baseConfig(seed),
          scenario,
          difficulty,
          winMode: sc.winModeDefault,
          missionIds: sc.missionIds,
          keyMissionId: sc.keyMissionId,
          swanFrequency: sc.swanFrequencyDefault,
          seats: RRS_IDS.map((rrsId) => ({ rrsId, controller: { kind: "ai" as const, level: 5 as const } })),
        };
        const end = playFullMatch(cfg);
        if (!end.ended) { check(`${scenario}/d${difficulty} seed=${seed}: матч завершился`, false); continue; }
        maxTick = Math.max(maxTick, end.tick);
        end.outcomes?.forEach((o, i) => { trBySeat[i] += o.tr; });
      }
      const avgs = trBySeat.map((t) => t / SEEDS.length);
      const mn = Math.min(...avgs);
      const mx = Math.max(...avgs);
      const spread = mn > 0 ? (mx - mn) / mn : 1;
      console.log(`  ${scenario}/d${difficulty}: avg ТР по местам [${avgs.map((a) => a.toFixed(1)).join(", ")}], разброс ${(spread * 100).toFixed(0)}%, тиков ≤ ${maxTick}`);
      check(`${scenario}/d${difficulty}: нет доминирующего места (<25%)`, spread < 0.25, `${(spread * 100).toFixed(0)}%`);
      check(`${scenario}/d${difficulty}: партия ≤ 12 тактов`, maxTick <= TICKS_TOTAL);
    }
  }
}

if (failures > 0) { console.error(`\n${failures} проверок провалено`); process.exit(1); }
console.log("\nВсе проверки движка пройдены.");
