import { useMemo } from "react";
import type { SimCase } from "@shared/simulation-content";
import { validateCase } from "@shared/case-validation";
import { buildRoadmapLayout, type NodeState } from "./case-roadmap-layout";
import type { MasterStepId } from "./case-master-support";

/**
 * Дерево кейса — мастер целиком: карточка, пять этапов, подблоки каждого этапа
 * и добавленные автором шаги с вариантами ответа.
 *
 * Незакрытое уходит в тень, заполненное светится, активный этап подсвечен.
 * Вписывается в панель через viewBox, поэтому полос прокрутки нет.
 * Намеренно не кликабельно: это карта, а не навигация.
 */

const STATE_STYLE: Record<NodeState, { fill: string; stroke: string; text: string; opacity: number }> = {
  dim: { fill: "#0d1728", stroke: "#2b4568", text: "#6f8db5", opacity: 0.5 },
  partial: { fill: "#2a1a10", stroke: "#FF6B00", text: "#ffd9bf", opacity: 1 },
  bright: { fill: "#0f2a24", stroke: "#54d28c", text: "#c8f5e2", opacity: 1 },
};

/** Длина строки в узле зависит от его ширины: обрезаем, чтобы текст не выезжал. */
function clipToWidth(text: string, width: number, fontSize: number): string {
  const perChar = fontSize * 0.55;
  const limit = Math.max(3, Math.floor((width - 8) / perChar));
  const value = (text || "").trim();
  return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

export function CaseRoadmap({
  caseInput,
  activeStepId,
}: {
  caseInput: SimCase;
  /** Активный этап мастера подсвечивается в дереве — но переход по клику не предусмотрен. */
  activeStepId: MasterStepId | null;
}) {
  const layout = useMemo(() => {
    const issues = validateCase(caseInput);
    return buildRoadmapLayout(caseInput, issues.length);
  }, [caseInput]);

  return (
    <div className="dns-master-roadmap flex h-full min-h-0 flex-col">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">
        Дерево кейса
      </div>
      <div className="dns-master-hint mt-1">
        Мастер целиком. Тусклое — не заполнено, яркое — готово.
      </div>

      {/* Холст вписывается в панель: viewBox масштабирует схему, прокрутки не появляется. */}
      <div className="dns-master-roadmap-canvas mt-2 min-h-0 flex-1 overflow-hidden">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMidYMin meet"
          role="img"
          aria-label="Дерево кейса: этапы мастера, их подблоки, шаги и варианты ответа"
        >
          {layout.edges.map((edge) => (
            <path
              key={edge.key}
              d={edge.path}
              fill="none"
              stroke="#4a9eff"
              strokeWidth={1.2}
              opacity={edge.dimmed ? 0.25 : 0.7}
            />
          ))}

          {layout.nodes.map((node) => {
            const style = STATE_STYLE[node.state];
            const active = node.stepId !== null && node.stepId === activeStepId;
            const fontSize = node.depth <= 1 ? 9 : 8;
            return (
              <g key={node.key} opacity={style.opacity}>
                <rect
                  x={node.x}
                  y={node.y}
                  width={node.width}
                  height={node.height}
                  rx={node.depth === 0 ? node.height / 2 : 5}
                  fill={style.fill}
                  stroke={active ? "#FF6B00" : style.stroke}
                  strokeWidth={active ? 2 : 1}
                />
                <text
                  x={node.x + node.width / 2}
                  y={node.y + node.height / 2 + fontSize / 3}
                  textAnchor="middle"
                  fontSize={fontSize}
                  fontWeight={node.depth <= 1 ? 700 : 500}
                  fill={style.text}
                >
                  {clipToWidth(node.title, node.width, fontSize)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
