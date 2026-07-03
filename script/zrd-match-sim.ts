/**
 * ЗРД v2 — харнесс движка матча: детерминизм, инварианты, приватность seat-view.
 * Запуск: npx tsx script/zrd-match-sim.ts
 * Секции ИИ/баланса добавляются задачами 1.6–1.7 плана.
 */
import {
  initMatch, applySeatIntent, resolveTickIfReady, toSeatView, toObserverView,
} from "../shared/zrd/match-engine";
import { getMatchCard } from "../shared/zrd/content-decks";
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

if (failures > 0) { console.error(`\n${failures} проверок провалено`); process.exit(1); }
console.log("\nВсе проверки движка пройдены.");
