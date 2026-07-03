import type { CSSProperties } from "react";
import { User, Bot, CircleOff } from "lucide-react";
import type { ZrdSeatPublicSummary, ZrdSeatView, KpiId, RrsId } from "@shared/zrd/match-types";
import { RRS_LABEL } from "@shared/zrd/match-types";
import { KPI_LABEL, computeKpi } from "@shared/zrd/kpi";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

const ACCENT: Record<RrsId, string> = { ekb: "#EC4899", chel: "#06B6D4", tmn: "#84CC16", perm: "#A78BFA" };
const FEATURE: Record<RrsId, string> = {
  ekb: "Флагман дивизиона: крупнейший рынок и трафик, максимальная конкуренция.",
  chel: "Промышленный город: сильный спрос на КБТ и B2B, чувствителен к ценам.",
  tmn: "Нефтегазовый регион: высокий средний чек и платёжеспособный спрос.",
  perm: "Растущий рынок: длинное логистическое плечо, охват ещё не выбран.",
};
const KPI_ORDER: KpiId[] = ["sales_growth", "market_coverage", "efficiency", "service_level", "logistics", "staffing"];
const SEG = 6;

interface TerritoryData {
  seatIdx: number;
  rrsId: RrsId;
  name: string;
  controllerKind: "human" | "ai" | "off";
  kpi: Record<KpiId, number>;
  passed: boolean;
  missionsDone: number;
  isYou: boolean;
}

function territoryFromSummary(s: ZrdSeatPublicSummary): TerritoryData {
  return {
    seatIdx: s.seatIdx, rrsId: s.rrsId, name: s.name, controllerKind: s.controllerKind,
    kpi: s.kpi, passed: s.passed, missionsDone: s.missionsDone, isYou: false,
  };
}

/** Нижняя зона — 4 РРС матча: публичные KPI всех мест, своё подсвечено, статус хода в шапке. */
export function ZrdTerritories({ view }: { view: ZrdSeatView }) {
  const you: TerritoryData = {
    seatIdx: view.seatIdx,
    rrsId: view.you.rrsId,
    name: view.you.controller.kind === "human" ? view.you.controller.name : RRS_LABEL[view.you.rrsId],
    controllerKind: view.you.controller.kind,
    kpi: computeKpi(view.you),
    passed: view.you.passed,
    missionsDone: Object.values(view.you.missionDone).filter(Boolean).length,
    isYou: true,
  };
  const all = [you, ...view.others.map(territoryFromSummary)].sort((a, b) => a.seatIdx - b.seatIdx);

  return (
    <div className="zrd-territories">
      {all.map((t) => {
        const off = t.controllerKind === "off";
        const Icon = t.controllerKind === "human" ? User : t.controllerKind === "ai" ? Bot : CircleOff;
        return (
          <HoverCard key={t.rrsId} openDelay={120} closeDelay={80}>
            <HoverCardTrigger asChild>
              <button
                type="button"
                className={`zrd-terr${t.isYou ? " is-active" : ""}`}
                style={{ "--acc": ACCENT[t.rrsId], opacity: off ? 0.45 : 1 } as CSSProperties}
                aria-pressed={t.isYou}
              >
                <div className="zrd-terr__head">
                  <span className="zrd-terr__dot" />
                  <span className="zrd-terr__name">{RRS_LABEL[t.rrsId]}{t.isYou ? " · вы" : ""}</span>
                  <span
                    className={`zrd-terr__who ${t.controllerKind === "human" ? "is-human" : "is-ai"}`}
                    title={t.controllerKind === "human" ? "Живой игрок" : t.controllerKind === "ai" ? "Компьютер (ИИ)" : "Не задействована"}
                  >
                    <Icon aria-hidden />
                  </span>
                </div>
                <div className="zrd-terr__kpis">
                  {KPI_ORDER.map((k) => {
                    const v = off ? 0 : t.kpi[k];
                    const on = Math.max(0, Math.min(SEG, Math.round((v / 100) * SEG)));
                    return (
                      <div key={k} className="zrd-terr__kpi">
                        <span className="zrd-terr__label">{KPI_LABEL[k]}</span>
                        <span className="zrd-terr__value">{off ? "—" : `${v}%`}</span>
                        <span className="zrd-terr__bar" aria-hidden>
                          {Array.from({ length: SEG }).map((_, i) => (
                            <span key={i} className={`zrd-terr__cell${i < on ? " is-on" : ""}`} />
                          ))}
                        </span>
                        <span className="zrd-terr__delta is-flat" />
                      </div>
                    );
                  })}
                </div>
              </button>
            </HoverCardTrigger>
            <HoverCardContent side="top" align="center" sideOffset={10}
              className="zrd-terr-pop w-[300px] p-0 bg-transparent border-0 rounded-none shadow-none"
              style={{ "--acc": ACCENT[t.rrsId] } as CSSProperties}>
              <div className="zrd-terr-pop__head">
                <span className={`zrd-terr-pop__ico ${t.controllerKind === "human" ? "is-human" : "is-ai"}`}><Icon aria-hidden /></span>
                <span className="zrd-terr-pop__name">{RRS_LABEL[t.rrsId]}</span>
                <span className="zrd-terr-pop__tag">
                  {t.controllerKind === "human" ? "живой игрок" : t.controllerKind === "ai" ? "компьютер" : "не задействована"}
                </span>
              </div>
              <div className="zrd-terr-pop__inner">
                {!off && (
                  <>
                    <div className="zrd-terr-pop__sect">Управленец</div>
                    <div className="zrd-terr-pop__mtype">{t.name}</div>
                    <div className="zrd-terr-pop__mdesc">
                      {t.passed ? "Ход в этом месяце завершён." : "Принимает решения этого месяца."}
                      {t.missionsDone > 0 ? ` Выполнено миссий: ${t.missionsDone}.` : ""}
                    </div>
                  </>
                )}
                <div className="zrd-terr-pop__sect">Особенность РРС</div>
                <div className="zrd-terr-pop__feature">{FEATURE[t.rrsId]}</div>
                {!off && (
                  <>
                    <div className="zrd-terr-pop__sect">Показатели сейчас</div>
                    <ul className="zrd-terr-pop__kpis">
                      {KPI_ORDER.map((k) => (
                        <li key={k} className="zrd-terr-pop__kpirow">
                          <span className="zrd-terr-pop__kpilabel">{KPI_LABEL[k]}</span>
                          <span className="zrd-terr-pop__kpival">{t.kpi[k]}%</span>
                          <span className="zrd-terr-pop__kpidelta is-flat" />
                        </li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </HoverCardContent>
          </HoverCard>
        );
      })}
    </div>
  );
}
