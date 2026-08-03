import type { SimCase } from "@shared/simulation-content";
import { hasMeaningfulText } from "@shared/case-validation";
import type { MasterStepId } from "./case-master-support";

/**
 * Раскладка дерева кейса. Чистая геометрия: строит иерархию «карточка → этапы →
 * подблоки → варианты» и раскладывает её слева направо.
 *
 * Дерево описывает мастер целиком, а не только пять этапов: у каждого этапа свои
 * подблоки, а шаги и варианты ответа автор добавляет сам — они появляются в дереве
 * по мере добавления.
 *
 * Размер холста считается по содержимому; вписывание в панель — задача рендера
 * (viewBox), поэтому полос прокрутки не возникает.
 */

/** Тень — то, чего автор ещё не закрыл. Свет — заполненное. */
export type NodeState = "dim" | "partial" | "bright";

interface TreeSeed {
  key: string;
  title: string;
  state?: NodeState;
  stepId: MasterStepId | null;
  children?: TreeSeed[];
}

export interface RoadmapNode {
  key: string;
  title: string;
  state: NodeState;
  stepId: MasterStepId | null;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface RoadmapEdge {
  key: string;
  path: string;
  dimmed: boolean;
}

export interface RoadmapLayout {
  nodes: RoadmapNode[];
  edges: RoadmapEdge[];
  width: number;
  height: number;
}

const NODE_H = 20;
const ROW_GAP = 6;
const COL_X = [6, 88, 196, 300];
const COL_W = [74, 100, 96, 92];
const PAD = 6;

const columnX = (depth: number) => COL_X[Math.min(depth, COL_X.length - 1)];
const columnW = (depth: number) => COL_W[Math.min(depth, COL_W.length - 1)];

const flag = (filled: boolean): NodeState => (filled ? "bright" : "dim");

/** Состояние ветки собирается из листьев: пусто, частично или всё закрыто. */
function rollUp(children: NodeState[]): NodeState {
  if (children.length === 0) return "dim";
  if (children.every((state) => state === "bright")) return "bright";
  if (children.every((state) => state === "dim")) return "dim";
  return "partial";
}

function buildSeed(caseInput: SimCase, validationIssueCount: number): TreeSeed {
  const cycles = [...(caseInput.cycles || [])].sort((a, b) => a.cycle - b.cycle);
  const competencyCount =
    (caseInput.primaryCompetencies || []).length + (caseInput.secondaryCompetencies || []).length;

  const intent: TreeSeed = {
    key: "intent",
    title: "1 · Замысел",
    stepId: "intent",
    children: [
      { key: "intent-title", title: "Название", state: flag(hasMeaningfulText(caseInput.title)), stepId: "intent" },
      { key: "intent-desc", title: "Описание", state: flag(hasMeaningfulText(caseInput.description)), stepId: "intent" },
      { key: "intent-problem", title: "Бизнес-проблема", state: flag(hasMeaningfulText(caseInput.businessProblem)), stepId: "intent" },
      { key: "intent-comp", title: `Компетенции · ${competencyCount}`, state: flag(competencyCount > 0), stepId: "intent" },
    ],
  };

  const situation: TreeSeed = {
    key: "situation",
    title: "2 · Ситуация",
    stepId: "situation",
    children: [
      { key: "sit-signal", title: "Сигнал", state: flag(hasMeaningfulText(caseInput.trigger?.text) && hasMeaningfulText(caseInput.trigger?.source)), stepId: "situation" },
      { key: "sit-zones", title: `Зоны · ${(caseInput.zones_affected || []).length}`, state: flag((caseInput.zones_affected || []).length > 0), stepId: "situation" },
      { key: "sit-cause", title: "Скрытая причина", state: flag(hasMeaningfulText(caseInput.hiddenCause)), stepId: "situation" },
      { key: "sit-data", title: `Данные · ${(caseInput.dataPoints || []).length}`, state: flag((caseInput.dataPoints || []).length > 0), stepId: "situation" },
      { key: "sit-trails", title: `Ложные следы · ${(caseInput.falseTrails || []).length}`, state: flag((caseInput.falseTrails || []).length > 0), stepId: "situation" },
    ],
  };

  // Шаги добавляет автор — сколько добавил, столько веток и появится.
  const structure: TreeSeed = {
    key: "structure",
    title: "3 · Структура",
    stepId: "structure",
    children:
      cycles.length === 0
        ? [{ key: "structure-empty", title: "Шагов нет", state: "dim", stepId: "structure" }]
        : cycles.map((cycle, index) => ({
            key: `structure-cycle-${cycle.id || index}`,
            title: cycle.title?.trim() || `Шаг ${cycle.cycle}`,
            state: flag(hasMeaningfulText(cycle.situation) && hasMeaningfulText(cycle.signal?.content)),
            stepId: "structure",
          })),
  };

  // Варианты ответа тоже добавляет автор: третий уровень дерева.
  const decisions: TreeSeed = {
    key: "decisions",
    title: "4 · Решения",
    stepId: "decisions",
    children:
      cycles.length === 0
        ? [{ key: "decisions-empty", title: "Вариантов нет", state: "dim", stepId: "decisions" }]
        : cycles.map((cycle, index) => {
            const options = (cycle.options || []).filter((option) => (option.status || "active") === "active");
            return {
              key: `decisions-cycle-${cycle.id || index}`,
              title: `Шаг ${cycle.cycle} · ${options.length}`,
              stepId: "decisions",
              children:
                options.length === 0
                  ? [{ key: `decisions-cycle-${cycle.id || index}-empty`, title: "нет ответов", state: "dim" as NodeState, stepId: "decisions" as MasterStepId }]
                  : options.map((option, optionIndex) => {
                      const target = option.nextCycleId;
                      const targetCycle = target && target !== "__complete"
                        ? cycles.find((item) => item.id === target)
                        : undefined;
                      const where = target === "__complete"
                        ? " → финал"
                        : targetCycle
                          ? ` → ш${targetCycle.cycle}`
                          : target
                            ? " → обрыв"
                            : "";
                      const scored = Object.keys(option.competency_scores || {}).length > 0;
                      return {
                        key: `decisions-option-${cycle.id || index}-${option.id || optionIndex}`,
                        title: `${hasMeaningfulText(option.text) ? option.text : `ответ ${optionIndex + 1}`}${where}`,
                        state: flag(hasMeaningfulText(option.text) && scored),
                        stepId: "decisions" as MasterStepId,
                      };
                    }),
            };
          }),
  };

  const launch: TreeSeed = {
    key: "launch",
    title: "5 · Запуск",
    stepId: "launch",
    children: [
      { key: "launch-media", title: "Медиа", state: flag(Boolean(caseInput.imageAssetId || caseInput.audioAssetId)), stepId: "launch" },
      { key: "launch-timing", title: "Тайминги", state: flag(Boolean(caseInput.timing?.decisionDeadlineSeconds)), stepId: "launch" },
      { key: "launch-order", title: `Порядок · ${caseInput.sortOrder ?? 0}`, state: "bright", stepId: "launch" },
      { key: "launch-qa", title: validationIssueCount > 0 ? `Автопроверка · ${validationIssueCount}` : "Автопроверка чиста", state: validationIssueCount > 0 ? "partial" : "bright", stepId: "launch" },
    ],
  };

  return {
    key: "root",
    title: caseInput.title?.trim() || "Новый кейс",
    stepId: null,
    children: [intent, situation, structure, decisions, launch],
  };
}

interface PlacedNode extends RoadmapNode {
  children: PlacedNode[];
}

/** Аккуратное дерево: лист занимает свою строку, родитель встаёт по центру детей. */
function place(seed: TreeSeed, depth: number, cursor: { y: number }): PlacedNode {
  const width = columnW(depth);
  const x = columnX(depth);

  if (!seed.children || seed.children.length === 0) {
    const node: PlacedNode = {
      key: seed.key,
      title: seed.title,
      state: seed.state ?? "dim",
      stepId: seed.stepId,
      depth,
      x,
      y: cursor.y,
      width,
      height: NODE_H,
      children: [],
    };
    cursor.y += NODE_H + ROW_GAP;
    return node;
  }

  const children = seed.children.map((child) => place(child, depth + 1, cursor));
  const first = children[0];
  const last = children[children.length - 1];
  const centerY = (first.y + last.y + last.height) / 2 - NODE_H / 2;

  return {
    key: seed.key,
    title: seed.title,
    state: seed.state ?? rollUp(children.map((child) => child.state)),
    stepId: seed.stepId,
    depth,
    x,
    y: centerY,
    width,
    height: NODE_H,
    children,
  };
}

export function buildRoadmapLayout(caseInput: SimCase, validationIssueCount = 0): RoadmapLayout {
  const cursor = { y: PAD };
  const root = place(buildSeed(caseInput, validationIssueCount), 0, cursor);

  const nodes: RoadmapNode[] = [];
  const edges: RoadmapEdge[] = [];

  const walk = (node: PlacedNode) => {
    const { children, ...rest } = node;
    nodes.push(rest);
    children.forEach((child) => {
      const fromX = node.x + node.width;
      const fromY = node.y + node.height / 2;
      const toX = child.x;
      const toY = child.y + child.height / 2;
      const bend = fromX + (toX - fromX) / 2;
      edges.push({
        key: `edge-${node.key}-${child.key}`,
        path: `M ${fromX} ${fromY} C ${bend} ${fromY}, ${bend} ${toY}, ${toX} ${toY}`,
        dimmed: child.state === "dim",
      });
      walk(child);
    });
  };
  walk(root);

  const width = Math.max(...nodes.map((node) => node.x + node.width)) + PAD;
  const height = cursor.y + PAD;
  return { nodes, edges, width, height };
}
