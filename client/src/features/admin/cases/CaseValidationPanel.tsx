import { useMemo } from "react";
import type { SimCase } from "@shared/simulation-content";
import { validateCase, type CaseValidationIssue } from "@shared/case-validation";

const CHECK_LABELS: Record<CaseValidationIssue["check"], string> = {
  bars_conformance: "Уровни BARS",
  antigaming: "Антигейминг",
  diagnostics: "Диагностика",
  effect_reality: "Влияние на состояние",
};

const CHECK_HINTS: Record<CaseValidationIssue["check"], string> = {
  bars_conformance: "Баллы компетенций должны совпадать с уровнями якорей поведения",
  antigaming: "Правильный ответ не должен угадываться по форме варианта",
  diagnostics: "Без скрытой причины и данных кейс проходится без диагностики",
  effect_reality: "Каждый вариант должен менять состояние магазина",
};

export function CaseValidationPanel({ caseInput }: { caseInput: SimCase | null }) {
  const issues = useMemo(() => (caseInput ? validateCase(caseInput) : []), [caseInput]);

  const grouped = useMemo(() => {
    const map = new Map<CaseValidationIssue["check"], CaseValidationIssue[]>();
    issues.forEach((issue) => {
      const list = map.get(issue.check) || [];
      list.push(issue);
      map.set(issue.check, list);
    });
    return Array.from(map.entries());
  }, [issues]);

  if (!caseInput) {
    return null;
  }

  if (issues.length === 0) {
    return (
      <div className="rounded-xl border border-[#2f6b2f]/40 bg-[#2f6b2f]/10 p-4">
        <div className="text-sm font-semibold text-[#54d28c]">Автопроверка пройдена</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8aa2c4]">
          Кейс можно переводить в статус готовности к прототипу или запуску.
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[#ffb27a]/35 bg-[#FF6B00]/8 p-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="text-sm font-semibold text-[#ffb27a]">Замечания автопроверки</div>
        <div className="text-[11px] font-semibold text-[#ffb27a]">{issues.length}</div>
      </div>
      <div className="mt-1 text-[11px] leading-relaxed text-[#b8c7df]">
        Пока замечания не устранены, кейс нельзя пометить готовым. Черновик сохраняется свободно.
      </div>
      <div className="mt-3 space-y-3">
        {grouped.map(([check, checkIssues]) => (
          <div key={check} className="rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2">
            <div className="flex items-baseline justify-between gap-2">
              <div className="text-xs font-semibold text-white">{CHECK_LABELS[check]}</div>
              <div className="text-[10px] text-[#70829d]">{checkIssues.length}</div>
            </div>
            <div className="mt-1 text-[10px] leading-relaxed text-[#70829d]">{CHECK_HINTS[check]}</div>
            <ul className="mt-2 space-y-1">
              {checkIssues.slice(0, 5).map((issue, issueIndex) => (
                <li key={`${check}-${issueIndex}`} className="text-[11px] leading-relaxed text-[#b8c7df]">
                  • {issue.message}
                </li>
              ))}
            </ul>
            {checkIssues.length > 5 && (
              <div className="mt-1 text-[10px] text-[#70829d]">…и ещё {checkIssues.length - 5}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
