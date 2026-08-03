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

/**
 * Дерево вертикальное с отступами: узлы идут сверху вниз, дети смещены вправо.
 * Раньше оно росло вправо четырьмя колонками — в узкой высокой панели такая схема
 * упирается в ширину и ужимается до нечитаемого (текст 8px превращался в 6px),
 * а больше половины высоты пустовало. Вертикальная раскладка расходует высоту,
 * которой много, и остаётся узкой.
 */
const NODE_H = 22;
const ROW_GAP = 4;
const INDENT = 15;
const CANVAS_W = 268;
const PAD = 6;
/** Минимальная ширина узла: даже самый глубокий уровень должен вмещать подпись. */
const MIN_NODE_W = 120;
/**
 * Схема обязана помещаться на экран целиком, без прокрутки. Значит высота
 * ограничена, и чем больше узлов, тем мельче текст. Дальше этого порога
 * варианты ответа сворачиваются в счётчик на своём шаге: структура кейса
 * остаётся видна, а подписи остаются читаемыми.
 */
const MAX_NODES_BEFORE_COMPACT = 34;

const flag = (filled: boolean): NodeState => (filled ? "bright" : "dim");

/** Состояние ветки собирается из листьев: пусто, частично или всё закрыто. */
function rollUp(children: NodeState[]): NodeState {
  if (children.length === 0) return "dim";
  if (children.every((state) => state === "bright")) return "bright";
  if (children.every((state) => state === "dim")) return "dim";
  return "partial";
}

function buildSeed(caseInput: SimCase, validationIssueCount: number, compactOptions: boolean): TreeSeed {
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
            const scoredCount = options.filter(
              (option) =>
                hasMeaningfulText(option.text) && Object.keys(option.competency_scores || {}).length > 0,
            ).length;

            if (compactOptions) {
              return {
                key: `decisions-cycle-${cycle.id || index}`,
                title: `Шаг ${cycle.cycle} · ответов ${options.length}`,
                state: options.length > 0 && scoredCount === options.length ? "bright" : options.length > 0 ? "partial" : "dim",
                stepId: "decisions" as MasterStepId,
              };
            }

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

/**
 * Родитель занимает свою строку, дети идут следом со сдвигом вправо.
 * Порядок сверху вниз совпадает с порядком чтения — это и делает схему
 * читаемой без масштабирования.
 */
function place(seed: TreeSeed, depth: number, cursor: { y: number }): PlacedNode {
  const x = PAD + depth * INDENT;
  const width = Math.max(MIN_NODE_W, CANVAS_W - x - PAD);

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

  node.children = (seed.children || []).map((child) => place(child, depth + 1, cursor));
  if (seed.state === undefined && node.children.length > 0) {
    node.state = rollUp(node.children.map((child) => child.state));
  }
  return node;
}

function countNodes(seed: TreeSeed): number {
  return 1 + (seed.children || []).reduce((sum, child) => sum + countNodes(child), 0);
}

export function buildRoadmapLayout(caseInput: SimCase, validationIssueCount = 0): RoadmapLayout {
  // Сначала пробуем показать всё. Если узлов слишком много, сворачиваем варианты —
  // иначе схема ужмётся до нечитаемой, а прокрутки у неё быть не должно.
  const full = buildSeed(caseInput, validationIssueCount, false);
  const seed = countNodes(full) > MAX_NODES_BEFORE_COMPACT
    ? buildSeed(caseInput, validationIssueCount, true)
    : full;

  const cursor = { y: PAD };
  const root = place(seed, 0, cursor);

  const nodes: RoadmapNode[] = [];
  const edges: RoadmapEdge[] = [];

  const walk = (node: PlacedNode) => {
    const { children, ...rest } = node;
    nodes.push(rest);
    children.forEach((child) => {
      // Уголок как в проводнике: вниз по стойке родителя, затем вбок к ребёнку.
      const railX = node.x + INDENT / 2;
      const fromY = node.y + node.height;
      const toY = child.y + child.height / 2;
      edges.push({
        key: `edge-${node.key}-${child.key}`,
        path: `M ${railX} ${fromY} L ${railX} ${toY} L ${child.x} ${toY}`,
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
