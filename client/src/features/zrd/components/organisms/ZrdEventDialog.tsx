import { useEffect, useRef } from "react";
import { Zap, AlertTriangle } from "lucide-react";
import type { EventCard, Resources } from "@shared/zrd/types";
import { formatEffects, formatCost } from "../../zrd-view";
import { Chip } from "../atoms/Chip";

interface Props {
  event: EventCard;
  resources: Resources;
  onChoose: (optionId: string) => void;
}

/** Кризис-событие: модальное окно с вариантами равной формы (§8a). */
export function ZrdEventDialog({ event, resources, onChoose }: Props) {
  const firstRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { firstRef.current?.focus(); }, [event.id]);

  const afford = (cost?: Partial<Resources>) =>
    !cost || Object.entries(cost).every(([k, v]) => (resources[k as keyof Resources] ?? 0) >= (v ?? 0));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,12,22,0.66)", backdropFilter: "blur(3px)" }} role="dialog" aria-modal="true" aria-labelledby="zrd-event-title">
      <div className="zrd-panel w-full max-w-2xl p-6" style={{ background: "var(--zrd-surface-2)" }}>
        <div className="mb-1 flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: "rgba(255,107,0,0.14)", color: "#FF6B00" }}>
            <Zap className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wide" style={{ color: "#FF6B00" }}>Событие квартала</div>
            <h2 id="zrd-event-title" className="text-lg font-extrabold" style={{ color: "var(--zrd-text)" }}>{event.title}</h2>
          </div>
        </div>
        {event.baseHit && (
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-semibold" style={{ background: "rgba(232,90,90,0.14)", color: "#e85a5a" }}>
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Без подготовки регион понесёт потери
          </div>
        )}
        <p className="mb-4 text-sm" style={{ color: "var(--zrd-text-dim)" }}>Выберите реакцию. Решение зависит от ситуации в регионе.</p>

        <div className="grid gap-3 sm:grid-cols-2">
          {event.options.map((opt, i) => {
            const ok = afford(opt.cost);
            const chips = formatEffects(opt.effects);
            const cost = formatCost(opt.cost);
            return (
              <button
                key={opt.id}
                ref={i === 0 ? firstRef : undefined}
                type="button"
                className="zrd-option"
                disabled={!ok}
                onClick={() => onChoose(opt.id)}
              >
                <span className="text-sm font-bold" style={{ color: "var(--zrd-text)" }}>{opt.label}</span>
                <div className="mt-auto flex flex-wrap items-center gap-1.5">
                  {cost && <Chip tone="neutral">{cost}</Chip>}
                  {opt.negatesBaseHit && <Chip tone="pos">гасит потери</Chip>}
                  {chips.map((c, j) => (
                    <Chip key={j} tone={c.positive ? "pos" : "neg"}>{c.text}</Chip>
                  ))}
                  {!ok && <Chip tone="neg">не хватает ресурсов</Chip>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
