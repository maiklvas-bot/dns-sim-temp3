import { useState } from "react";
import type { AcceptedIssue, CompetencyDefinition, SimCase } from "@shared/simulation-content";
import { isIssueAccepted, type CaseValidationIssue } from "@shared/case-validation";
import { explainIssue } from "@shared/case-issue-explanations";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/**
 * Группа однотипных замечаний автопроверки.
 *
 * Объяснение — что не так, почему и как исправить — зависит только от вида
 * проверки. Пока каждое замечание рисовалось отдельной карточкой, автор
 * тридцать семь раз читал один и тот же текст и переставал видеть за ним
 * конкретные места. Поэтому объяснение показывается один раз, а места —
 * компактным списком под ним.
 *
 * Свёрнутое состояние по умолчанию: сначала автор видит, сколько всего видов
 * проблем в кейсе, и только потом раскрывает нужный.
 */
export function IssueGroupCard({
  issues,
  accepted,
  caseInput,
  competencies = [],
  onAccept,
  onRevoke,
}: {
  /** Замечания одного вида проверки. */
  issues: CaseValidationIssue[];
  accepted: AcceptedIssue[];
  /** Нужен, чтобы назвать место по-человечески: «Цикл 2 · вариант 3». */
  caseInput: SimCase;
  /** Названия компетенций: в замечании должно стоять «Коммуникация», а не communication. */
  competencies?: CompetencyDefinition[];
  onAccept: (entry: AcceptedIssue) => void;
  onRevoke: (issue: CaseValidationIssue) => void;
}) {
  const [open, setOpen] = useState(false);
  const [reasonFor, setReasonFor] = useState<string | null>(null);
  const [reason, setReason] = useState("");

  const explanation = explainIssue(issues[0]);
  const pending = issues.filter((issue) => !isIssueAccepted(issue, accepted));
  const allAccepted = pending.length === 0;

  const issueKey = (issue: CaseValidationIssue) =>
    `${issue.check}|${issue.cycleId || ""}|${issue.optionId || ""}|${issue.competencyId || ""}`;

  /** Место замечания словами автора: номер цикла и номер варианта, а не служебные id. */
  const locationLabel = (issue: CaseValidationIssue): string => {
    if (!issue.cycleId) return "Кейс целиком";
    const cycleIndex = caseInput.cycles.findIndex((cycle) => cycle.id === issue.cycleId);
    const cycle = caseInput.cycles[cycleIndex];
    const parts = [`Цикл ${cycleIndex >= 0 ? cycleIndex + 1 : "?"}`];
    if (issue.optionId && cycle) {
      const optionIndex = cycle.options.findIndex((option) => option.id === issue.optionId);
      parts.push(`вариант ${optionIndex >= 0 ? optionIndex + 1 : "?"}`);
    }
    if (issue.competencyId) {
      const named = competencies.find((item) => item.id === issue.competencyId);
      parts.push(named?.name || issue.competencyId);
    }
    return parts.join(" · ");
  };

  const tone = allAccepted
    ? "border-[#243244] bg-[#0d1522]/70"
    : "border-[#ffb27a]/35 bg-[#f68b1f]/8";

  return (
    <div className={`rounded-lg border ${tone}`}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        className="flex w-full items-start gap-3 px-3 py-2.5 text-left"
      >
        <span
          className={`mt-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold ${
            allAccepted ? "bg-[#243244] text-[#8aa2c4]" : "bg-[#f68b1f]/25 text-[#ffb27a]"
          }`}
        >
          {allAccepted ? `${issues.length} принято` : pending.length}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[12.5px] font-semibold text-white">{explanation.what}</span>
          <span className="mt-0.5 block text-[11px] text-[#8aa2c4]">
            {open ? "Свернуть" : issues.length === 1 ? "Показать место" : `Показать все места (${issues.length})`}
          </span>
        </span>
        <span className="shrink-0 text-[#8aa2c4]">{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="border-t border-[#243244]/70 px-3 pb-3 pt-2.5">
          <div className="text-[11.5px] leading-relaxed text-[#b8c7df]">{explanation.why}</div>
          <div className="mt-2 rounded-md border border-[#243244] bg-[#0d1522]/60 px-2.5 py-2">
            <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#7d9bc9]">
              Как исправить
            </div>
            <div className="mt-1 text-[11.5px] leading-relaxed text-[#cbd8ef]">{explanation.how}</div>
          </div>

          <div className="mt-2.5 space-y-1">
            {issues.map((issue) => {
              const key = issueKey(issue);
              const isAccepted = isIssueAccepted(issue, accepted);
              return (
                <div
                  key={key}
                  className="rounded-md border border-[#243244]/80 bg-[#0d1522]/40 px-2.5 py-1.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[11.5px] ${isAccepted ? "text-[#7d9bc9]" : "text-[#cbd8ef]"}`}>
                      {locationLabel(issue)}
                      {isAccepted && <span className="ml-1.5 text-[10px] text-[#7d9bc9]">принято</span>}
                    </span>
                    {isAccepted ? (
                      <button
                        type="button"
                        onClick={() => onRevoke(issue)}
                        className="shrink-0 text-[10.5px] text-[#8aa2c4] underline decoration-dotted underline-offset-2 hover:text-white"
                      >
                        Вернуть в работу
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setReasonFor(reasonFor === key ? null : key);
                          setReason("");
                        }}
                        className="shrink-0 text-[10.5px] text-[#8aa2c4] underline decoration-dotted underline-offset-2 hover:text-white"
                      >
                        Так и задумано
                      </button>
                    )}
                  </div>

                  {reasonFor === key && (
                    <div className="mt-2 space-y-2">
                      <Input
                        value={reason}
                        placeholder="Почему в этом кейсе так и задумано?"
                        onChange={(event) => setReason(event.target.value)}
                        className="dns-admin-input h-8 border-[#2a3a4e] bg-[#141c2b] text-[12px] text-white"
                      />
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          className="h-7 text-[11px]"
                          disabled={!reason.trim()}
                          onClick={() => {
                            onAccept({
                              check: issue.check,
                              cycleId: issue.cycleId || null,
                              optionId: issue.optionId || null,
                              competencyId: issue.competencyId || null,
                              reason: reason.trim(),
                              acceptedForMessage: issue.message,
                            });
                            setReasonFor(null);
                            setReason("");
                          }}
                        >
                          Принять
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 border-[#2a3a4e] bg-transparent text-[11px] text-[#9aabc6]"
                          onClick={() => setReasonFor(null)}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
