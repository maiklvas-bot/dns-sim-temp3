import { useState } from "react";
import { MessageSquarePlus, Send, Lock, CheckCircle2 } from "lucide-react";
import { useDnsTheme } from "@/components/theme-toggle";
import { apiRequest } from "@/lib/queryClient";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Скрытые адреса получателя обратной связи.
 * В интерфейсе НЕ отображаются — пользователь видит только «Разработчик».
 * Механизм реальной отправки (SMTP) будет подключён позже; пока форма не отправляет.
 */
const FEEDBACK_RECIPIENTS = ["vasilcov.m@dns-shop.ru", "Lyubimov.AI@dns-shop.ru"] as const;
void FEEDBACK_RECIPIENTS; // зарезервировано для будущей привязки отправки

const CATEGORIES = ["Идея / предложение", "Ошибка / баг", "Вопрос", "Другое"] as const;

export function FeedbackButton({ className, size = "default" }: { className?: string; size?: "default" | "sm" | "lg" | "icon" }) {
  const { themeClass } = useDnsTheme();
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState<string>(CATEGORIES[0]);
  const [message, setMessage] = useState("");
  const [contact, setContact] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error" | "notConfigured">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const resetState = () => {
    setStatus("idle");
    setErrorMsg("");
  };

  const handleSubmit = async () => {
    if (status === "sending" || status === "sent") {
      return;
    }
    if (message.trim().length < 5) {
      setStatus("error");
      setErrorMsg("Опишите сообщение подробнее (минимум 5 символов).");
      return;
    }
    setStatus("sending");
    setErrorMsg("");
    try {
      await apiRequest("POST", "/api/feedback", {
        category,
        message: message.trim(),
        contact: contact.trim() || undefined,
        url: typeof window !== "undefined" ? (window.location.hash || window.location.pathname).slice(0, 300) : undefined,
      });
      setStatus("sent");
      setMessage("");
      setContact("");
      window.setTimeout(() => {
        setOpen(false);
        resetState();
      }, 1500);
    } catch (error: any) {
      const text = String(error?.message || "");
      if (/не настроена|MAIL_NOT_CONFIGURED/i.test(text)) {
        setStatus("notConfigured");
      } else {
        setStatus("error");
        setErrorMsg(text || "Не удалось отправить сообщение. Попробуйте позже.");
      }
    }
  };

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) {
      resetState();
    }
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size={size}
        onClick={() => setOpen(true)}
        title="Обратная связь разработчику"
        className={className}
      >
        <MessageSquarePlus className="mr-1.5 h-4 w-4" />
        Обратная связь
      </Button>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        {/* Анатомия по Gravity UI Dialog: header (title + description) → тело → разделённый футер с правым выравниванием */}
        <DialogContent className={`dns-product-shell ${themeClass} max-w-[440px] gap-0 p-0 overflow-hidden`}>
          <DialogHeader className="space-y-1.5 px-6 pt-6 pb-2 text-left">
            <DialogTitle className="text-[17px] font-bold">Обратная связь</DialogTitle>
            <DialogDescription className="text-[13px] leading-relaxed text-muted-foreground">
              Сообщите об ошибке, идее или вопросе. Получатель — <span className="font-semibold text-foreground">Разработчик</span>.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4 px-6 py-4">
            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium text-muted-foreground">Тема</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium text-muted-foreground">Сообщение</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Опишите, что произошло или что хотелось бы улучшить…"
                className="min-h-[120px] resize-y"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label className="text-[13px] font-medium text-muted-foreground">Контакт для ответа (необязательно)</Label>
              <Input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                placeholder="Эл. почта или имя в мессенджере"
              />
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border bg-muted/30 px-6 py-4">
            <div className="min-w-0 flex-1 text-[11px] leading-snug">
              {status === "sent" ? (
                <span className="flex items-center gap-1.5 font-medium text-emerald-500">
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
                  Отправлено. Спасибо!
                </span>
              ) : status === "notConfigured" ? (
                <span className="flex items-center gap-1.5 text-amber-500">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  Отправка пока не настроена — сообщите администратору.
                </span>
              ) : status === "error" ? (
                <span className="text-red-400">{errorMsg}</span>
              ) : (
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5 shrink-0" />
                  Письмо уйдёт разработчику. Контакт не обязателен.
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => handleOpenChange(false)} disabled={status === "sending"}>
                Отмена
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={status === "sending" || status === "sent" || message.trim().length < 5}
                className="bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90"
              >
                <Send className="mr-2 h-4 w-4" />
                {status === "sending" ? "Отправка…" : status === "sent" ? "Отправлено" : "Отправить"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
