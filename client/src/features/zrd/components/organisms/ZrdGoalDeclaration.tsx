import type { StrategyKey } from "@shared/zrd/types";
import { STRATEGY_META } from "../../zrd-view";

const ORDER: StrategyKey[] = ["service", "expansion", "efficiency"];

/** Декларация цели (фаза setup): выбор одной из трёх стратегий. */
export function ZrdGoalDeclaration({ onDeclare }: { onDeclare: (s: StrategyKey) => void }) {
  return (
    <div className="zrd-panel mx-auto max-w-4xl p-6">
      <div className="mb-1 text-center text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "#FF6B00" }}>Начало партии</div>
      <h2 className="mb-1 text-center text-2xl font-extrabold" style={{ color: "var(--zrd-text)" }}>Объявите цель развития региона</h2>
      <p className="mb-6 text-center text-sm" style={{ color: "var(--zrd-text-dim)" }}>
        Стратегия даёт бонус к итоговому рейтингу и оценивает последовательность ваших решений.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {ORDER.map((key) => {
          const s = STRATEGY_META[key];
          const Icon = s.icon;
          return (
            <button
              key={key}
              type="button"
              onClick={() => onDeclare(key)}
              className="zrd-option items-start"
              style={{ minHeight: 170 }}
            >
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl" style={{ background: `${s.color}22`, color: s.color }}>
                <Icon className="h-6 w-6" aria-hidden />
              </span>
              <span className="text-lg font-extrabold" style={{ color: "var(--zrd-text)" }}>{s.label}</span>
              <span className="text-sm" style={{ color: "var(--zrd-text-dim)" }}>{s.tagline}</span>
              <span className="mt-auto rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: `${s.color}1f`, color: s.color }}>{s.bonus}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
