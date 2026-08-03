import type { SimCase } from "@shared/simulation-content";
import { Button } from "@/components/ui/button";
import { CaseFlowDiagram } from "../../../components/CaseFlowDiagram";
import { createEmptyCycle } from "../../case-editor-support";
import { findBrokenTransitions, isCaseStructureBranching } from "../case-master-support";
import { CaseStructureMiniMap } from "../CaseStructureMiniMap";
import { MasterHelp } from "../MasterHelp";
import { HELP } from "../master-help-topics";

export function StepStructure({
  entity,
  onChange,
}: {
  entity: SimCase;
  onChange: (patch: Partial<SimCase>) => void;
}) {
  const cycles = entity.cycles || [];
  const branching = isCaseStructureBranching(entity);
  const brokenTransitions = findBrokenTransitions(entity);

  const addCycle = () => {
    const nextNumber = cycles.length + 1;
    onChange({
      cycles: [...cycles, createEmptyCycle(`${entity.id || "CASE"}-C${nextNumber}`, nextNumber)],
    });
  };

  // Кейс без единого шага пройти нельзя — последний шаг не удаляем, как и в редакторе циклов.
  const canRemoveCycle = cycles.length > 1;

  const removeCycle = (index: number) => {
    if (!canRemoveCycle) {
      return;
    }
    onChange({
      cycles: cycles
        .filter((_, cycleIndex) => cycleIndex !== index)
        .map((cycle, cycleIndex) => ({ ...cycle, cycle: cycleIndex + 1 })),
    });
  };

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-[#243244] bg-[#101826]/70 p-4">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-semibold text-white">Как кейс разворачивается?</span>
          <MasterHelp topic={HELP.structureShape} />
        </div>
        <div className="dns-master-hint mt-1">
          Форма кейса не выбирается переключателем — она получается из того, куда ведут ответы.
          Переходы задаются на этапе «Решения», а здесь видно, что вышло.
        </div>
      </div>

      {/* Два типа сценария словами, а не терминами: автор должен узнать свой случай. */}
      <div className="grid gap-2 md:grid-cols-2">
        <div
          className={`rounded-xl border p-3 ${
            branching ? "border-[#243244] bg-[#0d1522]/60" : "border-[#FF6B00]/50 bg-[#FF6B00]/8"
          }`}
        >
          <div className="text-xs font-semibold text-white">
            Линейный путь {!branching && <span className="text-[#ffb27a]">· сейчас так</span>}
          </div>
          <div className="dns-master-hint mt-1">
            Шаги идут подряд, одинаково для всех. Ответ меняет оценку и метрики магазина, но не маршрут.
            Подходит, когда важно, <b>как</b> человек решает, а не куда его заводит решение.
          </div>
        </div>
        <div
          className={`rounded-xl border p-3 ${
            branching ? "border-[#FF6B00]/50 bg-[#FF6B00]/8" : "border-[#243244] bg-[#0d1522]/60"
          }`}
        >
          <div className="text-xs font-semibold text-white">
            С ветвлением · «матрёшка» {branching && <span className="text-[#ffb27a]">· сейчас так</span>}
          </div>
          <div className="dns-master-hint mt-1">
            Ответ определяет следующий шаг: слабое решение заводит в осложнившуюся ситуацию, сильное —
            дальше по плану. Появляется само, как только у варианта задан переход «после ответа запустить».
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-[#243244] bg-[#101826]/60 p-3">
        <div className="text-xs font-semibold text-white">Шагов: {cycles.length}</div>
        {brokenTransitions > 0 && (
          <div className="text-[11px] font-semibold text-[#ff9999]">
            Оборванных переходов: {brokenTransitions} — ответ ведёт на шаг, которого нет
          </div>
        )}
        <Button type="button" size="sm" className="ml-auto shrink-0" onClick={addCycle}>
          Добавить шаг
        </Button>
      </div>

      {cycles.length > 0 ? (
        <>
          <CaseStructureMiniMap caseInput={entity} />
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
                  disabled={!canRemoveCycle}
                  title={canRemoveCycle ? undefined : "Последний шаг удалить нельзя — кейс без шагов не пройти"}
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
