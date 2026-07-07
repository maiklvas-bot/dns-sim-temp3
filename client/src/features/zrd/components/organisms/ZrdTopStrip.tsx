import { Zap, CheckCircle2 } from "lucide-react";
import type { ZrdSeatView } from "@shared/zrd/match-types";

/**
 * Блок «Событие раунда» — живой: показывает квартальную дилемму своего места,
 * ждущую решения (клик — открыть выбор), или спокойный месяц.
 */
export function ZrdTopStrip({ view, onOpenEvent }: { view: ZrdSeatView; onOpenEvent: () => void }) {
  const ev = view.you.pendingEvent;
  return (
    <div className="zrd-frame zrd-event">
      <div className="zrd-frame__head">Событие раунда</div>
      <div className="zrd-event__body">
        {ev ? (
          <>
            <div className="zrd-event__title">{ev.title}</div>
            <div className="zrd-event__desc">Квартальная дилемма требует вашего решения — без него ход не завершить</div>
            <div className="zrd-event__impact-head">Реакция</div>
            <div className="zrd-event__impact">
              <button type="button" className="zrd-evt-chip" onClick={onOpenEvent} style={{ cursor: "pointer" }}>
                <span className="zrd-evt-dot is-warn"><Zap aria-hidden /></span>
                Выбрать реакцию ({ev.options.length})
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="zrd-event__title">Спокойный месяц</div>
            <div className="zrd-event__desc">Дилемм нет — квартальные события приходят на рубеже кварталов</div>
            <div className="zrd-event__impact-head">Статус</div>
            <div className="zrd-event__impact">
              <span className="zrd-evt-chip"><span className="zrd-evt-dot is-good"><CheckCircle2 aria-hidden /></span>решений не требуется</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
