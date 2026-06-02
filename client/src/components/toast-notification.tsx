import { useSimulation } from "../context/SimulationContext";
import { EMAIL_CASES } from "@/data/email-cases";
import { MESSENGER_CASES } from "@/data/messenger-cases";
import { getDefaultChannelSound, playAudioImmediate, stopCurrentAudio } from "@/data/audio-map";
import { X } from "lucide-react";

export default function ToastNotifications() {
  const { state, dispatch } = useSimulation();

  const visibleToasts = state.toasts.filter(t => !t.dismissed).slice(-3);

  const handleOpenToast = (toast: (typeof visibleToasts)[number]) => {
    stopCurrentAudio();
    dispatch({ type: "DISMISS_TOAST", payload: toast.id });
    let openedAudioStarted = false;

    const playOpenedAudio = (src: string | null | undefined, volume: number) => {
      if (!state.enabledChannels.audio || !src) {
        return;
      }
      openedAudioStarted = Boolean(playAudioImmediate(src, volume)) || openedAudioStarted;
    };

    switch (toast.sourceType) {
      case "email":
        playOpenedAudio(EMAIL_CASES.find((item) => item.id === toast.signalId)?.audioUrl, 0.95);
        if (!openedAudioStarted) {
          playOpenedAudio(getDefaultChannelSound("email"), 0.75);
        }
        dispatch({ type: "OPEN_EMAIL", payload: toast.signalId });
        return;
      case "messenger":
        playOpenedAudio(MESSENGER_CASES.find((item) => item.id === toast.signalId)?.audioUrl, 0.95);
        if (!openedAudioStarted) {
          playOpenedAudio(getDefaultChannelSound("messenger"), 0.85);
        }
        dispatch({ type: "OPEN_MESSENGER", payload: toast.signalId });
        return;
      case "video":
        playOpenedAudio(getDefaultChannelSound("video"), 0.95);
        dispatch({ type: "OPEN_VIDEO", payload: toast.signalId });
        return;
      default:
        playOpenedAudio(state.activeSignals.find((item) => item.id === toast.signalId)?.audioUrl, 1);
        if (!openedAudioStarted) {
          playOpenedAudio(getDefaultChannelSound("call"), 0.9);
        }
        dispatch({ type: "SELECT_SIGNAL", payload: toast.signalId });
    }
  };

  const getPrimaryLabel = (toast: (typeof visibleToasts)[number]) => {
    switch (toast.sourceType) {
      case "email":
        return "Открыть письмо";
      case "messenger":
        return "Открыть сообщение";
      case "video":
        return "Открыть видео";
      default:
        return toast.type === "call" ? "Ответить на звонок" : "Открыть сигнал";
    }
  };

  if (visibleToasts.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 w-80">
      {visibleToasts.map(toast => (
        <div
          key={toast.id}
          className="toast-enter rounded-lg border border-[#FF6B00]/40 bg-[#1e2a3af0] backdrop-blur-md p-3 shadow-xl"
          data-testid={`toast-${toast.id}`}
        >
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-white">{toast.title}</div>
              <div className="text-xs text-[#8890a8] mt-0.5">{toast.source}</div>
            </div>
            <button
              onClick={() => dispatch({ type: "DISMISS_TOAST", payload: toast.id })}
              className="text-[#555570] hover:text-white transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 mt-2">
            <button
              onClick={() => handleOpenToast(toast)}
              className="flex-1 px-3 py-1.5 rounded bg-[#FF6B00] text-white text-xs font-medium hover:bg-[#e06000] transition-colors"
              data-testid={`toast-respond-${toast.id}`}
            >
              {getPrimaryLabel(toast)}
            </button>
            <button
              onClick={() => {
                if (toast.sourceType !== "main_case") {
                  dispatch({ type: "DISMISS_TOAST", payload: toast.id });
                  return;
                }
                dispatch({ type: "SNOOZE_SIGNAL", payload: toast.signalId });
              }}
              className="px-3 py-1.5 rounded border border-[#2a3a4e] text-[#8890a8] text-xs hover:border-[#3a4a5e] hover:text-white transition-colors"
            >
              {toast.sourceType === "main_case" ? "Отложить" : "Скрыть"}
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
