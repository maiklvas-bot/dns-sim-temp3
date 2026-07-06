import { useState, type CSSProperties } from "react";
import type { DeckId, MatchCardDef, ZrdSeatView } from "@shared/zrd/match-types";
import { DECK_VISUAL, cardArt, checkPlayable, handOfDeck } from "../../zrd-match-board";
import { formatEffects, formatCost } from "../../zrd-view";

/** Лицо карты матча: арт якоря (лист Canva) + кодовая плашка названия/эффектов по нижней границе. */
function CardFace({ card }: { card: MatchCardDef }) {
  const img = cardArt(card);
  const chips = formatEffects(card.effects).slice(0, 2);
  return (
    <span className="zrd-cardface">
      {img && <img src={img} alt={card.title} draggable={false} />}
      <span className="zrd-card-stats">
        <span className="zrd-card-stat is-good" style={{ fontWeight: 700 }}>{card.title}</span>
        {chips.map((s, i) => (
          <span key={i} className={`zrd-card-stat ${s.positive ? "is-good" : "is-bad"}`}>{s.text}</span>
        ))}
      </span>
    </span>
  );
}

/**
 * Личная колода места (правый край). Стопка показывает остаток в колоде;
 * веер — карты ЭТОЙ колоды в руке. Выбор → крупно → «Разыграть» (интент playCard).
 * Раскрытием управляет борд (глагол слева тоже открывает свою колоду).
 */
export function ZrdDeck({ deckId, view, open, onToggle, onPlay }: { deckId: DeckId; view: ZrdSeatView; open: boolean; onToggle: () => void; onPlay: (cardId: string) => void }) {
  const visual = DECK_VISUAL[deckId];
  const [sel, setSel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);

  const hand = handOfDeck(view.you, deckId);
  const remaining = view.you.deckCounts[deckId] ?? 0;
  const selected = hand.find((c) => c.id === sel) ?? null;

  const play = (c: MatchCardDef) => {
    setPlaying(true);
    window.setTimeout(() => {
      onPlay(c.id);
      setPlaying(false);
      setSel(null);
      if (open) onToggle();
    }, 340);
  };

  return (
    // увёл мышь из области колоды (стопка + веер) → веер закрывается сам; крупный просмотр (sel) не трогаем
    <div className={`zrd-deck${open ? " is-open" : ""}`}
      style={{ "--acc": visual.accent, "--card-aspect": visual.cardAspect } as CSSProperties}
      onMouseLeave={() => { if (open && !sel) onToggle(); }}>
      <button type="button" className="zrd-deck__pile"
        onClick={() => { onToggle(); setSel(null); }}
        title={`Колода «${visual.name}»: в руке ${hand.length}, в колоде ${remaining}`}>
        <img src={visual.pile} alt={`Колода ${visual.name}: в руке ${hand.length}, в колоде ${remaining}`} draggable={false} />
      </button>

      {/* Веер — карты этой колоды в руке (чужие руки и порядок колоды не видны никому) */}
      <div className="zrd-deck__fan">
        {hand.length === 0 && open && (
          <span className="zrd-deck__card" style={{ zIndex: 1, display: "flex", alignItems: "center", justifyContent: "center", color: "rgba(255,255,255,0.5)", fontSize: 11, padding: 8 }}>
            Нет карт этой колоды в руке — добор в начале месяца
          </span>
        )}
        {/* без inline z-index: иначе он перебивает hover-подъём карты на первый план */}
        {hand.map((c) => (
          <button key={c.id} type="button" className="zrd-deck__card"
            onClick={() => setSel(c.id)} title={c.title}>
            <CardFace card={c} />
          </button>
        ))}
      </div>

      {selected && (
        <div className="zrd-deck__overlay" onClick={() => { if (!playing) setSel(null); }}>
          <div className={`zrd-deck__preview${playing ? " is-playing" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="zrd-deck__preview-card"><CardFace card={selected} /></div>
            {!playing && (() => {
              const check = checkPlayable(view.you, selected);
              const cost = formatCost(selected.cost);
              return (
                <div className="zrd-deck__actions">
                  <button type="button" className="zrd-deck__play" disabled={!check.ok}
                    onClick={() => play(selected)} style={{ background: visual.accent }}
                    title={check.ok
                      ? `Разыграть: ${selected.title}${cost ? ` (${cost})` : ""}${selected.durationWeeks > 0 ? ` · проект ${selected.durationWeeks} нед.` : ""}`
                      : check.reason}>
                    {selected.durationWeeks > 0 ? `Запустить (${selected.durationWeeks} нед.)` : "Разыграть"}{cost ? ` · ${cost}` : ""}
                  </button>
                  <button type="button" className="zrd-deck__close" onClick={() => setSel(null)}>Закрыть</button>
                </div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
