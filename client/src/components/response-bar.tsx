import { useSimulation } from "../context/SimulationContext";
import { stopCurrentAudio } from "../data/audio-map";
import { summarizeOptionText } from "@/lib/choice-text";
import { EMAIL_CASES } from "../data/email-cases";
import { CHATS, MESSENGER_CASES } from "../data/messenger-cases";
import { VIDEO_CASES } from "../data/video-cases";
import DeadlineChip from "./deadline-chip";

export function OptionCard({
  option,
  idx,
  onClick,
  className = "",
  fitToContent = false,
}: {
  option: any;
  idx: number;
  onClick: () => void;
  className?: string;
  fitToContent?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full flex-col rounded-xl border border-border bg-card p-4 text-left shadow-sm transition-all hover:border-[#FF6B00]/45 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00]/55 focus-visible:ring-offset-0 active:scale-[0.99] cursor-pointer ${className}`}
      data-testid={`option-${idx}`}
      title={option.text}
    >
      <div className="flex items-start gap-3.5">
        <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-border bg-background text-[11px] font-bold text-muted-foreground flex-shrink-0">
          {idx + 1}
        </span>
        <p
          className="text-sm leading-6 text-foreground whitespace-pre-wrap break-words"
        >
          {fitToContent ? option.text : summarizeOptionText(option.text)}
        </p>
      </div>
    </button>
  );
}

function EmptyPanel() {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-border bg-[linear-gradient(180deg,rgba(20,28,43,0.74),rgba(11,18,29,0.9))] p-6 text-center">
      <div>
        <div className="text-[12px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Панель действий</div>
        <p className="mt-2 text-sm text-foreground">
          Откройте звонок, письмо, сообщение или начните просмотр видеозвонка
        </p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          После открытия кейса управленческие действия появятся здесь.
        </p>
      </div>
    </div>
  );
}

function ResolvedPanel({ title }: { title: string }) {
  return (
    <div className="flex h-full items-center justify-center rounded-2xl border border-[#00d4aa]/20 bg-[#00d4aa]/5 p-6 text-center">
      <div>
        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#7ef0da]">Панель действий</div>
        <p className="mt-2 text-sm font-semibold text-[#00d4aa]">{title}</p>
        <p className="mt-1 text-[12px] text-muted-foreground">
          Ответ уже зафиксирован. Откройте следующий кейс, чтобы продолжить работу.
        </p>
      </div>
    </div>
  );
}

function PanelHeader({
  accentClass,
  title,
  subtitle,
  helper,
  deadline,
  elapsedSeconds,
}: {
  accentClass: string;
  title: string;
  subtitle: string;
  helper: string;
  deadline: any;
  elapsedSeconds: number;
}) {
  return (
    <div className="mb-2 flex-shrink-0">
      <div className={`text-[12px] font-semibold uppercase tracking-wider ${accentClass}`}>Панель действий</div>
      <div className="mt-1 text-sm font-semibold text-foreground">{title}</div>
      <div className="mt-1 text-[13px] text-foreground">{subtitle}</div>
      <div className="mt-1 text-[12px] text-muted-foreground">{helper}</div>
      {deadline && (
        <div className="mt-2">
          <DeadlineChip deadline={deadline} elapsedSeconds={elapsedSeconds} />
        </div>
      )}
    </div>
  );
}

