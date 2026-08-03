import { useState } from "react";
import type { CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { CaseSummaryCard } from "./CaseSummaryCard";
import { CompetencyGuideDialog } from "./CompetencyGuideDialog";
import { MASTER_STEPS, type MasterStepId } from "./case-master-support";
import { StepIntent } from "./steps/StepIntent";
import { StepSituation } from "./steps/StepSituation";
import { StepStructure } from "./steps/StepStructure";
import { StepDecisions } from "./steps/StepDecisions";
import { StepLaunch } from "./steps/StepLaunch";

export type MasterView = { kind: "summary" } | { kind: "step"; stepId: MasterStepId };

export function initialMasterView(isNew: boolean): MasterView {
  return isNew ? { kind: "step", stepId: "intent" } : { kind: "summary" };
}

export function CaseMaster({
  entity,
  competencies,
  assets,
  caseSourceOptions,
  isNew,
  onUploadAsset,
  onTogglePreviewAudio,
  activePreviewKey,
  selectedCycleIndex,
  onSelectedCycleIndexChange,
  onChange,
  view: controlledView,
  onViewChange,
  themeClass,
}: {
  entity: SimCase;
  competencies: CompetencyDefinition[];
  assets: any[];
  caseSourceOptions: string[];
  isNew: boolean;
  onUploadAsset: (file: File) => Promise<string | null>;
  onTogglePreviewAudio: (previewKey: string, url: string | null) => void;
  activePreviewKey: string | null;
  selectedCycleIndex: number;
  onSelectedCycleIndexChange: (index: number) => void;
  onChange: (next: SimCase) => void;
  /** Вид можно вести снаружи — тогда замечания в соседней панели умеют открывать нужный этап. */
  view?: MasterView;
  onViewChange?: (next: MasterView) => void;
  /** Класс темы для вложенных диалогов: они рендерятся вне поддерева админки. */
  themeClass: string;
}) {
  const [ownView, setOwnView] = useState<MasterView>(() => initialMasterView(isNew));
  const view = controlledView ?? ownView;
  const setView = onViewChange ?? setOwnView;

  // Открыли другой кейс в том же окне — мастер должен начаться заново,
  // иначе автор увидит этап от предыдущего кейса.
  const [openedCaseId, setOpenedCaseId] = useState(entity.id);
  if (openedCaseId !== entity.id) {
    setOpenedCaseId(entity.id);
    setView(initialMasterView(isNew));
  }

  const [guideOpen, setGuideOpen] = useState(false);

  const patch = (partial: Partial<SimCase>) => onChange({ ...entity, ...partial });

  const stepIndex = view.kind === "step" ? MASTER_STEPS.findIndex((step) => step.id === view.stepId) : -1;
  const currentStep = stepIndex >= 0 ? MASTER_STEPS[stepIndex] : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-[#243244] bg-[#101826]/60 p-2">
        <button
          type="button"
          onClick={() => setView({ kind: "summary" })}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
            view.kind === "summary"
              ? "border-[#f68b1f] bg-[#f68b1f]/15 text-white"
              : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#9aabc6] hover:border-[#3b5878]"
          }`}
        >
          Карточка кейса
        </button>
        {MASTER_STEPS.map((step, index) => (
          <button
            key={step.id}
            type="button"
            onClick={() => setView({ kind: "step", stepId: step.id })}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
              view.kind === "step" && view.stepId === step.id
                ? "border-[#f68b1f] bg-[#f68b1f]/15 text-white"
                : "border-[#2a3a4e] bg-[#0d1522]/70 text-[#9aabc6] hover:border-[#3b5878]"
            }`}
          >
            {index + 1}. {step.title}
          </button>
        ))}
      </div>

      {view.kind === "summary" && (
        <CaseSummaryCard caseInput={entity} onOpenStep={(stepId) => setView({ kind: "step", stepId })} />
      )}

      {view.kind === "step" && currentStep && (
        <>
          {currentStep.id === "intent" && (
            <StepIntent
              entity={entity}
              competencies={competencies}
              onChange={patch}
              onOpenCompetencyGuide={() => setGuideOpen(true)}
            />
          )}
          {currentStep.id === "situation" && (
            <StepSituation entity={entity} caseSourceOptions={caseSourceOptions} onChange={patch} />
          )}
          {currentStep.id === "structure" && (
            <StepStructure
              entity={entity}
              onChange={patch}
              onEditDecisions={(cycleIndex) => {
                onSelectedCycleIndexChange(cycleIndex);
                setView({ kind: "step", stepId: "decisions" });
              }}
            />
          )}
          {currentStep.id === "decisions" && (
            <StepDecisions
              entity={entity}
              competencies={competencies}
              caseSourceOptions={caseSourceOptions}
              assets={assets}
              onUploadAsset={onUploadAsset}
              onTogglePreviewAudio={onTogglePreviewAudio}
              activePreviewKey={activePreviewKey}
              selectedCycleIndex={selectedCycleIndex}
              onSelectedCycleIndexChange={onSelectedCycleIndexChange}
              onChange={patch}
            />
          )}
          {currentStep.id === "launch" && (
            <StepLaunch
              entity={entity}
              assets={assets}
              onUploadAsset={onUploadAsset}
              onTogglePreviewAudio={onTogglePreviewAudio}
              activePreviewKey={activePreviewKey}
              onChange={patch}
            />
          )}

          <div className="flex items-center justify-between gap-3 border-t border-[#243244] pt-3">
            <Button
              type="button"
              variant="outline"
              className="border-[#2a3a4e] bg-transparent text-[#9aabc6]"
              disabled={stepIndex <= 0}
              onClick={() => setView({ kind: "step", stepId: MASTER_STEPS[stepIndex - 1].id })}
            >
              Назад
            </Button>
            <div className="text-[11px] text-[#7d9bc9]">
              Шаг {stepIndex + 1} из {MASTER_STEPS.length}
            </div>
            {stepIndex < MASTER_STEPS.length - 1 ? (
              <Button
                type="button"
                className="bg-[#f68b1f] text-white hover:bg-[#f68b1f]/90"
                onClick={() => setView({ kind: "step", stepId: MASTER_STEPS[stepIndex + 1].id })}
              >
                Далее
              </Button>
            ) : (
              <Button
                type="button"
                className="bg-[#f68b1f] text-white hover:bg-[#f68b1f]/90"
                onClick={() => setView({ kind: "summary" })}
              >
                К карточке кейса
              </Button>
            )}
          </div>
        </>
      )}

      <CompetencyGuideDialog
        open={guideOpen}
        onOpenChange={setGuideOpen}
        competencies={competencies}
        themeClass={themeClass}
      />
    </div>
  );
}
