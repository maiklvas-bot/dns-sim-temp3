import "@/styles/zrd.css";
import { useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, AlertCircle, Layers } from "lucide-react";
import { useDnsTheme } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { PublicZrdState } from "@shared/zrd/engine";
import type { ProjectCard, StandardAction, StrategyKey, Resources, CardCondition } from "@shared/zrd/types";
import { useZrdGame } from "./useZrdGame";
import { ZRD_DECKS } from "./zrd-board-data";
import { ZrdLobby } from "./components/organisms/ZrdLobby";
import { ZrdGoalDeclaration } from "./components/organisms/ZrdGoalDeclaration";
import { ZrdHand } from "./components/organisms/ZrdHand";
import { ZrdEventDialog } from "./components/organisms/ZrdEventDialog";
import { ZrdResults } from "./components/organisms/ZrdResults";
import { ZrdBoardBuild } from "./components/organisms/ZrdBoardBuild";
import { ZrdRoundBadge } from "./components/organisms/ZrdRoundBadge";

type Player = PublicZrdState["player"];

function affordable(res: Resources, cost?: Partial<Resources>): boolean {
  if (!cost) return true;
  return (Object.keys(cost) as (keyof Resources)[]).every((k) => (res[k] ?? 0) >= (cost[k] ?? 0));
}
function conditionMet(player: Player, cond?: CardCondition): boolean {
  if (!cond) return true;
  if (cond.minMetric) for (const k of Object.keys(cond.minMetric) as (keyof typeof cond.minMetric)[]) if ((player.metrics[k] ?? 0) < (cond.minMetric[k] ?? 0)) return false;
  if (cond.minResource) for (const k of Object.keys(cond.minResource) as (keyof Resources)[]) if ((player.resources[k] ?? 0) < (cond.minResource[k] ?? 0)) return false;
  if (cond.minResourceProd) for (const k of Object.keys(cond.minResourceProd) as (keyof Resources)[]) if ((player.resourceProd[k] ?? 0) < (cond.minResourceProd[k] ?? 0)) return false;
  return true;
}