export default function ResponseBar() {
  const { state, dispatch } = useSimulation();
  const { activeSignals } = state;

  const currentSignal =
    state.actionPanelSource === "main_case"
      ? activeSignals.find((signal) => signal.id === state.actionPanelContentId && !signal.isExpired) || null
      : null;
  const currentEmail =
    state.actionPanelSource === "email"
      ? EMAIL_CASES.find((email) => email.id === state.actionPanelContentId) || null
      : null;
  const currentMessenger =
    state.actionPanelSource === "messenger"
      ? MESSENGER_CASES.find((message) => message.id === state.actionPanelContentId) || null
      : null;
  const currentVideo =
    state.actionPanelSource === "video"
      ? VIDEO_CASES.find((video) => video.id === state.actionPanelContentId) || null
      : null;

  const handleSignalOption = (option: any) => {
    if (!currentSignal) {
      return;
    }
    stopCurrentAudio();
    dispatch({ type: "SELECT_OPTION", payload: { option, signal: currentSignal } });
  };

  const handleEmailOption = (option: any) => {
    if (!currentEmail) {
      return;
    }
    stopCurrentAudio();
    dispatch({ type: "ANSWER_EMAIL", payload: { emailId: currentEmail.id, option } });
  };

  const handleMessengerOption = (option: any) => {
    if (!currentMessenger) {
      return;
    }
    stopCurrentAudio();
    dispatch({ type: "ANSWER_MESSENGER", payload: { msgId: currentMessenger.id, option } });
  };

  const handleVideoOption = (option: any) => {
    if (!currentVideo) {
      return;
    }
    stopCurrentAudio();
    dispatch({ type: "ANSWER_VIDEO", payload: { videoId: currentVideo.id, option } });
  };

  if (!state.actionPanelSource || !state.actionPanelContentId) {
    return <EmptyPanel />;
  }

  if (currentSignal) {
    return (
      <div className="flex flex-col h-full min-h-0">
        <PanelHeader
          accentClass="text-[#FF6B00]"
          title="Варианты ответа на звонок"
          subtitle={currentSignal.title}
          helper="Выберите управленческое действие по текущему звонку."
          deadline={currentSignal.deadline}
          elapsedSeconds={state.elapsedSeconds}
        />
        <div className="custom-scroll flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-2">
            {currentSignal.options.map((option, idx) => (
              <OptionCard
                key={idx}
                option={option}
                idx={idx}
                fitToContent
                onClick={() => handleSignalOption(option)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentEmail) {
    if (state.answeredEmailIds.includes(currentEmail.id)) {
      return <ResolvedPanel title="Ответ на письмо уже отправлен" />;
    }

    return (
      <div className="flex flex-col h-full min-h-0">
        <PanelHeader
          accentClass="text-[#4a9eff]"
          title="Ответ на письмо"
          subtitle={`${currentEmail.from} · ${currentEmail.subject}`}
          helper="Письмо открыто. Выберите следующее управленческое действие."
          deadline={state.emailSignalMeta[currentEmail.id]?.deadline}
          elapsedSeconds={state.elapsedSeconds}
        />
        <div className="custom-scroll flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-2">
            {currentEmail.options.map((option, idx) => (
              <OptionCard
                key={idx}
                option={option}
                idx={idx}
                fitToContent
                onClick={() => handleEmailOption(option)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentMessenger) {
    if (state.answeredMessengerIds.includes(currentMessenger.id)) {
      return <ResolvedPanel title="Сообщение уже обработано" />;
    }

    const chatName = CHATS.find((chat) => chat.id === currentMessenger.chatId)?.name || "Чат";

    return (
      <div className="flex flex-col h-full min-h-0">
        <PanelHeader
          accentClass="text-[#00d4aa]"
          title="Реакция на сообщение"
          subtitle={`${currentMessenger.senderName} · ${chatName}`}
          helper="Сообщение открыто в ТёрКограмме. Выберите ответ здесь, без дублирования переписки."
          deadline={state.messengerSignalMeta[currentMessenger.id]?.deadline}
          elapsedSeconds={state.elapsedSeconds}
        />
        <div className="custom-scroll flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-2">
            {currentMessenger.options.map((option, idx) => (
              <OptionCard
                key={idx}
                option={option}
                idx={idx}
                fitToContent
                onClick={() => handleMessengerOption(option)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (currentVideo) {
    if (state.answeredVideoIds.includes(currentVideo.id)) {
      return <ResolvedPanel title="Решение по видеозвонку уже зафиксировано" />;
    }

    return (
      <div className="flex flex-col h-full min-h-0">
        <PanelHeader
          accentClass="text-[#a78bfa]"
          title="Решение по видеозвонку"
          subtitle={`${currentVideo.sender} · ${currentVideo.role}`}
          helper="Просмотр начат. Выберите управленческую реакцию в этом блоке."
          deadline={state.videoSignalMeta[currentVideo.id]?.deadline}
          elapsedSeconds={state.elapsedSeconds}
        />
        <div className="custom-scroll flex-1 min-h-0 overflow-y-auto pr-1">
          <div className="grid grid-cols-1 gap-2">
            {currentVideo.options.map((option, idx) => (
              <OptionCard
                key={idx}
                option={option}
                idx={idx}
                fitToContent
                onClick={() => handleVideoOption(option)}
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return <EmptyPanel />;
}
