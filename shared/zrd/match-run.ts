/**
 * ЗРД v2 — автопрогон матча (ИИ за все места). Для харнесса баланса и финализации:
 * детерминирован по seed конфига. Человеческие места тоже играются ИИ уровня 3
 * (для симуляций «как сыграл бы средний игрок»), если не передан aiForHumans=false.
 */
import type { MatchConfig, MatchState, AiLevel } from "./match-types";
import { initMatch, applySeatIntent, resolveTickIfReady } from "./match-engine";
import { chooseSeatIntent } from "./match-ai";

// локальный mulberry32 — независимый поток случайности для ε-шума ИИ
function nextRng(state: number): { value: number; state: number } {
  let t = (state + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, state: t >>> 0 };
}

/** Полный матч: ИИ ходит за все активные места (human-места — как ИИ humanLevel). */
export function playFullMatch(config: MatchConfig, humanLevel: AiLevel = 3): MatchState {
  let s = initMatch(config);
  // human-места на время прогона считаем ИИ заданного уровня
  const original = config.seats.map((x) => x.controller);
  s.seats.forEach((seat) => {
    if (seat.controller.kind === "human") seat.controller = { kind: "ai", level: humanLevel };
  });
  let rng = (config.seed ^ 0x9e3779b9) >>> 0;
  let guard = 0;
  while (!s.ended && guard++ < 3000) {
    let acted = false;
    for (let i = 0; i < 4; i++) {
      const seat = s.seats[i];
      if (seat.controller.kind !== "ai" || seat.passed) continue;
      let inner = 0;
      while (!s.seats[i].passed && !s.ended && inner++ < 60) {
        const r = nextRng(rng); rng = r.state;
        const intent = chooseSeatIntent(s, i, r.value);
        const res = applySeatIntent(s, i, intent);
        if (res.ok) { s = res.state; acted = true; }
        else {
          const p = applySeatIntent(s, i, { kind: "pass" });
          if (p.ok) { s = p.state; acted = true; }
          break;
        }
        if (intent.kind === "pass") break;
      }
    }
    const before = s.tick;
    s = resolveTickIfReady(s);
    if (!acted && s.tick === before && !s.ended) break; // защита от зависания
  }
  // восстановить контроллеры (для консистентности отчётов)
  s.seats.forEach((seat, i) => { seat.controller = original[i]; });
  return s;
}
