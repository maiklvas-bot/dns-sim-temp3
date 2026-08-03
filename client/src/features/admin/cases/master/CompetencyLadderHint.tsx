import type { CaseCycle, CompetencyDefinition } from "@shared/simulation-content";

/**
 * Показывает, как баллы компетенций меняются от варианта к варианту.
 * Когда все строки растут вместе — это и есть «единая шкала хорошести»,
 * которую участник читает по форме, не разбираясь в ситуации.
 */
export function CompetencyLadderHint({
  cycle,
  competencies,
}: {
  cycle: CaseCycle;
  competencies: CompetencyDefinition[];
}) {
  const options = [...(cycle.options || [])].sort((a, b) => a.level - b.level);
  if (options.length < 2) {
    return null;
  }

  const usedIds = Array.from(
    new Set(options.flatMap((option) => Object.keys(option.competency_scores || {}))),
  );
  if (usedIds.length === 0) {
    return null;
  }

  const rows = usedIds.map((id) => {
    const scores = options.map((option) => Number((option.competency_scores || {})[id] || 0));
    const rising = scores.every((value, index) => index === 0 || value >= scores[index - 1]);
    const flat = scores.every((value) => value === scores[0]);
    return {
      id,
      name: competencies.find((item) => item.id === id)?.name || id,
      scores,
      rising: rising && !flat,
    };
  });

  const allRising = rows.length >= 2 && rows.every((row) => row.rising);

  return (
    <div className="rounded-xl border border-[#243244] bg-[#0d1522]/70 p-3">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#70829d]">
        Как читается набор вариантов
      </div>
      <div className="mt-2 space-y-1">
        {rows.map((row) => (
          <div key={row.id} className="flex items-center gap-2">
            <div className="w-40 shrink-0 truncate text-[11.5px] text-[#b8c7df]">{row.name}</div>
            <div className="flex items-center gap-1.5 font-mono text-[11.5px] text-white">
              {row.scores.map((score, index) => (
                <span key={`${row.id}-${index}`}>
                  {index > 0 && <span className="mx-1 text-[#70829d]">→</span>}
                  {score}
                </span>
              ))}
            </div>
            {row.rising && <div className="text-[11px] text-[#ffb27a]">↗ растёт</div>}
          </div>
        ))}
      </div>
      {allRising && (
        <div className="mt-2 rounded-md border border-[#ffb27a]/35 bg-[#f68b1f]/10 px-2.5 py-2 text-[11.5px] leading-relaxed text-[#ffd77a]">
          Все строки растут вместе с номером варианта. Участнику достаточно выбрать последний пункт,
          чтобы получить максимум по всем компетенциям — думать не обязательно.
        </div>
      )}
    </div>
  );
}
