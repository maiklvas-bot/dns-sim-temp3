/**
 * ЗРД v2 — презентационный слой борда матча: арт карт (якоря Canva из zrd-decks.ts),
 * доступность карт, чипы эффектов. Механика — @shared/zrd/*; здесь только отображение.
 */
import type { Metrics, Resources } from "@shared/zrd/types";
import type { DeckId, MatchCardDef, ZrdSeatView } from "@shared/zrd/match-types";
import { getMatchCard } from "@shared/zrd/content-decks";
import {
  STAFF_DECK, GOODS_DECK, LOGISTICS_DECK, SERVICE_DECK, PROMO_DECK, PROJECTS_DECK,
  type ZrdDeckDef,
} from "./zrd-decks";

/** Колоды матча → визуальные листы Canva (id карт листа = anchorId контента). */
export const DECK_VISUAL: Record<DeckId, ZrdDeckDef> = {
  promo: PROMO_DECK,
  service: SERVICE_DECK,
  logistics: LOGISTICS_DECK,
  goods: GOODS_DECK,
  staff: STAFF_DECK,
  projects: PROJECTS_DECK,
};

const ANCHOR_ART = new Map<string, string>();
for (const deck of Object.values(DECK_VISUAL)) {
  for (const c of deck.cards) ANCHOR_ART.set(c.id, c.img);
}
/** Арт карты матча: по якорю (лист Canva); вариации переиспользуют арт якоря. */
export function cardArt(card: MatchCardDef): string | undefined {
  return ANCHOR_ART.get(card.anchorId);
}

export type YouState = ZrdSeatView["you"];

export function affordable(res: Resources, cost?: Partial<Resources>): boolean {
  if (!cost) return true;
  return Object.entries(cost).every(([k, v]) => (res as Record<string, number>)[k] >= (v ?? 0));
}

export function conditionMet(you: Pick<YouState, "metrics" | "resources">, cond?: MatchCardDef["condition"]): boolean {
  if (!cond) return true;
  if (cond.minMetric) {
    for (const [k, v] of Object.entries(cond.minMetric)) {
      if ((you.metrics[k as keyof Metrics] ?? 0) < (v ?? 0)) return false;
    }
  }
  if (cond.minResource) {
    for (const [k, v] of Object.entries(cond.minResource)) {
      if ((you.resources[k as keyof Resources] ?? 0) < (v ?? 0)) return false;
    }
  }
  return true;
}

export interface CardCheck { ok: boolean; reason?: string }

export function checkPlayable(you: YouState, card: MatchCardDef): CardCheck {
  if (you.passed) return { ok: false, reason: "Ход завершён — ждём остальных" };
  if (you.actionsLeft <= 0) return { ok: false, reason: "Нет действий в этом месяце" };
  if (!affordable(you.resources, card.cost)) return { ok: false, reason: "Не хватает ресурсов" };
  if (!conditionMet(you, card.condition)) return { ok: false, reason: "Не выполнено условие карты" };
  return { ok: true };
}

/** Карты руки, принадлежащие колоде. */
export function handOfDeck(you: YouState, deckId: DeckId): MatchCardDef[] {
  return you.hand
    .map((id) => getMatchCard(id))
    .filter((c): c is MatchCardDef => Boolean(c && c.deck === deckId));
}

/** Сброшенные карты (по порядку сброса). */
export function discardCards(you: YouState): MatchCardDef[] {
  return you.discard
    .map((id) => getMatchCard(id))
    .filter((c): c is MatchCardDef => Boolean(c));
}
