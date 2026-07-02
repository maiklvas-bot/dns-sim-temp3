import type { ReactNode } from "react";
import { BarChart3, Clock, AlertTriangle, Globe } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";

type Tone = "bad" | "accent";
interface SwanRow { ico: ReactNode; label: string; value: string; tone: Tone; hint: string }

/** Показатели текущего риска. Заглушки до появления контента рисков в движке. */
const ROWS: SwanRow[] = [
  { ico: <BarChart3 aria-hidden />, label: "Влияние на процессы", value: "−2", tone: "bad", hint: "Замедляет операционные показатели РРС на время действия" },
  { ico: <Clock aria-hidden />, label: "Длительность", value: "2 нед.", tone: "accent", hint: "Сколько раундов сохраняется эффект события" },
  { ico: <AlertTriangle aria-hidden />, label: "Вероятность", value: "6%", tone: "bad", hint: "Шанс, что событие сработает в очередном раунде" },
  { ico: <Globe aria-hidden />, label: "Масштаб", value: "Локальный", tone: "accent", hint: "Затрагивает одну РРС, а не весь дивизион" },
];

/**
 * Замыкающий блок «Чёрный лебедь» (по макету DAHOQZK8EeY) — риск-событие раунда.
 * Верхний ряд, справа от «События раунда». При наведении — всплывающее окно с пояснением
 * (что такое «чёрный лебедь» + что за событие сейчас и на что влияет).
 */
export function ZrdClosingBlock({ active = true }: { state: PublicZrdState; active?: boolean }) {
  // active — «чёрный лебедь» сейчас сработал: кромка блока мягко пульсирует красным.
  // Пока движок solo — по умолчанию true (демо); при контенте рисков придёт из состояния.
  return (
    <HoverCard openDelay={120} closeDelay={80}>
      <HoverCardTrigger asChild>
        <div className={`zrd-frame zrd-swan${active ? " is-active" : ""}`} tabIndex={0} role="button"
          aria-label="Чёрный лебедь: Проверка органов — подробности при наведении">
          <div className="zrd-frame__head">Чёрный лебедь</div>
          <div className="zrd-swan__body">
            <div className="zrd-swan__title">Проверка органов</div>
            <div className="zrd-swan__rows">
              {ROWS.map((r) => (
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

      <HoverCardContent
        side="bottom"
        align="end"
        sideOffset={8}
        className="zrd-swan-pop w-[336px] p-0 bg-transparent border-0 rounded-none shadow-none"
      >
        <div className="zrd-swan-pop__head">
          <AlertTriangle className="zrd-swan-pop__head-ico" aria-hidden />
          <span>Чёрный лебедь</span>
        </div>
        <div className="zrd-swan-pop__inner">
          <p className="zrd-swan-pop__def">
            Редкое, труднопредсказуемое событие с сильным эффектом. Его нельзя запланировать
            заранее — важно вовремя среагировать, когда оно срабатывает.
          </p>
          <div className="zrd-swan-pop__now">
            <span className="zrd-swan-pop__now-lbl">Сейчас сработало</span>
            <span className="zrd-swan-pop__now-val">Проверка органов</span>
          </div>
          <p className="zrd-swan-pop__desc">
            Внеплановая проверка контролирующих органов тормозит бизнес-процессы в одной РРС:
            часть команды отвлекается на документы, операционка проседает.
          </p>
          <ul className="zrd-swan-pop__list">
            {ROWS.map((r) => (
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
