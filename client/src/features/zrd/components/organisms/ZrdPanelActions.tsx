import { CalendarCheck, Building2, TrendingUp, Users, Star, ChevronRight } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { PublicZrdState } from "@shared/zrd/engine";
import { ZrdTip } from "./ZrdTip";

/** Глаголы-категории → колода движка (ZRD_DECKS): infra/it=logistics, marketing/strategic=projects, hr=staff. */
const VERBS: { label: string; icon: LucideIcon; deckId: string; desc: string }[] = [
  { label: "Планировать",   icon: CalendarCheck, deckId: "projects",
    desc: "Стратегические проекты: открыть колоду планирования (выход в новые районы, e-commerce, ассортимент)." },
  { label: "Строить",       icon: Building2,     deckId: "logistics",
    desc: "Инфраструктура: открыть колоду логистики (магазины, гипермаркеты, склады и хабы)." },
  { label: "Развивать",     icon: TrendingUp,    deckId: "projects",
    desc: "Маркетинг и рост: открыть колоду проектов (рекламные кампании, продвижение, расширение)." },
  { label: "Управлять",     icon: Users,         deckId: "staff",
    desc: "Персонал: открыть колоду сотрудников (найм, обучение, наставничество, мотивация)." },
  { label: "Анализировать", icon: Star,          deckId: "logistics",
    desc: "IT и данные: открыть колоду логистики/IT (CRM, BI-аналитика, автоматизация склада)." },
];

/** #9-1 «Действия» — меню действий-глаголов; открывает колоду карт по категории. */
export function ZrdPanelActions({ state, onOpenDeck }: { state: PublicZrdState; onOpenDeck: (deckId: string) => void }) {
  const canOpen = state.phase === "action" || state.phase === "research";
  return (
    <div className="zrd-frame h-full">
      <div className="zrd-frame__head">Действия</div>
      <div className="zrd-frame__body">
        {VERBS.map((v) => {
          const Icon = v.icon;
          return (
            <ZrdTip key={v.label} title={v.label} value="Открывает колоду карт" desc={v.desc}>
              <button
                type="button"
                className="zrd-act-row"
                disabled={!canOpen}
                onClick={() => onOpenDeck(v.deckId)}
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
