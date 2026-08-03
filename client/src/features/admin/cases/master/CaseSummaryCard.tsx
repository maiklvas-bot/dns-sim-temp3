import { useMemo } from "react";
import type { SimCase } from "@shared/simulation-content";
import { validateCase } from "@shared/case-validation";
import { buildStepSummaries, type MasterStepId, type StepSummary } from "./case-master-support";
import { CaseStructureMiniMap } from "./CaseStructureMiniMap";

/** Все плитки одного размера — три строки содержания, недостающие добираются пустыми. */
const TILE_LINES = 3;

function StepTile({ summary, index, onOpen }: { summary: StepSummary; index: number; onOpen: () => void }) {
  const hasIssues = summary.issueCount > 0;
  const lines = [...summary.lines.slice(0, TILE_LINES)];
  while (lines.length < TILE_LINES) lines.push("");

  return (
    <button
      type="button"
      onClick={onOpen}
      className={`dns-master-tile flex h-full flex-col rounded-xl border p-3 text-left transition ${
        hasIssues
          ? "border-[#ffb27a]/50 bg-[#f68b1f]/10 hover:border-[#ffb27a]"
          : summary.isFilled
            ? "border-[#54d28c]/35 bg-[#101826]/70 hover:border-[#54d28c]"
            : "border-[#243244] bg-[#101826]/70 hover:border-[#3b5878]"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-5 w-5 flex-none items-center justify-center rounded-md border border-[#3b5878] text-[11px] font-bold text-[#8ec5ff]">
          {index + 1}
        </span>
        {hasIssues ? (
          <span className="text-[11px] font-semibold text-[#ffb27a]">⚠ {summary.issueCount}</span>
        ) : (
          <span className={`text-[11px] font-semibold ${summary.isFilled ? "text-[#54d28c]" : "text-[#7d9bc9]"}`}>
            {summary.isFilled ? "готово" : "не заполнено"}
          </span>
        )}
      </div>

      <div className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8aa2c4]">
        {summary.title}
      </div>

      <div className="mt-1.5 space-y-0.5">
        {lines.map((line, lineIndex) => (
          <div
            key={`${summary.stepId}-${lineIndex}`}
            className="truncate text-[12px] leading-5 text-[#b8c7df]"
          >
            {line || " "}
          </div>
        ))}
      </div>
    </button>
  );
}

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
        <div className="dns-master-hint mt-1">
          Карточка кейса. Нажмите на любой блок, чтобы вернуться к его настройке.
        </div>
      </div>

      {/* Плитки одного размера: auto-rows-fr выравнивает высоту ряда, h-full тянет карточку. */}
      <div className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {summaries.map((summary, index) => (
          <StepTile
            key={summary.stepId}
            summary={summary}
            index={index}
            onOpen={() => onOpenStep(summary.stepId)}
          />
        ))}
      </div>

      {/* Схема — отдельная полоса, а не начинка одной из плиток: иначе плитки разной высоты. */}
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-3">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[#8aa2c4]">
            Структура кейса
          </div>
          <button
            type="button"
            onClick={() => onOpenStep("structure")}
            className="rounded-md border border-[#3b5878] px-2 py-0.5 text-[11px] font-semibold text-[#8ec5ff] transition hover:border-[#6fa0ff] hover:bg-[#6fa0ff]/10"
          >
            Настроить
          </button>
        </div>
        <div className="mt-2">
          <CaseStructureMiniMap caseInput={caseInput} />
        </div>
      </div>
    </div>
  );
}
