import { useState } from "react";
import { MapPin } from "lucide-react";
import type { RrsId, ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_LABEL, RRS_PROFILES } from "@shared/zrd/match-types";

/**
 * Выбор РРС САМИМ ИГРОКОМ при входе (когда людей за столом больше одного):
 * оценщик задал только состав РРС и уровни ИИ — за какую РРС играть, решает игрок.
 * Доступны: своя провизорная РРС + провизорные РРС других ещё не выбравших людей.
 */
export function ZrdRrsPicker({ view, onPick }: { view: ZrdSeatView; onPick: (rrsId: RrsId) => void }) {
  const [busy, setBusy] = useState<RrsId | null>(null);

  const options: RrsId[] = [
    view.you.rrsId,
    ...view.others
      .filter((o) => o.controllerKind === "human" && o.rrsChosen === false)
      .map((o) => o.rrsId),
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,12,22,0.78)", backdropFilter: "blur(4px)" }}
      role="dialog" aria-modal="true" aria-label="Выбор РРС">
      <div className="zrd-panel w-full max-w-3xl p-6 text-center" style={{ background: "var(--zrd-surface-2)" }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#FF6B00" }}>
          {view.you.controller.kind === "human" ? view.you.controller.name : ""} · выбор РРС
        </div>
        <h2 className="mb-1 mt-1 text-2xl font-extrabold" style={{ color: "var(--zrd-text)" }}>За какую РРС играете?</h2>
        <p className="mb-5 text-sm" style={{ color: "var(--zrd-text-dim)" }}>
          У каждой РРС свои стартовые особенности. Кто выбирает первым — тому больше вариантов.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((id) => {
            const profile = RRS_PROFILES[id];
            return (
              <button
                key={id}
                type="button"
                className="zrd-option"
                disabled={busy !== null}
                onClick={() => { setBusy(id); onPick(id); }}
                style={{ textAlign: "left" }}
              >
                <span className="inline-flex items-center gap-1.5 text-sm font-bold" style={{ color: "var(--zrd-text)" }}>
                  <MapPin className="h-4 w-4" style={{ color: "#FF6B00" }} aria-hidden />
                  {RRS_LABEL[id]}
                </span>
                <span className="mt-1 block text-xs leading-relaxed" style={{ color: "var(--zrd-text-dim)" }}>
                  {profile?.tagline}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
