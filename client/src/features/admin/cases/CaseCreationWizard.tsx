import { useEffect, useId, useMemo, useState } from "react";
import type { ChatInfo, CompetencyDefinition, EmailCase, MessengerCase, SimCase, VideoCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Pause, Play, Trash2 } from "lucide-react";
import { useDnsTheme } from "@/components/theme-toggle";
import { CompetencyRoleSelector, Field, FieldArea, MultiSelectField, SelectField, SuggestField } from "../components/AdminFields";
import { CompetencyHorizontalImpactChart } from "../components/CompetencyHorizontalImpactChart";
import type { AdminChannelTab as ChannelTab } from "../admin-types";
import {
  buildCompetencyAliasMap,
  buildCompetencyNameMap,
  buildOptionCompetencyProfile,
  CASE_SIGNAL_TYPE_OPTIONS,
  createEmptyCase,
  STORE_EFFECT_FIELDS,
  STORE_ZONE_OPTIONS,
} from "./case-editor-support";
import { createEmptyStructuredOption } from "./case-editor-support";
import { StructuredOptionsEditor } from "./StructuredOptionsEditor";

export function CaseCreationWizard({
  open,
  step,
  draft,
  competencies,
  caseSourceOptions,
  onOpenChange,
  onStepChange,
  onDraftChange,
  onConfirm,
}: {
  open: boolean;
  step: number;
  draft: SimCase;
  competencies: CompetencyDefinition[];
  caseSourceOptions: string[];
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: number) => void;
  onDraftChange: (draft: SimCase) => void;
  onConfirm: () => void | Promise<void>;
}) {
  const { themeClass } = useDnsTheme();
  const wizardSteps = [
    {
      title: "Контекст кейса",
      description: "Сначала задайте базовый смысл кейса: что произошло, для кого он предназначен и какую управленческую тему проверяет.",
    },
    {
      title: "Сигнал и зона",
      description: "Здесь задаётся, откуда студент получает сигнал, через какой тип коммуникации и какая зона магазина первой попадает под давление.",
    },
    {
      title: "Первый цикл события",
      description: "Опишите стартовую ситуацию и текст сигнала, который увидит студент в симуляции. Это точка входа в кейс.",
    },
    {
      title: "Параметры времени",
      description: "Настройте интервалы и напоминания. Эти поля управляют темпом появления и повторного срабатывания кейса.",
    },
  ] as const;

  const currentCycle = draft.cycles?.[0] || createEmptyCase(1).cycles[0];

  const setDraft = (patch: Partial<SimCase>) => onDraftChange({ ...draft, ...patch });
  const setCycle = (patch: Record<string, any>) => {
    const nextCycles = [...(draft.cycles || [])];
    nextCycles[0] = { ...currentCycle, ...patch };
    onDraftChange({ ...draft, cycles: nextCycles });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={`dns-product-shell dns-admin-shell ${themeClass} flex max-h-[90vh] max-w-4xl flex-col gap-0 overflow-hidden p-0`}>
        <DialogHeader className="space-y-1.5 px-6 pt-6 pb-3 text-left">
          <DialogTitle>Мастер создания нового кейса</DialogTitle>
          <DialogDescription className="text-muted-foreground">
            Служебные поля вроде `ID` и внутренних кодов будут сгенерированы автоматически. После завершения мастер откроет кейс в полном редакторе для детальной настройки.
          </DialogDescription>
        </DialogHeader>

        <div className="grid flex-1 gap-4 overflow-y-auto px-6 py-4 lg:grid-cols-[240px,1fr]">
          <div className="space-y-2 rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
            {wizardSteps.map((wizardStep, index) => (
              <button
                key={wizardStep.title}
                type="button"
                onClick={() => onStepChange(index)}
                className={`w-full rounded-xl border px-3 py-3 text-left transition ${
                  step === index
                    ? "border-[#4a9eff] bg-[#4a9eff]/10"
                    : "border-[#243244] bg-[#101826]/70"
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#8ec5ff]">Шаг {index + 1}</div>
                <div className="mt-1 text-sm font-semibold text-white">{wizardStep.title}</div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
            <div className="mb-4 rounded-xl border border-[#29425f] bg-[#122031] p-4">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8ec5ff]">{wizardSteps[step].title}</div>
              <div className="mt-2 text-sm leading-relaxed text-[#d6e3f7]">{wizardSteps[step].description}</div>
            </div>

            {step === 0 && (
              <div className="space-y-4">
                <FieldArea
                  label="Название кейса"
                  value={draft.title}
                  onChange={(value) => setDraft({ title: value })}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  Это название будет видеть администратор, оценщик и участник в журнале решений. Лучше использовать понятную формулировку управленческой проблемы: например, `Провал утренней расстановки персонала`.
                </div>
                <FieldArea
                  label="Описание кейса"
                  value={draft.description}
                  onChange={(value) => setDraft({ description: value })}
                />
                <CompetencyRoleSelector
                  primaryValues={draft.primaryCompetencies || []}
                  secondaryValues={draft.secondaryCompetencies || []}
                  onChange={(next) => setDraft(next)}
                  competencies={competencies}
                />
              </div>
            )}

            {step === 1 && (
              <div className="space-y-4">
                <SuggestField
                  label="Источник сигнала"
                  value={draft.trigger.source}
                  onChange={(value) => setDraft({ trigger: { ...draft.trigger, source: value } })}
                  options={caseSourceOptions}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  Источник помогает студенту понять, от кого пришёл запрос: сотрудник, склад, директор, клиент, мониторинг очереди и так далее.
                </div>
                <SelectField
                  label="Тип сигнала"
                  value={draft.trigger.type}
                  onChange={(value) => setDraft({ trigger: { ...draft.trigger, type: value as any } })}
                  options={[...CASE_SIGNAL_TYPE_OPTIONS]}
                />
                <MultiSelectField
                  label="Зоны магазина"
                  values={draft.zones_affected || []}
                  onChange={(values) => setDraft({ zones_affected: values as any })}
                  options={[...STORE_ZONE_OPTIONS]}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  Зоны определяют, где кейс отзовётся сильнее всего: `торговый_зал`, `склад`, `выдача`, `начальство`. Можно перечислить несколько через запятую.
                </div>
              </div>
            )}

            {step === 2 && (
              <div className="space-y-4">
                <FieldArea
                  label="Стартовая ситуация"
                  value={currentCycle.situation}
                  onChange={(value) => setCycle({ situation: value })}
                />
                <FieldArea
                  label="Текст сигнала для студента"
                  value={draft.trigger.text}
                  onChange={(value) => setDraft({ trigger: { ...draft.trigger, text: value } })}
                />
                <FieldArea
                  label="Текст сигнала внутри цикла"
                  value={currentCycle.signal?.content || ""}
                  onChange={(value) => setCycle({ signal: { ...(currentCycle.signal || {}), content: value } })}
                />
                <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
                  В этом шаге достаточно описать первую ситуацию и первый сигнал. Варианты ответа, последствия и дополнительные циклы вы сможете спокойно добавить уже в полном редакторе.
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <Field
                    label="Мин. интервал, сек"
                    value={draft.timing?.minIntervalSeconds ?? ""}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, minIntervalSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Нижняя граница ожидания следующего появления кейса.</div>
                </div>
                <div>
                  <Field
                    label="Макс. интервал, сек"
                    value={draft.timing?.maxIntervalSeconds ?? ""}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, maxIntervalSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Верхняя граница интервала между срабатываниями.</div>
                </div>
                <div>
                  <Field
                    label="Срок решения, сек"
                    value={draft.timing?.decisionDeadlineSeconds ?? ""}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, decisionDeadlineSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Сколько секунд даётся участнику после появления события.</div>
                </div>
                <div>
                  <Field
                    label="Повтор напоминания, сек"
                    value={draft.timing?.reminderIntervalSeconds ?? 180}
                    onChange={(value) => setDraft({ timing: { ...draft.timing, reminderIntervalSeconds: value ? Number(value) : null } })}
                  />
                  <div className="mt-1 text-[11px] text-[#8aa2c4]">Через сколько секунд система повторно напомнит о неотработанном кейсе.</div>
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="border-t border-border bg-muted/30 px-6 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => onStepChange(Math.max(step - 1, 0))}
              disabled={step === 0}
            >
              Назад
            </Button>
            <div className="text-xs text-muted-foreground">Шаг {step + 1} из {wizardSteps.length}</div>
            {step < wizardSteps.length - 1 ? (
              <Button type="button" className="bg-[#FF6B00] text-white hover:bg-[#FF6B00]/90" onClick={() => onStepChange(step + 1)}>
                Далее
              </Button>
            ) : (
              <Button type="button" className="bg-[#FF6B00] text-white hover:bg-[#e06000]" onClick={onConfirm}>
                Создать и сохранить
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
