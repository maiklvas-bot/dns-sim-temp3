import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { StructuredCyclesEditor } from "../../CaseEditors";

export function StepDecisions({
  entity,
  competencies,
  assets,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex,
  onSelectedCycleIndexChange,
  onChange,
}: {
  entity: SimCase;
  competencies: CompetencyDefinition[];
  assets: any[];
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  selectedCycleIndex?: number;
  onSelectedCycleIndexChange?: (index: number) => void;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Что может сделать участник?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Варианты должны быть похожи по форме: если «правильный» длиннее и звучит грамотнее остальных,
          участник выберет его не думая. Уровень проявления компетенции задаётся отдельно от текста —
          именно он идёт в оценку.
        </div>
      </div>

      <StructuredCyclesEditor
        cycles={entity.cycles || []}
        competencies={competencies}
        assets={assets}
        onUploadAsset={onUploadAsset}
        onTogglePreviewAudio={onTogglePreviewAudio}
        activePreviewKey={activePreviewKey}
        selectedCycleIndex={selectedCycleIndex}
        onSelectedCycleIndexChange={onSelectedCycleIndexChange}
        onChange={(cycles) => onChange({ cycles })}
      />
    </div>
  );
}
