import { useState, type CSSProperties } from "react";
import { User, Bot } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { scenarioById, AI_LEVEL_LABEL } from "../../zrd-player-scenarios";

type Trend = "up" | "down" | "flat";
interface Kpi { label: string; value: string; pct: number; delta: string; trend: Trend }
/** Кто управляет РРС: живой игрок или ИИ. Состав задаёт оценщик; сценарий живого — выбор при входе по коду. */
type Controller = { kind: "human"; scenarioId: string } | { kind: "ai"; scenarioId: string; level: 1 | 2 | 3 | 4 | 5 };
interface Territory { id: string; name: string; accent: string; controller: Controller; feature: string; kpis: Kpi[] }

/** 4 территории (РРС) с KPI. Значения/состав — заглушки до появления по-территориальной модели и live-сессии. */
const TERRITORIES: Territory[] = [
  { id: "ekb", name: "РРС Екатеринбург", accent: "#EC4899",
    controller: { kind: "human", scenarioId: "crisis" },
    feature: "Флагман дивизиона: крупнейший рынок и трафик, максимальная конкуренция.",
    kpis: [
    { label: "Рост продаж", value: "+28%", pct: 92, delta: "+3%", trend: "up" },
    { label: "Покрытие рынка", value: "72%", pct: 72, delta: "+1%", trend: "up" },
    { label: "Эффективность", value: "85%", pct: 85, delta: "−1%", trend: "down" },
    { label: "Уровень сервиса", value: "91%", pct: 91, delta: "+2%", trend: "up" },
    { label: "Логистика", value: "78%", pct: 78, delta: "−2%", trend: "down" },
    { label: "Персонал", value: "81%", pct: 81, delta: "+1%", trend: "up" },
  ] },
  { id: "chl", name: "РРС Челябинск", accent: "#06B6D4",
    controller: { kind: "ai", scenarioId: "optimizer", level: 2 },
    feature: "Промышленный город: сильный спрос на КБТ и B2B, чувствителен к ценам.",
    kpis: [
    { label: "Рост продаж", value: "+12%", pct: 64, delta: "+2%", trend: "up" },
    { label: "Покрытие рынка", value: "58%", pct: 58, delta: "+3%", trend: "up" },
    { label: "Эффективность", value: "70%", pct: 70, delta: "0%", trend: "flat" },
    { label: "Уровень сервиса", value: "84%", pct: 84, delta: "+1%", trend: "up" },
    { label: "Логистика", value: "66%", pct: 66, delta: "−1%", trend: "down" },
    { label: "Персонал", value: "74%", pct: 74, delta: "+2%", trend: "up" },
  ] },
  { id: "tmn", name: "РРС Тюмень", accent: "#84CC16",
    controller: { kind: "ai", scenarioId: "growth", level: 4 },
    feature: "Нефтегазовый регион: высокий средний чек и платёжеспособный спрос.",
    kpis: [
    { label: "Рост продаж", value: "+19%", pct: 78, delta: "+4%", trend: "up" },
    { label: "Покрытие рынка", value: "63%", pct: 63, delta: "+1%", trend: "up" },
    { label: "Эффективность", value: "88%", pct: 88, delta: "+2%", trend: "up" },
    { label: "Уровень сервиса", value: "79%", pct: 79, delta: "−1%", trend: "down" },
    { label: "Логистика", value: "82%", pct: 82, delta: "+3%", trend: "up" },
    { label: "Персонал", value: "69%", pct: 69, delta: "−2%", trend: "down" },
  ] },
  { id: "prm", name: "РРС Пермь", accent: "#A78BFA",
    controller: { kind: "ai", scenarioId: "strategist", level: 3 },
    feature: "Растущий рынок: длинное логистическое плечо, охват ещё не выбран.",
    kpis: [
    { label: "Рост продаж", value: "+8%", pct: 52, delta: "+1%", trend: "up" },
    { label: "Покрытие рынка", value: "49%", pct: 49, delta: "−2%", trend: "down" },
    { label: "Эффективность", value: "75%", pct: 75, delta: "+1%", trend: "up" },
    { label: "Уровень сервиса", value: "88%", pct: 88, delta: "+2%", trend: "up" },
    { label: "Логистика", value: "71%", pct: 71, delta: "0%", trend: "flat" },
    { label: "Персонал", value: "77%", pct: 77, delta: "+1%", trend: "up" },
  ] },
];

const SEG = 6;
const deltaClass = (t: Trend) => (t === "up" ? "is-up" : t === "down" ? "is-down" : "is-flat");

