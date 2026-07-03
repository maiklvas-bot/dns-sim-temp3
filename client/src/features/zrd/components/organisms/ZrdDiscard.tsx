import { useState } from "react";
import type { ZrdSeatView } from "@shared/zrd/match-types";
import { DECK_VISUAL, cardArt, discardCards } from "../../zrd-match-board";

/**
 * Колода сброса — светящаяся оранжевая кнопка (стиль референса DAHNebr3cXQ).
 * Клик открывает СВОЙ сброс: какие карты уже разыграны за партию (чужой сброс закрыт).
 */
export function ZrdDiscard({ view }: { view: ZrdSeatView }) {
  const [open, setOpen] = useState(false);
  const cards = discardCards(view.you);
  return (
    <>
      <button type="button" className="zrd-discard" onClick={() => setOpen(true)}
        title={`Колода для сброса (${cards.length}) — открыть`}
        aria-label={`Колода для сброса: ${cards.length} карт, открыть список`}>
        <span className="zrd-discard__gloss" aria-hidden />
        <span className="zrd-discard__bolt zrd-discard__bolt--tl" aria-hidden />
        <span className="zrd-discard__bolt zrd-discard__bolt--tr" aria-hidden />
        <span className="zrd-discard__bolt zrd-discard__bolt--bl" aria-hidden />
        <span className="zrd-discard__bolt zrd-discard__bolt--br" aria-hidden />
        <span className="zrd-discard__label">КОЛОДА<br />для СБРОСА</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(8,12,22,0.66)", backdropFilter: "blur(3px)" }}
          role="dialog" aria-modal="true" aria-label="Колода для сброса" onClick={() => setOpen(false)}>
          <div className="zrd-panel w-full max-w-3xl p-5" style={{ background: "var(--zrd-surface-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-extrabold" style={{ color: "var(--zrd-text)" }}>Сброшенные карты</h2>
              <span className="text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>{cards.length} за партию · виден только вам</span>
              <button type="button" className="ml-auto rounded-lg border px-2.5 py-1 text-sm"
                style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text-dim)", cursor: "pointer" }}
                onClick={() => setOpen(false)}>Закрыть</button>
            </div>
            {cards.length === 0 ? (
              <p className="text-sm" style={{ color: "var(--zrd-text-dim)" }}>Пока пусто — сыгранные карты будут появляться здесь.</p>
            ) : (
              <div className="grid max-h-[60vh] grid-cols-3 gap-2 overflow-y-auto sm:grid-cols-4 md:grid-cols-5">
                {cards.map((c) => {
                  const img = cardArt(c);
                  return (
                    <div key={c.id} className="rounded-lg border p-1.5 text-center" style={{ borderColor: `${DECK_VISUAL[c.deck].accent}55` }}>
                      {img && <img src={img} alt="" className="mb-1 w-full rounded" draggable={false} />}
                      <div className="text-[11px] font-semibold leading-tight" style={{ color: "var(--zrd-text)" }}>{c.title}</div>
                      <div className="text-[10px]" style={{ color: DECK_VISUAL[c.deck].accent }}>{DECK_VISUAL[c.deck].name}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
