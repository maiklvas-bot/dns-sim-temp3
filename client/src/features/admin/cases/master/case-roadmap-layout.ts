import type { SimCase } from "@shared/simulation-content";
import { hasMeaningfulText } from "@shared/case-validation";
import { signalTypeLabel, type MasterStepId } from "./case-master-support";

/**
 * Раскладка дерева кейса. Чистая геометрия — считает координаты узлов и рёбер,
 * рисование отдельно. Дерево ветвящееся: по стволу идут этапы и шаги, вправо от
 * каждого шага отходят варианты ответа, а от варианта — ребро на тот шаг, который
 * он запускает.
 */

export type NodeShape = "stage" | "step" | "option" | "finish";
/** Тень — то, чего автор ещё не закрыл. Свет — заполненное. */
export type NodeState = "dim" | "partial" | "bright";

export interface RoadmapNode {
  key: string;
  shape: NodeShape;
  state: NodeState;
  /** Этап мастера, которому принадлежит узел: по нему подсвечивается активный. */
  stepId: MasterStepId | null;
  title: string;
  subtitle: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoadmapEdge {
  key: string;
  path: string;
  /** Возврат на другой шаг рисуется иначе, чем спуск по стволу. */
  kind: "trunk" | "branch" | "jump" | "finish";
  dimmed: boolean;
}

export interface RoadmapLayout {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  width: number;
  height: number;
}

const PAD = 8;
const TRUNK_W = 148;
const TRUNK_X = PAD;
const TRUNK_CX = TRUNK_X + TRUNK_W / 2;
const STAGE_H = 42;
const STEP_H = 46;
const OPT_W = 104;
const OPT_H = 28;
const OPT_X = TRUNK_X + TRUNK_W + 26;
const OPT_CX = OPT_X + OPT_W / 2;
const ROW_GAP = 18;
const OPT_GAP = 8;

function clip(text: string, limit: number): string {
  const value = (text || "").trim();
  if (value.length <= limit) return value;
  return `${value.slice(0, Math.max(0, limit - 1))}…`;
}

export function buildRoadmapLayout(caseInput: SimCase): RoadmapLayout {
  const cycles = [...(caseInput.cycles || [])].sort((a, b) => a.cycle - b.cycle);
  const cycleIndexById = new Map<string, number>();
  cycles.forEach((cycle, index) => {
    if (cycle.id) cycleIndexById.set(cycle.id, index);
  });

  const nodes: RoadmapNode[] = [];
  const edges: RoadmapEdge[] = [];
  let cursorY = PAD;
  let maxX = OPT_X + OPT_W;

  const competencyCount =
    (caseInput.primaryCompetencies || []).length + (caseInput.secondaryCompetencies || []).length;
  const intentReady = hasMeaningfulText(caseInput.title) && competencyCount > 0;
  const situationReady =
    hasMeaningfulText(caseInput.trigger?.text) && hasMeaningfulText(caseInput.hiddenCause);

  const pushTrunk = (node: Omit<RoadmapNode, "x" | "y" | "width" | "height">, height: number) => {
    const placed: RoadmapNode = { ...node, x: TRUNK_X, y: cursorY, width: TRUNK_W, height };
    nodes.push(placed);
    return placed;
  };

  const intent = pushTrunk(
    {
      key: "intent",
      shape: "stage",
      state: intentReady ? "bright" : "dim",
      stepId: "intent",
      title: "1 · Замысел",
      subtitle: hasMeaningfulText(caseInput.title) ? clip(caseInput.title, 20) : "название не задано",
    },
    STAGE_H,
  );
  cursorY += STAGE_H + ROW_GAP;

  const situation = pushTrunk(
    {
      key: "situation",
      shape: "stage",
      state: situationReady ? "bright" : hasMeaningfulText(caseInput.trigger?.text) ? "partial" : "dim",
      stepId: "situation",
      title: "2 · Ситуация",
      subtitle: hasMeaningfulText(caseInput.trigger?.text)
        ? clip(signalTypeLabel(caseInput.trigger?.type), 20)
        : "сигнал не описан",
    },
    STAGE_H,
  );
  cursorY += STAGE_H + ROW_GAP;

  edges.push({
    key: "trunk-intent-situation",
    path: `M ${TRUNK_CX} ${intent.y + intent.height} L ${TRUNK_CX} ${situation.y}`,
    kind: "trunk",
    dimmed: !intentReady,
  });

  const stepNodes: RoadmapNode[] = [];
  let previous: RoadmapNode = situation;

  cycles.forEach((cycle, index) => {
    const options = (cycle.options || []).filter((option) => (option.status || "active") === "active");
    const described = hasMeaningfulText(cycle.situation);
    const branchHeight = options.length * OPT_H + Math.max(0, options.length - 1) * OPT_GAP;
    const rowHeight = Math.max(STEP_H, branchHeight);

    const step: RoadmapNode = {
      key: `step-${cycle.id || index}`,
      shape: "step",
      state: described && options.length > 0 ? "bright" : described || options.length > 0 ? "partial" : "dim",
      stepId: "structure",
      title: `Шаг ${cycle.cycle}`,
      subtitle: described ? clip(cycle.situation, 20) : "шаг не описан",
      x: TRUNK_X,
      y: cursorY + (rowHeight - STEP_H) / 2,
      width: TRUNK_W,
      height: STEP_H,
    };
    nodes.push(step);
    stepNodes.push(step);

    edges.push({
      key: `trunk-${previous.key}-${step.key}`,
      path: `M ${TRUNK_CX} ${previous.y + previous.height} L ${TRUNK_CX} ${step.y}`,
      kind: "trunk",
      dimmed: previous.state === "dim",
    });

    // Варианты ответа отходят вправо от шага — это и есть ветвление.
    options.forEach((option, optionIndex) => {
      const optionY = cursorY + (rowHeight - branchHeight) / 2 + optionIndex * (OPT_H + OPT_GAP);
      const target = option.nextCycleId;
      const targetIndex = target && target !== "__complete" ? cycleIndexById.get(target) : undefined;
      const hasText = hasMeaningfulText(option.text);

      const optionNode: RoadmapNode = {
        key: `${step.key}-option-${option.id || optionIndex}`,
        shape: "option",
        state: hasText ? "bright" : "dim",
        stepId: "decisions",
        title: hasText ? clip(option.text, 16) : `ответ ${optionIndex + 1}`,
        subtitle:
          target === "__complete"
            ? "финал"
            : targetIndex !== undefined
              ? `шаг ${cycles[targetIndex].cycle}`
              : target
                ? "обрыв"
                : "далее",
        x: OPT_X,
        y: optionY,
        width: OPT_W,
        height: OPT_H,
      };
      nodes.push(optionNode);
      maxX = Math.max(maxX, OPT_X + OPT_W);

      const stepRight = step.x + step.width;
      const stepMidY = step.y + step.height / 2;
      const optionMidY = optionY + OPT_H / 2;
      edges.push({
        key: `branch-${optionNode.key}`,
        path: `M ${stepRight} ${stepMidY} C ${stepRight + 14} ${stepMidY}, ${OPT_X - 14} ${optionMidY}, ${OPT_X} ${optionMidY}`,
        kind: "branch",
        dimmed: !hasText,
      });
    });

    cursorY += rowHeight + ROW_GAP;
    previous = step;
  });

  const finish = pushTrunk(
    {
      key: "finish",
      shape: "finish",
      state: "bright",
      stepId: null,
      title: "Финал кейса",
      subtitle: "оценка компетенций",
    },
    STAGE_H,
  );
  edges.push({
    key: `trunk-${previous.key}-finish`,
    path: `M ${TRUNK_CX} ${previous.y + previous.height} L ${TRUNK_CX} ${finish.y}`,
    kind: "trunk",
    dimmed: previous.state === "dim",
  });
  cursorY += STAGE_H + PAD;

  // Переходы: от варианта — к шагу, который он запускает, или к финалу.
  // Рисуются последними, потому что им нужны координаты всех шагов.
  cycles.forEach((cycle, index) => {
    const options = (cycle.options || []).filter((option) => (option.status || "active") === "active");
    options.forEach((option, optionIndex) => {
      const target = option.nextCycleId;
      if (!target) return;
      const source = nodes.find(
        (node) => node.key === `step-${cycle.id || index}-option-${option.id || optionIndex}`,
      );
      if (!source) return;

      const targetNode =
        target === "__complete"
          ? finish
          : (() => {
              const targetIndex = cycleIndexById.get(target);
              return targetIndex === undefined ? null : stepNodes[targetIndex];
            })();
      if (!targetNode) return;

      const fromX = source.x + source.width;
      const fromY = source.y + source.height / 2;
      const toX = targetNode.x + targetNode.width;
      const toY = targetNode.y + targetNode.height / 2;
      const sweep = maxX + 16;
      maxX = Math.max(maxX, sweep);
      edges.push({
        key: `jump-${source.key}`,
        path: `M ${fromX} ${fromY} C ${sweep} ${fromY}, ${sweep} ${toY}, ${toX} ${toY}`,
        kind: target === "__complete" ? "finish" : "jump",
        dimmed: source.state === "dim",
      });
    });
  });

  return { nodes, edges, width: maxX + PAD, height: cursorY };
}
