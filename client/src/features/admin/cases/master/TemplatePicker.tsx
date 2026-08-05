import { useState } from "react";
import type { SimCase } from "@shared/simulation-content";
import { CASE_TEMPLATES, instantiateTemplate, type CaseTemplate } from "@shared/case-templates";
import { Button } from "@/components/ui/button";

export function TemplatePicker({
  caseId,
  onApply,
}: {
  caseId: string;
  onApply: (next: SimCase) => void;
}) {
  const [open, setOpen] = useState(false);
  const [confirming, setConfirming] = useState<CaseTemplate | null>(null);

  if (!open) {
    return (
      <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="min-w-0">
            <div className="text-sm font-semibold text-white">Начать с готового образца</div>
            <div className="mt-1 text-[11px] text-[#8fa8cf]">
              Пять выверенных кейсов со всей структурой и связями. Тексты потом перепишете под свою ситуацию.
            </div>
          </div>
          <Button type="button" size="sm" className="ml-auto shrink-0" onClick={() => setOpen(true)}>
            Посмотреть образцы
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
      <div className="mb-2 flex items-center justify-between gap-3">
        <div className="text-sm font-semibold text-white">Выберите образец</div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="shrink-0 border-[#2a3a4e] bg-transparent text-[#9aabc6]"
          onClick={() => { setOpen(false); setConfirming(null); }}
        >
          Свернуть
        </Button>
      </div>

      <div className="space-y-2">
        {CASE_TEMPLATES.map((template) => (
          <div key={template.id} className="rounded-lg border border-[#243244] bg-[#0d1522]/70 p-3">
            <div className="text-[13px] font-semibold text-white">{template.title}</div>
            <div className="mt-1 text-[11.5px] text-[#b8c7df]">{template.summary}</div>
            <div className="mt-1 text-[11px] text-[#7d9bc9]">Учит: {template.teaches}</div>

            {confirming?.id === template.id ? (
              <div className="mt-2 rounded-md border border-[#f68b1f]/35 bg-[#f68b1f]/12 p-2">
                <div className="text-[11.5px] leading-relaxed text-[#ffd9bf]">
                  Текущее содержимое кейса будет заменено структурой образца. Это действие нельзя отменить.
                </div>
                <div className="mt-2 flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => {
                      onApply(instantiateTemplate(template, caseId));
                      setConfirming(null);
                      setOpen(false);
                    }}
                  >
                    Заменить и продолжить
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-[#2a3a4e] bg-transparent text-[#9aabc6]"
                    onClick={() => setConfirming(null)}
                  >
                    Отмена
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="mt-2 border-[#2a3a4e] bg-transparent text-[#9aabc6]"
                onClick={() => setConfirming(template)}
              >
                Взять за основу
              </Button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
