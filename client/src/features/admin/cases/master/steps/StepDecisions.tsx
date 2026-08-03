import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { StructuredCyclesEditor } from "../../CaseEditors";
import { MasterHelp } from "../MasterHelp";
import { HELP } from "../master-help-topics";

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
        <div className="dns-master-hint mt-1">
          Варианты должны быть похожи по форме: если «правильный» длиннее и звучит грамотнее остальных,
          участник выберет его не думая. Уровень проявления компетенции задаётся отдельно от текста —
          именно он идёт в оценку.
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <span className="flex items-center gap-1.5 text-[11px] text-[#8aa2c4]">
            <MasterHelp topic={HELP.cycleSituation} /> Ситуация шага
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#8aa2c4]">
            <MasterHelp topic={HELP.optionLevels} /> Уровни компетенций
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#8aa2c4]">
            <MasterHelp topic={HELP.optionTransition} /> Переход после ответа
          </span>
          <span className="flex items-center gap-1.5 text-[11px] text-[#8aa2c4]">
            <MasterHelp topic={HELP.effects} /> Эффекты на метрики
          </span>
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
