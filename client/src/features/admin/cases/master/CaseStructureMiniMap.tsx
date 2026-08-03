import type { SimCase } from "@shared/simulation-content";

/**
 * Мини-схема структуры для карточки кейса: шаги в порядке прохождения и переходы,
 * которые задают ответы. Полная схема с текстами вариантов живёт в CaseFlowDiagram —
 * здесь только форма кейса, чтобы автор с одного взгляда видел линию или ветвление.
 */
export function CaseStructureMiniMap({ caseInput }: { caseInput: SimCase }) {
  const cycles = [...(caseInput.cycles || [])].sort((a, b) => a.cycle - b.cycle);

  if (cycles.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-[#31455f] px-3 py-4 text-center text-[12px] text-[#8aa2c4]">
        Шагов нет — кейсу нечего показать участнику
      </div>
    );
  }

  const knownIds = new Set(cycles.map((cycle) => cycle.id).filter(Boolean));

  return (
    <div className="dns-master-minimap grid auto-rows-fr gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
      {cycles.map((cycle) => {
        const options = cycle.options || [];
        const targets = options.map((option) => option.nextCycleId).filter(Boolean) as string[];
        const finishes = targets.filter((target) => target === "__complete").length;
        const broken = targets.filter((target) => target !== "__complete" && !knownIds.has(target)).length;
        const forward = targets.filter((target) => target !== "__complete" && knownIds.has(target)).length;

        return (
          <div
            key={cycle.id || cycle.cycle}
            className={`flex h-full flex-col rounded-lg border px-2.5 py-2 ${
              broken > 0 ? "border-[#ff9999]/50 bg-[#ff4444]/8" : "border-[#243244] bg-[#0d1522]/70"
            }`}
          >
            <div className="text-[11px] font-semibold text-white">Шаг {cycle.cycle}</div>
            <div className="mt-0.5 truncate text-[11px] text-[#8aa2c4]">
              {cycle.situation || "без описания"}
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 gap-y-0.5 text-[10px] text-[#7d9bc9]">
              <span>вариантов: {options.length}</span>
              {forward > 0 && <span className="text-[#8ec5ff]">→ дальше: {forward}</span>}
              {finishes > 0 && <span className="text-[#54d28c]">финал: {finishes}</span>}
              {broken > 0 && <span className="text-[#ff9999]">обрыв: {broken}</span>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
