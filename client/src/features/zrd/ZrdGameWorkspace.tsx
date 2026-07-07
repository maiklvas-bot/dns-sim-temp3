import "@/styles/zrd.css";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, AlertCircle, Layers, PauseCircle, BookOpen } from "lucide-react";
import { useDnsTheme } from "@/components/theme-toggle";
import { cn } from "@/lib/utils";
import type { StandardAction, EventCard } from "@shared/zrd/types";
import type { DeckId } from "@shared/zrd/match-types";
import { RRS_LABEL } from "@shared/zrd/match-types";
import { getSwan } from "@shared/zrd/content-swans";
import { MASCOT_VISUAL } from "./zrd-mascots";
import { useZrdMatch } from "./useZrdMatch";
import { ZrdLobby } from "./components/organisms/ZrdLobby";
import { ZrdMascotPicker } from "./components/organisms/ZrdMascotPicker";
import { ZrdEventDialog } from "./components/organisms/ZrdEventDialog";
import { ZrdMatchResults } from "./components/organisms/ZrdMatchResults";
import { ZrdBoardBuild } from "./components/organisms/ZrdBoardBuild";
import { ZrdRoundBadge } from "./components/organisms/ZrdRoundBadge";

/** Коды отказов движка → человеческое пояснение. */
const REJECT_TEXT: Record<string, string> = {
  NO_ACTIONS: "Действия месяца закончились",
  CANT_AFFORD: "Не хватает ресурсов",
  COND_NOT_MET: "Не выполнено условие карты",
  EVENT_PENDING: "Сначала решите событие квартала",
  ALREADY_PASSED: "Ход уже завершён — ждём остальных",
  PAUSED: "Оценщик поставил матч на паузу",
  GAME_ENDED: "Матч завершён",
};

