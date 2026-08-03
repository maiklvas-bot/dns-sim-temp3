import { useMemo } from "react";
import type { AcceptedIssue, CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { isIssueAccepted, validateCase, type CaseValidationIssue } from "@shared/case-validation";
import { StructuredCyclesEditor } from "../../CaseEditors";
import { issuesForStep } from "../case-master-support";
import { CompetencyLadderHint } from "../CompetencyLadderHint";
import { IssueCard } from "../IssueCard";
import { MasterHelp } from "../MasterHelp";
import { HELP } from "../master-help-topics";

export function StepDecisions({
  entity,
  competencies,
  caseSourceOptions,
  assets,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex,
  onSelectedCycleIndexChange,
  onChange,
  onAcceptIssue,
  onRevokeIssue,
}: {
  entity: SimCase;
  competencies: CompetencyDefinition[];
  caseSourceOptions: string[];
  assets: any[];
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  selectedCycleIndex?: number;
  onSelectedCycleIndexChange?: (index: number) => void;
  onChange: (patch: Partial<SimCase>) => void;
  onAcceptIssue: (entry: AcceptedIssue) => void;
  onRevokeIssue: (issue: CaseValidationIssue) => void;
}) {
  const stepIssues = useMemo(
    () => issuesForStep("decisions", validateCase(entity)),
    [entity],
  );
  const activeIssues = stepIssues.filter((issue) => !isIssueAccepted(issue, entity.acceptedIssues));

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

      {(entity.cycles || []).map((cycle) => (
        <CompetencyLadderHint
          key={`ladder-${cycle.id}`}
          cycle={cycle}
          competencies={competencies}
          issues={stepIssues}
        />
      ))}

      {activeIssues.length > 0 && (
        <div className="space-y-2">
          {activeIssues.map((issue, index) => (
            <IssueCard
              key={`decisions-issue-${index}`}
              issue={issue}
              accepted={entity.acceptedIssues || []}
              onAccept={onAcceptIssue}
              onRevoke={onRevokeIssue}
            />
          ))}
        </div>
      )}

      <StructuredCyclesEditor
        cycles={entity.cycles || []}
        caseSourceOptions={caseSourceOptions}
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
