import { useState, type CSSProperties } from "react";
import type { PublicZrdState } from "@shared/zrd/engine";
import type { StandardAction, Resources } from "@shared/zrd/types";
import { STANDARD_ACTIONS } from "@shared/zrd/content";
import type { ZrdDeckDef, ZrdDeckCard } from "../../zrd-decks";

/** Лицо карты: оригинальный арт + (опц.) кодовая плашка показателей по нижней границе. */
function CardFace({ card }: { card: ZrdDeckCard }) {
  return (
    <span className="zrd-cardface">
      <img src={card.img} alt={card.title} draggable={false} />
      {card.stats && card.stats.length > 0 && (
        <span className="zrd-card-stats">
          {card.stats.map((s, i) => (
            <span key={i} className={`zrd-card-stat ${s.good ? "is-good" : "is-bad"}`}>{s.text}</span>
          ))}
        </span>
      )}
    </span>
  );
}

/** Универсальная колода (левый край). Клик → ВСЕ карты выезжают вправо → выбор → крупно → «Разыграть». */
export function ZrdDeck({ deck, state, onPlay }: { deck: ZrdDeckDef; state: PublicZrdState; onPlay: (a: StandardAction) => void }) {
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const selected = deck.cards.find((c) => c.id === sel) ?? null;

  const canAct = state.phase === "action" && state.actionsLeft > 0;
  const afford = (a: StandardAction) =>
    Object.entries(STANDARD_ACTIONS[a].cost).every(([k, v]) => (state.player.resources[k as keyof Resources] ?? 0) >= (v ?? 0));
  const playable = (c: ZrdDeckCard) => canAct && afford(c.action);

  const play = (c: ZrdDeckCard) => {
    setPlaying(true);
    window.setTimeout(() => {
      onPlay(c.action);
      setPlaying(false);
      setSel(null);
      setOpen(false);
    }, 340);
  };

  return (
    <div className={`zrd-deck${open ? " is-open" : ""}`} style={{ "--acc": deck.accent, "--card-aspect": deck.cardAspect } as CSSProperties}>
      {/* Стопка — оригинальная картинка листа (ширину колонки задаёт явный width, img её не раздувает) */}
      <button type="button" className="zrd-deck__pile"
        onClick={() => { setOpen((o) => !o); setSel(null); }}
        title={`Колода «${deck.name}» (${deck.cards.length})`}>
        <img src={deck.pile} alt={`Колода ${deck.name}`} draggable={false} />
      </button>

      {/* Веер — ВСЕ карты колоды */}
      <div className="zrd-deck__fan">
        {deck.cards.map((c, i) => (
          <button key={c.id} type="button" className="zrd-deck__card" style={{ zIndex: i + 1 }}
            onClick={() => { setOpen(true); setSel(c.id); }} title={c.title}>
            <CardFace card={c} />
          </button>
        ))}
      </div>

      {selected && (
        <div className="zrd-deck__overlay" onClick={() => { if (!playing) setSel(null); }}>
          <div className={`zrd-deck__preview${playing ? " is-playing" : ""}`} onClick={(e) => e.stopPropagation()}>
            <div className="zrd-deck__preview-card"><CardFace card={selected} /></div>
            {!playing && (
              <div className="zrd-deck__actions">
                <button type="button" className="zrd-deck__play" disabled={!playable(selected)}
                  onClick={() => play(selected)} style={{ background: deck.accent }}
                  title={playable(selected) ? `Разыграть: ${selected.title}` : "Недоступно (фаза/ходы/ресурсы)"}>
                  Разыграть
                </button>
                <button type="button" className="zrd-deck__close" onClick={() => setSel(null)}>Закрыть</button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
