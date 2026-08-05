import { useState } from "react";
import type { AcceptedIssue } from "@shared/simulation-content";
import { isIssueAccepted, type CaseValidationIssue } from "@shared/case-validation";
import { explainIssue } from "@shared/case-issue-explanations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function IssueCard({
  issue,
  accepted,
  onAccept,
  onRevoke,
}: {
  issue: CaseValidationIssue;
  accepted: AcceptedIssue[];
  onAccept: (entry: AcceptedIssue) => void;
  onRevoke: (issue: CaseValidationIssue) => void;
}) {
  const explanation = explainIssue(issue);
  const isAccepted = isIssueAccepted(issue, accepted);
  const [showReason, setShowReason] = useState(false);
  const [reason, setReason] = useState("");

  if (isAccepted) {
    return (
      <div className="rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2">
        <div className="flex items-center justify-between gap-2">
          <div className="text-[12px] text-[#8aa2c4]">{explanation.what}</div>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="shrink-0 border-[#2a3a4e] bg-transparent text-[#9aabc6]"
            onClick={() => onRevoke(issue)}
          >
            Вернуть в работу
          </Button>
        </div>
        <div className="mt-1 text-[10px] text-[#7d9bc9]">Принято автором</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#ffb27a]/35 bg-[#f68b1f]/8 px-3 py-2.5">
      <div className="text-[12.5px] font-semibold text-white">{explanation.what}</div>
      <div className="mt-1.5 text-[11.5px] leading-relaxed text-[#b8c7df]">{explanation.why}</div>
      <div className="mt-2 rounded-md border border-[#243244] bg-[#0d1522]/60 px-2.5 py-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d9bc9]">Как исправить</div>
        <div className="mt-1 text-[11.5px] leading-relaxed text-[#cbd8ef]">{explanation.how}</div>
      </div>
      <div className="mt-2 text-[10px] text-[#7d9bc9]">{explanation.detail}</div>

      {showReason ? (
        <div className="mt-2 space-y-2">
          <Input
            value={reason}
            placeholder="Почему в этом кейсе так и задумано?"
            onChange={(event) => setReason(event.target.value)}
            className="dns-admin-input border-[#2a3a4e] bg-[#141c2b] text-white"
          />
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              disabled={!reason.trim()}
              onClick={() => {
                onAccept({
                  check: issue.check,
                  cycleId: issue.cycleId || null,
                  optionId: issue.optionId || null,
                  reason: reason.trim(),
                  acceptedForMessage: issue.message,
                });
                setShowReason(false);
                setReason("");
              }}
            >
              Принять замечание
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="border-[#2a3a4e] bg-transparent text-[#9aabc6]"
              onClick={() => setShowReason(false)}
            >
              Отмена
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setShowReason(true)}
          className="mt-2 text-[11px] text-[#8aa2c4] underline decoration-dotted underline-offset-2 hover:text-white"
        >
          Так и задумано — принять замечание
        </button>
      )}
    </div>
  );
}
