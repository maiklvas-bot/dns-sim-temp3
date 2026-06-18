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
import { CaseMediaPanel } from "./CaseMediaPanel";
import { StructuredOptionsEditor } from "./StructuredOptionsEditor";
import { createEmptyStructuredOption } from "./case-editor-support";

export function StructuredCyclesEditor({
  cycles,
  onChange,
  competencies,
  assets,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex: controlledSelectedCycleIndex,
  onSelectedCycleIndexChange,
}: {
  cycles: any[];
  onChange: (cycles: any[]) => void;
  competencies: CompetencyDefinition[];
  assets: any[];
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  selectedCycleIndex?: number;
  onSelectedCycleIndexChange?: (index: number) => void;
}) {
  const [internalSelectedCycleIndex, setInternalSelectedCycleIndex] = useState(0);
  const normalizedCycles = cycles || [];
  const selectedCycleIndex = controlledSelectedCycleIndex ?? internalSelectedCycleIndex;
  const setSelectedCycleIndex = (index: number) => {
    setInternalSelectedCycleIndex(index);
    onSelectedCycleIndexChange?.(index);
  };
  const selectedCycle = normalizedCycles[Math.min(selectedCycleIndex, Math.max(0, normalizedCycles.length - 1))] || null;

  useEffect(() => {
    if (selectedCycleIndex > Math.max(0, normalizedCycles.length - 1)) {
      setSelectedCycleIndex(Math.max(0, normalizedCycles.length - 1));
    }
  }, [normalizedCycles.length, selectedCycleIndex]);

  const updateCycle = (index: number, patch: Record<string, any>) => {
    onChange(cycles.map((cycle, cycleIndex) => cycleIndex === index ? { ...cycle, ...patch } : cycle));
  };

  const addCycle = () => {
    onChange([
      ...(cycles || []),
      {
        id: `draft-cycle-${Date.now()}`,
        cycle: (cycles?.length || 0) + 1,
        title: `Цикл ${(cycles?.length || 0) + 1}`,
        description: "",
        source: "",
        situation: "",
        signal: { type: "message", content: "" },
        zonesAffected: [],
        timing: { decisionDeadlineSeconds: 180, reminderIntervalSeconds: 180 },
        status: "draft",
        isFinal: false,
        priority: "normal",
        criticality: "normal",
        options: [createEmptyStructuredOption(1)],
        imageAssetId: null,
        imageUrl: null,
        audioAssetId: null,
        audioUrl: null,
      },
    ]);
    setSelectedCycleIndex(cycles?.length || 0);
  };

  const removeCycle = (index: number) => {
    if ((cycles || []).length <= 1) {
      return;
    }
    onChange(cycles.filter((_, cycleIndex) => cycleIndex !== index).map((cycle, cycleIndex) => ({ ...cycle, cycle: cycleIndex + 1 })));
    setSelectedCycleIndex(Math.max(0, index - 1));
  };

  return (
    <div className="dns-admin-cycles-panel rounded-xl border border-[#2a3a4e] bg-[#141c2b]/35 p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <div className="text-sm font-semibold text-white">Структура кейса</div>
            <span className="rounded-full border border-[#2a3a4e] bg-[#101826] px-2 py-0.5 text-[10px] font-semibold text-[#8aa2c4]">
              {normalizedCycles.length <= 1 ? "Простой · 1 сценарий" : `С циклами · ${normalizedCycles.length}`}
            </span>
          </div>
          <div className="mt-1 text-[11px] text-[#8890a8]">
            {normalizedCycles.length <= 1
              ? "Простой кейс: один сценарий-ответ без ветвления. Кнопка «+ Цикл» превратит его в кейс с циклами."
              : "Кейс с циклами: каждый цикл — отдельное окно. Переключайтесь степпером выше — структура видна целиком."}
          </div>
        </div>
      </div>

      {/* Номера циклов — на левой грани (вертикальный рейл), деталь цикла — справа. */}
      <div className="flex gap-3">
        <div className="dns-admin-cycle-rail flex flex-none flex-col gap-1.5">
          {normalizedCycles.map((cycle, index) => (
            <button
              key={`${cycle.id || "cycle"}-${index}`}
              type="button"
              onClick={() => setSelectedCycleIndex(index)}
              title={`${cycle.title || `Цикл ${index + 1}`} · ${(cycle.options || []).length} отв.`}
              className={`flex h-10 w-10 flex-none items-center justify-center rounded-lg border text-sm font-bold transition ${
                index === selectedCycleIndex
                  ? "border-[#FF6B00] bg-[#FF6B00] text-white shadow-[0_6px_16px_rgba(255,107,0,0.3)]"
                  : "border-[#2a3a4e] bg-[#0d1522]/75 text-[#9aabc6] hover:border-[#3b5878]"
              }`}
            >
              {index + 1}
            </button>
          ))}
          <Button type="button" size="icon" variant="outline" className="h-10 w-10 border-dashed border-[#FF6B00]/45 bg-transparent text-[#ffb27a]" onClick={addCycle} title="Добавить цикл">+</Button>
        </div>

        <div className="min-w-0 flex-1">
        {selectedCycle && (
          <div className="dns-admin-cycle-detail rounded-xl border border-[#243244] bg-[#101826]/60 p-4">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-semibold text-white">{selectedCycle.title || `Цикл ${selectedCycleIndex + 1}`}</div>
                <div className="mt-1 text-[11px] text-[#8890a8]">Ситуация, сигнал, медиа и варианты ответа для текущего цикла.</div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                className="border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                onClick={() => removeCycle(selectedCycleIndex)}
                disabled={normalizedCycles.length <= 1}
              >
                Удалить цикл
              </Button>
            </div>

            <CaseMediaPanel
              title="Медиа выбранного цикла"
              helper="Если здесь выбрать файлы, в симуляции для этого цикла они заменят медиа кейса по умолчанию."
              target={selectedCycle}
              assets={assets}
              onChange={(patch) => updateCycle(selectedCycleIndex, patch)}
              onUploadAsset={onUploadAsset}
              onTogglePreviewAudio={onTogglePreviewAudio}
              activePreviewKey={activePreviewKey}
              previewKey={`case-cycle:${selectedCycle.id || selectedCycleIndex}`}
            />

            <div className="dns-admin-cycle-meta-grid">
              <Field label="Название цикла" value={selectedCycle.title || ""} onChange={(value) => updateCycle(selectedCycleIndex, { title: value })} />
              <SuggestField label="Источник сигнала" value={selectedCycle.source || ""} onChange={(value) => updateCycle(selectedCycleIndex, { source: value })} options={[]} />
              <SelectField
                label="Статус"
                value={selectedCycle.status || "active"}
                onChange={(value) => updateCycle(selectedCycleIndex, { status: value })}
                options={[
                  { value: "active", label: "Активен" },
                  { value: "draft", label: "Черновик" },
                  { value: "hidden", label: "Скрыт" },
                ]}
              />
              <SelectField
                label="Приоритет"
                value={selectedCycle.priority || "normal"}
                onChange={(value) => updateCycle(selectedCycleIndex, { priority: value })}
                options={[
                  { value: "normal", label: "Обычный" },
                  { value: "high", label: "Высокий" },
                  { value: "critical", label: "Критический" },
                ]}
              />
              <SelectField
                label="Критичность"
                value={selectedCycle.criticality || "normal"}
                onChange={(value) => updateCycle(selectedCycleIndex, { criticality: value })}
                options={[
                  { value: "normal", label: "Штатно" },
                  { value: "attention", label: "Внимание" },
                  { value: "risk", label: "Риск" },
                ]}
              />
              <Field label="Срок решения, сек" value={selectedCycle.timing?.decisionDeadlineSeconds || ""} onChange={(value) => updateCycle(selectedCycleIndex, { timing: { ...(selectedCycle.timing || {}), decisionDeadlineSeconds: Number(value) || null } })} />
            </div>
            <FieldArea label="Описание цикла" value={selectedCycle.description || ""} onChange={(value) => updateCycle(selectedCycleIndex, { description: value })} />
            <MultiSelectField label="Зоны магазина" values={selectedCycle.zonesAffected || []} onChange={(values) => updateCycle(selectedCycleIndex, { zonesAffected: values })} options={[...STORE_ZONE_OPTIONS]} />
            <label className="dns-admin-cycle-final-toggle">
              <input type="checkbox" checked={Boolean(selectedCycle.isFinal)} onChange={(event) => updateCycle(selectedCycleIndex, { isFinal: event.target.checked })} />
              <span>
                <strong>Финальный цикл</strong>
                <small>После ответа кейс может завершиться без следующего события.</small>
              </span>
            </label>
            <FieldArea label="Ситуация" value={selectedCycle.situation} onChange={(value) => updateCycle(selectedCycleIndex, { situation: value })} />
            <div className="grid gap-4 md:grid-cols-2">
              <SelectField label="Тип сигнала" value={selectedCycle.signal?.type} onChange={(value) => updateCycle(selectedCycleIndex, { signal: { ...(selectedCycle.signal || {}), type: value } })} options={[...CASE_SIGNAL_TYPE_OPTIONS]} />
              <FieldArea label="Текст сигнала" value={selectedCycle.signal?.content} onChange={(value) => updateCycle(selectedCycleIndex, { signal: { ...(selectedCycle.signal || {}), content: value } })} />
            </div>
            <StructuredOptionsEditor
              title="Варианты ответа для цикла"
              options={selectedCycle.options || []}
              competencies={competencies}
              cycleOptions={normalizedCycles.map((cycle, index) => ({
                value: cycle.id || `cycle-${index + 1}`,
                label: `Цикл ${index + 1}: ${(cycle.situation || cycle.signal?.content || "без описания").slice(0, 48)}`,
              }))}
              currentCycleId={selectedCycle.id || `cycle-${selectedCycleIndex + 1}`}
              onChange={(options) => updateCycle(selectedCycleIndex, { options })}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
