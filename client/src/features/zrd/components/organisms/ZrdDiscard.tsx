import { useState } from "react";
import type { ZrdSeatView } from "@shared/zrd/match-types";
import { DECK_IDS, DECK_LABEL } from "@shared/zrd/match-types";
import { DECK_VISUAL, cardArt, discardCards } from "../../zrd-match-board";

/**
 * Две служебные колоды (стиль референса DAHNebr3cXQ):
 * «Сброс» (оранжевая) — разыгранные карты, открывается список (виден только вам);
 * «Раздача» (синяя) — карты, выданные на игру и ждущие добора: видно только количество
 * по направлениям, содержимое скрыто до добора (никто не знает будущих карт).
 */
export function ZrdDiscard({ view, only }: { view: ZrdSeatView; only?: "discard" | "deal" }) {
  const [open, setOpen] = useState<"discard" | "deal" | null>(null);
  const cards = discardCards(view.you);
  const dealTotal = DECK_IDS.reduce((a, d) => a + (view.you.deckCounts[d] ?? 0), 0);

  return (
    <>
      <div style={{ display: "flex", gap: 8, height: "100%", flexShrink: 0, justifyContent: "center" }}>
        {only !== "deal" && (
        <button type="button" className="zrd-discard" onClick={() => setOpen("discard")}
          title={`Сброс (${cards.length}) — разыгранные карты, открыть`}
          aria-label={`Сброс: ${cards.length} разыгранных карт, открыть список`}>
          <span className="zrd-discard__gloss" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--tl" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--tr" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--bl" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--br" aria-hidden />
          <span className="zrd-discard__label">СБРОС<br />{cards.length}</span>
        </button>
        )}

        {only !== "discard" && (
        <button type="button" className="zrd-discard zrd-discard--deal" onClick={() => setOpen("deal")}
          title={`Раздача (${dealTotal}) — карты, выданные на игру; содержимое скрыто до добора`}
          aria-label={`Раздача: ${dealTotal} карт ждут добора, открыть сводку`}>
          <span className="zrd-discard__gloss" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--tl" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--tr" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--bl" aria-hidden />
          <span className="zrd-discard__bolt zrd-discard__bolt--br" aria-hidden />
          <span className="zrd-discard__label">РАЗДАЧА<br />{dealTotal}</span>
        </button>
        )}
      </div>

      {open === "discard" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(8,12,22,0.66)", backdropFilter: "blur(3px)" }}
          role="dialog" aria-modal="true" aria-label="Сброс — разыгранные карты" onClick={() => setOpen(null)}>
          <div className="zrd-panel w-full max-w-3xl p-5" style={{ background: "var(--zrd-surface-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-extrabold" style={{ color: "var(--zrd-text)" }}>Сброс — разыгранные карты</h2>
              <span className="text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>{cards.length} за партию · виден только вам</span>
              <button type="button" className="ml-auto rounded-lg border px-2.5 py-1 text-sm"
                style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text-dim)", cursor: "pointer" }}
                onClick={() => setOpen(null)}>Закрыть</button>
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

      {open === "deal" && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(8,12,22,0.66)", backdropFilter: "blur(3px)" }}
          role="dialog" aria-modal="true" aria-label="Раздача — карты, выданные на игру" onClick={() => setOpen(null)}>
          <div className="zrd-panel w-full max-w-md p-5" style={{ background: "var(--zrd-surface-2)" }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-lg font-extrabold" style={{ color: "var(--zrd-text)" }}>Раздача</h2>
              <span className="text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>{dealTotal} карт ждут добора</span>
              <button type="button" className="ml-auto rounded-lg border px-2.5 py-1 text-sm"
                style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text-dim)", cursor: "pointer" }}
                onClick={() => setOpen(null)}>Закрыть</button>
            </div>
            <p className="mb-3 text-sm" style={{ color: "var(--zrd-text-dim)" }}>
              Карты, выданные вам на партию. Какие именно — тайна до добора: новые карты приходят
              в руку в начале каждого месяца, за партию не повторяются.
            </p>
            <div className="space-y-1.5">
              {DECK_IDS.map((d) => (
                <div key={d} className="flex items-center gap-2 rounded-lg border px-3 py-1.5"
                  style={{ borderColor: `${DECK_VISUAL[d].accent}55` }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: DECK_VISUAL[d].accent }} aria-hidden />
                  <span className="text-sm font-semibold" style={{ color: "var(--zrd-text)" }}>{DECK_LABEL[d]}</span>
                  <span className="ml-auto text-sm font-extrabold" style={{ color: DECK_VISUAL[d].accent }}>{view.you.deckCounts[d] ?? 0}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
