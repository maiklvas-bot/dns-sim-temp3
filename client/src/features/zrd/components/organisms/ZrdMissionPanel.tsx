import { Trophy, Star, Truck, Users, Coins, Check, Crown } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { KpiId, ZrdSeatView } from "@shared/zrd/match-types";

const KPI_ICON: Record<KpiId, LucideIcon> = {
  sales_growth: Trophy,
  market_coverage: Star,
  service_level: Star,
  efficiency: Coins,
  logistics: Truck,
  staffing: Users,
};

const SEG = 7;

/**
 * Панель «Миссия» — живой прогресс миссий своего места: значение KPI против цели квартала,
 * финальная цель, выполненные отмечены, ключевая (режим «гонка») — с короной.
 */
export function ZrdMissionPanel({ view }: { view: ZrdSeatView }) {
  return (
    <div className="zrd-frame zrd-mission">
      <div className="zrd-frame__head">
        Миссия {view.winMode === "race" && <span className="zrd-head-sub">(гонка к ключевой цели)</span>}
      </div>
      <div className="zrd-mission__sub">Цели квартала {view.quarter} — двигаются каждый квартал</div>
      <div className="zrd-mission__list">
        {view.missions.map((m) => {
          const Icon = KPI_ICON[m.def.kpi] ?? Star;
          const on = Math.max(0, Math.min(SEG, Math.round((m.value / 100) * SEG)));
          const reached = m.value >= m.target;
          return (
            <div key={m.def.id} className="zrd-mkpi" title={`${m.def.label}: сейчас ${m.value}%, цель квартала ${m.target}%, финал ${m.finalTarget}%`}>
              <span className="zrd-mkpi__check" style={{ opacity: m.done ? 1 : reached ? 0.7 : 0.25 }}><Check aria-hidden /></span>
              <span className="zrd-mkpi__label">
                {m.def.label}
                {m.isKey && <Crown className="ml-1 inline h-3 w-3" style={{ color: "#f0b429" }} aria-hidden />}
              </span>
              <span className={`zrd-mkpi__bar zrd-mkpi__bar--${reached ? "g" : "b"}`} aria-hidden>
                {Array.from({ length: SEG }).map((_, i) => (
                  <span key={i} className={`zrd-mkpi__cell${i < on ? " is-on" : ""}`} />
                ))}
              </span>
              <span className="zrd-mkpi__val">{m.value}%</span>
              <span className="zrd-mkpi__ico" style={{ color: m.done ? "#5BBF3A" : "#C8901E" }}><Icon aria-hidden /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
