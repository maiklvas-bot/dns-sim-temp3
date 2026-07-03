import type { ReactNode } from "react";
import { BarChart3, Clock, AlertTriangle, Globe, ShieldCheck } from "lucide-react";
import type { ActiveSwan, ZrdSeatView } from "@shared/zrd/match-types";
import { RRS_LABEL } from "@shared/zrd/match-types";
import { getSwan } from "@shared/zrd/content-swans";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

type Tone = "bad" | "accent";
interface SwanRow { ico: ReactNode; label: string; value: string; tone: Tone; hint: string }

function rowsFor(swan: ActiveSwan): SwanRow[] {
  const def = getSwan(swan.swanId);
  if (!def) return [];
  const impact = [
    ...Object.entries(def.tickPenalty.metrics ?? {}).map(([, v]) => v ?? 0),
    ...Object.entries(def.tickPenalty.resources ?? {}).map(([, v]) => v ?? 0),
  ].reduce((a, v) => a + v, 0);
  return [
    { ico: <BarChart3 aria-hidden />, label: "Влияние на процессы", value: String(impact), tone: "bad",
      hint: "Суммарный штраф за каждый месяц действия, пока место не отреагирует" },
    { ico: <Clock aria-hidden />, label: "Осталось", value: `${swan.weeksLeft} нед.`, tone: "accent",
      hint: "Сколько недель эффект ещё сохраняется" },
    { ico: <AlertTriangle aria-hidden />, label: "Реакции", value: String(def.options.length), tone: "accent",
      hint: "Сколько вариантов реакции доступно — реакция снимает штраф с вашей РРС" },
    { ico: <Globe aria-hidden />, label: "Масштаб", value: swan.scope === "global" ? "Глобальный" : (swan.targetRrs ? RRS_LABEL[swan.targetRrs] : "Локальный"), tone: swan.scope === "global" ? "bad" : "accent",
      hint: swan.scope === "global" ? "Затрагивает все активные РРС дивизиона" : "Затрагивает одну РРС" },
  ];
}

/**
 * Блок «Чёрный лебедь» — живое состояние рисков матча. Показывает активного лебедя,
 * задевающего вашу РРС (или первого активного). Клик — реакция (если ещё не реагировали).
 */
export function ZrdClosingBlock({ view, onReact }: { view: ZrdSeatView; onReact: (swanId: string) => void }) {
  const mine = view.swans.filter((s) => s.scope === "global" || s.targetRrs === view.you.rrsId);
  const swan = mine[0] ?? view.swans[0] ?? null;
  const def = swan ? getSwan(swan.swanId) : null;
  const targetsMe = Boolean(swan && (swan.scope === "global" || swan.targetRrs === view.you.rrsId));
  const reacted = Boolean(swan?.reactedSeats.includes(view.seatIdx));
  const active = Boolean(swan && targetsMe && !reacted);

  if (!swan || !def) {
    return (
      <div className="zrd-frame zrd-swan" tabIndex={0} aria-label="Чёрный лебедь: сейчас не активен">
        <div className="zrd-frame__head">Чёрный лебедь</div>
        <div className="zrd-swan__body">
          <div className="zrd-swan__title" style={{ opacity: 0.6 }}>Горизонт чист</div>
          <div className="zrd-swan__rows">
            <div className="zrd-swan__row">
              <span className="zrd-swan__ico"><ShieldCheck aria-hidden /></span>
              <span className="zrd-swan__label">Активных рисков нет</span>
              <span className="zrd-swan__val is-accent">—</span>
            </div>
            <div className="zrd-swan__row">
              <span className="zrd-swan__ico"><AlertTriangle aria-hidden /></span>
              <span className="zrd-swan__label">Может сработать в любой месяц</span>
              <span className="zrd-swan__val is-accent">rng</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const rows = rowsFor(swan);
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className={`zrd-frame zrd-swan${active ? " is-active" : ""}`} tabIndex={0} role="button"
          onClick={() => { if (active) onReact(swan.swanId); }}
          onKeyDown={(e) => { if (active && (e.key === "Enter" || e.key === " ")) onReact(swan.swanId); }}
          style={{ cursor: active ? "pointer" : "default" }}
          aria-label={`Чёрный лебедь: ${def.title}${active ? " — нажмите, чтобы отреагировать" : reacted ? " — вы уже отреагировали" : ""}`}>
          <div className="zrd-frame__head">Чёрный лебедь{view.swans.length > 1 ? ` (${view.swans.length})` : ""}</div>
          <div className="zrd-swan__body">
            <div className="zrd-swan__title">{def.title}</div>
            <div className="zrd-swan__rows">
              {rows.map((r) => (
                <div key={r.label} className="zrd-swan__row">
                  <span className="zrd-swan__ico">{r.ico}</span>
                  <span className="zrd-swan__label">{r.label}</span>
                  <span className={`zrd-swan__val is-${r.tone}`}>{r.value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </HoverCardTrigger>

      <HoverCardContent side="bottom" align="end" sideOffset={8}
        className="zrd-swan-pop w-[336px] p-0 bg-transparent border-0 rounded-none shadow-none">
        <div className="zrd-swan-pop__head">
          <AlertTriangle className="zrd-swan-pop__head-ico" aria-hidden />
          <span>Чёрный лебедь</span>
        </div>
        <div className="zrd-swan-pop__inner">
          <p className="zrd-swan-pop__def">
            Редкое, труднопредсказуемое событие с сильным эффектом. Штраф применяется каждый месяц,
            пока действует, — реакция снимает его с вашей РРС.
          </p>
          <div className="zrd-swan-pop__now">
            <span className="zrd-swan-pop__now-lbl">{reacted ? "Вы отреагировали" : targetsMe ? "Бьёт по вам" : "Активен в дивизионе"}</span>
            <span className="zrd-swan-pop__now-val">{def.title}</span>
          </div>
          <p className="zrd-swan-pop__desc">{def.description}</p>
          <ul className="zrd-swan-pop__list">
            {rows.map((r) => (
              <li key={r.label} className="zrd-swan-pop__item">
                <span className="zrd-swan-pop__item-ico">{r.ico}</span>
                <span className="zrd-swan-pop__item-main">
                  <span className="zrd-swan-pop__item-top">
                    <span className="zrd-swan-pop__item-label">{r.label}</span>
                    <span className={`zrd-swan-pop__item-val is-${r.tone}`}>{r.value}</span>
                  </span>
                  <span className="zrd-swan-pop__item-hint">{r.hint}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </HoverCardContent>
    </HoverCard>
  );
}
