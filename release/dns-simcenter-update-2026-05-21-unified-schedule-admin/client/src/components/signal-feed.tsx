import { useEffect, useState } from "react";
import {
  getChannelNotificationCounts,
  getSignalTypeEmoji,
  getSignalTypeLabel,
  useSimulation,
} from "../context/SimulationContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Clock, AlertTriangle, Phone, Mail, MessageSquare, Video, Volume2, RotateCcw } from "lucide-react";
import EmailInbox from "./email-inbox";
import TerKogram from "./ter-kogram";
import VideoMessages from "./video-player";
import { getSignalImage, getWaitingSignalImage } from "../data/signal-images";
import { playAudioImmediate, stopCurrentAudio } from "../data/audio-map";
import { CASES_DATA } from "../data/cases";
import DeadlineChip from "./deadline-chip";

type Tab = "signals" | "email" | "messenger" | "video";

export default function SignalFeed() {
  const { state, dispatch } = useSimulation();
  const { activeSignals, currentSignalId } = state;
  const [activeTab, setActiveTab] = useState<Tab>("signals");

  const pendingSignals = [...activeSignals.filter((signal) => !signal.isExpired)].sort((left, right) => left.arrivedAt - right.arrivedAt);
  const currentSignal = activeSignals.find(s => s.id === currentSignalId && !s.isExpired);
  const channelCounts = getChannelNotificationCounts(state);

  useEffect(() => {
    if (state.actionPanelSource === "main_case") {
      setActiveTab("signals");
      return;
    }

    if (state.actionPanelSource === "email") {
      setActiveTab("email");
      return;
    }

    if (state.actionPanelSource === "messenger") {
      setActiveTab("messenger");
      return;
    }

    if (state.actionPanelSource === "video") {
      setActiveTab("video");
    }
  }, [state.actionPanelSource]);

  const tabs = [
    { key: "signals" as Tab, label: "Звонки", icon: Phone, count: channelCounts.calls, color: "#FF6B00", enabled: true },
    { key: "email" as Tab, label: "Почта", icon: Mail, count: channelCounts.email, color: "#4a9eff", enabled: state.enabledChannels.email },
    { key: "messenger" as Tab, label: "ТёркоГрамм", icon: MessageSquare, count: channelCounts.messenger, color: "#00d4aa", enabled: state.enabledChannels.messenger },
    { key: "video" as Tab, label: "Видео", icon: Video, count: channelCounts.video, color: "#a78bfa", enabled: state.enabledChannels.video },
  ].filter(t => t.enabled);

  // Get case zones for image selection
  const getCaseZones = (caseId: string) => {
    const caseData = CASES_DATA.find(c => c.id === caseId);
    return caseData?.zones_affected || [];
  };

  const getCaseImage = (caseId: string) => {
    const caseData = CASES_DATA.find(c => c.id === caseId);
    return caseData?.imageUrl || null;
  };

  const getCaseDescription = (caseId: string) => {
    const caseData = CASES_DATA.find(c => c.id === caseId);
    return caseData?.description || "";
  };

  // Replay audio for current signal
  const handleReplayAudio = () => {
    if (currentSignal?.audioUrl) {
      playAudioImmediate(currentSignal.audioUrl, 0.9);
    }
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab bar */}
      <div className="mb-2 flex flex-shrink-0 items-center gap-1 border-b border-[#2a3a4e]/50 pb-2">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => {
                setActiveTab(tab.key);
                dispatch({ type: "CLEAR_ACTION_PANEL" });
              }}
              className={`flex items-center gap-1 rounded-lg px-2 py-1 text-[9px] font-medium transition-all ${
                isActive ? "text-white" : "text-[#555570] hover:text-[#8890a8]"
              }`}
              style={isActive ? { background: tab.color + "22", color: tab.color } : {}}
              data-testid={`tab-${tab.key}`}
            >
              <Icon className="w-3 h-3" />
              <span>{tab.label}</span>
              {tab.count > 0 && (
                <span className="flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white" style={{ background: tab.color }}>
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">

        {/* SIGNALS TAB */}
        {activeTab === "signals" && (
          <div className="flex flex-col h-full min-h-0">

            {/* Signal list — compact cards at top */}
            {pendingSignals.length > 0 && (
              <div className="mb-2 flex-shrink-0 space-y-1">
                {pendingSignals.map(signal => {
                  const isSelected = signal.id === currentSignalId;
                  const img = getSignalImage(signal.type, getCaseZones(signal.caseId), signal.title, undefined, getCaseImage(signal.caseId));
                  return (
                    <button
                      key={signal.id}
                      onClick={() => {
                        stopCurrentAudio();
                        if (state.enabledChannels.audio && signal.audioUrl) {
                          playAudioImmediate(signal.audioUrl, 0.9);
                        }
                        dispatch({ type: "SELECT_SIGNAL", payload: signal.id });
                      }}
                      className={`w-full text-left rounded-lg border transition-all cursor-pointer overflow-hidden flex items-stretch ${
                        isSelected ? "border-[#FF6B00] bg-[#FF6B00]/8" : "border-[#2a3a4e] bg-[#141c2b]/60 hover:border-[#3a4a5e]"
                      }`}
                      data-testid={`signal-${signal.id}`}
                    >
                      <div className="w-12 flex-shrink-0"><img src={img} alt="" loading="eager" decoding="async" className="h-full w-full object-cover" style={{ minHeight: 46 }} /></div>
                      <div className="flex-1 p-2 min-w-0">
                        <div className="flex items-center justify-between gap-1">
                          <span className="text-[10px] font-medium text-[#b8c8de]">{getSignalTypeEmoji(signal.type)} {getSignalTypeLabel(signal.type)}</span>
                          {signal.deadline ? (
                            <DeadlineChip deadline={signal.deadline} elapsedSeconds={state.elapsedSeconds} compact />
                          ) : !signal.isAcknowledged ? (
                            <span className="flex items-center gap-0.5 text-[10px] font-medium text-[#ff8080]"><AlertTriangle className="w-3 h-3" />новый</span>
                          ) : null}
                        </div>
                        <div className="truncate text-[12px] font-semibold text-white">{signal.title}</div>
                        <div className="truncate text-[10px] text-[#97a8c2]">
                          {signal.source}
                          {signal.isAcknowledged && <span className="ml-1 text-[#00d4aa]">• в работе</span>}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex-1 min-h-0">
            {/* HERO ZONE — fills all remaining space */}
            <div className="h-full min-h-0 rounded-xl overflow-hidden relative">
              {currentSignal ? (
                <div className="grid h-full min-h-0 md:grid-cols-[168px_minmax(0,1fr)]">
                  <div className="relative min-h-[150px] border-r border-[#233347] bg-[#101826]">
                    <img
                      src={getSignalImage(currentSignal.type, getCaseZones(currentSignal.caseId), currentSignal.title, undefined, getCaseImage(currentSignal.caseId))}
                      alt={currentSignal.title}
                      loading="eager"
                      decoding="async"
                      className="absolute inset-0 w-full h-full object-cover opacity-75"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117b8] to-[#0d111748]" />
                    <div className="absolute inset-x-0 bottom-0 p-2">
                      <div className="rounded-xl border border-white/10 bg-[#0d1117]/72 p-2.5 backdrop-blur-sm">
                        <div className="text-[11px] uppercase tracking-[0.16em] text-[#FFB36B]">Линия связи</div>
                        <div className="mt-1 text-[13px] font-semibold text-white">{getSignalTypeLabel(currentSignal.type)}</div>
                        <div className="mt-1 text-[12px] leading-5 text-[#e0ebfa]">{currentSignal.source}</div>
                      </div>
                    </div>
                  </div>
                  <div className="flex min-h-0 flex-col bg-[linear-gradient(180deg,rgba(14,20,31,0.96),rgba(11,17,27,0.98))] p-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-base">{getSignalTypeEmoji(currentSignal.type)}</span>
                          <span className="text-[12px] font-medium text-[#ced8ea]">{getSignalTypeLabel(currentSignal.type)}</span>
                        </div>
                        <div className="mt-1.5 text-[15px] font-bold leading-6 text-white">
                          {currentSignal.title} <span className="text-[13px] text-[#FF9B53]">— Этап {currentSignal.cycle}</span>
                        </div>
                      </div>
                      {currentSignal.audioUrl && (
                        <button
                          onClick={handleReplayAudio}
                          className="inline-flex items-center gap-1 rounded-full border border-[#FF6B00]/35 bg-[#1a2435] px-2.5 py-1 text-[11px] font-semibold text-[#FFD19B] transition-all hover:border-[#FF6B00] hover:text-white"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <Volume2 className="w-3 h-3" />
                          Повтор аудио
                        </button>
                      )}
                    </div>
                    {currentSignal.deadline && (
                      <div className="mt-3">
                        <DeadlineChip deadline={currentSignal.deadline} elapsedSeconds={state.elapsedSeconds} />
                      </div>
                    )}
                    <ScrollArea className="mt-3 flex-1 min-h-0 pr-2">
                      <div className="space-y-2.5">
                        <div className="rounded-xl border border-[#2a3a4e] bg-[#121c2b] p-2.5">
                          <div className="text-[11px] uppercase tracking-[0.16em] text-[#aac0dd]">Ситуация</div>
                          <p className="mt-1.5 text-[13px] leading-6 text-[#f2f6ff]">{currentSignal.fullSituation}</p>
                        </div>
                        {getCaseDescription(currentSignal.caseId) && (
                          <div className="rounded-xl border border-[#243448] bg-[#0f1724] p-2.5">
                            <div className="text-[11px] uppercase tracking-[0.16em] text-[#aac0dd]">Контекст</div>
                            <p className="mt-1.5 text-[12px] leading-6 text-[#d3deee]">{getCaseDescription(currentSignal.caseId)}</p>
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                </div>
              ) : pendingSignals.length === 0 ? (
                /* Waiting state: dimmed store floor */
                <>
                  <img src={getWaitingSignalImage()} alt="" loading="eager" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <Clock className="w-10 h-10 text-[#8ea4c2] mx-auto mb-3" />
                      <p className="text-sm text-[#dce7f7]">Ожидание сигналов...</p>
                      <p className="text-xs text-[#9fb4cf] mt-1">Сигналы поступят автоматически</p>
                    </div>
                  </div>
                </>
              ) : (
                /* Signals exist but none selected */
                <>
                  <img src={getWaitingSignalImage()} alt="" loading="eager" decoding="async" className="absolute inset-0 w-full h-full object-cover opacity-40" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <p className="text-sm text-[#dce7f7]">Выберите сигнал выше</p>
                    </div>
                  </div>
                </>
              )}
            </div>
            </div>
          </div>
        )}

        {/* EMAIL TAB */}
        {activeTab === "email" && (
          <EmailInbox
            arrivedEmails={state.arrivedEmailIds}
            answeredEmailIds={state.answeredEmailIds}
            onAnswer={(emailId, option) => dispatch({ type: "ANSWER_EMAIL", payload: { emailId, option } })}
          />
        )}

        {/* MESSENGER TAB */}
        {activeTab === "messenger" && (
          <TerKogram
            arrivedMessages={state.arrivedMessengerIds}
            answeredMessageIds={state.answeredMessengerIds}
            onAnswer={(msgId, option) => dispatch({ type: "ANSWER_MESSENGER", payload: { msgId, option } })}
          />
        )}

        {/* VIDEO TAB */}
        {activeTab === "video" && (
          <VideoMessages
            arrivedVideos={state.arrivedVideoIds}
            answeredVideoIds={state.answeredVideoIds}
            onAnswer={(videoId, option) => dispatch({ type: "ANSWER_VIDEO", payload: { videoId, option } })}
          />
        )}
      </div>
    </div>
  );
}
