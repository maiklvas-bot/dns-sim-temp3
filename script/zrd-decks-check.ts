/**
 * ЗРД v2 — проверка контента: колоды 6×50, инварианты карт.
 * Запуск: npx tsx script/zrd-decks-check.ts
 * Расширяется секциями лебедей/миссий/сценариев (задачи 1.3–1.4 плана).
 */
import { MATCH_DECK_CARDS, DECK_ANCHORS, getMatchCard } from "../shared/zrd/content-decks";
import { BLACK_SWANS, SWAN_TICK_PROBABILITY, getSwan } from "../shared/zrd/content-swans";
import { DECK_IDS } from "../shared/zrd/match-types";
import type { DeckId } from "../shared/zrd/match-types";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) { console.log(`  ok  ${name}`); }
  else { failures++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

console.log("── Колоды 6×50 ──");
check("всего 300 карт", MATCH_DECK_CARDS.length === 300, `получено ${MATCH_DECK_CARDS.length}`);

const byDeck = new Map<DeckId, number>();
for (const c of MATCH_DECK_CARDS) byDeck.set(c.deck, (byDeck.get(c.deck) ?? 0) + 1);
for (const d of DECK_IDS) check(`колода ${d}: 50 карт`, byDeck.get(d) === 50, `получено ${byDeck.get(d) ?? 0}`);

const ids = new Set(MATCH_DECK_CARDS.map((c) => c.id));
check("id карт уникальны", ids.size === MATCH_DECK_CARDS.length);

for (const d of DECK_IDS) {
  const anchors = DECK_ANCHORS[d];
  check(`колода ${d}: 9 якорей`, anchors.length === 9, `получено ${anchors.length}`);
  const anchorIds = new Set(anchors.map((a) => a.anchorId));
  const bad = MATCH_DECK_CARDS.filter((c) => c.deck === d && !anchorIds.has(c.anchorId));
  check(`колода ${d}: anchorId каждой карты ∈ якорей`, bad.length === 0, bad.slice(0, 3).map((c) => c.id).join(","));
}

const noPrice = MATCH_DECK_CARDS.filter((c) => {
  const costSum = Object.values(c.cost).reduce((a, v) => a + (v ?? 0), 0);
  const givesCapital = (c.effects.resources?.capital ?? 0) > 0;
  return costSum <= 0 && !givesCapital; // «бесплатные» допустимы только как трейд-офф с доходом
});
check("у каждой карты есть цена или это трейд-офф с доходом", noPrice.length === 0, noPrice.slice(0, 3).map((c) => c.id).join(","));

const t3NoCond = MATCH_DECK_CARDS.filter((c) => c.tier === 3 && !c.condition);
check("у tier-3 есть condition", t3NoCond.length === 0, t3NoCond.slice(0, 3).map((c) => c.id).join(","));

const noTags = MATCH_DECK_CARDS.filter((c) => c.competencyTags.length === 0);
check("у всех карт есть competencyTags", noTags.length === 0, noTags.slice(0, 3).map((c) => c.id).join(","));

const badDuration = MATCH_DECK_CARDS.filter((c) => c.durationWeeks < 0 || c.durationWeeks > 8);
check("durationWeeks в диапазоне 0..8", badDuration.length === 0);

const titles = new Set(MATCH_DECK_CARDS.map((c) => `${c.deck}:${c.title}`));
check("названия внутри колоды уникальны", titles.size === MATCH_DECK_CARDS.length);

check("getMatchCard находит карту", getMatchCard(MATCH_DECK_CARDS[0].id)?.id === MATCH_DECK_CARDS[0].id);
check("getMatchCard: неизвестный id → undefined", getMatchCard("nope") === undefined);

console.log("── Чёрные лебеди ──");
check("14 лебедей", BLACK_SWANS.length === 14, `получено ${BLACK_SWANS.length}`);
const swanIds = new Set(BLACK_SWANS.map((s) => s.id));
check("id лебедей уникальны", swanIds.size === BLACK_SWANS.length);
for (const s of BLACK_SWANS) {
  check(`${s.id}: ≥2 опций`, s.options.length >= 2);
  const free = s.options.filter((o) => {
    const sum = Object.values(o.cost ?? {}).reduce((a, v) => a + (v ?? 0), 0);
    return sum === 0;
  });
  check(`${s.id}: есть бесплатная опция`, free.length >= 1);
  check(`${s.id}: durationWeeks > 0`, s.durationWeeks > 0);
  const optIds = new Set(s.options.map((o) => o.id));
  check(`${s.id}: id опций уникальны`, optIds.size === s.options.length);
  const hasPenalty = Boolean(s.tickPenalty.metrics || s.tickPenalty.resources);
  check(`${s.id}: есть штраф за такт`, hasPenalty);
}
const scopes = new Set(BLACK_SWANS.map((s) => s.scope));
check("есть и local, и global", scopes.has("local") && scopes.has("global"));
check("частоты: off=0 и по возрастанию", SWAN_TICK_PROBABILITY.off === 0
  && SWAN_TICK_PROBABILITY.rare < SWAN_TICK_PROBABILITY.standard
  && SWAN_TICK_PROBABILITY.standard < SWAN_TICK_PROBABILITY.storm);
check("getSwan находит лебедя", getSwan(BLACK_SWANS[0].id)?.id === BLACK_SWANS[0].id);

if (failures > 0) { console.error(`\n${failures} проверок провалено`); process.exit(1); }
console.log("\nВсе проверки контента пройдены.");
