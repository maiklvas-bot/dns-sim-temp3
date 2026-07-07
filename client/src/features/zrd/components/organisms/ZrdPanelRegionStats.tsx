import { Store, Settings, User, Star, DollarSign } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { ZrdSeatView } from "@shared/zrd/match-types";
import { computeKpi } from "@shared/zrd/kpi";
import { ZrdTip } from "./ZrdTip";

/** «Показатели региона» — живые данные своего места (метрики + KPI движка). */
export function ZrdPanelRegionStats({ view }: { view: ZrdSeatView }) {
  const you = view.you;
  const m = you.metrics;
  const kpi = computeKpi(you);
  const pct = (v: number) => Math.round((v / 20) * 100);
  const projectStores = you.discard.filter((id) => id.startsWith("pj_open_store") || id.startsWith("pj_new_loc")).length;

  const rows: { icon: LucideIcon; label: string; value: string; desc: string }[] = [
    { icon: Store, label: "Сеть магазинов", value: String(40 + m.coverage * 2 + projectStores * 2),
      desc: "Число точек РРС. Растёт от открытия магазинов, пунктов выдачи и проектов развития." },
    { icon: Settings, label: "Уровень сервиса", value: `${kpi.service_level}%`,
      desc: "Качество обслуживания (NPS). Поднимается сервисными картами и обучением; влияет на лояльность и продажи." },
    { icon: User, label: "Доля онлайн", value: `${Math.min(60, 25 + you.resources.market * 4)}%`,
      desc: "Доля онлайн-продаж РРС. Растёт от продвижения и рыночного потенциала." },
    { icon: Star, label: "Укомплектованность", value: `${kpi.staffing}%`,
      desc: "Заполненность штата точек. Зависит от ресурса «Люди» и его производства; низкая — бьёт по сервису." },
    { icon: DollarSign, label: "Доля рынка (оценочно)", value: `${pct(m.coverage)}%`,
      desc: "Оценочная доля рынка РРС — сводный показатель охвата и присутствия сети." },
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
