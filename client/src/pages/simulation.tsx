import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { getChannelNotificationCounts, useSimulation } from "../context/SimulationContext";
import StoreMap from "@/components/store-map";
import SignalFeed from "@/components/signal-feed";
import MetricsPanel from "@/components/metrics-panel";
import ResponseBar from "@/components/response-bar";
import ToastNotifications from "@/components/toast-notification";
import ConsequenceModal from "@/components/consequence-modal";
import DecisionJournal from "@/components/decision-journal";
import ActiveTimersPanel from "@/components/active-timers-panel";
import { Timer, Calendar, User, FileText, StopCircle, FlaskConical, PauseCircle, PlayCircle, Map, BarChart3, Radio } from "lucide-react";
import { setLiveSimulationRole } from "@/lib/live-session";
import storeBg from "@assets/store_bg.png";

// Тип иконки из lucide-react
type LucideIcon = React.ComponentType<{ className?: string }>;

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

// Тип для мобильных табов
export default function SimulationPage() {
  const [, navigate] = useLocation();
  const { state, dispatch, isReadOnly, livePresence, liveSessionConfig, liveSocketConnected, liveStatus, mode } = useSimulation();

  // ─── Mobile tab state ───
  const [mobileTab, setMobileTab] = useState<'map' | 'signals' | 'metrics'>('signals');

  // Auto-start if not running (direct navigation as participant)
  useEffect(() => {
    if (isReadOnly) {
      return;
    }

    if (mode !== "standalone") {
      return;
    }

    if (!state.isRunning && !state.isCompleted && state.decisions.length === 0) {
      // If no config was set, start with defaults
      if (state.selectedCaseIds.length > 0 && !state.isRunning) {
        dispatch({ type: "START_SIMULATION" });
      }
    }
  }, [dispatch, isReadOnly, mode, state.decisions.length, state.isCompleted, state.isRunning, state.selectedCaseIds.length]);

  // Navigate to results when completed
  useEffect(() => {
    if (state.isCompleted) {
      const timeout = setTimeout(() => navigate("/results"), 1500);
      return () => clearTimeout(timeout);
    }
  }, [state.isCompleted, navigate]);

  const isLowTime = state.timeRemaining < 120;
  const pendingSignals = state.activeSignals.filter(s => !s.isExpired).length;
  const totalPauseSeconds = state.pauses.reduce((sum, pause) => sum + pause.durationSeconds, 0);
  const maxPauseCount = 5;
  const maxPauseSeconds = 30 * 60;
  const pauseLimitReached = state.pauses.length >= maxPauseCount || totalPauseSeconds >= maxPauseSeconds;
  const channelCounts = getChannelNotificationCounts(state);
  const waitingForStudent = isReadOnly && !livePresence.studentConnected;
  const waitingForAssessorSetup = mode === "student" && (liveSessionConfig?.selectedCaseIds.length ?? 0) === 0 && Boolean(liveSessionConfig);
  const hasFallbackLiveSync = Boolean(
    liveSessionConfig && (
      liveStatus != null ||
      livePresence.assessorConnected ||
      livePresence.studentConnected ||
      state.isRunning ||
      state.isPaused ||
      state.isCompleted
    )
  );
  const liveSyncIndicator = !liveSessionConfig
    ? null
    : liveSocketConnected
      ? {
          label: "Синхронизация: онлайн",
          helper: "Мгновенная синхронизация",
          badgeClass: "border-[#00d4aa]/35 bg-[#00d4aa]/10 text-[#8ef0d9]",
          helperClass: "text-[#8ef0d9]",
        }
      : hasFallbackLiveSync
        ? {
            label: "Синхронизация: резерв",
            helper: "Работает через резервный канал",
            badgeClass: "border-[#ffc107]/35 bg-[#ffc107]/10 text-[#ffe08a]",
            helperClass: "text-[#ffe08a]",
          }
        : {
            label: "Синхронизация: ожидание",
            helper: "Связь ещё не поднята",
            badgeClass: "border-[#d7a5a5]/35 bg-[#d7a5a5]/10 text-[#ffdede]",
            helperClass: "text-[#ffdede]",
          };

  // ─── Mobile tab configuration ───
  const tabs: { key: 'map' | 'signals' | 'metrics'; label: string; icon: LucideIcon }[] = [
    { key: 'map', label: 'Карта', icon: Map },
    { key: 'signals', label: 'Сигналы', icon: Radio },
    { key: 'metrics', label: 'Метрики', icon: BarChart3 },
  ];

  return (
    <div
      className="dns-product-shell h-screen flex flex-col overflow-hidden relative"
      style={{
        backgroundImage: `url(${storeBg})`,
        backgroundSize: "cover",
        backgroundPosition: "center",
      }}
    >
      {/* Dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#0d1421f2] via-[#16213ef5] to-[#0d1421f7]" />

      {/* Toast notifications */}
      <ToastNotifications />

      {/* Consequence modal */}
      <ConsequenceModal />

      {/* Decision journal sheet */}
      <DecisionJournal />

      {/* Content */}
      <div className="relative z-10 flex flex-col h-full">
        {/* HEADER */}
        <header className="mx-3 mt-3 flex flex-col gap-3 rounded-2xl border border-[#FF6B00]/20 bg-[#101826]/88 px-3 py-3 shadow-2xl backdrop-blur-xl md:mx-4 md:flex-row md:items-center md:justify-between md:px-5">
          {/* Left header group */}
          <div className="flex items-center gap-2 md:gap-4 overflow-x-auto">
            {/* Timer */}
            <div className={`flex items-center gap-1 md:gap-1.5 px-2 py-1 md:px-3 rounded-lg flex-shrink-0 ${
              isLowTime ? "bg-[#ff4444]/10 border border-[#ff4444]/30" : "bg-[#1e2a3a] border border-[#2a3a4e]"
            }`}>
              <Timer className={`w-3.5 h-3.5 md:w-4 md:h-4 ${isLowTime ? "text-[#ff4444] animate-pulse" : "text-[#FF6B00]"}`} />
              <span className="hidden sm:inline text-[10px] uppercase tracking-[0.14em] text-[#8b93ab]">До конца</span>
              <span className={`text-xs md:text-sm font-mono font-bold tabular-nums ${isLowTime ? "text-[#ff4444]" : "text-white"}`}>
                {formatTime(state.timeRemaining)}
              </span>
            </div>

            {/* Sim date/time */}
            <div className="hidden sm:flex items-center gap-1.5 rounded-lg border border-[#2a3a4e] bg-[#1e2a3a]/60 px-2 md:px-3 py-1 text-[#8890a8] flex-shrink-0">
              <Calendar className="w-3.5 h-3.5" />
              <span className="text-[10px] uppercase tracking-[0.14em] text-[#8b93ab]">Время магазина</span>
              <span className="text-xs font-mono tabular-nums">{state.simDateTime}</span>
            </div>

            {/* Compact mobile date — показываем только время без лейбла */}
            <div className="flex sm:hidden items-center gap-1 rounded-lg border border-[#2a3a4e] bg-[#1e2a3a]/60 px-2 py-1 text-[#8890a8] flex-shrink-0">
              <Calendar className="w-3 h-3" />
              <span className="text-[10px] font-mono tabular-nums">{state.simDateTime}</span>
            </div>

            {/* Participant */}
            {state.participantName && (
              <div className="hidden md:flex items-center gap-1.5 text-[#6a7088]">
                <User className="w-3.5 h-3.5" />
                <span className="text-xs">{state.participantName}</span>
              </div>
            )}

            {/* Test mode badge */}
            {state.isTestMode && (
              <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#ffc107]/15 border border-[#ffc107]/40 flex-shrink-0">
                <FlaskConical className="w-3 h-3 text-[#ffc107]" />
                <span className="text-[10px] text-[#ffc107] font-semibold hidden sm:inline">ТЕСТОВЫЙ РЕЖИМ</span>
                <span className="text-[10px] text-[#ffc107] font-semibold sm:hidden">ТЕСТ</span>
              </div>
            )}

            {liveSyncIndicator && (
              <div className={`hidden lg:flex items-center gap-1 rounded-full border px-2 py-0.5 ${liveSyncIndicator.badgeClass}`}>
                <span className="text-[10px] font-semibold uppercase tracking-[0.16em]">
                  {liveSyncIndicator.label}
                </span>
              </div>
            )}
          </div>

          {/* Right header group */}
          <div className="flex items-center gap-1.5 md:gap-2">
            {/* Channel counts — desktop only */}
            <div className="hidden items-center gap-2 rounded-xl border border-[#2a3a4e] bg-[#141c2b]/70 px-3 py-2 lg:flex">
              {[
                { key: "calls", label: "Звонки", count: channelCounts.calls, color: "#FF6B00" },
                { key: "email", label: "Почта", count: channelCounts.email, color: "#4a9eff" },
                { key: "messenger", label: "ТёркоГрамм", count: channelCounts.messenger, color: "#00d4aa" },
                { key: "video", label: "Видео", count: channelCounts.video, color: "#a78bfa" },
              ].map((item) => (
                <div key={item.key} className="flex items-center gap-2 rounded-lg px-2 py-1" style={{ backgroundColor: `${item.color}14` }}>
                  <span className="text-[10px] text-[#8b93ab]">{item.label}</span>
                  <span
                    className="inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
                    style={{ backgroundColor: item.color }}
                  >
                    {item.count}
                  </span>
                </div>
              ))}
            </div>

            {/* Pending signals indicator */}
            {pendingSignals > 0 && (
              <div className="flex items-center gap-1 px-1.5 md:px-2 py-1 rounded bg-[#FF6B00]/10 border border-[#FF6B00]/30 flex-shrink-0">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B00] animate-pulse" />
                <span className="text-[10px] text-[#FF6B00] font-medium hidden sm:inline">
                  {pendingSignals} сигнал{pendingSignals > 1 ? (pendingSignals < 5 ? "а" : "ов") : ""}
                </span>
                <span className="text-[10px] text-[#FF6B00] font-medium sm:hidden">{pendingSignals}</span>
              </div>
            )}

            {/* Pause button — компактный на мобильных */}
            <button
              onClick={() => dispatch({ type: "TOGGLE_PAUSE" })}
              className={`flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border transition-all text-xs ${
                state.isPaused
                  ? "border-[#00d4aa]/40 bg-[#00d4aa]/10 text-[#00d4aa]"
                  : "border-[#2a3a4e] bg-[#1e2a3a]/60 text-[#8890a8] hover:text-white hover:border-[#3a4a5e]"
              }`}
              data-testid="button-pause"
              disabled={isReadOnly}
            >
              {state.isPaused ? <PlayCircle className="w-3.5 h-3.5" /> : <PauseCircle className="w-3.5 h-3.5" />}
              <span className="hidden sm:inline">{isReadOnly ? "Наблюдение" : state.isPaused ? "Продолжить" : "Пауза"}</span>
            </button>

            {/* Journal button — скрыт на самых маленьких экранах */}
            {mode !== "student" && (
              <button
                onClick={() => dispatch({ type: "TOGGLE_JOURNAL" })}
                className="hidden sm:flex items-center gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-[#2a3a4e] bg-[#1e2a3a]/60 text-[#8890a8] hover:text-white hover:border-[#3a4a5e] transition-all text-xs"
                data-testid="button-journal"
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Журнал ({state.decisions.length})</span>
                <span className="md:hidden">{state.decisions.length}</span>
              </button>
            )}

            {isReadOnly && (
              <>
                <button
                  onClick={() => {
                    setLiveSimulationRole("assessor-setup");
                    navigate("/evaluator");
                  }}
                  className="hidden md:flex items-center gap-1.5 rounded-lg border border-[#2a3a4e] bg-[#1e2a3a]/60 px-3 py-1.5 text-xs text-[#8890a8] transition-all hover:border-[#4a9eff] hover:text-white"
                >
                  В кабинет оценщика
                </button>
                <button
                  onClick={() => navigate("/evaluator")}
                  className="hidden md:flex items-center gap-1.5 rounded-lg border border-[#2a3a4e] bg-[#1e2a3a]/60 px-3 py-1.5 text-xs text-[#8890a8] transition-all hover:border-[#00d4aa] hover:text-white"
                >
                  Новая / текущие сессии
                </button>
              </>
            )}

            {/* End simulation — компактная на мобильных */}
            <button
              onClick={() => dispatch({ type: "COMPLETE_SIMULATION" })}
              className="flex items-center gap-1 md:gap-1.5 px-2 md:px-3 py-1 md:py-1.5 rounded-lg border border-[#ff4444]/30 bg-[#ff4444]/5 text-[#ff4444] hover:bg-[#ff4444]/10 transition-all text-xs flex-shrink-0"
              data-testid="button-end"
              disabled={isReadOnly}
            >
              <StopCircle className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{isReadOnly ? "Только просмотр" : "Завершить"}</span>
            </button>
          </div>
        {pauseLimitReached && !state.isPaused ? (<div className="mx-3 mt-2 rounded-xl border border-[#ff4444]/40 bg-[#ff4444]/10 px-3 py-2 text-xs text-[#ffd7d7]">Достигнут лимит пауз. Новая пауза недоступна: это нарушение безопасности проведения симуляции.</div>) : null}
        </header>

        {/* ─── Mobile tab switcher ─── */}
        <div className="flex md:hidden items-center gap-1 px-2 py-1.5 overflow-x-auto border-b border-[#2a3a4e]/40 bg-[#141c2b]/60 backdrop-blur-sm flex-shrink-0">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = mobileTab === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setMobileTab(tab.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex-1 justify-center min-w-0 ${
                  isActive
                    ? "bg-[#FF6B00]/15 border border-[#FF6B00]/40 text-[#FF6B00]"
                    : "border border-[#2a3a4e]/50 text-[#6a7088] hover:text-[#8890a8] hover:border-[#3a4a5e]"
                }`}
              >
                <Icon className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* MAIN LAYOUT: Mobile 1-col, Tablet 2-col, Desktop 3-col */}
        <div className="flex-1 min-h-0 overflow-hidden p-3 md:p-4 xl:p-5">
          <div className="grid h-full min-h-0 grid-cols-1 gap-3 md:gap-4 xl:gap-5 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(640px,1fr)_300px] 2xl:grid-cols-[260px_minmax(780px,1fr)_340px]">
            {/* ─── Left: Store Map ─── */}
            <div
              className={`min-h-0 min-w-0 overflow-hidden rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-3 md:p-4 backdrop-blur-sm ${
                mobileTab !== 'map' ? 'hidden md:block' : ''
              }`}
            >
              <StoreMap />
            </div>

            {/* ─── Center: Signal Feed + Response ─── */}
            <div
              className={`min-h-0 min-w-0 overflow-y-auto pr-0.5 md:pr-1 ${
                mobileTab !== 'signals' ? 'hidden md:block' : ''
              }`}
            >
              <div className="flex min-h-full flex-col gap-3 md:gap-4 xl:gap-5">
                <div className="min-h-[58vh] rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-3 md:p-4 backdrop-blur-sm">
                  <SignalFeed />
                </div>
                <div className="min-h-[34vh] rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-3 md:p-4 backdrop-blur-sm">
                  <ResponseBar />
                </div>
              </div>
            </div>

            {/* ─── Right: Metrics + Active Timers ─── */}
            <div
              className={`min-h-0 min-w-0 flex flex-col gap-3 overflow-y-auto pr-1 md:gap-4 xl:gap-5 custom-scroll ${
                mobileTab !== 'metrics' ? 'hidden md:block' : ''
              }`}
            >
              <div className="rounded-2xl border border-[#2a3a4e] bg-[#1e2a3acc] p-3 backdrop-blur-sm md:p-4">
                <MetricsPanel />
              </div>
              <div className="min-h-0 flex-1">
                <ActiveTimersPanel />
              </div>
            </div>
          </div>
        </div>

        {/* Completion overlay */}
        {state.isCompleted && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-[#1a1a2e]/90 backdrop-blur-sm">
            <div className="text-center">
              <div className="text-3xl mb-3">✅</div>
              <h2 className="text-xl font-bold text-white mb-2">Симуляция завершена</h2>
              <p className="text-sm text-[#8890a8]">Переход к результатам...</p>
            </div>
          </div>
        )}

        {isReadOnly && !state.isRunning && !state.isCompleted && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0d1117]/70 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-[#2a3a4e] bg-[#141c2b]/95 p-6 text-center shadow-2xl">
              <PauseCircle className="mx-auto mb-3 h-10 w-10 text-[#4a9eff]" />
              <h2 className="mb-2 text-xl font-bold text-white">Режим наблюдения оценщика</h2>
              <p className="text-sm text-[#8890a8]">
                {waitingForStudent
                  ? "Передайте студенту код подключения. После входа и старта симуляции здесь автоматически появятся его действия."
                  : "Студент уже подключён. После старта симуляции здесь автоматически появятся его действия и ответы."}
              </p>
              {liveSessionConfig && (
                <div className="mt-5 rounded-2xl border border-[#315070] bg-[#101826] p-4">
                  <div className="text-[11px] uppercase tracking-[0.22em] text-[#8ec5ff]">Код подключения</div>
                  <div className="mt-2 font-mono text-3xl font-bold tracking-[0.45em] text-white">
                    {liveSessionConfig.accessCode}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3 text-left">
                    <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/60 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Студент</div>
                      <div className={`mt-1 text-sm font-semibold ${livePresence.studentConnected ? "text-[#8ef0d9]" : "text-[#c9d2e6]"}`}>
                        {livePresence.studentConnected ? "Подключён" : "Ожидаем вход"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/60 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Сессия</div>
                      <div className="mt-1 text-sm font-semibold text-[#c9d2e6]">
                        {liveStatus === "completed" ? "Завершена" : liveStatus === "running" ? "Идёт" : "Готова к старту"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {mode === "student" && !state.isRunning && !state.isCompleted && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0d1117]/72 backdrop-blur-sm">
            <div className="w-full max-w-lg rounded-2xl border border-[#2a3a4e] bg-[#141c2b]/95 p-6 text-center shadow-2xl">
              <PauseCircle className="mx-auto mb-3 h-10 w-10 text-[#00d4aa]" />
              <h2 className="mb-2 text-xl font-bold text-white">Подключение к live-сессии</h2>
              <p className="text-sm text-[#8890a8]">
                {waitingForAssessorSetup
                  ? "Передайте код сессии оценщику. После выбора настроек симуляция стартует автоматически."
                  : liveSocketConnected
                  ? "Связь с сервером установлена. Загружаем сценарий от оценщика."
                  : hasFallbackLiveSync
                    ? "WebSocket сейчас недоступен, но резервная синхронизация уже работает."
                    : "Ожидаем подключение к серверу и подтверждение запуска от оценщика."}
              </p>
              {liveSessionConfig && (
                <div className="mt-5 rounded-2xl border border-[#2a3a4e] bg-[#101826] p-4 text-left">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.16em] text-[#6f7990]">
                    <span>Код сессии</span>
                    <span className={liveSyncIndicator?.helperClass}>
                      {liveSyncIndicator?.helper}
                    </span>
                  </div>
                  <div className="mt-2 font-mono text-2xl font-bold tracking-[0.35em] text-white">
                    {liveSessionConfig.accessCode}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-3">
                    <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/60 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Оценщик</div>
                      <div className={`mt-1 text-sm font-semibold ${livePresence.assessorConnected ? "text-[#8ef0d9]" : "text-[#c9d2e6]"}`}>
                        {livePresence.assessorConnected ? "На связи" : "Не в сети"}
                      </div>
                    </div>
                    <div className="rounded-xl border border-[#2a3a4e] bg-[#141c2b]/60 p-3">
                      <div className="text-[10px] uppercase tracking-[0.16em] text-[#6f7990]">Сессия</div>
                      <div className="mt-1 text-sm font-semibold text-[#c9d2e6]">
                        {waitingForAssessorSetup ? "Ждёт настройки" : liveStatus === "completed" ? "Завершена" : liveStatus === "running" ? "Идёт" : "Готовится"}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {isReadOnly && state.isRunning && (
          <div className="pointer-events-none absolute right-4 top-16 z-20 rounded-full border border-[#4a9eff]/35 bg-[#4a9eff]/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">
            Режим наблюдения
          </div>
        )}

        {mode === "student" && liveSessionConfig && !state.isCompleted && (
          <div className="pointer-events-none absolute left-4 top-16 z-20 rounded-full border border-[#2a3a4e] bg-[#141c2b]/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#aab7d0]">
            Код сессии: {liveSessionConfig.accessCode}
          </div>
        )}

        {state.isPaused && !state.isCompleted && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-[#0d1117]/70 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-2xl border border-[#2a3a4e] bg-[#141c2b]/95 p-6 text-center shadow-2xl">
              <PauseCircle className="mx-auto mb-3 h-10 w-10 text-[#00d4aa]" />
              <h2 className="mb-2 text-xl font-bold text-white">Симуляция на паузе</h2>
              <p className="mb-4 text-sm text-[#8890a8]">
                В отчёте сохранится время постановки на паузу и её длительность.
              </p>
              <div className="mb-4 rounded-xl border border-[#2a3a4e] bg-[#1e2a3a]/70 p-3 text-left">
                <div className="flex items-center justify-between text-xs text-[#8890a8]">
                  <span>Точка паузы</span>
                  <span className="font-mono text-white">{state.simDateTime}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[#8890a8]">
                  <span>Общее количество пауз</span>
                  <span className="font-mono text-white">{state.pauses.length}/{maxPauseCount}</span>
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-[#8890a8]">
                  <span>Общее время пауз</span>
                  <span className="font-mono text-white">{Math.floor(totalPauseSeconds / 60)} мин {totalPauseSeconds % 60} сек / 30 мин</span>
                </div>
              </div>
              <button
                onClick={() => dispatch({ type: "TOGGLE_PAUSE" })}
                className="inline-flex items-center gap-2 rounded-lg bg-[#00d4aa] px-4 py-2 text-sm font-semibold text-[#0d1117] transition-all hover:bg-[#00c39c]"
                disabled={isReadOnly}
              >
                <PlayCircle className="h-4 w-4" />
                {isReadOnly ? "Ожидание студента" : "Продолжить симуляцию"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
