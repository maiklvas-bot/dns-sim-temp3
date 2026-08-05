import { useState } from "react";
import { EMAIL_CASES } from "../data/email-cases";
import { useSimulation } from "../context/SimulationContext";
import { playAudioImmediate } from "../data/audio-map";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Mail, CheckCircle, Volume2 } from "lucide-react";

const DEPT_ICONS: Record<string, string> = {
  "Клиентская служба": "👥",
  "Бухгалтерия": "📊",
  "Администрация": "🏛️",
  "Сервисный центр": "🔧",
  "Логистика": "🚚",
  "Региональный офис": "🏢",
  "HR / Администрация": "👤",
};

export default function EmailInbox({
  arrivedEmails,
  answeredEmailIds,
}: {
  arrivedEmails: string[];
  answeredEmailIds: string[];
  onAnswer: (emailId: string, option: any) => void;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { state, dispatch } = useSimulation();

  const emails = EMAIL_CASES
    .filter((email) => arrivedEmails.includes(email.id))
    .sort((left, right) => {
      const leftArrivedAt = state.emailSignalMeta[left.id]?.arrivedAt ?? left.arrivalMinute * 60;
      const rightArrivedAt = state.emailSignalMeta[right.id]?.arrivedAt ?? right.arrivalMinute * 60;
      return leftArrivedAt - rightArrivedAt || left.sortOrder - right.sortOrder;
    });
  const selectedEmailId =
    state.actionPanelSource === "email" && state.actionPanelContentId
      ? state.actionPanelContentId
      : selectedId;
  const selected = emails.find(e => e.id === selectedEmailId);
  const unansweredCount = emails.filter(e => !answeredEmailIds.includes(e.id)).length;

  if (emails.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full py-12 text-center">
        <Mail className="w-10 h-10 text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">Входящих писем нет</p>
        <p className="text-xs text-muted-foreground mt-1">Новые письма появятся автоматически</p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 gap-0">
      {/* Left: email list */}
      <div className="w-[42%] flex-shrink-0 border-r border-border flex flex-col min-h-0">
        <div className="px-3 py-2 border-b border-border bg-card/60 flex-shrink-0">
          <div className="text-[10px] uppercase tracking-wider text-[#4a9eff] font-semibold">
            Входящие {unansweredCount > 0 && <span className="ml-1 px-1.5 py-0.5 rounded-full bg-[#4a9eff]/20 text-[#4a9eff] text-[9px]">{unansweredCount}</span>}
          </div>
        </div>
        <ScrollArea className="flex-1 min-h-0">
          <div className="divide-y divide-border/40">
            {emails.map(email => {
              const isAnswered = answeredEmailIds.includes(email.id);
              const isSelected = selectedEmailId === email.id;
              return (
                <button
                  key={email.id}
                  onClick={() => {
                    setSelectedId(email.id);
                    dispatch({ type: "OPEN_EMAIL", payload: email.id });
                  }}
                  className={`w-full text-left p-3 transition-all ${
                    isSelected
                      ? "bg-[#4a9eff]/10 border-l-2 border-l-[#4a9eff]"
                      : "hover:bg-accent/60 border-l-2 border-l-transparent"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    {!isAnswered && (
                      <div className="w-1.5 h-1.5 rounded-full bg-[#4a9eff] mt-1.5 flex-shrink-0" />
                    )}
                    {isAnswered && (
                      <CheckCircle className="w-3 h-3 text-[#00d4aa] mt-1 flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className={`text-xs leading-tight truncate ${isAnswered ? "text-muted-foreground" : "text-foreground font-medium"}`}>
                        {email.subject}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                        {DEPT_ICONS[email.department] || "📧"} {email.from}
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-0.5 truncate">{email.preview}</div>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </div>

      {/* Right: email detail */}
      <div className="flex-1 flex flex-col min-h-0 min-w-0">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Выберите письмо
          </div>
        ) : (
          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4">
              {/* Header */}
              <div className="mb-3 pb-3 border-b border-border">
                <h3 className={`text-sm font-semibold mb-2 ${
                  answeredEmailIds.includes(selected.id) ? "text-muted-foreground" : "text-foreground"
                }`}>
                  {selected.subject}
                </h3>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>От: <span className="text-foreground">{selected.from}</span></span>
                  <span className="px-2 py-0.5 rounded-full text-[9px]" style={{ background: selected.departmentColor + "20", color: selected.departmentColor }}>
                    {selected.department}
                  </span>
                  <span className="ml-auto">
                    Получено на {Math.round((state.emailSignalMeta[selected.id]?.arrivedAt ?? selected.arrivalMinute * 60) / 60)} мин
                  </span>
                </div>
              </div>

              {/* Body */}
              <div className="text-xs text-foreground leading-relaxed whitespace-pre-line mb-4">
                {selected.body}
              </div>

              {selected.imageUrl && (
                <div className="mb-4">
                  <img
                    src={selected.imageUrl}
                    alt={selected.subject}
                    className="max-h-64 w-full rounded-xl border border-border object-cover"
                  />
                </div>
              )}

              {selected.audioUrl && (
                <div className="mb-4 flex items-center justify-between rounded-xl border border-[#4a9eff]/25 bg-[#4a9eff]/8 px-3 py-2">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Аудиосообщение</div>
                    <div className="mt-1 text-xs text-foreground">К письму прикреплена запись. Её можно прослушать отдельно от текста письма.</div>
                  </div>
                  <button
                    onClick={() => playAudioImmediate(selected.audioUrl!, 0.95)}
                    className="inline-flex items-center gap-2 rounded-lg border border-[#4a9eff]/35 bg-background px-3 py-2 text-xs font-semibold text-[#8ec5ff] transition-all hover:border-[#4a9eff] hover:text-foreground"
                  >
                    <Volume2 className="h-3.5 w-3.5" />
                    Воспроизвести
                  </button>
                </div>
              )}

              {/* Response options */}
              {answeredEmailIds.includes(selected.id) ? (
                <div className="flex items-center gap-2 py-3 px-4 rounded-lg bg-[#00d4aa]/5 border border-[#00d4aa]/20">
                  <CheckCircle className="w-4 h-4 text-[#00d4aa]" />
                  <span className="text-xs text-[#00d4aa]">Ответ отправлен</span>
                </div>
              ) : (
                <div className="rounded-xl border border-border bg-background/80 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">Панель действий</div>
                  <div className="mt-2 text-xs leading-relaxed text-foreground">
                    Письмо открыто. Варианты управленческого ответа доступны в нижней панели действий.
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        )}
      </div>
    </div>
  );
}
