/**
 * Симуляция ЗРД — харнесс Фазы 1/2 (запуск: `npx tsx script/zrd-sim.ts`).
 * Гоняет полные партии через политику, проверяет:
 *  1) детерминизм (один seed → один результат),
 *  2) баланс (разные стратегии дают сопоставимый ТР, нет доминирующей),
 *  3) дифференциацию скоринга (разные «персоны» → разные профили компетенций).
 * Падает с кодом 1, если проверки не прошли (как тест).
 */
import { initState, applyIntent } from "../shared/zrd/engine";
import { computeCompetencies } from "../shared/zrd/scoring";
import { chooseIntent, type PolicyOptions } from "../shared/zrd/ai";
import { EVENT_CARDS } from "../shared/zrd/content";
import type { ZrdConfig, ZrdState, StrategyKey, CompetencyScores } from "../shared/zrd/types";
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

function fmtMetrics(s: ZrdState): string {
  const m = s.outcome!.metrics;
  return `S${m.sales}/N${m.nps}/O${m.coverage}`;
}

let failures = 0;
function check(name: string, cond: boolean, info = "") {
  console.log(`${cond ? "  ✅" : "  ❌"} ${name}${info ? " — " + info : ""}`);
  if (!cond) failures++;
}

// ── 0. Инварианты контента (§8a: ход всегда возможен) ──────────────────────
console.log("\n=== 0. Инварианты контента ===");
{
  const noFree = EVENT_CARDS.filter((ev) => !ev.options.some((o) => !o.cost || Object.values(o.cost).every((v) => !v)));
  check("у каждого события есть бесплатный вариант (нет тупика)", noFree.length === 0,
    noFree.length ? `без free: ${noFree.map((e) => e.id).join(", ")}` : "");
}

// ── 1. Детерминизм ─────────────────────────────────────────────────────────
console.log("\n=== 1. Детерминизм ===");
{
  const cfg: ZrdConfig = { difficulty: 3, quarters: 4, seed: 42, strategy: null };
  const a = playGame(cfg, { style: "balanced", strategy: "service" });
  const b = playGame(cfg, { style: "balanced", strategy: "service" });
  check("один seed → один ТР", a.outcome!.tr === b.outcome!.tr, `tr=${a.outcome!.tr}`);
  check("один seed → одинаковый лог", a.log.length === b.log.length, `len=${a.log.length}`);
  check("партия завершилась", a.ended && a.outcome!.quartersPlayed <= 4);
}

// ── 2. Баланс стратегий ────────────────────────────────────────────────────
console.log("\n=== 2. Баланс стратегий (L3, balanced) ===");
{
  const strategies: StrategyKey[] = ["service", "expansion", "efficiency"];
  const trs: number[] = [];
  for (const strat of strategies) {
    const results: number[] = [];
    for (const seed of [42, 101, 777]) {
      const s = playGame({ difficulty: 3, quarters: 4, seed, strategy: null }, { style: "balanced", strategy: strat });
      results.push(s.outcome!.tr);
    }
    const avg = Math.round((results.reduce((a, b) => a + b, 0) / results.length) * 10) / 10;
    trs.push(avg);
    console.log(`  ${strat.padEnd(11)} avg ТР=${avg}  (seeds: ${results.join(", ")})`);
  }
  const spread = Math.max(...trs) - Math.min(...trs);
  check("нет доминирующей стратегии (разброс avg ТР ≤ 6)", spread <= 6, `разброс=${spread.toFixed(1)}`);
  check("все стратегии играбельны (рост с базы 6 → ТР ≥ 10)", trs.every((t) => t >= 10), `min=${Math.min(...trs)}`);
}

// ── 3. Дифференциация скоринга (персоны, усреднение по seed) ────────────────
console.log("\n=== 3. Дифференциация скоринга (L3, среднее по 5 seed) ===");
const SEEDS = [42, 101, 777, 1234, 2026];
const STYLES = ["planner", "balanced", "improviser", "weak", "risktaker"] as const;

function avgProfile(style: (typeof STYLES)[number]): CompetencyScores {
  const acc = COMPETENCY_KEYS.reduce((a, k) => { a[k] = 0; return a; }, {} as CompetencyScores);
  for (const seed of SEEDS) {
    const prof = computeCompetencies(playGame({ difficulty: 3, quarters: 4, seed, strategy: null }, { style }));
    for (const k of COMPETENCY_KEYS) acc[k] += prof[k];
  }
  for (const k of COMPETENCY_KEYS) acc[k] = Math.round((acc[k] / SEEDS.length) * 10) / 10;
  return acc;
}
const profiles: Record<string, CompetencyScores> = {};
for (const style of STYLES) profiles[style] = avgProfile(style);

console.log("  " + "компетенция".padEnd(30) + STYLES.map((x) => x.slice(0, 6).padStart(8)).join(""));
for (const k of COMPETENCY_KEYS) {
  const row = STYLES.map((st) => profiles[st][k].toFixed(1).padStart(8)).join("");
  console.log("  " + COMPETENCY_LABEL[k].padEnd(30) + row);
}
const overall = (p: CompetencyScores) => Math.round((COMPETENCY_KEYS.reduce((a, k) => a + p[k], 0) / COMPETENCY_KEYS.length) * 10) / 10;
console.log("  " + "СРЕДНЕЕ ПО ПРОФИЛЮ".padEnd(30) + STYLES.map((st) => overall(profiles[st]).toFixed(1).padStart(8)).join(""));
console.log("");

// Слабая игра должна проседать по «жёстким» (наблюдаемым) компетенциям
const hardComps = ["planning", "decision_making", "result_orientation", "team_motivation", "critical_thinking"] as const;
const weakBelow = hardComps.filter((k) => profiles.weak[k] < profiles.balanced[k]).length;
check("weak < balanced по ≥4 из 5 «жёстких» компетенций", weakBelow >= 4, `${weakBelow}/5`);
check("общий профиль weak ниже balanced", overall(profiles.weak) < overall(profiles.balanced),
  `${overall(profiles.weak)} vs ${overall(profiles.balanced)}`);
// Планировщик-аналитик выделяется на различающих компетенциях
const discr = ["analytical", "planning", "goal_setting"] as const;
const plannerAbove = discr.filter((k) => profiles.planner[k] >= profiles.balanced[k]).length;
check("planner ≥ balanced по аналитике/планированию/цели", plannerAbove === 3, `${plannerAbove}/3`);
check("planner.Аналитика заметно выше weak (≥1.5 разрыв)", profiles.planner.analytical - profiles.weak.analytical >= 1.5,
  `${profiles.planner.analytical} vs ${profiles.weak.analytical}`);
// Средний игрок — в середине шкалы (не упирается в потолок/пол)
check("balanced средний профиль в полосе [2.5,4.0]", overall(profiles.balanced) >= 2.5 && overall(profiles.balanced) <= 4.0,
  `${overall(profiles.balanced)}`);
check("все баллы в диапазоне 0..5", Object.values(profiles).every((p) => COMPETENCY_KEYS.every((k) => p[k] >= 0 && p[k] <= 5)));

console.log(`\n=== Итог: ${failures === 0 ? "ВСЕ ПРОВЕРКИ ПРОШЛИ ✅" : failures + " проверок упало ❌"} ===\n`);
process.exit(failures === 0 ? 0 : 1);
