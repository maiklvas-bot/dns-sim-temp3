import { Clock, CornerDownRight, Flag, Play } from "lucide-react";
import type { SimCase, CaseOption, CaseCycle } from "@shared/simulation-content";

const OPTION_LETTERS = ["A", "B", "C", "D", "E", "F", "G", "H"];

function toneForScore(score: number): "pos" | "neg" | "neutral" {
  if (score > 0) return "pos";
  if (score < 0) return "neg";
  return "neutral";
}

function resolveTarget(option: CaseOption, cycles: CaseCycle[], cycleIndex: number): { label: string; terminal: boolean } {
  if (option.nextCycleId === "__complete") {
    return { label: "Завершить кейс", terminal: true };
  }
  const linked = option.nextCycleId ? cycles.find((c) => c.id === option.nextCycleId) : null;
  if (linked) {
    return { label: `Цикл ${linked.cycle}`, terminal: false };
  }
  const fallback = cycles[cycleIndex + 1];
  if (fallback) {
    return { label: `Цикл ${fallback.cycle} (по порядку)`, terminal: false };
  }
  return { label: "Финал кейса", terminal: true };
}

/**
 * Схема путей кейса (дерево/BPMN): Старт → шлюз каждого цикла с ветвлением
 * по вариантам ответа (что случится при каждом выборе) → Финал.
 * Цвет ветви — по знаку оценки (зелёный/красный/нейтральный).
 */
export function CaseFlowDiagram({ caseItem }: { caseItem: SimCase | null | undefined }) {
  const cycles = caseItem?.cycles || [];

  if (!caseItem || cycles.length === 0) {
    return (
      <div className="dns-flow-empty">
        В кейсе ещё нет циклов. Добавьте цикл и варианты ответа — здесь появится дерево путей
        с тем, что произойдёт при каждом выборе студента.
      </div>
    );
  }

  return (
    <div className="dns-flow">
      <div className="dns-flow-terminal dns-flow-terminal--start">
        <Play className="h-4 w-4" aria-hidden="true" />
        <span>Старт · {caseItem.title || "Кейс"}</span>
      </div>

      {cycles.map((cycle, cycleIndex) => {
        const options = (cycle.options || []).filter((o) => (o.status || "active") === "active");
        return (
          <div key={cycle.id || cycleIndex} className="dns-flow-cycle">
            <div className="dns-flow-rail" aria-hidden="true">
              <span className="dns-flow-rail-dot">{cycle.cycle}</span>
            </div>
            <div className="dns-flow-cycle-body">
              <div className="dns-flow-node">
                <div className="dns-flow-node-head">
                  <span className="dns-flow-node-badge">Цикл {cycle.cycle}</span>
                  {cycle.priority && cycle.priority !== "normal" && (
                    <span className="dns-flow-prio" data-p={cycle.priority}>
                      {cycle.priority === "critical" ? "критично" : "важно"}
                    </span>
                  )}
                  {cycle.isFinal && <span className="dns-flow-prio" data-p="final">финальный</span>}
                </div>
                <div className="dns-flow-node-signal">
                  {cycle.signal?.content || cycle.situation || "Сигнал не задан"}
                </div>
              </div>

              <div className="dns-flow-gateway" aria-hidden="true">Выбор студента</div>

              <div className="dns-flow-options">
                {options.length === 0 && (
                  <div className="dns-flow-noopt">Нет активных вариантов ответа в этом цикле.</div>
                )}
                {options.map((option, optionIndex) => {
                  const target = resolveTarget(option, cycles, cycleIndex);
                  return (
                    <div key={option.id || optionIndex} className="dns-flow-option" data-tone={toneForScore(option.score)}>
                      <span className="dns-flow-letter">{OPTION_LETTERS[optionIndex] || optionIndex + 1}</span>
                      <div className="dns-flow-option-main">
                        <div className="dns-flow-option-text">{option.text || "Ответ без текста"}</div>
                        <div className="dns-flow-option-meta">
                          <span className="dns-flow-score">{option.score > 0 ? `+${option.score}` : option.score}</span>
                          <span className="dns-flow-target" data-terminal={target.terminal}>
                            <CornerDownRight className="h-3 w-3" aria-hidden="true" />
                            {target.label}
                          </span>
                          {Number(option.nextDelaySeconds) > 0 && (
                            <span className="dns-flow-delay">
                              <Clock className="h-3 w-3" aria-hidden="true" />
                              {option.nextDelaySeconds}с
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })}

      <div className="dns-flow-terminal dns-flow-terminal--finish">
        <Flag className="h-4 w-4" aria-hidden="true" />
        <span>Финал кейса · итоговая оценка компетенций</span>
      </div>
    </div>
  );
}
