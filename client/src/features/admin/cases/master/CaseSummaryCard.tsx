import { useMemo } from "react";
import type { SimCase } from "@shared/simulation-content";
import { validateCase } from "@shared/case-validation";
import { buildStepSummaries, type MasterStepId } from "./case-master-support";

export function CaseSummaryCard({
  caseInput,
  onOpenStep,
}: {
  caseInput: SimCase;
  onOpenStep: (stepId: MasterStepId) => void;
}) {
  const issues = useMemo(() => validateCase(caseInput), [caseInput]);
  const summaries = useMemo(() => buildStepSummaries(caseInput, issues), [caseInput, issues]);

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">{caseInput.title || "Новый кейс"}</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Карточка кейса. Нажмите на любой блок, чтобы вернуться к его настройке.
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {summaries.map((summary, index) => {
          const isLast = index === summaries.length - 1;
          return (
            <button
              key={summary.stepId}
              type="button"
              onClick={() => onOpenStep(summary.stepId)}
              className={`rounded-xl border p-3 text-left transition ${isLast ? "md:col-span-2" : ""} ${
                summary.issueCount > 0
                  ? "border-[#ffb27a]/40 bg-[#FF6B00]/8 hover:border-[#ffb27a]"
                  : "border-[#243244] bg-[#101826]/60 hover:border-[#3b5878]"
              }`}
            >
              <div className="flex items-baseline justify-between gap-2">
                <div className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#70829d]">
                  {index + 1}. {summary.title}
                </div>
                {summary.issueCount > 0 ? (
                  <div className="shrink-0 text-[11px] font-semibold text-[#ffb27a]">⚠ {summary.issueCount}</div>
                ) : (
                  <div className={`shrink-0 text-[11px] ${summary.isFilled ? "text-[#54d28c]" : "text-[#70829d]"}`}>
                    {summary.isFilled ? "готово" : "не заполнено"}
                  </div>
                )}
              </div>
              <div className="mt-2 space-y-0.5">
                {summary.lines.map((line, lineIndex) => (
                  <div key={`${summary.stepId}-${lineIndex}`} className="truncate text-[12px] text-[#b8c7df]">
                    {line}
                  </div>
                ))}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
