import { Plus, Settings, Wrench } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";

/**
 * Блок «Событие раунда» (по макету DAHNeYWgFtQ, плоский стиль борда) — один блок, контент по центру.
 * Заголовок события — из состояния; описание/влияние — заглушки до контента событий.
 */
export function ZrdTopStrip({ state }: { state: PublicZrdState }) {
  const eventTitle = state.pendingEvent?.title ?? "Рост спроса на КБТ и ТВ";
  return (
    <div className="zrd-frame zrd-event">
      <div className="zrd-frame__head">Событие раунда</div>
      <div className="zrd-event__body">
        <div className="zrd-event__title">{eventTitle}</div>
        <div className="zrd-event__desc">Усиление спроса в городах-миллионниках и рост онлайн-заказов</div>
        <div className="zrd-event__impact-head">Влияние события</div>
        <div className="zrd-event__impact">
          <span className="zrd-evt-chip"><span className="zrd-evt-dot is-good"><Plus aria-hidden /></span>+ спрос</span>
          <span className="zrd-evt-chip"><span className="zrd-evt-dot is-warn"><Settings aria-hidden /></span>− логистика</span>
          <span className="zrd-evt-chip"><span className="zrd-evt-dot is-info"><Wrench aria-hidden /></span>+ выручка</span>
        </div>
      </div>
    </div>
  );
}
