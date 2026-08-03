import type { SimCase } from "@shared/simulation-content";
import { hasMeaningfulText } from "@shared/case-validation";
import { signalTypeLabel, type MasterStepId } from "./case-master-support";

/**
 * Постоянное дерево кейса. Показывает кейс целиком в порядке прохождения:
 * замысел, ситуация, шаги с ответами, финал. Достраивается по мере заполнения.
 *
 * Намеренно не кликабельно и не зависит от текущего этапа: это карта, по которой
 * автор сверяется, не теряя места. Пропадает только вместе с закрытием мастера.
 */

interface RoadmapNode {
  key: string;
  badge: string;
  title: string;
  lines: string[];
  state: "empty" | "partial" | "filled";
  tone: "stage" | "step" | "finish";
  stepId: MasterStepId | null;
}

function buildNodes(caseInput: SimCase): RoadmapNode[] {
  const cycles = [...(caseInput.cycles || [])].sort((a, b) => a.cycle - b.cycle);
  const knownIds = new Set(cycles.map((cycle) => cycle.id).filter(Boolean));
  const competencyCount =
    (caseInput.primaryCompetencies || []).length + (caseInput.secondaryCompetencies || []).length;

  const nodes: RoadmapNode[] = [
    {
      key: "intent",
      badge: "1",
      title: "Замысел",
      lines: [
        hasMeaningfulText(caseInput.title) ? caseInput.title : "название не задано",
        competencyCount > 0 ? `компетенций: ${competencyCount}` : "компетенции не выбраны",
      ],
      state: hasMeaningfulText(caseInput.title) && competencyCount > 0 ? "filled" : "empty",
      tone: "stage",
      stepId: "intent",
    },
    {
      key: "situation",
      badge: "2",
      title: "Ситуация",
      lines: [
        hasMeaningfulText(caseInput.trigger?.text)
          ? `сигнал: ${signalTypeLabel(caseInput.trigger?.type)}`
          : "сигнал не описан",
        hasMeaningfulText(caseInput.hiddenCause) ? "причина скрыта" : "скрытой причины нет",
        `данных ${(caseInput.dataPoints || []).length} · следов ${(caseInput.falseTrails || []).length}`,
      ],
      state: hasMeaningfulText(caseInput.trigger?.text) && hasMeaningfulText(caseInput.hiddenCause)
        ? "filled"
        : hasMeaningfulText(caseInput.trigger?.text)
          ? "partial"
          : "empty",
      tone: "stage",
      stepId: "situation",
    },
  ];

  cycles.forEach((cycle) => {
    const options = (cycle.options || []).filter((option) => (option.status || "active") === "active");
    const described = hasMeaningfulText(cycle.situation);
    const lines: string[] = [described ? cycle.situation : "шаг не описан"];

    if (options.length === 0) {
      lines.push("ответов нет");
    } else {
      options.slice(0, 4).forEach((option, optionIndex) => {
        const target = option.nextCycleId;
        const where = !target
          ? "дальше по порядку"
          : target === "__complete"
            ? "→ финал"
            : knownIds.has(target)
              ? `→ шаг ${cycles.findIndex((item) => item.id === target) + 1}`
              : "→ обрыв";
        const text = hasMeaningfulText(option.text) ? option.text : `ответ ${optionIndex + 1}`;
        lines.push(`${text} ${where}`);
      });
      if (options.length > 4) lines.push(`…и ещё ${options.length - 4}`);
    }

    nodes.push({
      key: `cycle-${cycle.id || cycle.cycle}`,
      badge: String(cycle.cycle),
      title: cycle.title?.trim() || `Шаг ${cycle.cycle}`,
      lines,
      state: described && options.length > 0 ? "filled" : described || options.length > 0 ? "partial" : "empty",
      tone: "step",
      stepId: null,
    });
  });

  nodes.push({
    key: "finish",
    badge: "✓",
    title: "Финал кейса",
    lines: ["итоговая оценка компетенций"],
    state: "filled",
    tone: "finish",
    stepId: null,
  });

  return nodes;
}

const STATE_STYLE: Record<RoadmapNode["state"], { badge: string; card: string; rail: string }> = {
  empty: {
    badge: "border-[#3b5878] bg-[#122031] text-[#7d9bc9]",
    card: "border-[#243244] bg-[#0d1522]/80",
    rail: "text-[#3b5878]",
  },
  partial: {
    badge: "border-[#FF6B00] bg-[#FF6B00] text-white",
    card: "border-[#ffb27a]/40 bg-[#FF6B00]/10",
    rail: "text-[#FF6B00]",
  },
  filled: {
    badge: "border-[#54d28c] bg-[#54d28c] text-[#062018]",
    card: "border-[#54d28c]/35 bg-[#101826]/80",
    rail: "text-[#54d28c]",
  },
};

export function CaseRoadmap({
  caseInput,
  activeStepId,
}: {
  caseInput: SimCase;
  /** Подсветка текущего этапа — ориентир на карте, без перехода по клику. */
  activeStepId: MasterStepId | null;
}) {
  const nodes = buildNodes(caseInput);

  return (
    <div className="dns-master-roadmap">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">
        Дерево кейса
      </div>
      <div className="dns-master-hint mt-1">
        Как кейс выглядит целиком. Достраивается по мере заполнения.
      </div>

      <ol className="dns-master-roadmap-track mt-3 space-y-2.5">
        {nodes.map((node) => {
          const style = STATE_STYLE[node.state];
          const isActive = node.stepId !== null && node.stepId === activeStepId;
          return (
            <li key={node.key} className={`dns-master-roadmap-node ${style.rail}`}>
              <span className={`dns-master-roadmap-badge ${style.badge}`}>{node.badge}</span>
              <div
                className={`rounded-xl border px-3 py-2.5 ${style.card} ${
                  isActive ? "ring-2 ring-[#FF6B00]" : ""
                }`}
              >
                <div className="flex items-baseline gap-1.5">
                  <span className="min-w-0 flex-1 truncate text-[12px] font-bold text-white">{node.title}</span>
                  {node.tone === "step" && (
                    <span className="flex-none text-[9px] font-semibold uppercase tracking-[0.14em] text-[#7d9bc9]">
                      шаг
                    </span>
                  )}
                </div>
                <ul className="mt-1 space-y-0.5">
                  {node.lines.map((line, lineIndex) => (
                    <li
                      key={`${node.key}-${lineIndex}`}
                      className="truncate text-[11px] leading-4 text-[#8aa2c4]"
                      title={line}
                    >
                      {line}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
