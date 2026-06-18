import { useState } from "react";
import { MessageSquarePlus, Send, Lock } from "lucide-react";
import { useDnsTheme } from "@/components/theme-toggle";
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

      <Dialog open={open} onOpenChange={setOpen}>
        {/* Анатомия по Gravity UI Dialog: header (title + description) → тело → разделённый футер с правым выравниванием */}
        <DialogContent className={`dns-product-shell ${themeClass} max-w-[440px] gap-0 p-0 overflow-hidden`}>
          <DialogHeader className="space-y-1.5 px-6 pt-6 pb-2 text-left">
            <div className="flex items-center gap-2">
              <DialogTitle className="text-[17px] font-bold">Обратная связь</DialogTitle>
              <span className="rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-amber-500">
                в разработке
              </span>
            </div>
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
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Lock className="h-3.5 w-3.5" />
              Отправка появится позже
            </div>
            <div className="flex items-center gap-2">
              <Button type="button" variant="ghost" className="text-muted-foreground" onClick={() => setOpen(false)}>
                Отмена
              </Button>
              <Button
                type="button"
                disabled
                title="Отправка в разработке"
                className="bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90"
              >
                <Send className="mr-2 h-4 w-4" />
                Отправить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