export default function ZrdGameWorkspace() {
  const { themeClass } = useDnsTheme();
  const game = useZrdGame();
  const [, navigate] = useLocation();
  const [keepSel, setKeepSel] = useState<string[]>([]);
  const [deckOpen, setDeckOpen] = useState<string | null>(null);

  const { state, result } = game;
  const showResults = Boolean(result) && (state?.ended ?? true);

  const toggleKeep = (card: ProjectCard) =>
    setKeepSel((s) => (s.includes(card.id) ? s.filter((x) => x !== card.id) : [...s, card.id]));

  const confirmKeep = async () => { await game.dispatch({ kind: "keepCards", cardIds: keepSel }); setKeepSel([]); };

  return (
    <div className={themeClass}>
      <div className="zrd-root flex h-dvh flex-col overflow-hidden">
        {/* Шапка */}
        <header className="border-b px-4 py-3" style={{ borderColor: "var(--zrd-border)" }}>
          <div className="mx-auto flex w-full max-w-[1700px] items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold transition-colors"
            style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text-dim)", cursor: "pointer" }}
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Выход
          </button>
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: "rgba(255,107,0,0.14)", color: "#FF6B00" }}>
              <Layers className="h-4 w-4" aria-hidden />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-extrabold" style={{ color: "var(--zrd-text)" }}>Институт ЗРД</div>
              <div className="text-[11px]" style={{ color: "var(--zrd-text-dim)" }}>Покорение новых территорий</div>
            </div>
          </div>
          <div className="ml-auto">
            {/* Бейдж раунда в шапке (замена плашки на борде). Переключатель темы временно скрыт. */}
            {state && !showResults && state.phase !== "setup" && (
              <ZrdRoundBadge round={Math.min(state.quarter ?? 1, state.config?.quarters ?? 24)} total={state.config?.quarters ?? 24} />
            )}
            {/* <ThemeToggle theme={theme} onToggle={toggleTheme} /> */}
          </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          {game.rejected && (
            <div className="mx-2 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(232,90,90,0.14)", color: "#e85a5a" }}>
              <AlertCircle className="h-4 w-4" aria-hidden /> Ход недоступен ({game.rejected}). Выберите другое действие.
            </div>
          )}

          {/* Лобби / результаты / цель — центрированный скролл */}
          {(!state || showResults || state.phase === "setup") && (
            <div className="mx-auto w-full max-w-[1700px] flex-1 space-y-4 overflow-y-auto p-4">
              {!state && !showResults && <ZrdLobby onStart={game.start} loading={game.loading} error={game.error} />}
              {showResults && result && <ZrdResults result={result} onLeave={game.leave} />}
              {state && !showResults && state.phase === "setup" && (
                <ZrdGoalDeclaration onDeclare={(s: StrategyKey) => game.dispatch({ kind: "declareStrategy", strategy: s })} />
              )}
            </div>
          )}

          {/* Игровой стол — полное заполнение FullHD */}
          {state && !showResults && state.phase !== "setup" && (
            <div className="flex min-h-0 flex-1 flex-col p-2">
              <ZrdBoardBuild
                state={state}
                onStandard={(a: StandardAction) => game.dispatch({ kind: "standard", action: a })}
                onPass={() => (state.phase === "research" ? confirmKeep() : game.dispatch({ kind: "pass" }))}
                onOpenDeck={(id) => setDeckOpen(id)}
              />

              {/* Модал-колода: исследование = выбрать в руку; действия = разыграть */}
              {deckOpen && (() => {
                const deck = ZRD_DECKS.find((d) => d.id === deckOpen);
                if (!deck) return null;
                const DeckIcon = deck.icon;
                const inResearch = state.phase === "research";
                const cards = (inResearch ? state.offer : state.player.hand).filter((c) => deck.categories.includes(c.category));
                return (
                  <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,12,22,0.66)", backdropFilter: "blur(3px)" }} role="dialog" aria-modal="true" onClick={() => setDeckOpen(null)}>
                    <div className="zrd-panel w-full max-w-3xl p-5" style={{ background: "var(--zrd-surface-2)" }} onClick={(e) => e.stopPropagation()}>
                      <div className="mb-3 flex items-center gap-2">
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg" style={{ background: `${deck.color}22`, color: deck.color }}><DeckIcon className="h-4 w-4" aria-hidden /></span>
                        <h2 className="text-lg font-extrabold" style={{ color: "var(--zrd-text)" }}>{deck.label}</h2>
                        <span className="text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>{inResearch ? "выберите карты в руку (первая бесплатно, далее 2К)" : "разыграйте проект"}</span>
                        <button type="button" className="ml-auto rounded-lg border px-2.5 py-1 text-sm" style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text-dim)", cursor: "pointer" }} onClick={() => setDeckOpen(null)}>Закрыть</button>
                      </div>
                      <ZrdHand
                        cards={cards}
                        selectedIds={inResearch ? keepSel : undefined}
                        onCardClick={(c) => {
                          if (inResearch) { toggleKeep(c); }
                          else { game.dispatch({ kind: "playCard", cardId: c.id }); setDeckOpen(null); }
                        }}
                        check={inResearch ? undefined : (c) => {
                          if (state.actionsLeft <= 0) return { ok: false, reason: "Нет действий в этом раунде" };
                          if (!affordable(state.player.resources, c.cost)) return { ok: false, reason: "Не хватает ресурсов" };
                          if (!conditionMet(state.player, c.condition)) return { ok: false, reason: "Не выполнено условие карты" };
                          return { ok: true };
                        }}
                        emptyText={inResearch ? "В этой колоде нет карт в этом раунде" : "Нет карт этой колоды в руке"}
                      />
                      {inResearch && (
                        <div className="mt-4 flex items-center gap-2">
                          <button type="button" onClick={() => { confirmKeep(); setDeckOpen(null); }} className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{ background: "#FF6B00", cursor: "pointer" }}>
                            Оставить {keepSel.length > 0 ? `(${keepSel.length})` : "—"} и продолжить
                          </button>
                          <span className="text-[12px]" style={{ color: "var(--zrd-text-dim)" }}>В руке: {state.player.hand.length}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </main>

        {/* Событие — модальное окно поверх стола */}
        {state && !showResults && state.phase === "event" && state.pendingEvent && (
          <ZrdEventDialog
            event={state.pendingEvent}
            resources={state.player.resources}
            onChoose={(optionId) => game.dispatch({ kind: "eventChoice", optionId })}
          />
        )}

        {!(state && !showResults && state.phase !== "setup") && (
          <footer className={cn("px-4 py-2 text-center text-[11px]")} style={{ color: "var(--zrd-text-dim)" }}>
            ЗРД · стратегическая симуляция управления регионом · DNS SimCenter
          </footer>
        )}
      </div>
    </div>
  );
}
