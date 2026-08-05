/**
 * Симуляция ЗРД — прогон полной партии политикой (для AI-оппонента на сервере и тестов).
 * Чистая детерминированная обёртка над initState/applyIntent/chooseIntent.
 */
import type { ZrdConfig, ZrdState } from "./types";
import { initState, applyIntent } from "./engine";
import { chooseIntent, type PolicyOptions } from "./ai";

/** Гарантирует прогресс, если политика вернула неприменимое намерение (страховка от зацикливания). */
function fallbackIntent(s: ZrdState): ZrdState {
  if (s.phase === "setup") return applyIntent(s, { kind: "declareStrategy", strategy: "service" }).state;
  if (s.phase === "research") return applyIntent(s, { kind: "keepCards", cardIds: [] }).state;
  if (s.phase === "action") return applyIntent(s, { kind: "pass" }).state;
  if (s.phase === "event" && s.pendingEvent) {
    // выбираем гарантированно доступный (бесплатный) вариант — инвариант: он всегда есть
    const free = s.pendingEvent.options.find((o) => !o.cost || Object.values(o.cost).every((v) => !v)) ?? s.pendingEvent.options[0];
    return applyIntent(s, { kind: "eventChoice", optionId: free.id }).state;
  }
  return s;
}

/** Играет партию до конца выбранной политикой и возвращает финальное состояние. */
export function playFullGame(config: ZrdConfig, opts: PolicyOptions = {}): ZrdState {
  let s = initState(config);
  let guard = 0;
  while (!s.ended && guard++ < 2000) {
    const res = applyIntent(s, chooseIntent(s, opts));
    s = res.ok ? res.state : fallbackIntent(s);
  }
  return s;
}
