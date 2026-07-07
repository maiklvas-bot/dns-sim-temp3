import { useState } from "react";
import { Mail, FileText, CalendarClock, X, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { buildPdfPayloadFromReport } from "@/lib/report-data";
import { contactParticipantMail, sendResultsMail, scheduleTrainingMail } from "@/lib/staff-mail";

type MailMode = "contact" | "results" | "training";

const MODE_META: Record<MailMode, { icon: typeof Mail; title: string; cta: string }> = {
  contact: { icon: Mail, title: "Связаться с участником", cta: "Отправить письмо" },
  results: { icon: FileText, title: "Отправить обратную связь на почту", cta: "Отправить с PDF" },
  training: { icon: CalendarClock, title: "Назначить обучение", cta: "Назначить и уведомить" },
};

/** Диалог отправки письма участнику (3 сценария) — переиспользует общий SMTP-канал и обязательную подпись на сервере. */
export function ParticipantMailDialog({
  mode,
  participantName,
  defaultEmail,
  report,
  onClose,
}: {
  mode: MailMode;
  participantName: string;
  defaultEmail?: string | null;
  report?: unknown;
  onClose: () => void;
}) {
  const meta = MODE_META[mode];
  const Icon = meta.icon;
  const [to, setTo] = useState(defaultEmail?.trim() || "");
  const [subject, setSubject] = useState(`Сообщение от оценщика — ${participantName}`);
  const [message, setMessage] = useState("");
  const [summary, setSummary] = useState("");
  const [trainingDate, setTrainingDate] = useState("");
  const [note, setNote] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to.trim());
  const canSend = emailValid && !sending && (
    mode === "contact" ? message.trim().length > 0
      : mode === "results" ? summary.trim().length > 0 && Boolean(report)
        : trainingDate.trim().length > 0
  );

  const handleSend = async () => {
    if (!canSend) return;
    setSending(true);
    setError(null);
    try {
      if (mode === "contact") {
        await contactParticipantMail({ to: to.trim(), participantName, subject: subject.trim(), message: message.trim() });
      } else if (mode === "results") {
        await sendResultsMail({ to: to.trim(), participantName, summary: summary.trim(), pdfPayload: buildPdfPayloadFromReport(report as any) });
      } else {
        await scheduleTrainingMail({ to: to.trim(), participantName, trainingDate: trainingDate.trim(), note: note.trim() || undefined });
      }
      setSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не удалось отправить письмо");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: "rgba(8,12,22,0.7)", backdropFilter: "blur(4px)" }} role="dialog" aria-modal="true" aria-label={meta.title}>
      <div className="flex w-full max-w-lg flex-col overflow-hidden rounded-2xl border" style={{ background: "#101725", borderColor: "rgba(255,255,255,0.09)" }}>
        <header className="flex items-center gap-3 border-b px-5 py-4" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg" style={{ background: "rgba(255,107,0,0.14)", color: "#FF6B00" }}>
            <Icon className="h-4 w-4" aria-hidden />
          </span>
          <div className="leading-tight">
            <div className="text-base font-extrabold text-white">{meta.title}</div>
            <div className="text-xs text-white/50">{participantName}</div>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="ml-auto rounded-lg border p-1.5 text-white/60" style={{ borderColor: "rgba(255,255,255,0.12)", cursor: "pointer" }}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </header>

        {sent ? (
          <div className="p-5 text-sm text-white">
            <p style={{ color: "#35d38a" }}>Письмо отправлено на {to}.</p>
            <p className="mt-2 text-white/50">Ящик one-way — участник увидит обязательную подпись с контактами для обратной связи.</p>
            <Button type="button" className="dns-assessor-v2-primary mt-4 w-full" onClick={onClose}>Готово</Button>
          </div>
        ) : (
          <div className="space-y-3 p-5">
            <label className="block">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/45">Почта участника</span>
              <input type="email" value={to} onChange={(e) => setTo(e.target.value)} placeholder="participant@dns-shop.ru"
                className="w-full rounded-lg border px-3 py-2 text-sm text-white" style={{ borderColor: emailValid || !to ? "rgba(255,255,255,0.14)" : "#d98f8f", background: "#131b2b" }} />
              {!defaultEmail && <span className="mt-1 block text-[11px] text-white/40">Участник не указывал почту при входе — введите вручную.</span>}
            </label>

            {mode === "contact" && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/45">Тема</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm text-white" style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b" }} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/45">Сообщение</span>
                  <textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={5} placeholder="Текст письма участнику…"
                    className="w-full rounded-lg border px-3 py-2 text-sm text-white" style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b" }} />
                </label>
              </>
            )}

            {mode === "results" && (
              <label className="block">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/45">Комментарий к результатам</span>
                <textarea value={summary} onChange={(e) => setSummary(e.target.value)} rows={5} placeholder="Краткий вывод по итогам прохождения…"
                  className="w-full rounded-lg border px-3 py-2 text-sm text-white" style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b" }} />
                <span className="mt-1 block text-[11px] text-white/40">PDF-отчёт будет сформирован автоматически и приложен к письму.</span>
              </label>
            )}

            {mode === "training" && (
              <>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/45">Дата обучения</span>
                  <input type="date" value={trainingDate} onChange={(e) => setTrainingDate(e.target.value)} className="w-full rounded-lg border px-3 py-2 text-sm text-white" style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b", colorScheme: "dark" }} />
                </label>
                <label className="block">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-white/45">Комментарий (необязательно)</span>
                  <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} placeholder="Место проведения, формат…"
                    className="w-full rounded-lg border px-3 py-2 text-sm text-white" style={{ borderColor: "rgba(255,255,255,0.14)", background: "#131b2b" }} />
                </label>
              </>
            )}

            {error && <div className="rounded-lg px-3 py-2 text-sm" style={{ background: "rgba(232,90,90,0.14)", color: "#e85a5a" }}>{error}</div>}

            <Button type="button" className="dns-assessor-v2-primary w-full" onClick={handleSend} disabled={!canSend}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden /> : <Icon className="mr-2 h-4 w-4" aria-hidden />}
              {sending ? "Отправляем…" : meta.cta}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
