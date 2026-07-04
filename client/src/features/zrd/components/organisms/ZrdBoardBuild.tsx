import type { StandardAction } from "@shared/zrd/types";
import type { DeckId, ZrdSeatView } from "@shared/zrd/match-types";
import { DECK_IDS } from "@shared/zrd/match-types";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ZrdPanelRegionStats } from "./ZrdPanelRegionStats";
import { ZrdPanelAvailableActions } from "./ZrdPanelAvailableActions";
import { ZrdPanelProjects } from "./ZrdPanelProjects";
import { ZrdPanelResources } from "./ZrdPanelResources";
import { ZrdPanelActions } from "./ZrdPanelActions";
import { ZrdDeck } from "./ZrdDeck";
import { ZrdTopStrip } from "./ZrdTopStrip";
import { ZrdMissionPanel } from "./ZrdMissionPanel";
import { ZrdTerritories } from "./ZrdTerritories";
import { ZrdDiscard } from "./ZrdDiscard";
import { ZrdClosingBlock } from "./ZrdClosingBlock";
import { ZrdIslandMap } from "./ZrdIslandMap";

interface Props {
  view: ZrdSeatView;
  openDeck: DeckId | null;
  onToggleDeck: (deckId: DeckId) => void;
  onStandard: (a: StandardAction) => void;
  onPlayCard: (cardId: string) => void;
  onPass: () => void;
  onViewData: () => void;
  onOpenEvent: () => void;
  onReactSwan: (swanId: string) => void;
}

/** Борд матча: все блоки живые от seat-view; правые колоды — личные 6×50. */
export function ZrdBoardBuild({ view, openDeck, onToggleDeck, onStandard, onPlayCard, onPass, onViewData, onOpenEvent, onReactSwan }: Props) {
  const canPass = !view.matchEnded && !view.you.passed && !view.you.pendingEvent;
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
    <div className="flex h-full gap-2">
      {/* Левый край — 5 панелей вертикально, на ВСЮ высоту полотна (делят высоту поровну) */}
      <div className="flex w-[248px] flex-shrink-0 flex-col gap-2 min-h-0 py-1 pl-1">
        <div className="min-h-0 flex-1"><ZrdPanelRegionStats view={view} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelAvailableActions view={view} onStandard={onStandard} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelActions view={view} onOpenDeck={onToggleDeck} onViewData={onViewData} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelResources view={view} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelProjects view={view} /></div>
      </div>

      {/* Центр: сверху «Миссия» + «Событие раунда» + «Чёрный лебедь»; ниже — карта 4 РРС (слот под арт) */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
        <div className="flex shrink-0 gap-2" style={{ height: "calc((100% - 32px) / 5)" }}>
          <div className="min-w-0 flex-1"><ZrdMissionPanel view={view} /></div>
          <div className="min-w-0 flex-1"><ZrdTopStrip view={view} onOpenEvent={onOpenEvent} /></div>
          <div className="shrink-0" style={{ aspectRatio: "5 / 4", height: "100%" }}>
            <ZrdClosingBlock view={view} onReact={onReactSwan} />
          </div>
        </div>
        {/* Центр — карта территории (четверть 1/4: остров своей РРС); кнопка завершения хода поверх */}
        <div className="relative min-h-0 flex-1 overflow-hidden rounded-xl border"
          style={{ borderColor: "rgba(255,107,0,0.16)", background: "#111318" }}>
          <ZrdIslandMap view={view} />
          <button
            type="button"
            onClick={onPass}
            disabled={!canPass}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 rounded-xl px-6 py-2.5 text-sm font-extrabold text-white transition-opacity disabled:opacity-40"
            style={{ background: "#FF6B00", cursor: canPass ? "pointer" : "default", boxShadow: "0 6px 18px rgba(0,0,0,0.5)" }}
            title={view.you.pendingEvent ? "Сначала решите событие квартала" : view.you.passed ? "Ход завершён — ждём остальных" : "Завершить ход месяца"}
          >
            {view.you.passed ? "Ход завершён — ждём остальных" : `Завершить месяц (осталось действий: ${view.you.actionsLeft})`}
          </button>
        </div>
        {/* Нижняя полоса: 4 РРС + колода сброса */}
        <div className="flex shrink-0 gap-2" style={{ height: "calc((100% - 32px) / 5)" }}>
          <div className="min-w-0 flex-1"><ZrdTerritories view={view} /></div>
          <ZrdDiscard view={view} />
        </div>
      </div>

      {/* Правый край — 6 личных колод (Продвижение · Сервис · Логистика · Товар · Сотрудники · Проекты) */}
      <div className="zrd-deck-col-r flex-shrink-0 min-h-0 py-1 pr-1">
        {DECK_IDS.map((deckId) => (
          <ZrdDeck key={deckId} deckId={deckId} view={view} open={openDeck === deckId} onToggle={() => onToggleDeck(deckId)} onPlay={onPlayCard} />
        ))}
      </div>
    </div>
    </TooltipProvider>
  );
}
