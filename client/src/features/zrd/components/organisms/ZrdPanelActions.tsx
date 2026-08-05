import { CalendarCheck, Building2, TrendingUp, Users, Star, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { DeckId, ZrdSeatView } from "@shared/zrd/match-types";
import { handOfDeck } from "../../zrd-match-board";
import { ZrdTip } from "./ZrdTip";

/** Глаголы-категории → личные колоды матча. «Анализировать» дополнительно сигналит viewData (скоринг аналитики). */
const VERBS: { label: string; icon: LucideIcon; deckId: DeckId; analytics?: boolean; desc: string }[] = [
  { label: "Планировать",   icon: CalendarCheck, deckId: "projects",
    desc: "Стратегические проекты РРС: открытия, переезды, склады, раскрытие потенциала." },
  { label: "Строить",       icon: Building2,     deckId: "logistics",
    desc: "Логистика: поставки, склады, транспорт, доставка до клиента." },
  { label: "Развивать",     icon: TrendingUp,    deckId: "promo",
    desc: "Продвижение: реклама, акции, брендинг, программы лояльности." },
  { label: "Управлять",     icon: Users,         deckId: "staff",
    desc: "Сотрудники: найм, обучение, наставничество, удержание команды." },
  { label: "Анализировать", icon: Star,          deckId: "goods", analytics: true,
    desc: "Товар и данные: ассортимент, закупка, цены, инвентаризация. Открытие фиксируется как работа с данными." },
];

/** «Действия» — меню глаголов; открывает свою колоду карт соответствующего направления. */
export function ZrdPanelActions({ view, onOpenDeck, onViewData }: { view: ZrdSeatView; onOpenDeck: (deckId: DeckId) => void; onViewData: () => void }) {
  const canOpen = !view.matchEnded;
  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">Действия</div>
      <div className="zrd-frame__body">
        {VERBS.map((v) => {
          const Icon = v.icon;
          const inHand = handOfDeck(view.you, v.deckId).length;
          return (
            <ZrdTip key={v.label} title={v.label} value={`Карт в руке: ${inHand}`} desc={v.desc}>
              <button
                type="button"
                className="zrd-act-row"
                disabled={!canOpen}
                onClick={() => { if (v.analytics) onViewData(); onOpenDeck(v.deckId); }}
              >
                <span className="zrd-verb-ico"><Icon aria-hidden /></span>
                <span className="zrd-act-label">{v.label}</span>
                <ChevronRight className="zrd-verb-chev" aria-hidden />
              </button>
            </ZrdTip>
          );
        })}
      </div>
    </div>
  );
}
