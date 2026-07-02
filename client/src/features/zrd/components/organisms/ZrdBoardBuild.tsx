import type { PublicZrdState } from "@shared/zrd/engine";
import type { StandardAction } from "@shared/zrd/types";
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
import { STAFF_DECK, GOODS_DECK, LOGISTICS_DECK, SERVICE_DECK, PROMO_DECK, PROJECTS_DECK } from "../../zrd-decks";

interface Props {
  state: PublicZrdState;
  onStandard: (a: StandardAction) => void;
  onPass: () => void;
  onOpenDeck: (deckId: string) => void;
}

/** Чистый борд — собираем по частям. Нижний ряд готов (5 панелей); верх и центр — следующими частями. */
export function ZrdBoardBuild({ state, onStandard, onOpenDeck }: Props) {
  return (
    <TooltipProvider delayDuration={150} skipDelayDuration={300}>
    <div className="flex h-full gap-2">
      {/* Левый край — 5 панелей вертикально, на ВСЮ высоту полотна (делят высоту поровну) */}
      <div className="flex w-[248px] flex-shrink-0 flex-col gap-2 min-h-0 py-1 pl-1">
        <div className="min-h-0 flex-1"><ZrdPanelRegionStats state={state} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelAvailableActions state={state} onStandard={onStandard} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelActions state={state} onOpenDeck={onOpenDeck} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelResources state={state} /></div>
        <div className="min-h-0 flex-1"><ZrdPanelProjects /></div>
      </div>

      {/* Центр: сверху горизонтальный ряд из 2 блоков — «Миссия» (слева) и «Событие раунда» (справа); ниже — центр (4 РРС).
          py-1 — чтобы верхний ряд выровнялся по вертикали с левыми панелями (у них тоже py-1). */}
      <div className="flex min-w-0 flex-1 flex-col gap-2 py-1">
        {/* Верхний ряд: два блока РАВНОЙ ширины, РОВНО в высоту одной левой панели: (контент − 4 зазора×8) / 5.
            Справа невидимый спейсер шириной = «колоде сброса», чтобы правая граница Миссии/События совпала с правым краем РРС Пермь (не тянулась до колод). */}
        <div className="flex shrink-0 gap-2" style={{ height: "calc((100% - 32px) / 5)" }}>
          <div className="min-w-0 flex-1"><ZrdMissionPanel state={state} /></div>
          <div className="min-w-0 flex-1"><ZrdTopStrip state={state} /></div>
          {/* Замыкающий блок «Чёрный лебедь»: тот же слот, что был у спейсера (aspect 5/4 = ширина колоды сброса),
              поэтому правая граница Миссии/События остаётся ровно по правому краю РРС Пермь, а блок стоит между Событием и колодами. */}
          <div className="shrink-0" style={{ aspectRatio: "5 / 4", height: "100%" }}>
            <ZrdClosingBlock state={state} />
          </div>
        </div>
        {/* Центр — карта 4 РРС (следующая часть) */}
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border border-dashed"
          style={{ borderColor: "rgba(255,107,0,0.12)", color: "var(--zrd-text-dim)" }}>
          <span className="text-sm">Центр — карта 4 РРС (собираем по частям)</span>
        </div>
        {/* Нижняя полоса: 4 территории (РРС) + колода сброса справа (у колод); высота = одной панели */}
        <div className="flex shrink-0 gap-2" style={{ height: "calc((100% - 32px) / 5)" }}>
          <div className="min-w-0 flex-1"><ZrdTerritories state={state} /></div>
          <ZrdDiscard count={state.player.playedCardIds?.length ?? 0} />
        </div>
      </div>

      {/* Правый край — 6 колод карт вертикально (сверху вниз): Продвижение · Сервис · Логистика · Товар · Сотрудники · Проекты.
          Колода = карта; клик по стопке → её карты выезжают ВЛЕВО в один ряд на уровне своей колоды. */}
      <div className="zrd-deck-col-r flex-shrink-0 min-h-0 py-1 pr-1">
        <ZrdDeck deck={PROMO_DECK} state={state} onPlay={onStandard} />
        <ZrdDeck deck={SERVICE_DECK} state={state} onPlay={onStandard} />
        <ZrdDeck deck={LOGISTICS_DECK} state={state} onPlay={onStandard} />
        <ZrdDeck deck={GOODS_DECK} state={state} onPlay={onStandard} />
        <ZrdDeck deck={STAFF_DECK} state={state} onPlay={onStandard} />
        <ZrdDeck deck={PROJECTS_DECK} state={state} onPlay={onStandard} />
      </div>
    </div>
    </TooltipProvider>
  );
}
