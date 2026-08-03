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

const STATE_STYLE: Record<RoadmapNode["state"], { badge: string; card: string }> = {
  empty: {
    badge: "border-[#3b5878] bg-[#0d1522] text-[#7d9bc9]",
    card: "border-[#243244] bg-[#0d1522]/70",
  },
  partial: {
    badge: "border-[#ffb27a] bg-[#FF6B00]/20 text-[#ffb27a]",
    card: "border-[#ffb27a]/35 bg-[#FF6B00]/8",
  },
  filled: {
    badge: "border-[#54d28c] bg-[#54d28c]/15 text-[#54d28c]",
    card: "border-[#54d28c]/30 bg-[#101826]/70",
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

      <ol className="relative mt-3 space-y-2">
        {/* Линия маршрута за кружками — она и делает список дорожной картой. */}
        <span
          aria-hidden="true"
          className="absolute bottom-3 left-[13px] top-3 w-px bg-gradient-to-b from-[#3b5878] via-[#3b5878] to-transparent"
        />
        {nodes.map((node) => {
          const style = STATE_STYLE[node.state];
          const isActive = node.stepId !== null && node.stepId === activeStepId;
          return (
            <li key={node.key} className="relative flex gap-2.5">
              <span
                className={`z-10 mt-0.5 flex h-[27px] w-[27px] flex-none items-center justify-center rounded-full border text-[11px] font-bold ${style.badge}`}
              >
                {node.badge}
              </span>
              <div
                className={`min-w-0 flex-1 rounded-lg border px-2.5 py-2 ${style.card} ${
                  isActive ? "ring-1 ring-[#FF6B00]" : ""
                }`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="min-w-0 truncate text-[12px] font-semibold text-white">{node.title}</span>
                  {node.tone === "step" && (
                    <span className="flex-none text-[9px] uppercase tracking-[0.12em] text-[#7d9bc9]">шаг</span>
                  )}
                </div>
                {node.lines.map((line, lineIndex) => (
                  <div
                    key={`${node.key}-${lineIndex}`}
                    className="mt-0.5 truncate text-[11px] leading-4 text-[#8aa2c4]"
                    title={line}
                  >
                    {line}
                  </div>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
