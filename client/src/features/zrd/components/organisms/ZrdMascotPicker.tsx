import { useState } from "react";
import type { MascotId } from "@shared/zrd/match-types";
import { MASCOT_IDS } from "@shared/zrd/match-types";
import { MASCOT_VISUAL } from "../../zrd-mascots";

/**
 * Выбор фигурки ИГРОКОМ при входе по коду (оценщик аватары не назначает).
 * Наведение увеличивает фигурку (как карты в колоде), клик — выбрать.
 */
export function ZrdMascotPicker({ playerName, onPick }: { playerName: string; onPick: (id: MascotId) => void }) {
  const [busy, setBusy] = useState<MascotId | null>(null);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(8,12,22,0.78)", backdropFilter: "blur(4px)" }}
      role="dialog" aria-modal="true" aria-label="Выбор фигурки">
      <div className="zrd-panel w-full max-w-4xl p-6 text-center" style={{ background: "var(--zrd-surface-2)" }}>
        <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#FF6B00" }}>
          {playerName} · выбор фигурки
        </div>
        <h2 className="mb-1 mt-1 text-2xl font-extrabold" style={{ color: "var(--zrd-text)" }}>Кем играете?</h2>
        <p className="mb-5 text-sm" style={{ color: "var(--zrd-text-dim)" }}>
          Фигурка будет ходить по вашей территории. Наведите, чтобы рассмотреть; кликните, чтобы выбрать.
        </p>
        <div className="flex items-end justify-center gap-4">
          {MASCOT_IDS.map((id) => {
            const m = MASCOT_VISUAL[id];
            return (
              <button
                key={id}
                type="button"
                className="zrd-mascot-pick"
                style={{ "--acc": m.accent } as React.CSSProperties}
                onClick={() => { setBusy(id); onPick(id); }}
                disabled={busy !== null}
                title={`${m.name} — ${m.style}`}
              >
                <img src={m.figure} alt={m.name} draggable={false} />
                <span className="zrd-mascot-pick__name">{m.name}</span>
                <span className="zrd-mascot-pick__style">{m.style}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
