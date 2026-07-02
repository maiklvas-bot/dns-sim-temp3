import { Store, Truck, Network, GraduationCap, Headset } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { ZRD_ACTIVE_PROJECTS } from "../../zrd-board-data";
import type { ZrdActiveProject } from "../../zrd-board-data";
import { ZrdTip } from "./ZrdTip";

/** Иконка-плитка + цвет + описание под каждый проект (по макету panel-projects.png). */
const PROJECT_META: Record<string, { icon: LucideIcon; color: string; desc: string }> = {
  "Открытие 2 магазинов в Тюмени": { icon: Store, color: "#C8862A",
    desc: "Расширение сети в Тюмени: рост охвата и продаж региона. Статус «в работе» — идёт по плану." },
  "Расширение склада Екатеринбург": { icon: Truck, color: "#7A5230",
    desc: "Увеличение складских мощностей в ЕКБ: усилит логистику и доступность товара. В работе." },
  "IT-платформа для логистики": { icon: Network, color: "#8E44AD",
    desc: "Цифровая платформа управления маршрутами и складом. «Задержка» — не хватает ресурса/решения, требует внимания." },
  "Обучение управленцев": { icon: GraduationCap, color: "#2E78C7",
    desc: "Программа развития руководителей точек: поднимет уровень сервиса и мотивацию команды. В работе." },
  "Сервисный центр Пермь": { icon: Headset, color: "#5A6270",
    desc: "Новый сервисный центр в Перми: усилит сервис и лояльность клиентов. Статус «план» — ещё не запущен." },
};

const BADGE_CLASS: Record<ZrdActiveProject["status"], string> = {
  "В РАБОТЕ": "zrd-proj-badge--work",
  "ЗАДЕРЖКА": "zrd-proj-badge--delay",
  "ПЛАН": "zrd-proj-badge--plan",
};

/** #9-3 «Проекты (активные)» — список активных проектов региона со статусами. */
export function ZrdPanelProjects() {
  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">
        Проекты <span className="zrd-head-sub">(активные)</span>
      </div>
      <div className="zrd-frame__body">
        {ZRD_ACTIVE_PROJECTS.map((p) => {
          const meta = PROJECT_META[p.name] ?? { icon: Store, color: "#5A6270", desc: "" };
          const Icon = meta.icon;
          return (
            <ZrdTip key={p.name} title={p.name} value={`Статус: ${p.status}`} desc={meta.desc}>
              <div className="zrd-proj-row">
                <span className="zrd-proj-ico" style={{ background: meta.color }}><Icon aria-hidden /></span>
                <span className="zrd-proj-name">{p.name}</span>
                <span className={`zrd-proj-badge ${BADGE_CLASS[p.status]}`}>{p.status}</span>
              </div>
            </ZrdTip>
          );
        })}
      </div>
    </div>
  );
}
