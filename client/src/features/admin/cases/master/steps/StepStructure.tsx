import type { SimCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { CaseFlowDiagram } from "../../../components/CaseFlowDiagram";
import { isCaseStructureBranching } from "../case-master-support";

export function StepStructure({
  entity,
  onChange,
}: {
  entity: SimCase;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  const cycles = entity.cycles || [];
  const branching = isCaseStructureBranching(entity);

  const addCycle = () => {
    const nextNumber = cycles.length + 1;
    onChange({
      cycles: [
        ...cycles,
        {
          id: `${entity.id || "CASE"}-C${nextNumber}`,
          cycle: nextNumber,
          situation: "",
          signal: { type: "message" as const, content: "" },
          options: [],
        },
      ],
    });
  };

  const removeCycle = (index: number) => {
    onChange({
      cycles: cycles
        .filter((_, cycleIndex) => cycleIndex !== index)
        .map((cycle, cycleIndex) => ({ ...cycle, cycle: cycleIndex + 1 })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="text-sm font-semibold text-white">Как кейс разворачивается?</div>
        <div className="mt-1 text-[11px] leading-relaxed text-[#8890a8]">
          Кейс может идти одной линией — шаг за шагом, — или ветвиться, когда ответ участника определяет,
          что случится дальше. Ветвление задаётся на этапе «Решения»: у каждого варианта можно выбрать,
          какой шаг он запускает.
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="text-xs font-semibold text-white">
          Сейчас: {branching ? "кейс с ветвлением" : "линейный путь"}
        </div>
        <div className="text-[11px] text-[#8890a8]">Шагов: {cycles.length}</div>
        <Button type="button" size="sm" className="ml-auto shrink-0" onClick={addCycle}>
          Добавить шаг
        </Button>
      </div>

      {cycles.length > 0 ? (
        <>
          <CaseFlowDiagram caseItem={entity} />
          <div className="space-y-2">
            {cycles.map((cycle, index) => (
              <div
                key={cycle.id || `cycle-${index}`}
                className="flex items-center gap-3 rounded-lg border border-[#243244] bg-[#0d1522]/70 px-3 py-2"
              >
                <div className="text-xs font-semibold text-white">Шаг {cycle.cycle}</div>
                <div className="min-w-0 flex-1 truncate text-[11px] text-[#8aa2c4]">
                  {cycle.situation || "Ситуация не описана"}
                </div>
                <div className="shrink-0 text-[11px] text-[#70829d]">
                  вариантов: {(cycle.options || []).length}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-[#ff4444]/30 bg-transparent text-[#ff9999]"
                  onClick={() => removeCycle(index)}
                >
                  Удалить
                </Button>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-lg border border-dashed border-[#31455f] bg-[#0e1624] px-4 py-6 text-center text-[12px] text-[#8aa2c4]">
          Пока нет ни одного шага. Добавьте первый — это то, с чего начнётся кейс.
        </div>
      )}
    </div>
  );
}
