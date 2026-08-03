import { useMemo } from "react";
import type { AcceptedIssue, SimCase } from "@shared/simulation-content";
import { isIssueAccepted, validateCase, type CaseValidationIssue } from "@shared/case-validation";
import { IssueCard } from "./master/IssueCard";

/**
 * Замечания автопроверки на этапе «Оформление и запуск».
 *
 * Каждое замечание — карточка с объяснением: что не так, почему это ломает
 * оценку участника и как исправить. Замечание можно осознанно принять с
 * обоснованием — тогда оно перестаёт блокировать, но остаётся видимым.
 */
export function CaseValidationPanel({
  caseInput,
  onChange,
}: {
  caseInput: SimCase | null;
  /** Без него панель только показывает: принять замечание будет нечем. */
  onChange?: (patch: Partial<SimCase>) => void;
}) {
  const issues = useMemo(() => (caseInput ? validateCase(caseInput) : []), [caseInput]);
  const accepted = useMemo(() => caseInput?.acceptedIssues || [], [caseInput]);
  const blocking = useMemo(
    () => issues.filter((issue) => !isIssueAccepted(issue, accepted)),
    [issues, accepted],
  );

  if (!caseInput) {
    return null;
  }

  const acceptIssue = (entry: AcceptedIssue) => {
    onChange?.({ acceptedIssues: [...accepted, entry] });
  };

  // Отмена снимает записи с той же привязкой — той же тройкой, по которой идёт сопоставление.
  const revokeIssue = (issue: CaseValidationIssue) => {
    onChange?.({
      acceptedIssues: accepted.filter(
        (item) =>
          !(
            item.check === issue.check
            && (item.cycleId ?? null) === (issue.cycleId ?? null)
            && (item.optionId ?? null) === (issue.optionId ?? null)
          ),
      ),
    });
  };

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-[#54d28c]/40 bg-[#54d28c]/10 p-4">
        <div className="text-sm font-semibold text-[#54d28c]">Автопроверка пройдена</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8aa2c4]">
          Кейс можно переводить в статус готовности к прототипу или запуску.
        </div>
      </div>
    );
  }

  const allAccepted = blocking.length === 0;

  return (
    <div
      className={`rounded-xl border p-4 ${
        allAccepted ? "border-[#54d28c]/35 bg-[#54d28c]/8" : "border-[#ffb27a]/35 bg-[#f68b1f]/8"
      }`}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className={`text-sm font-semibold ${allAccepted ? "text-[#54d28c]" : "text-[#ffb27a]"}`}>
          Замечания автопроверки
        </div>
        <div className={`text-[11px] font-semibold ${allAccepted ? "text-[#54d28c]" : "text-[#ffb27a]"}`}>
          {allAccepted ? `${issues.length} принято` : blocking.length}
        </div>
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-[#b8c7df]">
        {allAccepted
          ? "Все замечания приняты автором: кейс не блокируется, но замечания остаются видимыми."
          : "Каждое замечание объясняет, чем оно вредит оценке участника. Если в этом кейсе так и задумано — примите его с обоснованием."}
      </div>

      <div className="mt-3 space-y-2">
        {issues.map((issue, issueIndex) => (
          <IssueCard
            key={`${issue.check}-${issue.cycleId || ""}-${issue.optionId || ""}-${issueIndex}`}
            issue={issue}
            accepted={accepted}
            onAccept={acceptIssue}
            onRevoke={revokeIssue}
          />
        ))}
      </div>
    </div>
  );
}
