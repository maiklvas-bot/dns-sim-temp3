import { useState } from "react";
import { MESSENGER_CASES, CHATS } from "../data/messenger-cases";
import { playAudioImmediate } from "../data/audio-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, MessageSquare, Volume2 } from "lucide-react";
import { useSimulation } from "../context/SimulationContext";
import DeadlineChip from "./deadline-chip";

function Avatar({ letter, size = "sm" }: { letter: string; size?: "sm" | "md" }) {
  const s = size === "sm" ? "w-8 h-8 text-sm" : "w-10 h-10 text-base";
  return (
    <div className={`${s} rounded-full bg-muted flex items-center justify-center font-bold text-foreground flex-shrink-0`}>
      {letter}
    </div>
  );
}

export default function TerKogram({
  arrivedMessages,
  answeredMessageIds,
}: {
  arrivedMessages: string[];
  answeredMessageIds: string[];
  onAnswer: (msgId: string, option: any) => void;
}) {
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [focusedMessageId, setFocusedMessageId] = useState<string | null>(null);
  const { state, dispatch } = useSimulation();

  const arrivedCases = MESSENGER_CASES
    .filter((message) => arrivedMessages.includes(message.id))
    .sort((left, right) => {
      const leftArrivedAt = state.messengerSignalMeta[left.id]?.arrivedAt ?? left.arrivalMinute * 60;
      const rightArrivedAt = state.messengerSignalMeta[right.id]?.arrivedAt ?? right.arrivalMinute * 60;
      return leftArrivedAt - rightArrivedAt || left.sortOrder - right.sortOrder;
    });
  const chatUnreadCounts: Record<string, number> = {};
  const chatLastMessages: Record<string, typeof arrivedCases[number]> = {};
  const actionPanelMessageId =
    state.actionPanelSource === "messenger" && state.actionPanelContentId
      ? state.actionPanelContentId
      : null;
  const actionPanelMessage = actionPanelMessageId
    ? arrivedCases.find((message) => message.id === actionPanelMessageId) || null
    : null;

  arrivedCases.forEach((message) => {
    const previous = chatLastMessages[message.chatId];
    const messageArrivedAt = state.messengerSignalMeta[message.id]?.arrivedAt ?? message.arrivalMinute * 60;
    const previousArrivedAt = previous
      ? state.messengerSignalMeta[previous.id]?.arrivedAt ?? previous.arrivalMinute * 60
      : -1;

    if (!previous || messageArrivedAt >= previousArrivedAt) {
      chatLastMessages[message.chatId] = message;
    }

    if (!answeredMessageIds.includes(message.id)) {
      chatUnreadCounts[message.chatId] = (chatUnreadCounts[message.chatId] || 0) + 1;
    }
  });

  const activeChats = CHATS
    .filter((chat) => chatLastMessages[chat.id])
    .sort((left, right) => {
      const leftMessage = chatLastMessages[left.id];
      const rightMessage = chatLastMessages[right.id];
      const leftArrivedAt = leftMessage ? state.messengerSignalMeta[leftMessage.id]?.arrivedAt ?? leftMessage.arrivalMinute * 60 : 0;
      const rightArrivedAt = rightMessage ? state.messengerSignalMeta[rightMessage.id]?.arrivedAt ?? rightMessage.arrivalMinute * 60 : 0;
      return leftArrivedAt - rightArrivedAt;
    });
  const effectiveSelectedChatId = actionPanelMessage?.chatId || selectedChatId;
  const selectedChat = CHATS.find((chat) => chat.id === effectiveSelectedChatId) || activeChats[0] || null;
  const chatMessages = arrivedCases.filter((message) => message.chatId === selectedChat?.id);
  const focusedMessage =
    chatMessages.find((message) => message.id === actionPanelMessageId) ||
    chatMessages.find((message) => message.id === focusedMessageId) ||
    chatMessages.find((message) => !answeredMessageIds.includes(message.id)) ||
    chatMessages[chatMessages.length - 1] ||
    null;
  const participantDisplayName = state.participantName?.trim() || "Космонавт";

  if (activeChats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <MessageSquare className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">ТёрКограмм</p>
        <p className="text-xs text-muted-foreground mt-1">Сообщения появятся автоматически</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0">
      <div className="w-[38%] flex-shrink-0 border-r border-border flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-border bg-card/60 flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-[#00d4aa] font-semibold">
            ТёрКограмм
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="divide-y divide-border/40">
            {activeChats.map((chat) => {
              const lastMsg = chatLastMessages[chat.id];
              const unread = chatUnreadCounts[chat.id] || 0;
              const isSelected = selectedChat?.id === chat.id;

              return (
                <button
                  key={chat.id}
                  onClick={() => {
                    setSelectedChatId(chat.id);
                    const nextFocusedMessage =
                      arrivedCases.find((message) => message.chatId === chat.id && !answeredMessageIds.includes(message.id)) ||
                      arrivedCases.filter((message) => message.chatId === chat.id).at(-1) ||
                      null;
                    setFocusedMessageId(nextFocusedMessage?.id || null);
                    dispatch({ type: "CLEAR_ACTION_PANEL" });
                  }}
                  className={`w-full text-left p-3 transition-all flex items-start gap-2 ${
                    isSelected ? "bg-[#00d4aa]/8 border-l-2 border-l-[#00d4aa]" : "hover:bg-accent/60 border-l-2 border-l-transparent"
                  }`}
                >
                  <Avatar letter={chat.avatar} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={`text-xs truncate ${unread > 0 ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                        {chat.name}
                      </span>
                      {unread > 0 && (
                        <span className="ml-auto flex-shrink-0 w-4 h-4 rounded-full bg-[#00d4aa] text-[9px] font-bold text-black flex items-center justify-center">
                          {unread}
                        </span>
                      )}
                    </div>
                    {!chat.isGroup && chat.role && (
                      <div className="text-[10px] text-muted-foreground truncate">{chat.role}</div>
                    )}
                    {lastMsg && (
                      <div className="text-[10px] text-muted-foreground truncate mt-0.5">{lastMsg.message.slice(0, 45)}...</div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {!selectedChat ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Выберите чат
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-card/60 flex-shrink-0">
              <Avatar letter={selectedChat.avatar} size="sm" />
              <div>
                <div className="text-xs text-foreground font-medium">{selectedChat.name}</div>
                {!selectedChat.isGroup && selectedChat.role && (
                  <div className="text-[10px] text-muted-foreground">{selectedChat.role}</div>
                )}
                {selectedChat.isGroup && selectedChat.members && (
                  <div className="text-[10px] text-muted-foreground">{selectedChat.members.join(", ")}</div>
                )}
              </div>
            </div>

            <div className="custom-scroll flex-1 min-h-0 overflow-y-auto p-3 space-y-4 pr-2">
              {chatMessages.map((message) => {
                const isAnswered = answeredMessageIds.includes(message.id);
                const isOpened = state.openedMessengerIds.includes(message.id);
                const isFocused = focusedMessage?.id === message.id;
                const studentDecision = state.decisions.find(
                  (decision) => decision.sourceType === "messenger" && decision.caseId === message.id
                );
                const participantAvatar = participantDisplayName.slice(0, 1).toUpperCase();

                return (
                  <div key={message.id} className="space-y-3">
                    <button
                      onClick={() => {
                        setFocusedMessageId(message.id);
                        dispatch({ type: "OPEN_MESSENGER", payload: message.id });
                      }}
                      className={`w-full rounded-xl border p-3 text-left transition-all ${
                        isFocused
                          ? "border-[#00d4aa]/60 bg-[#00d4aa]/8 shadow-[0_0_0_1px_rgba(0,212,170,0.15)]"
                          : "border-border bg-card/35 hover:border-border hover:bg-accent/70"
                      }`}
                    >
                      <div className="flex items-start gap-2">
                        <Avatar letter={message.senderAvatar} size="sm" />
                        <div className="min-w-0 flex-1">
                          <div className="mb-1 flex items-center gap-2">
                            <span className="text-[11px] font-medium text-foreground">{message.senderName}</span>
                            {!isAnswered && !isOpened && (
                              <span className="rounded-full bg-[#00d4aa]/16 px-2 py-0.5 text-[9px] font-semibold text-[#00d4aa]">
                                Требует открытия
                              </span>
                            )}
                            {!isAnswered && isOpened && (
                              <span className="rounded-full bg-[#4a9eff]/16 px-2 py-0.5 text-[9px] font-semibold text-[#8ec5ff]">
                                Панель действий активна
                              </span>
                            )}
                            {isAnswered && (
                              <span className="rounded-full bg-[#00d4aa]/12 px-2 py-0.5 text-[9px] font-semibold text-[#7ef0da]">
                                Отработано
                              </span>
                            )}
                          </div>

                          <div className="rounded-xl border border-[#8fb5e8]/45 bg-[#e8f1ff] p-3 shadow-[0_10px_26px_rgba(0,0,0,0.16)]">
                            <p className="text-[13px] font-medium leading-6 text-[#132033]">{message.message}</p>
                            {message.imageUrl && (
                              <img
                                src={message.imageUrl}
                                alt={message.senderName}
                                className="mt-3 max-h-48 w-full rounded-lg border border-[#31455f] object-cover"
                              />
                            )}
                            {message.audioUrl && (
                              <div className="mt-3 flex items-center justify-between rounded-xl border border-[#00a887]/35 bg-[#dffaf5] px-3 py-2">
                                <div className="text-[11px] font-semibold text-[#075a4d]">К сообщению прикреплено аудио</div>
                                <button
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    playAudioImmediate(message.audioUrl!, 0.95);
                                  }}
                                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#00d4aa]/30 bg-[#101a29] px-2.5 py-1.5 text-[11px] font-semibold text-[#7ef0da] transition-all hover:border-[#00d4aa] hover:text-white"
                                >
                                  <Volume2 className="h-3.5 w-3.5" />
                                  Слушать
                                </button>
                              </div>
                            )}
                          </div>

                          <div className="mt-2 flex items-center justify-between gap-2">
                            {state.messengerSignalMeta[message.id]?.deadline ? (
                              <DeadlineChip
                                deadline={state.messengerSignalMeta[message.id]?.deadline}
                                elapsedSeconds={state.elapsedSeconds}
                                referenceElapsedSeconds={studentDecision?.timer?.resolvedAtElapsed ?? null}
                                compact
                              />
                            ) : (
                              <span className="text-[10px] text-muted-foreground">Без таймера</span>
                            )}
                            <span className="text-[10px] text-muted-foreground">
                              {isAnswered
                                ? "Ответ выбран"
                                : isOpened
                                  ? "Варианты доступны в панели действий"
                                  : "Откройте сообщение, чтобы появились действия"}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>

                    {studentDecision && (
                      <div className="flex justify-end">
                        <div className="flex max-w-[84%] items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="mb-1 flex items-center justify-end gap-2">
                              <span className="rounded-full bg-[#4a9eff]/16 px-2 py-0.5 text-[9px] font-semibold text-[#8ec5ff]">
                                Ответ студента
                              </span>
                              <span className="text-[11px] font-medium text-foreground">{participantDisplayName}</span>
                            </div>
                            <div className="rounded-xl border border-[#4a9eff]/35 bg-[#dbeeff] p-3">
                              <p className="text-[13px] font-medium leading-6 text-[#102033]">{studentDecision.optionText}</p>
                            </div>
                          </div>
                          <Avatar letter={participantAvatar} size="sm" />
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
