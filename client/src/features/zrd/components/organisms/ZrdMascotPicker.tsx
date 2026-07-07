import { useState } from "react";
import type { MascotId } from "@shared/zrd/match-types";
import { MASCOT_IDS } from "@shared/zrd/match-types";
import { MASCOT_VISUAL } from "../../zrd-mascots";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Выбор фигурки ИГРОКОМ при входе по коду (оценщик аватары не назначает),
 * следом — своя корпоративная почта (для обратной связи, необязательно).
 * Наведение увеличивает фигурку (как карты в колоде), клик — выбрать.
 */
export function ZrdMascotPicker({ playerName, onComplete }: { playerName: string; onComplete: (id: MascotId, email?: string) => void }) {
  const [picked, setPicked] = useState<MascotId | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (picked) {
    const valid = email.trim() === "" || EMAIL_RE.test(email.trim());
    const submit = () => {
      if (submitting) return;
      setSubmitting(true);
      onComplete(picked, email.trim() || undefined);
    };
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: "rgba(8,12,22,0.78)", backdropFilter: "blur(4px)" }}
        role="dialog" aria-modal="true" aria-label="Корпоративная почта">
        <div className="zrd-panel w-full max-w-md p-6 text-center" style={{ background: "var(--zrd-surface-2)" }}>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#FF6B00" }}>
            {playerName} · последний шаг
          </div>
          <h2 className="mb-1 mt-1 text-xl font-extrabold" style={{ color: "var(--zrd-text)" }}>Корпоративная почта</h2>
          <p className="mb-4 text-sm" style={{ color: "var(--zrd-text-dim)" }}>
            Для обратной связи и дальнейшей коммуникации по итогам симуляции. Можно пропустить.
          </p>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@dns-shop.ru"
            autoFocus
            className="w-full rounded-lg border px-3 py-2 text-center text-sm text-white"
            style={{ borderColor: valid ? "rgba(255,255,255,0.14)" : "#d98f8f", background: "#131b2b" }}
          />
          {!valid && <p className="mt-1.5 text-xs" style={{ color: "#ffb4b4" }}>Проверьте формат почты</p>}
          <div className="mt-5 flex justify-center gap-3">
            <button type="button" onClick={submit} disabled={!valid || submitting}
              className="rounded-xl px-6 py-2.5 text-sm font-extrabold text-white disabled:opacity-40"
              style={{ background: "#FF6B00", cursor: valid ? "pointer" : "default" }}>
              {email.trim() ? "Продолжить" : "Пропустить и начать"}
            </button>
          </div>
        </div>
      </div>
    );
  }

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
                onClick={() => setPicked(id)}
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
