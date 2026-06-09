import { useEffect, useId, useMemo, useState } from "react";
import type { ChatInfo, CompetencyDefinition, EmailCase, MessengerCase, SimCase, VideoCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { Pause, Play, Trash2 } from "lucide-react";
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
import { StructuredOptionsEditor } from "./StructuredOptionsEditor";

export function SignalCreationWizard({
  open,
  mode,
  step,
  draft,
  competencies,
  chats,
  emailSenderOptions,
  emailDepartmentOptions,
  messengerSenderOptions,
  messengerRoleOptions,
  videoSenderOptions,
  videoRoleOptions,
  onOpenChange,
  onStepChange,
  onDraftChange,
  onConfirm,
}: {
  open: boolean;
  mode: ChannelTab;
  step: number;
  draft: EmailCase | MessengerCase | VideoCase;
  competencies: CompetencyDefinition[];
  chats: ChatInfo[];
  emailSenderOptions: string[];
  emailDepartmentOptions: string[];
  messengerSenderOptions: string[];
  messengerRoleOptions: string[];
  videoSenderOptions: string[];
  videoRoleOptions: string[];
  onOpenChange: (open: boolean) => void;
  onStepChange: (step: number) => void;
  onDraftChange: (draft: EmailCase | MessengerCase | VideoCase) => void;
  onConfirm: () => void | Promise<void>;
}) {
  const competencyOptions = competencies.map((competency) => ({
    value: competency.id,
    label: competency.name,
  }));

  const wizardConfig = {
    email: {
      title: "Создание письма",
      description: "Пошагово задайте служебное письмо, которое придёт студенту в корпоративную почту.",
      steps: ["Источник и смысл", "Содержимое письма", "Время и оценка"],
    },
    messenger: {
      title: "Создание сообщения",
      description: "Пошагово задайте сообщение из рабочего чата, которое увидит студент.",
      steps: ["От кого пришло", "Текст сообщения", "Время и оценка"],
    },
    video: {
      title: "Создание видеосигнала",
      description: "Пошагово задайте видеосигнал и базовую управленческую цель этого события.",
      steps: ["Кто обращается", "Ситуация", "Время и оценка"],
    },
  }[mode];

  const update = (patch: Record<string, any>) => onDraftChange({ ...(draft as any), ...patch });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl border-[#2a3a4e] bg-[#1a2435] text-white">
        <DialogHeader>
          <DialogTitle>{wizardConfig.title}</DialogTitle>
          <DialogDescription className="text-[#8aa2c4]">
            {wizardConfig.description}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 lg:grid-cols-[220px,1fr]">
          <div className="space-y-2">
            {wizardConfig.steps.map((stepTitle, index) => (
              <button
                key={stepTitle}
                type="button"
                onClick={() => onStepChange(index)}
                className={`w-full rounded-xl border px-4 py-3 text-left ${
                  step === index ? "border-[#4a9eff] bg-[#4a9eff]/10" : "border-[#2a3a4e] bg-[#101826]/60"
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.18em] text-[#8ec5ff]">Шаг {index + 1}</div>
                <div className="mt-1 text-sm font-semibold text-white">{stepTitle}</div>
              </button>
            ))}
          </div>

          <div className="rounded-xl border border-[#243244] bg-[#141c2b]/45 p-4">
            {mode === "email" && step === 0 && (
              <div className="space-y-4">
                <Field label="Тема письма" value={(draft as EmailCase).subject} onChange={(value) => update({ subject: value })} />
                <SuggestField label="Отправитель" value={(draft as EmailCase).from} onChange={(value) => update({ from: value })} options={emailSenderOptions} />
                <SuggestField label="Подразделение" value={(draft as EmailCase).department} onChange={(value) => update({ department: value })} options={emailDepartmentOptions} />
                <SelectField label="Основная компетенция" value={(draft as EmailCase).primaryCompetency} onChange={(value) => update({ primaryCompetency: value })} options={competencyOptions} />
              </div>
            )}
            {mode === "email" && step === 1 && (
              <div className="space-y-4">
                <FieldArea label="Короткое превью письма" value={(draft as EmailCase).preview} onChange={(value) => update({ preview: value })} />
                <FieldArea label="Тело письма" value={(draft as EmailCase).body} onChange={(value) => update({ body: value })} />
              </div>
            )}
            {mode === "email" && step === 2 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Минута прихода" value={(draft as EmailCase).arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...((draft as EmailCase).timing || {}), arrivalMinute: Number(value) } })} />
                <Field label="Повтор, сек" value={(draft as EmailCase).timing?.reminderIntervalSeconds ?? 180} onChange={(value) => update({ timing: { ...((draft as EmailCase).timing || {}), reminderIntervalSeconds: Number(value) } })} />
                <Field label="Срок решения, сек" value={(draft as EmailCase).timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...((draft as EmailCase).timing || {}), decisionDeadlineSeconds: value ? Number(value) : null } })} />
                <Field label="Порядок показа" value={(draft as EmailCase).sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
              </div>
            )}

            {mode === "messenger" && step === 0 && (
              <div className="space-y-4">
                <SuggestField label="Отправитель" value={(draft as MessengerCase).senderName} onChange={(value) => update({ senderName: value })} options={messengerSenderOptions} />
                <SuggestField label="Роль отправителя" value={(draft as MessengerCase).senderRole} onChange={(value) => update({ senderRole: value })} options={messengerRoleOptions} />
                <SelectField label="Чат" value={(draft as MessengerCase).chatId} onChange={(value) => update({ chatId: value })} options={chats.map((chat) => ({ value: chat.id, label: chat.name }))} />
                <SelectField label="Основная компетенция" value={(draft as MessengerCase).primaryCompetency} onChange={(value) => update({ primaryCompetency: value })} options={competencyOptions} />
              </div>
            )}
            {mode === "messenger" && step === 1 && (
              <div className="space-y-4">
                <FieldArea label="Текст сообщения" value={(draft as MessengerCase).message} onChange={(value) => update({ message: value })} />
                <Field label="Аватар отправителя" value={(draft as MessengerCase).senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
              </div>
            )}
            {mode === "messenger" && step === 2 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Минута прихода" value={(draft as MessengerCase).arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...((draft as MessengerCase).timing || {}), arrivalMinute: Number(value) } })} />
                <Field label="Повтор, сек" value={(draft as MessengerCase).timing?.reminderIntervalSeconds ?? 5} onChange={(value) => update({ timing: { ...((draft as MessengerCase).timing || {}), reminderIntervalSeconds: Number(value) } })} />
                <Field label="Срок решения, сек" value={(draft as MessengerCase).timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...((draft as MessengerCase).timing || {}), decisionDeadlineSeconds: value ? Number(value) : null } })} />
                <Field label="Порядок показа" value={(draft as MessengerCase).sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
              </div>
            )}

            {mode === "video" && step === 0 && (
              <div className="space-y-4">
                <Field label="Заголовок видеосигнала" value={(draft as VideoCase).title} onChange={(value) => update({ title: value })} />
                <SuggestField label="Отправитель" value={(draft as VideoCase).sender} onChange={(value) => update({ sender: value })} options={videoSenderOptions} />
                <SuggestField label="Роль отправителя" value={(draft as VideoCase).role} onChange={(value) => update({ role: value })} options={videoRoleOptions} />
                <SelectField label="Основная компетенция" value={(draft as VideoCase).primaryCompetency} onChange={(value) => update({ primaryCompetency: value })} options={competencyOptions} />
              </div>
            )}
            {mode === "video" && step === 1 && (
              <div className="space-y-4">
                <FieldArea label="Ситуация" value={(draft as VideoCase).situation} onChange={(value) => update({ situation: value })} />
                <Field label="Длительность ролика" value={(draft as VideoCase).duration} onChange={(value) => update({ duration: value })} />
                <Field label="Аватар отправителя" value={(draft as VideoCase).senderAvatar} onChange={(value) => update({ senderAvatar: value })} />
              </div>
            )}
            {mode === "video" && step === 2 && (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <Field label="Минута прихода" value={(draft as VideoCase).arrivalMinute} onChange={(value) => update({ arrivalMinute: Number(value), timing: { ...((draft as VideoCase).timing || {}), arrivalMinute: Number(value) } })} />
                <Field label="Повтор, сек" value={(draft as VideoCase).timing?.reminderIntervalSeconds ?? 180} onChange={(value) => update({ timing: { ...((draft as VideoCase).timing || {}), reminderIntervalSeconds: Number(value) } })} />
                <Field label="Срок решения, сек" value={(draft as VideoCase).timing?.decisionDeadlineSeconds ?? ""} onChange={(value) => update({ timing: { ...((draft as VideoCase).timing || {}), decisionDeadlineSeconds: value ? Number(value) : null } })} />
                <Field label="Порядок показа" value={(draft as VideoCase).sortOrder} onChange={(value) => update({ sortOrder: Number(value) })} />
              </div>
            )}

            <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-3 text-[11px] leading-relaxed text-[#c7d3e7]">
              Это упрощённый мастер. После завершения откроется полный редактор сигнала, где можно спокойно добавить варианты ответа, медиа и точные последствия.
            </div>
          </div>
        </div>

        <DialogFooter>
          <div className="flex w-full items-center justify-between gap-3">
            <Button type="button" variant="outline" className="border-[#2a3a4e] bg-transparent text-[#8890a8]" onClick={() => onStepChange(Math.max(0, step - 1))} disabled={step === 0}>
              Назад
            </Button>
            <div className="text-xs text-[#8890a8]">Шаг {step + 1} из {wizardConfig.steps.length}</div>
            {step < wizardConfig.steps.length - 1 ? (
              <Button type="button" className="bg-[#4a9eff] text-white hover:bg-[#3d8be0]" onClick={() => onStepChange(step + 1)}>
                Далее
              </Button>
            ) : (
              <Button type="button" className="bg-[#FF6B00] hover:bg-[#e06000]" onClick={onConfirm}>
                Создать и сохранить
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
