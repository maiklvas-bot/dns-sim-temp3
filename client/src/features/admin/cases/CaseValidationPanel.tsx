import { useMemo } from "react";
import type { AcceptedIssue, CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { isIssueAccepted, validateCase, type CaseValidationIssue } from "@shared/case-validation";
import { IssueGroupCard } from "./master/IssueGroupCard";

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
  competencies = [],
}: {
  caseInput: SimCase | null;
  /** Без него панель только показывает: принять замечание будет нечем. */
  onChange?: (patch: Partial<SimCase>) => void;
  /** Чтобы компетенция в замечании называлась по-русски, а не служебным id. */
  competencies?: CompetencyDefinition[];
}) {
  const issues = useMemo(() => (caseInput ? validateCase(caseInput) : []), [caseInput]);
  const accepted = useMemo(() => caseInput?.acceptedIssues || [], [caseInput]);
  const blocking = useMemo(
    () => issues.filter((issue) => !isIssueAccepted(issue, accepted)),
    [issues, accepted],
  );

  // Замечания одного вида объясняются одинаково, поэтому показываются одной
  // группой: тридцать семь одинаковых карточек автор просто перестаёт читать.
  const groups = useMemo(() => {
    const byCheck = new Map<CaseValidationIssue["check"], CaseValidationIssue[]>();
    for (const issue of issues) {
      const list = byCheck.get(issue.check);
      if (list) list.push(issue);
      else byCheck.set(issue.check, [issue]);
    }
    return Array.from(byCheck.entries());
  }, [issues]);

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
        {groups.map(([check, groupIssues]) => (
          <IssueGroupCard
            key={check}
            issues={groupIssues}
            accepted={accepted}
            caseInput={caseInput}
            competencies={competencies}
            onAccept={acceptIssue}
            onRevoke={revokeIssue}
          />
        ))}
      </div>
    </div>
  );
}
