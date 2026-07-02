import { Truck, Store, Headset, Megaphone, Users, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";
import type { StandardAction, Resources } from "@shared/zrd/types";
import { STANDARD_ACTIONS } from "@shared/zrd/content";
import { ZrdTip } from "./ZrdTip";

const ACTIONS: { action: StandardAction; label: string; icon: LucideIcon; color: string; cost: number; desc: string }[] = [
  { action: "improve_logistics", label: "Улучшить логистику", icon: Truck, color: "#FF6B00", cost: 3,
    desc: "Развивает склад и доставку: +производство склада каждый квартал. Тратит ход и финансы." },
  { action: "open_basic", label: "Открыть магазин", icon: Store, color: "#4ea8de", cost: 5,
    desc: "Новая базовая точка: +охват сети региона. Тратит ход и финансы." },
  { action: "improve_service", label: "Усилить сервис", icon: Headset, color: "#FF6B00", cost: 2,
    desc: "Повышает уровень сервиса (NPS) региона. Тратит ход и финансы." },
  { action: "promo", label: "Маркетинг и реклама", icon: Megaphone, color: "#4ea8de", cost: 2,
    desc: "Промо-акция: +продажи в этом квартале. Тратит ход и финансы." },
  { action: "hire", label: "Поддержка персонала", icon: Users, color: "#4ea8de", cost: 1,
    desc: "Найм и удержание: +производство персонала каждый квартал. Тратит ход и финансы." },
];

/** #9-4 «Доступные действия» — кликабельная панель, играет стандартные действия движка. */
export function ZrdPanelAvailableActions({ state, onStandard }: { state: PublicZrdState; onStandard: (a: StandardAction) => void }) {
  const afford = (cost: Partial<Resources>) =>
    Object.entries(cost).every(([k, v]) => (state.player.resources[k as keyof Resources] ?? 0) >= (v ?? 0));
  const canAct = state.phase === "action" && state.actionsLeft > 0;

  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">Доступные действия</div>
      <div className="zrd-frame__body">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const cap = STANDARD_ACTIONS[a.action].cost.capital ?? 0;
          const ok = canAct && afford(STANDARD_ACTIONS[a.action].cost);
          return (
            <ZrdTip key={a.action} title={a.label} value={`Стоимость: ${cap}К финансов`} desc={a.desc}>
              <button
                type="button"
                className="zrd-act-row"
                disabled={!ok}
                onClick={() => onStandard(a.action)}
              >
                <span className="zrd-act-ico" style={{ background: a.color }}><Icon aria-hidden /></span>
                <span className="zrd-act-label">{a.label}</span>
                <span className="zrd-act-cost">
                  <span className="zrd-ap-badge"><Settings aria-hidden /></span>
                  <span className="zrd-ap-num">{a.cost}</span>
                </span>
              </button>
            </ZrdTip>
          );
        })}
      </div>
    </div>
  );
}
