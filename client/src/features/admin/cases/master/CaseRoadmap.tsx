import type { SimCase } from "@shared/simulation-content";
import { buildRoadmapLayout, type NodeState, type RoadmapNode } from "./case-roadmap-layout";
import type { MasterStepId } from "./case-master-support";

/**
 * Дерево кейса — ветвящаяся схема всего кейса целиком: ствол этапов и шагов,
 * вправо от каждого шага — варианты ответа, от варианта — переход на тот шаг,
 * который он запускает.
 *
 * Незакрытые блоки уходят в тень, заполненные светятся. Активный этап мастера
 * подсвечен. Намеренно не кликабельно: это карта, а не навигация.
 */

const STATE_FILL: Record<NodeState, { fill: string; stroke: string; text: string; sub: string; opacity: number }> = {
  dim: { fill: "#0d1728", stroke: "#2b4568", text: "#6f8db5", sub: "#4d6d94", opacity: 0.55 },
  partial: { fill: "#2a1a10", stroke: "#FF6B00", text: "#ffd9bf", sub: "#ffb27a", opacity: 1 },
  bright: { fill: "#0f2a24", stroke: "#54d28c", text: "#dcfbee", sub: "#8ff5de", opacity: 1 },
};

const EDGE_COLOR = {
  trunk: "#4a9eff",
  branch: "#6fa0ff",
  jump: "#FF6B00",
  finish: "#54d28c",
} as const;

function NodeShapePath({ node, active }: { node: RoadmapNode; active: boolean }) {
  const style = STATE_FILL[node.state];
  const { x, y, width: w, height: h } = node;
  const stroke = active ? "#FF6B00" : style.stroke;
  const strokeWidth = active ? 2.5 : 1.5;
  const common = {
    fill: style.fill,
    stroke,
    strokeWidth,
    filter: node.state === "dim" ? undefined : "url(#roadmapGlow)",
  };

  if (node.shape === "option") {
    // Ромб — вариант ответа, как в схеме кейса на бумаге.
    const cx = x + w / 2;
    const cy = y + h / 2;
    return <polygon points={`${cx},${y} ${x + w},${cy} ${cx},${y + h} ${x},${cy}`} {...common} />;
  }
  if (node.shape === "step") {
    // Шаг — «дом»: скошенная кровля отличает точку ветвления от простого этапа.
    const notch = 12;
    return (
      <polygon
        points={`${x + notch},${y} ${x + w - notch},${y} ${x + w},${y + notch} ${x + w},${y + h} ${x},${y + h} ${x},${y + notch}`}
        {...common}
      />
    );
  }
  return <rect x={x} y={y} width={w} height={h} rx={node.shape === "finish" ? h / 2 : 8} {...common} />;
}

export function CaseRoadmap({
  caseInput,
  activeStepId,
}: {
  caseInput: SimCase;
  /** Активный этап мастера подсвечивается в дереве — но переход по клику не предусмотрен. */
  activeStepId: MasterStepId | null;
}) {
  const layout = buildRoadmapLayout(caseInput);

  return (
    <div className="dns-master-roadmap">
      <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#8aa2c4]">
        Дерево кейса
      </div>
      <div className="dns-master-hint mt-1">
        Кейс целиком. Тусклое — ещё не заполнено, яркое — готово.
      </div>

      <div className="dns-master-roadmap-canvas mt-3 overflow-x-auto">
        <svg
          width={layout.width}
          height={layout.height}
          viewBox={`0 0 ${layout.width} ${layout.height}`}
          role="img"
          aria-label="Схема кейса: этапы, шаги и переходы между ними"
          style={{ maxWidth: "none" }}
        >
          <defs>
            <filter id="roadmapGlow" x="-40%" y="-40%" width="180%" height="180%">
              <feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#4a9eff" floodOpacity="0.35" />
            </filter>
            <marker id="roadmapArrow" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
              <path d="M0,0 L7,3.5 L0,7 z" fill="currentColor" />
            </marker>
          </defs>

          {layout.edges.map((edge) => (
            <path
              key={edge.key}
              d={edge.path}
              fill="none"
              color={EDGE_COLOR[edge.kind]}
              stroke={EDGE_COLOR[edge.kind]}
              strokeWidth={edge.kind === "trunk" ? 2.5 : 1.5}
              strokeDasharray={edge.kind === "jump" ? "4 3" : undefined}
              opacity={edge.dimmed ? 0.3 : 0.85}
              markerEnd="url(#roadmapArrow)"
            />
          ))}

          {layout.nodes.map((node) => {
            const style = STATE_FILL[node.state];
            const active = node.stepId !== null && node.stepId === activeStepId;
            const isOption = node.shape === "option";
            return (
              <g key={node.key} opacity={style.opacity}>
                <NodeShapePath node={node} active={active} />
                <text
                  x={node.x + node.width / 2}
                  y={node.y + (isOption ? node.height / 2 + 3.5 : 17)}
                  textAnchor="middle"
                  fontSize={isOption ? 9 : 11}
                  fontWeight={700}
                  fill={style.text}
                >
                  {node.title}
                </text>
                {!isOption && (
                  <text
                    x={node.x + node.width / 2}
                    y={node.y + 31}
                    textAnchor="middle"
                    fontSize={9}
                    fill={style.sub}
                  >
                    {node.subtitle}
                  </text>
                )}
                {isOption && (
                  <text
                    x={node.x + node.width + 5}
                    y={node.y + node.height / 2 + 3}
                    fontSize={8}
                    fill={style.sub}
                  >
                    {node.subtitle}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
}
