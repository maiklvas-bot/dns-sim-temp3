import { Hammer, Boxes, Lightbulb, Users as UsersIcon, Megaphone, Wrench } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DeckId, ZrdSeatView } from "@shared/zrd/match-types";
import { ZrdTip } from "./ZrdTip";

const DECK_ICON: Record<DeckId, { icon: LucideIcon; color: string }> = {
  projects: { icon: Lightbulb, color: "#C8862A" },
  logistics: { icon: Boxes, color: "#2E78C7" },
  goods: { icon: Hammer, color: "#8E44AD" },
  staff: { icon: UsersIcon, color: "#2E9E6B" },
  promo: { icon: Megaphone, color: "#C0392B" },
  service: { icon: Wrench, color: "#5A6270" },
};

/** «Проекты (активные)» — реальные многонедельные проекты места: прогресс в неделях, эффект по завершении. */
export function ZrdPanelProjects({ view }: { view: ZrdSeatView }) {
  const projects = view.you.activeProjects;
  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">
        Проекты <span className="zrd-head-sub">(активные: {projects.length})</span>
      </div>
      <div className="zrd-frame__body">
        {projects.length === 0 && (
          <div className="zrd-proj-row" style={{ opacity: 0.6 }}>
            <span className="zrd-proj-name">Нет активных проектов — сыграйте карту с длительностью</span>
          </div>
        )}
        {projects.map((p) => {
          const meta = DECK_ICON[p.deck] ?? DECK_ICON.projects;
          const Icon = meta.icon;
          const doneWeeks = p.totalWeeks - p.weeksLeft;
          return (
            <ZrdTip key={p.cardId} title={p.title} value={`Осталось ${p.weeksLeft} нед. из ${p.totalWeeks}`}
              desc="Проект идёт по неделям; эффект карты применится по завершении. Прогресс тикает каждый месяц.">
              <div className="zrd-proj-row">
                <span className="zrd-proj-ico" style={{ background: meta.color }}><Icon aria-hidden /></span>
                <span className="zrd-proj-name">{p.title}</span>
                <span className={`zrd-proj-badge ${p.weeksLeft <= 4 ? "zrd-proj-badge--work" : "zrd-proj-badge--plan"}`}>
                  {doneWeeks}/{p.totalWeeks} НЕД
                </span>
              </div>
            </ZrdTip>
          );
        })}
      </div>
    </div>
  );
}