/** Подробная карточка РРС (по наведению): тип управленца, особенность региона, текущие показатели. */
function TerritoryPopover({ t }: { t: Territory }) {
  const sc = scenarioById(t.controller.scenarioId);
  const isHuman = t.controller.kind === "human";
  return (
    <HoverCardContent
      side="top"
      align="center"
      sideOffset={10}
      className="zrd-terr-pop w-[320px] p-0 bg-transparent border-0 rounded-none shadow-none"
      style={{ "--acc": t.accent } as CSSProperties}
    >
      <div className="zrd-terr-pop__head">
        <span className={`zrd-terr-pop__ico ${isHuman ? "is-human" : "is-ai"}`}>
          {isHuman ? <User aria-hidden /> : <Bot aria-hidden />}
        </span>
        <span className="zrd-terr-pop__name">{t.name}</span>
        <span className="zrd-terr-pop__tag">{isHuman ? "живой игрок" : "компьютер"}</span>
      </div>
      <div className="zrd-terr-pop__inner">
        <div className="zrd-terr-pop__sect">Тип управленца</div>
        {sc && (
          <>
            <div className="zrd-terr-pop__mtype">
              {sc.name}
              {!isHuman && t.controller.kind === "ai" && (
                <span className="zrd-terr-pop__lvl">· {AI_LEVEL_LABEL[t.controller.level]}</span>
              )}
            </div>
            <div className="zrd-terr-pop__mdesc">{sc.behavior}</div>
            <div className="zrd-terr-pop__chips">
              {sc.competencies.map((c) => (
                <span key={c} className="zrd-terr-pop__chip">{c}</span>
              ))}
            </div>
          </>
        )}

        <div className="zrd-terr-pop__sect">Особенность РРС</div>
        <div className="zrd-terr-pop__feature">{t.feature}</div>

        <div className="zrd-terr-pop__sect">Показатели сейчас</div>
        <ul className="zrd-terr-pop__kpis">
          {t.kpis.map((k) => (
            <li key={k.label} className="zrd-terr-pop__kpirow">
              <span className="zrd-terr-pop__kpilabel">{k.label}</span>
              <span className="zrd-terr-pop__kpival">{k.value}</span>
              <span className={`zrd-terr-pop__kpidelta ${deltaClass(k.trend)}`}>{k.delta}</span>
            </li>
          ))}
        </ul>
      </div>
    </HoverCardContent>
  );
}

/**
 * Нижняя зона — 4 территории (РРС), плоский стиль борда «KPI региона».
 * В шапке блока — значок управленца (человек = живой игрок, робот = ИИ) в цвет РРС.
 * При наведении — подробная карточка: тип управленца, особенность региона, текущие показатели.
 */
export function ZrdTerritories(_props: { state: PublicZrdState }) {
  const [active, setActive] = useState<string>(TERRITORIES[0].id);
  return (
    <div className="zrd-territories">
      {TERRITORIES.map((t) => {
        const isHuman = t.controller.kind === "human";
        return (
          <HoverCard key={t.id} openDelay={120} closeDelay={80}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={`zrd-terr${active === t.id ? " is-active" : ""}`}
                style={{ "--acc": t.accent } as CSSProperties}
                onClick={() => setActive(t.id)}
                aria-pressed={active === t.id}
              >
                <div className="zrd-terr__head">
                  <span className="zrd-terr__dot" />
                  <span className="zrd-terr__name">{t.name}</span>
                  <span
                    className={`zrd-terr__who ${isHuman ? "is-human" : "is-ai"}`}
                    title={isHuman ? "Живой игрок" : "Компьютер (ИИ)"}
                  >
                    {isHuman ? <User aria-hidden /> : <Bot aria-hidden />}
                  </span>
                </div>
                <div className="zrd-terr__kpis">
                  {t.kpis.map((k) => {
                    const on = Math.max(0, Math.min(SEG, Math.round((k.pct / 100) * SEG)));
                    return (
                      <div key={k.label} className="zrd-terr__kpi">
                        <span className="zrd-terr__label">{k.label}</span>
                        <span className="zrd-terr__value">{k.value}</span>
                        <span className="zrd-terr__bar" aria-hidden>
                          {Array.from({ length: SEG }).map((_, i) => (
                            <span key={i} className={`zrd-terr__cell${i < on ? " is-on" : ""}`} />
                          ))}
                        </span>
                        <span className={`zrd-terr__delta ${deltaClass(k.trend)}`}>{k.delta}</span>
                      </div>
                    );
                  })}
                </div>
              </button>
            </HoverCardTrigger>
            <TerritoryPopover t={t} />
          </HoverCard>
        );
      })}
    </div>
  );
}
