import { RussianRuble, Users, Package, Cpu, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { Resources } from "@shared/zrd/types";
import type { ZrdSeatView } from "@shared/zrd/match-types";
import { ZrdTip } from "./ZrdTip";

/** 5 ресурсов движка → подписи/иконки/цвета по макету panel-resources.png. */
const RESOURCES: { key: keyof Resources; label: string; icon: LucideIcon; tile: string; fill: string; scale: number; desc: string }[] = [
  { key: "capital",   label: "Финансы",    icon: RussianRuble, tile: "#C8901E", fill: "#5BBF3A", scale: 50,
    desc: "Деньги РРС. Оплачивают карты, действия и найм. Пополняются месячным доходом и квартальным производством." },
  { key: "staff",     label: "Люди",       icon: Users,        tile: "#E0701A", fill: "#FF6B00", scale: 6,
    desc: "Персонал точек и склада. Нужен для проектов и сервиса; производство даёт прирост каждый квартал." },
  { key: "warehouse", label: "Материалы",  icon: Package,      tile: "#D9772A", fill: "#FF6B00", scale: 6,
    desc: "Складские запасы и товар. Держат продажи и логистику; нехватка усиливает урон от сбоев и лебедей." },
  { key: "tech",      label: "Технологии", icon: Cpu,          tile: "#2E78C7", fill: "#FF8C1A", scale: 6,
    desc: "Технологическая база. Повышает эффективность и открывает продвинутые карты." },
  { key: "market",    label: "Репутация",  icon: Star,         tile: "#4CAF50", fill: "#FF8C1A", scale: 6,
    desc: "Рыночная репутация и маркетинговый ресурс. Усиливает продвижение, продажи и долю онлайн." },
];

const segments = (v: number, scale: number) => Math.max(0, Math.min(5, Math.round((v / scale) * 5)));

/** «Ресурсы» — 5 ресурсов своего места: индикатор уровня + точный объём + доход в подсказке. */
export function ZrdPanelResources({ view }: { view: ZrdSeatView }) {
  const you = view.you;
  const r = you.resources;
  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">Ресурсы</div>
      <div className="zrd-frame__body">
        {RESOURCES.map((res) => {
          const Icon = res.icon;
          const v = r[res.key] ?? 0;
          const on = segments(v, res.scale);
          const income = res.key === "capital"
            ? ` · доход ${you.incomeMonthly}/мес`
            : (you.resourceProd[res.key] ?? 0) > 0 ? ` · +${you.resourceProd[res.key]}/кв` : "";
          return (
            <ZrdTip key={res.key} title={res.label} value={`Сейчас: ${v}${income}`} desc={res.desc}>
              <div className="zrd-res-row">
                <span className="zrd-res-ico" style={{ background: res.tile }}><Icon aria-hidden /></span>
                <span className="zrd-res-label">{res.label}</span>
                <span className="zrd-res-bar" aria-hidden>
                  {[0, 1, 2, 3, 4].map((i) => (
                    <span
                      key={i}
                      className={`zrd-res-cell${i < on ? " zrd-res-cell--on" : ""}`}
                      style={i < on ? { background: res.fill, borderColor: res.fill } : undefined}
                    />
                  ))}
                </span>
                <span className="zrd-res-val">{v}</span>
              </div>
            </ZrdTip>
          );
        })}
      </div>
    </div>
  );
}
