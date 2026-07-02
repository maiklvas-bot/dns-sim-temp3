import { RussianRuble, Users, Package, Cpu, Star } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";
import type { Resources } from "@shared/zrd/types";
import { ZrdTip } from "./ZrdTip";

/** 5 ресурсов движка → подписи/иконки/цвета по макету panel-resources.png. */
const RESOURCES: { key: keyof Resources; label: string; icon: LucideIcon; tile: string; fill: string; scale: number; desc: string }[] = [
  { key: "capital",   label: "Финансы",    icon: RussianRuble, tile: "#C8901E", fill: "#5BBF3A", scale: 50,
    desc: "Деньги региона. Оплачивают действия, проекты и найм — чем больше финансов, тем больше ходов можно сделать за квартал." },
  { key: "staff",     label: "Люди",       icon: Users,        tile: "#E0701A", fill: "#FF6B00", scale: 6,
    desc: "Персонал точек и склада. Нужен для открытия магазинов, проектов и сервиса; каждый квартал даёт прирост ресурсов." },
  { key: "warehouse", label: "Материалы",  icon: Package,      tile: "#D9772A", fill: "#FF6B00", scale: 6,
    desc: "Складские запасы и товар. Держат продажи и стабильную логистику; нехватка усиливает урон от сбоев поставок." },
  { key: "tech",      label: "Технологии", icon: Cpu,          tile: "#2E78C7", fill: "#FF8C1A", scale: 6,
    desc: "Технологическая база. Открывает IT-проекты (CRM, BI, автоматизация склада) и повышает эффективность." },
  { key: "market",    label: "Репутация",  icon: Star,         tile: "#4CAF50", fill: "#FF8C1A", scale: 6,
    desc: "Рыночная репутация и маркетинговый ресурс. Усиливает продвижение и продажи, влияет на долю рынка." },
];

/** Нормированная «наполненность» 0..5 сегментов (число справа — точный объём). */
const segments = (v: number, scale: number) => Math.max(0, Math.min(5, Math.round((v / scale) * 5)));

/** #9-2 «Ресурсы» — 5 ресурсов региона: иконка + индикатор уровня + точный объём. */
export function ZrdPanelResources({ state }: { state: PublicZrdState }) {
  const r = state.player.resources;
  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">Ресурсы</div>
      <div className="zrd-frame__body">
        {RESOURCES.map((res) => {
          const Icon = res.icon;
          const v = r[res.key] ?? 0;
          const on = segments(v, res.scale);
          return (
            <ZrdTip key={res.key} title={res.label} value={`Сейчас: ${v}`} desc={res.desc}>
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
