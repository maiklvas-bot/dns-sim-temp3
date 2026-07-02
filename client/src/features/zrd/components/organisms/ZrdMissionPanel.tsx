import { Trophy, Star, Globe, Users, Coins, Medal, Award, Gem, Truck, Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";

/** KPI игровой миссии (§ декларация цели/KPI). Проценты — заглушки до привязки к целям движка. */
const KPI: { label: string; pct: number; tone: "g" | "b"; Icon: LucideIcon; tile: string }[] = [
  { label: "Рост продаж",       pct: 72, tone: "g", Icon: Trophy, tile: "#C8901E" },
  { label: "Покрытие рынка",    pct: 85, tone: "b", Icon: Star,   tile: "#C8901E" },
  { label: "Уровень сервиса",   pct: 91, tone: "g", Icon: Star,   tile: "#C8901E" },
  { label: "Логистика",         pct: 78, tone: "g", Icon: Truck,  tile: "#C8901E" },
  { label: "Доля онлайн",       pct: 48, tone: "b", Icon: Globe,  tile: "#8a93a6" },
  { label: "Укомплектованность", pct: 81, tone: "g", Icon: Users,  tile: "#B87333" },
  { label: "Доля рынка",        pct: 32, tone: "b", Icon: Coins,  tile: "#8a93a6" },
  { label: "Прибыльность",      pct: 67, tone: "g", Icon: Medal,  tile: "#B87333" },
  { label: "NPS (лояльность)",  pct: 74, tone: "g", Icon: Award,  tile: "#8a93a6" },
  { label: "Инновации",         pct: 59, tone: "b", Icon: Gem,    tile: "#8a93a6" },
];

const SEG = 7;

/**
 * Панель «Миссия игры» (по макету DAHNeYPml_U, плоский стиль борда).
 * Заголовок + подзаголовок цели + список KPI с сегментными барами, % и иконкой-ачивкой.
 * Проценты — заглушки до привязки к целям/декларации (в движке пока нет KPI-целей).
 */
export function ZrdMissionPanel(_props: { state: PublicZrdState }) {
  return (
    <div className="zrd-frame zrd-mission">
      <div className="zrd-frame__head">Миссия</div>
      <div className="zrd-mission__sub">Развить сеть, усилить сервис и удержать лидерство DNS</div>
      <div className="zrd-mission__list">
        {KPI.map((k) => {
          const on = Math.max(0, Math.min(SEG, Math.round((k.pct / 100) * SEG)));
          const Icon = k.Icon;
          return (
            <div key={k.label} className="zrd-mkpi">
              <span className="zrd-mkpi__check"><Check aria-hidden /></span>
              <span className="zrd-mkpi__label">{k.label}</span>
              <span className={`zrd-mkpi__bar zrd-mkpi__bar--${k.tone}`} aria-hidden>
                {Array.from({ length: SEG }).map((_, i) => (
                  <span key={i} className={`zrd-mkpi__cell${i < on ? " is-on" : ""}`} />
                ))}
              </span>
              <span className="zrd-mkpi__val">{k.pct}%</span>
              <span className="zrd-mkpi__ico" style={{ color: k.tile }}><Icon aria-hidden /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
