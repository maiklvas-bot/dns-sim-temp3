import { Store, Settings, User, Star, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";
import { ZrdTip } from "./ZrdTip";

/** #9-5 «Показатели региона» — кодовая панель на живых данных движка. */
export function ZrdPanelRegionStats({ state }: { state: PublicZrdState }) {
  const m = state.player.metrics;
  const r = state.player.resources;
  const pct = (v: number) => Math.round((v / 20) * 100);
  const storeCards = state.player.playedCardIds.filter((id) => ["store", "hyper", "new_district"].includes(id)).length;

  const rows: { icon: LucideIcon; label: string; value: string; desc: string }[] = [
    { icon: Store, label: "Сеть магазинов", value: String(40 + m.coverage * 2 + storeCards * 2),
      desc: "Число точек в регионе (магазины и гипермаркеты). Растёт от открытия точек и инфраструктурных проектов." },
    { icon: Settings, label: "Уровень сервиса", value: `${pct(m.nps)}%`,
      desc: "Качество обслуживания (NPS). Поднимается сервисными действиями и обучением; влияет на лояльность и продажи." },
    { icon: User, label: "Доля онлайн", value: `${Math.min(60, 25 + r.market * 4)}%`,
      desc: "Доля онлайн-продаж в регионе. Растёт от e-commerce и маркетинговой активности." },
    { icon: Star, label: "Укомплектованность", value: `${Math.min(99, 55 + r.staff * 6)}%`,
      desc: "Заполненность штата точек. Зависит от ресурса «Люди»; низкая — бьёт по сервису и продажам." },
    { icon: DollarSign, label: "Доля рынка (оценочно)", value: `${pct(m.coverage)}%`,
      desc: "Оценочная доля рынка региона — сводный показатель охвата и присутствия сети." },
  ];

  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">Показатели региона</div>
      <div className="zrd-frame__body">
        {rows.map((row) => {
          const Icon = row.icon;
          return (
            <ZrdTip key={row.label} title={row.label} value={`Сейчас: ${row.value}`} desc={row.desc}>
              <div className="zrd-stat-row" tabIndex={0}>
                <span className="zrd-stat-ico"><Icon size={18} aria-hidden /></span>
                <span className="zrd-stat-label">{row.label}</span>
                <span className="zrd-stat-val">{row.value}</span>
              </div>
            </ZrdTip>
          );
        })}
      </div>
    </div>
  );
}
