import { Truck, Store, Headset, Megaphone, Users, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { StandardAction, Resources } from "@shared/zrd/types";
import { STANDARD_ACTIONS } from "@shared/zrd/content";
import type { ZrdSeatView } from "@shared/zrd/match-types";
import { affordable } from "../../zrd-match-board";
import { ZrdTip } from "./ZrdTip";

const ACTIONS: { action: StandardAction; label: string; icon: LucideIcon; color: string; desc: string }[] = [
  { action: "improve_logistics", label: "Улучшить логистику", icon: Truck, color: "#FF6B00",
    desc: "Развивает склад и доставку: +производство склада каждый квартал. Тратит действие месяца и финансы." },
  { action: "open_basic", label: "Открыть магазин", icon: Store, color: "#4ea8de",
    desc: "Новая базовая точка: +охват сети РРС. Тратит действие месяца и финансы." },
  { action: "improve_service", label: "Усилить сервис", icon: Headset, color: "#FF6B00",
    desc: "Повышает уровень сервиса (NPS) РРС. Тратит действие месяца и финансы." },
  { action: "promo", label: "Маркетинг и реклама", icon: Megaphone, color: "#4ea8de",
    desc: "Промо-акция: +продажи. Тратит действие месяца и финансы." },
  { action: "hire", label: "Поддержка персонала", icon: Users, color: "#4ea8de",
    desc: "Найм и удержание: +производство персонала каждый квартал. Тратит действие месяца и финансы." },
];

/** «Доступные действия» — стандартные действия места (клик = сыграть). */
export function ZrdPanelAvailableActions({ view, onStandard }: { view: ZrdSeatView; onStandard: (a: StandardAction) => void }) {
  const you = view.you;
  const canAct = !view.matchEnded && !you.passed && you.actionsLeft > 0;

  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">
        Доступные действия <span className="zrd-head-sub">({you.actionsLeft} в месяце)</span>
      </div>
      <div className="zrd-frame__body">
        {ACTIONS.map((a) => {
          const Icon = a.icon;
          const cost = STANDARD_ACTIONS[a.action].cost as Partial<Resources>;
          const cap = cost.capital ?? 0;
          const ok = canAct && affordable(you.resources, cost);
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
                  <span className="zrd-ap-num">{cap}</span>
                </span>
              </button>
            </ZrdTip>
          );
        })}
      </div>
    </div>
  );
}
