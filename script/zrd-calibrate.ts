/**
 * Калибровка скоринга ЗРД (Фаза 2): средние «сырые» сигналы по персонам и seed'ам.
 * Из этих чисел выставляется EXPECTED_MAX, чтобы balanced ≈ 3.0, weak низко, planner/strong высоко.
 * Запуск: `npx tsx script/zrd-calibrate.ts`
 */
import { initState, applyIntent } from "../shared/zrd/engine";
import { computeRaw } from "../shared/zrd/scoring";
import { chooseIntent, type PlayStyle, type PolicyOptions } from "../shared/zrd/ai";
import type { ZrdConfig, ZrdState, CompetencyKey } from "../shared/zrd/types";
import { COMPETENCY_KEYS, COMPETENCY_LABEL } from "../shared/zrd/types";

function fallback(s: ZrdState): ZrdState {
  if (s.phase === "setup") return applyIntent(s, { kind: "declareStrategy", strategy: "service" }).state;
  if (s.phase === "research") return applyIntent(s, { kind: "keepCards", cardIds: [] }).state;
  if (s.phase === "action") return applyIntent(s, { kind: "pass" }).state;
  if (s.phase === "event" && s.pendingEvent) return applyIntent(s, { kind: "eventChoice", optionId: s.pendingEvent.options[0].id }).state;
  return s;
}
function playGame(config: ZrdConfig, opts: PolicyOptions): ZrdState {
  let s = initState(config);
  let guard = 0;
  while (!s.ended && guard++ < 2000) {
    const res = applyIntent(s, chooseIntent(s, opts));
    s = res.ok ? res.state : fallback(s);
  }
  return s;
}

const SEEDS = Array.from({ length: 30 }, (_, i) => i * 37 + 1);
const STYLES: PlayStyle[] = ["weak", "improviser", "balanced", "planner"];

const avgRaw: Record<PlayStyle, Record<CompetencyKey, number>> = {} as any;
for (const style of STYLES) {
  const acc = COMPETENCY_KEYS.reduce((a, k) => { a[k] = 0; return a; }, {} as Record<CompetencyKey, number>);
  for (const seed of SEEDS) {
    const s = playGame({ difficulty: 3, quarters: 4, seed, strategy: null }, { style });
    const raw = computeRaw(s);
    for (const k of COMPETENCY_KEYS) acc[k] += raw[k];
  }
  for (const k of COMPETENCY_KEYS) acc[k] = Math.round((acc[k] / SEEDS.length) * 100) / 100;
  avgRaw[style] = acc;
}

console.log("\nСредний сырой сигнал по компетенциям (L3, 30 seed):");
console.log("  " + "компетенция".padEnd(30) + STYLES.map((x) => x.slice(0, 6).padStart(9)).join("") + "   reco_max");
for (const k of COMPETENCY_KEYS) {
  const row = STYLES.map((st) => avgRaw[st][k].toFixed(2).padStart(9)).join("");
  // reco EXPECTED_MAX: чтобы balanced ≈ 3.0 → max = balanced_raw / 0.5
  const recoMax = Math.max(1, Math.round(avgRaw.balanced[k] / 0.5));
  console.log("  " + COMPETENCY_LABEL[k].padEnd(30) + row + `   ${recoMax}`);
}
console.log("");
