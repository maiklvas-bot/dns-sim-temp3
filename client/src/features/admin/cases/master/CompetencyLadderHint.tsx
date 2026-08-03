import type { CaseCycle, CompetencyDefinition } from "@shared/simulation-content";
import type { CaseValidationIssue } from "@shared/case-validation";
import { buildLadderView, findLadderIssue } from "./competency-ladder";

/**
 * Показывает, как уровни компетенций меняются от варианта к варианту.
 * Когда все строки растут вместе — это «единая шкала хорошести»: участнику
 * достаточно выбрать последний пункт, чтобы получить максимум по всему.
 *
 * Вердикт берётся из автопроверки, а не считается здесь заново — иначе картинка
 * и механика разойдутся.
 */
export function CompetencyLadderHint({
  cycle,
  competencies,
  issues,
}: {
  cycle: CaseCycle;
  competencies: CompetencyDefinition[];
  issues: CaseValidationIssue[];
}) {
  const view = buildLadderView(cycle, competencies);
  if (!view) {
    return null;
  }

  const ladderIssue = findLadderIssue(cycle.id, issues);

  return (
    <div
      className={`rounded-xl border p-3 ${
        ladderIssue ? "border-[#ffb27a]/45 bg-[#f68b1f]/8" : "border-[#243244] bg-[#0d1522]/70"
      }`}
    >
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">
          Как читается набор вариантов · {cycle.title?.trim() || `шаг ${cycle.cycle}`}
        </div>
        {ladderIssue && <div className="text-[11px] font-semibold text-[#ffb27a]">лестница</div>}
      </div>

      <div className="mt-2 space-y-1">
        {view.rows.map((row) => (
          <div key={row.competencyId} className="flex items-center gap-2">
            <div className="w-40 shrink-0 truncate text-[11.5px] text-[#b8c7df]" title={row.name}>
              {row.name}
            </div>
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-white">
              {row.scores.map((score, index) => (
                <span key={`${row.competencyId}-${index}`}>
                  {index > 0 && <span className="mx-1 text-[#7d9bc9]">→</span>}
                  {score}
                </span>
              ))}
            </div>
            {row.rising && <div className="text-[11px] text-[#ffb27a]">↗ растёт</div>}
          </div>
        ))}
      </div>

      {ladderIssue && (
        <div className="mt-2 rounded-md border border-[#ffb27a]/35 bg-[#f68b1f]/10 px-2.5 py-2 text-[11.5px] leading-relaxed text-[#ffd77a]">
          Все строки растут вместе с номером варианта. Участнику достаточно выбрать последний пункт,
          чтобы получить максимум по всем компетенциям — думать не обязательно. Сделайте так, чтобы
          сильный по одной компетенции ответ был средним по другой: тогда получится профиль, а не лестница.
        </div>
      )}
    </div>
  );
}