export default function ZrdGameWorkspace() {
  const { themeClass } = useDnsTheme();
  const match = useZrdMatch();
  const [, navigate] = useLocation();
  const [deckOpen, setDeckOpen] = useState<DeckId | null>(null);
  const [eventOpen, setEventOpen] = useState(false);
  const [swanOpen, setSwanOpen] = useState<string | null>(null);

  const { view } = match;
  const showResults = Boolean(view?.matchEnded);
  // матчи, созданные до появления маскотов, не несут mascotId — даём фигурку по умолчанию
  const mascot = view ? (MASCOT_VISUAL[view.you.mascotId] ?? MASCOT_VISUAL.strateg) : null;

  // Квартальная дилемма БЛОКИРУЕТ все действия месяца (EVENT_PENDING) — открываем её диалог сами,
  // как событие в HoMM: иначе игрок видит «мёртвые» кнопки и не понимает, что матч ждёт его решения.
  const pendingEventId = view?.you.pendingEvent?.id ?? null;
  useEffect(() => {
    if (pendingEventId) setEventOpen(true);
  }, [pendingEventId]);

  // диалог реакции на лебедя: переиспользуем форму события (равная форма §8a)
  const swanDef = swanOpen ? getSwan(swanOpen) : null;
  const swanAsEvent: EventCard | null = swanDef
    ? { id: swanDef.id, title: swanDef.title, options: swanDef.options, competencies: [] }
    : null;

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
          {/* Кто проходит симуляцию: аватар маскота + имя участника + его РРС */}
          {view && mascot && view.you.controller.kind === "human" && (
            <div className="inline-flex items-center gap-2 rounded-lg border px-2.5 py-1"
              style={{ borderColor: "rgba(255,107,0,0.4)", background: "rgba(255,107,0,0.08)" }}
              title={`${mascot.name}: ${mascot.style}`}>
              <img
                src={mascot.img}
                alt={mascot.name}
                className="h-8 w-8 rounded-full object-cover"
                style={{ border: `2px solid ${mascot.accent}` }}
                draggable={false}
              />
              <span className="leading-tight">
                <span className="block text-sm font-extrabold" style={{ color: "var(--zrd-text)" }}>{view.you.controller.name}</span>
                <span className="block text-[10px] uppercase tracking-wide" style={{ color: "var(--zrd-text-dim)" }}>
                  {RRS_LABEL[view.you.rrsId]} · {mascot.name}
                </span>
              </span>
            </div>
          )}
          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => navigate("/zrd/manual")}
              className="inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm font-semibold"
              style={{ borderColor: "var(--zrd-border)", color: "var(--zrd-text-dim)", cursor: "pointer" }}
              title="Инструкция к игре"
            >
              <BookOpen className="h-4 w-4" aria-hidden /> Инструкция
            </button>
            {view && !showResults && (
              <ZrdRoundBadge quarter={view.quarter} tick={view.tick} deadlineAt={match.deadlineAt} paused={match.paused} />
            )}
          </div>
          </div>
        </header>

        <main className="flex min-h-0 flex-1 flex-col">
          {match.rejected && (
            <div className="mx-2 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(232,90,90,0.14)", color: "#e85a5a" }}>
              <AlertCircle className="h-4 w-4" aria-hidden /> {REJECT_TEXT[match.rejected] ?? `Ход недоступен (${match.rejected})`}
            </div>
          )}
          {match.paused && view && !showResults && (
            <div className="mx-2 mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(255,107,0,0.14)", color: "#FF6B00" }}>
              <PauseCircle className="h-4 w-4" aria-hidden /> Матч на паузе — оценщик скоро продолжит игру.
            </div>
          )}

          {/* Лобби / результаты — центрированный скролл */}
          {(!view || showResults) && (
            <div className="mx-auto w-full max-w-[1700px] flex-1 space-y-4 overflow-y-auto p-4">
              {!view && (
                <ZrdLobby
                  onJoinCode={(code) => void match.joinByCode(code)}
                  onAdoptSeat={(id, seat, token) => void match.adoptSeat(id, seat, token)}
                  loading={match.loading}
                  error={match.error}
                />
              )}
              {view && showResults && <ZrdMatchResults view={view} onLeave={match.leave} />}
            </div>
          )}

          {/* Игровой стол: на низких окнах — вертикальный скролл вместо разъезда панелей */}
          {view && !showResults && (
            <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-2">
              <ZrdBoardBuild
                view={view}
                openDeck={deckOpen}
                onToggleDeck={(id) => setDeckOpen((cur) => (cur === id ? null : id))}
                onStandard={(a: StandardAction) => void match.dispatch({ kind: "standard", action: a })}
                onPlayCard={(cardId) => void match.dispatch({ kind: "playCard", cardId })}
                onPass={() => void match.dispatch({ kind: "pass" })}
                onViewData={() => void match.dispatch({ kind: "viewData" })}
                onOpenEvent={() => setEventOpen(true)}
                onReactSwan={(swanId) => setSwanOpen(swanId)}
              />
            </div>
          )}
        </main>

        {/* Первый вход по коду: игрок сам выбирает фигурку (оценщик аватары не назначает) */}
        {view && !showResults && view.you.controller.kind === "human" && view.you.mascotChosen === false && (
          <ZrdMascotPicker
            playerName={view.you.controller.name}
            onComplete={(id, email) => void match.chooseMascot(id, email)}
          />
        )}

        {/* Квартальная дилемма — модал (открывается из «События раунда» или блокирует пас) */}
        {view && !showResults && eventOpen && view.you.pendingEvent && (
          <ZrdEventDialog
            event={view.you.pendingEvent}
            resources={view.you.resources}
            onChoose={(optionId) => { void match.dispatch({ kind: "eventChoice", optionId }); setEventOpen(false); }}
          />
        )}

        {/* Реакция на чёрного лебедя — модал той же формы */}
        {view && !showResults && swanAsEvent && (
          <ZrdEventDialog
            event={swanAsEvent}
            resources={view.you.resources}
            onChoose={(optionId) => { void match.dispatch({ kind: "swanChoice", swanId: swanAsEvent.id, optionId }); setSwanOpen(null); }}
          />
        )}

        {!(view && !showResults) && (
          <footer className={cn("px-4 py-2 text-center text-[11px]")} style={{ color: "var(--zrd-text-dim)" }}>
            ЗРД · стратегический матч 4 РРС · DNS SimCenter
          </footer>
        )}
      </div>
    </div>
  );
}
