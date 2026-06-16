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
import { createEmptyStructuredOption, formatCompetencyScores, parseCompetencyScores } from "./case-editor-support";

export function StructuredOptionsEditor({
  title,
  options,
  onChange,
  competencies,
  cycleOptions = [],
  currentCycleId,
}: {
  title: string;
  options: any[];
  onChange: (options: any[]) => void;
  competencies: CompetencyDefinition[];
  cycleOptions?: Array<{ value: string; label: string }>;
  currentCycleId?: string;
}) {
  const previewData = useMemo(() => {
    const profile = buildOptionCompetencyProfile(options);
    return competencies
      .map((competency) => ({
        name: competency.name,
        shortName: competency.name.length > 18 ? `${competency.name.slice(0, 18)}…` : competency.name,
        value: Number(profile[competency.id] || 0),
      }))
      .filter((item) => item.value > 0);
  }, [competencies, options]);

  const updateOption = (index: number, patch: Record<string, any>) => {
    onChange(options.map((option, optionIndex) => optionIndex === index ? { ...option, ...patch } : option));
  };

  const updateEffects = (index: number, effectKey: string, value: number) => {
    updateOption(index, {
      effects: {
        ...(options[index]?.effects || {}),
        [effectKey]: Number.isFinite(value) ? value : 0,
      },
    });
  };

  const updateCompetencyScore = (index: number, competencyId: string, value: number) => {
    const currentScores = { ...(options[index]?.competency_scores || {}) };
    if (value <= 0) {
      delete currentScores[competencyId];
    } else {
      currentScores[competencyId] = value;
    }

    updateOption(index, { competency_scores: currentScores });
  };

  const addOption = () => {
    onChange([...(options || []), createEmptyStructuredOption((options?.length || 0) + 1)]);
  };

  const removeOption = (index: number) => {
    onChange(options.filter((_, optionIndex) => optionIndex !== index).map((option, optionIndex) => ({ ...option, level: optionIndex + 1 })));
  };

  return (
    <div className="dns-admin-options-card rounded-xl border border-[#2a3a4e] bg-[#141c2b]/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-semibold text-white">{title}</div>
          <div className="mt-1 text-[11px] text-[#8890a8]">Каждый вариант ответа заполняется отдельными полями без JSON.</div>
        </div>
        <Button type="button" size="sm" className="shrink-0 whitespace-nowrap" onClick={addOption}>Добавить вариант</Button>
      </div>
      <div className="space-y-3">
        {(options || []).map((option, index) => (
          <div key={`${option.id || "option"}-${index}`} className="dns-admin-option-card rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div className="text-sm font-semibold text-white">Вариант {index + 1}</div>
              <Button type="button" size="sm" variant="outline" className="border-[#ff4444]/30 bg-transparent text-[#ff9999]" onClick={() => removeOption(index)}>
                Удалить
              </Button>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2">
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#70829d]">Позиция варианта</div>
                <div className="mt-1 text-sm font-semibold text-white">{index + 1}</div>
              </div>
              <Field label="Оценка" value={option.score} onChange={(value) => updateOption(index, { score: Number(value) })} />
            </div>
            <FieldArea label="Текст ответа" value={option.text} onChange={(value) => updateOption(index, { text: value })} />
            <div className="dns-admin-option-routing-grid">
              <SelectField
                label="Статус ответа"
                value={option.status || "active"}
                onChange={(value) => updateOption(index, { status: value || "active" })}
                options={[
                  { value: "active", label: "Активен" },
                  { value: "hidden", label: "Скрыт" },
                  { value: "draft", label: "Черновик" },
                ]}
              />
              {cycleOptions.length > 0 && (
                <SelectField
                  label="После ответа запустить"
                  value={option.nextCycleId || ""}
                  onChange={(value) => updateOption(index, { nextCycleId: value || "" })}
                  emptyLabel="Следующий цикл по порядку"
                  options={[
                    ...cycleOptions.filter((cycle) => cycle.value !== currentCycleId),
                    { value: "__complete", label: "Завершить кейс" },
                  ]}
                />
              )}
              <Field
                label="Задержка, сек"
                value={option.nextDelaySeconds ?? ""}
                onChange={(value) => updateOption(index, { nextDelaySeconds: value ? Number(value) : null })}
              />
              <SelectField
                label="Канал следующего события"
                value={option.nextChannel || "main_case"}
                onChange={(value) => updateOption(index, { nextChannel: value || "main_case" })}
                options={[
                  { value: "main_case", label: "Основной кейс" },
                  { value: "email", label: "Почта" },
                  { value: "messenger", label: "Мессенджер" },
                  { value: "video", label: "Видео" },
                ]}
              />
            </div>
            <FieldArea
              label="Комментарий / пояснение для администратора"
              value={option.comment || ""}
              onChange={(value) => updateOption(index, { comment: value })}
            />
            <div className="dns-admin-store-effects-grid">
              {STORE_EFFECT_FIELDS.map((field) => (
                <div key={field.key}>
                  <Field
                    label={field.label}
                    value={option.effects?.[field.key] ?? 0}
                    onChange={(value) => updateEffects(index, field.key, Number(value))}
                  />
                  <div className="mt-1 text-[10px] leading-relaxed text-[#71839d]">{field.metric}</div>
                </div>
              ))}
            </div>
            <div className="rounded-xl border border-[#243244] bg-[#0d1522]/80 p-3">
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#6fa0ff]">Влияние на компетенции</div>
                  <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
                    Настройте силу влияния ответа на каждую компетенцию. `0` означает, что этот вариант не влияет на выбранную компетенцию.
                  </div>
                </div>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {competencies.map((competency) => {
                  const scoreValue = Number(option.competency_scores?.[competency.id] || 0);

                  return (
                    <div key={competency.id} className="rounded-lg border border-[#223245] bg-[#101826]/80 px-3 py-2">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-xs font-medium text-white">{competency.name}</div>
                          <div className="text-[10px] uppercase tracking-[0.16em] text-[#70829d]">{competency.category}</div>
                        </div>
                        <div className="rounded-full border border-[#2a3a4e] bg-[#141c2b]/70 px-2 py-1 text-xs font-semibold text-white">
                          {scoreValue}
                        </div>
                      </div>
                      <Slider
                        value={[scoreValue]}
                        onValueChange={([value]) => updateCompetencyScore(index, competency.id, value)}
                        min={0}
                        max={5}
                        step={1}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Живой preview влияния кейса</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Ниже видно, как текущий набор вариантов ответа формирует ожидаемый профиль компетенций у этого кейса.
        </div>
        {previewData.length > 0 ? (
          <div className="mt-4">
            <CompetencyHorizontalImpactChart
              data={previewData}
              series={[{ key: "value", label: "Влияние", color: "#4a9eff" }]}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-6 text-center text-sm text-[#8aa2c4]">
            Пока ни одна компетенция не настроена. Добавьте влияние через ползунки выше, и график появится автоматически.
          </div>
        )}
      </div>
    </div>
  );
}
