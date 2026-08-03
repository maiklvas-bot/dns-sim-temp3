import { useMemo, useState } from "react";
import type { SimCase } from "@shared/simulation-content";
import { validateCase } from "@shared/case-validation";
import { buildRoadmapLayout, type NodeState, type RoadmapNode } from "./case-roadmap-layout";
import type { MasterStepId } from "./case-master-support";

/**
 * Дерево кейса — мастер целиком: карточка, пять этапов, подблоки каждого этапа
 * и добавленные автором элементы. Наборы свёрнуты под «+», раскрывает их автор.
 *
 * Незакрытое уходит в тень, заполненное светится, активный этап подсвечен.
 * Вписывается в панель через viewBox, поэтому полос прокрутки нет.
 *
 * Единственное действие — раскрыть или свернуть набор. Переходов по клику нет:
 * это карта, а не навигация.
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
  const [expandedKeys, setExpandedKeys] = useState<string[]>([]);
  const [hovered, setHovered] = useState<{ node: RoadmapNode; x: number; y: number } | null>(null);

  const layout = useMemo(() => {
    const issues = validateCase(caseInput);
    return buildRoadmapLayout(caseInput, issues.length, expandedKeys);
  }, [caseInput, expandedKeys]);

  const toggle = (key: string) => {
    setExpandedKeys((keys) => (keys.includes(key) ? keys.filter((item) => item !== key) : [...keys, key]));
  };

  return (
    <div className="dns-master-roadmap flex h-full min-h-0 flex-col">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">
        Дерево кейса
      </div>
      <div className="dns-master-hint mt-1">
        Мастер целиком. «+» раскрывает набор, наведение объясняет блок.
      </div>

      {/* Холст вписывается в панель: viewBox масштабирует схему, прокрутки не появляется. */}
      <div
        className="dns-master-roadmap-canvas relative mt-2 min-h-0 flex-1 overflow-hidden"
        onMouseLeave={() => setHovered(null)}
      >
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          preserveAspectRatio="xMinYMin meet"
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
            const fontSize = node.depth === 0 ? 12 : node.depth === 1 ? 11 : 10;
            const togglable = node.hasChildren && node.depth > 0;
            const textX = node.x + (togglable ? 20 : 7);
            return (
              <g
                key={node.key}
                opacity={style.opacity}
                onMouseEnter={(event) =>
                  setHovered({
                    node,
                    x: event.nativeEvent.offsetX,
                    y: event.nativeEvent.offsetY,
                  })
                }
              >
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

                {togglable && (
                  /* Единственное действие в дереве: раскрыть или свернуть набор. */
                  <g
                    className="cursor-pointer"
                    onClick={() => toggle(node.key)}
                    role="button"
                    tabIndex={0}
                    aria-label={`${node.collapsed ? "Раскрыть" : "Свернуть"} ${node.title}`}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") toggle(node.key);
                    }}
                  >
                    <rect
                      x={node.x + 4}
                      y={node.y + 5}
                      width={12}
                      height={12}
                      rx={3}
                      fill="#0d1728"
                      stroke={style.stroke}
                      strokeWidth={1}
                    />
                    <path
                      d={
                        node.collapsed
                          ? `M ${node.x + 10} ${node.y + 8} L ${node.x + 10} ${node.y + 14} M ${node.x + 7} ${node.y + 11} L ${node.x + 13} ${node.y + 11}`
                          : `M ${node.x + 7} ${node.y + 11} L ${node.x + 13} ${node.y + 11}`
                      }
                      stroke={style.text}
                      strokeWidth={1.6}
                      strokeLinecap="round"
                    />
                  </g>
                )}

                <text
                  x={textX}
                  y={node.y + node.height / 2 + fontSize / 3}
                  fontSize={fontSize}
                  fontWeight={node.depth <= 1 ? 700 : 500}
                  fill={style.text}
                >
                  {clipToWidth(node.title, node.width - (textX - node.x), fontSize)}
                </text>
              </g>
            );
          })}
        </svg>

        {hovered && (
          <div
            className="pointer-events-none absolute z-30 w-[16rem] rounded-lg border border-[#3b5878] bg-[#101826] p-2.5 shadow-[0_14px_36px_rgba(0,0,0,0.5)]"
            style={{
              left: Math.min(hovered.x + 12, 40),
              top: hovered.y + 16,
            }}
          >
            <div className="text-[11px] font-bold text-white">{hovered.node.title}</div>
            <div className="mt-1 text-[11px] leading-relaxed text-[#b8c7df]">{hovered.node.hint}</div>
            {hovered.node.hasChildren && (
              <div className="mt-1.5 text-[10px] text-[#8ec5ff]">
                {hovered.node.collapsed
                  ? `Внутри элементов: ${hovered.node.childCount}. Нажмите «+», чтобы раскрыть.`
                  : `Раскрыто, элементов: ${hovered.node.childCount}.`}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
