import type { SimCase } from "@shared/simulation-content";
import { hasMeaningfulText } from "@shared/case-validation";
import type { MasterStepId } from "./case-master-support";

/**
 * Раскладка дерева кейса. Чистая геометрия: строит иерархию «карточка → этапы →
 * подблоки → добавленные автором элементы» и раскладывает её сверху вниз.
 *
 * Дерево вертикальное с отступами: узел на строку, вложенность показана сдвигом.
 * Горизонтальная раскладка упиралась в ширину узкой панели и ужимала текст.
 *
 * Наборы (зоны, данные, ложные следы, шаги, варианты ответа) свёрнуты: узел
 * показывает, сколько в нём элементов, а раскрыть их — решение автора.
 */

/** Тень — то, чего автор ещё не закрыл. Свет — заполненное. */
export type NodeState = "dim" | "partial" | "bright";

interface TreeSeed {
  key: string;
  title: string;
  /** Что за блок и что в нём — текст всплывающей подсказки. */
  hint: string;
  state?: NodeState;
  stepId: MasterStepId | null;
  children?: TreeSeed[];
  /** Набор раскрывается по желанию автора; этапы и карточка открыты сразу. */
  collapsedByDefault?: boolean;
}

export interface RoadmapNode {
  key: string;
  title: string;
  hint: string;
  state: NodeState;
  stepId: MasterStepId | null;
  depth: number;
  x: number;
  y: number;
  width: number;
  height: number;
  hasChildren: boolean;
  collapsed: boolean;
  childCount: number;
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

const NODE_H = 22;
const ROW_GAP = 4;
const INDENT = 15;
const CANVAS_W = 268;
const PAD = 6;
/** Минимальная ширина узла: даже самый глубокий уровень должен вмещать подпись. */
const MIN_NODE_W = 120;

const flag = (filled: boolean): NodeState => (filled ? "bright" : "dim");

/** Состояние ветки собирается из листьев: пусто, частично или всё закрыто. */
function rollUp(children: NodeState[]): NodeState {
  if (children.length === 0) return "dim";
  if (children.every((state) => state === "bright")) return "bright";
  if (children.every((state) => state === "dim")) return "dim";
  return "partial";
}

/** Свёрнутый набор: заголовок со счётчиком, элементы внутри. */
function collection(
  key: string,
  label: string,
  hint: string,
  stepId: MasterStepId,
  items: Array<{ key: string; title: string; hint: string; state: NodeState }>,
): TreeSeed {
  return {
    key,
    title: `${label} · ${items.length}`,
    hint: items.length > 0 ? `${hint} Сейчас: ${items.length}. Раскройте, чтобы увидеть список.` : `${hint} Пока пусто.`,
    state: items.length === 0 ? "dim" : rollUp(items.map((item) => item.state)),
    stepId,
    collapsedByDefault: true,
    children: items.map((item) => ({ ...item, stepId })),
  };
}

function buildSeed(caseInput: SimCase, validationIssueCount: number): TreeSeed {
  const cycles = [...(caseInput.cycles || [])].sort((a, b) => a.cycle - b.cycle);
  const competencyIds = [
    ...(caseInput.primaryCompetencies || []).map((id) => ({ id, role: "первичная" })),
    ...(caseInput.secondaryCompetencies || []).map((id) => ({ id, role: "вторичная" })),
  ];

  const intent: TreeSeed = {
    key: "intent",
    title: "1 · Замысел",
    hint: "Зачем кейс существует и что проверяет. Содержит название, описание, бизнес-проблему и разметку компетенций.",
    stepId: "intent",
    children: [
      { key: "intent-title", title: "Название", hint: "Как ситуация называется между собой в магазине. По названию кейс находится в списке.", state: flag(hasMeaningfulText(caseInput.title)), stepId: "intent" },
      { key: "intent-desc", title: "Описание", hint: "Что происходит в подразделении. Служебный текст: его видит оценщик, участник — нет.", state: flag(hasMeaningfulText(caseInput.description)), stepId: "intent" },
      { key: "intent-problem", title: "Бизнес-проблема", hint: "Чем ситуация вредит магазину, если её решают плохо. Отсюда берётся смысл оценки.", state: flag(hasMeaningfulText(caseInput.businessProblem)), stepId: "intent" },
      collection(
        "intent-comp",
        "Компетенции",
        "Какие качества проверяет кейс: первичные дают основной вес в оценке, вторичные — дополнительный.",
        "intent",
        competencyIds.map((item, index) => ({
          key: `intent-comp-${item.id || index}`,
          title: `${item.id} · ${item.role}`,
          hint: `Компетенция «${item.id}», роль в кейсе — ${item.role}.`,
          state: "bright" as NodeState,
        })),
      ),
    ],
  };

  const situation: TreeSeed = {
    key: "situation",
    title: "2 · Ситуация",
    hint: "Что видит участник и что от него скрыто. Содержит сигнал, зоны магазина, скрытую причину, данные для запроса и ложные следы.",
    stepId: "situation",
    children: [
      { key: "sit-signal", title: "Сигнал", hint: "Первое, что получит участник: источник, тип и текст. Здесь только симптом — причину он должен найти сам.", state: flag(hasMeaningfulText(caseInput.trigger?.text) && hasMeaningfulText(caseInput.trigger?.source)), stepId: "situation" },
      collection(
        "sit-zones",
        "Зоны",
        "Зоны магазина, которых касается ситуация.",
        "situation",
        (caseInput.zones_affected || []).map((zone, index) => ({
          key: `sit-zone-${zone || index}`,
          title: String(zone),
          hint: `Зона магазина «${zone}» затронута ситуацией.`,
          state: "bright" as NodeState,
        })),
      ),
      { key: "sit-cause", title: "Скрытая причина", hint: "Настоящая причина за симптомом. Участник её не видит и должен догадаться сам.", state: flag(hasMeaningfulText(caseInput.hiddenCause)), stepId: "situation" },
      collection(
        "sit-data",
        "Данные",
        "Что участник может запросить, чтобы проверить догадку. У каждого запроса своя цена: минуты, отвлечённый сотрудник, испорченные отношения.",
        "situation",
        (caseInput.dataPoints || []).map((point, index) => ({
          key: `sit-data-${index}`,
          title: hasMeaningfulText(point?.label) ? point.label : `запись ${index + 1}`,
          hint: hasMeaningfulText(point?.label)
            ? `Данные для запроса: «${point.label}»${point?.costToRequest ? `. Цена: ${point.costToRequest}` : ""}`
            : "Запись без названия — участнику нечего запрашивать.",
          state: flag(hasMeaningfulText(point?.label)),
        })),
      ),
      collection(
        "sit-trails",
        "Ложные следы",
        "Правдоподобные, но неверные объяснения ситуации. Не дают взять верный ответ с первого взгляда.",
        "situation",
        (caseInput.falseTrails || []).map((trail, index) => ({
          key: `sit-trail-${index}`,
          title: hasMeaningfulText(trail) ? trail : `след ${index + 1}`,
          hint: hasMeaningfulText(trail)
            ? `Ложный след: «${trail}»`
            : "След без текста — участник его не увидит.",
          state: flag(hasMeaningfulText(trail)),
        })),
      ),
    ],
  };

  const structure: TreeSeed = {
    key: "structure",
    title: "3 · Структура",
    hint: "Как кейс разворачивается: сколько шагов и куда ведут ответы. Шаги добавляет автор.",
    stepId: "structure",
    children: [
      collection(
        "structure-cycles",
        "Шаги",
        "Шаги кейса в порядке прохождения. Каждый — своя обстановка и свой сигнал.",
        "structure",
        cycles.map((cycle, index) => ({
          key: `structure-cycle-${cycle.id || index}`,
          title: cycle.title?.trim() || `Шаг ${cycle.cycle}`,
          hint: hasMeaningfulText(cycle.situation)
            ? `Шаг ${cycle.cycle}: ${cycle.situation}`
            : `Шаг ${cycle.cycle} без описания — участнику нечего показать.`,
          state: flag(hasMeaningfulText(cycle.situation) && hasMeaningfulText(cycle.signal?.content)),
        })),
      ),
    ],
  };

  const decisions: TreeSeed = {
    key: "decisions",
    title: "4 · Решения",
    hint: "Что может сделать участник. У каждого варианта свой уровень проявления компетенций, эффекты на магазин и переход на следующий шаг.",
    stepId: "decisions",
    children:
      cycles.length === 0
        ? [{ key: "decisions-empty", title: "Шагов нет", hint: "Сначала добавьте шаг на этапе «Структура».", state: "dim", stepId: "decisions" }]
        : cycles.map((cycle, index) => {
            const options = (cycle.options || []).filter((option) => (option.status || "active") === "active");
            return collection(
              `decisions-cycle-${cycle.id || index}`,
              `Шаг ${cycle.cycle} · ответы`,
              `Варианты ответа шага ${cycle.cycle}.`,
              "decisions",
              options.map((option, optionIndex) => {
                const target = option.nextCycleId;
                const targetCycle =
                  target && target !== "__complete" ? cycles.find((item) => item.id === target) : undefined;
                const where =
                  target === "__complete"
                    ? " → финал"
                    : targetCycle
                      ? ` → ш${targetCycle.cycle}`
                      : target
                        ? " → обрыв"
                        : "";
                const scored = Object.keys(option.competency_scores || {}).length > 0;
                const text = hasMeaningfulText(option.text) ? option.text : `ответ ${optionIndex + 1}`;
                return {
                  key: `decisions-option-${cycle.id || index}-${option.id || optionIndex}`,
                  title: `${text}${where}`,
                  hint: `Вариант «${text}». ${scored ? "Уровни компетенций выставлены" : "Уровни компетенций не выставлены — вариант ничего не измеряет"}.${
                    target === "__complete"
                      ? " После ответа кейс завершается."
                      : targetCycle
                        ? ` После ответа запускается шаг ${targetCycle.cycle}.`
                        : target
                          ? " Переход ведёт на шаг, которого нет — ветка обрывается."
                          : " Переход не задан: кейс идёт дальше по порядку."
                  }`,
                  state: flag(hasMeaningfulText(option.text) && scored),
                };
              }),
            );
          }),
  };

  const launch: TreeSeed = {
    key: "launch",
    title: "5 · Запуск",
    hint: "Готов ли кейс к участникам: медиа, тайминги, порядок показа и результат автопроверки.",
    stepId: "launch",
    children: [
      { key: "launch-media", title: "Медиа", hint: "Изображение и озвучка по умолчанию — используются, если у шага нет своих.", state: flag(Boolean(caseInput.imageAssetId || caseInput.audioAssetId)), stepId: "launch" },
      { key: "launch-timing", title: "Тайминги", hint: "Ритм кейса: интервалы событий, срок решения и повтор напоминания. Срок решения создаёт давление.", state: flag(Boolean(caseInput.timing?.decisionDeadlineSeconds)), stepId: "launch" },
      { key: "launch-order", title: `Порядок · ${caseInput.sortOrder ?? 0}`, hint: "Каким по счёту кейс показывается участнику.", state: "bright", stepId: "launch" },
      {
        key: "launch-qa",
        title: validationIssueCount > 0 ? `Автопроверка · ${validationIssueCount}` : "Автопроверка чиста",
        hint:
          validationIssueCount > 0
            ? `Автопроверка нашла замечаний: ${validationIssueCount}. Пока они не сняты, кейс нельзя пометить готовым.`
            : "Автопроверка не нашла замечаний — кейс можно выпускать.",
        state: validationIssueCount > 0 ? "partial" : "bright",
        stepId: "launch",
      },
    ],
  };

  return {
    key: "root",
    title: caseInput.title?.trim() || "Новый кейс",
    hint: "Кейс целиком. Ниже — пять этапов мастера и всё, что в них заполнено. Наборы свёрнуты: нажмите «+», чтобы раскрыть.",
    stepId: null,
    children: [intent, situation, structure, decisions, launch],
  };
}

/** Ключи наборов, свёрнутых по умолчанию — их и раскрывает автор. */
export function defaultCollapsedKeys(caseInput: SimCase, validationIssueCount = 0): string[] {
  const keys: string[] = [];
  const walk = (seed: TreeSeed) => {
    if (seed.collapsedByDefault && (seed.children || []).length > 0) keys.push(seed.key);
    (seed.children || []).forEach(walk);
  };
  walk(buildSeed(caseInput, validationIssueCount));
  return keys;
}

interface PlacedNode extends RoadmapNode {
  children: PlacedNode[];
}

function place(seed: TreeSeed, depth: number, cursor: { y: number }, expanded: Set<string>): PlacedNode {
  const x = PAD + depth * INDENT;
  const width = Math.max(MIN_NODE_W, CANVAS_W - x - PAD);
  const seedChildren = seed.children || [];
  const collapsed = seedChildren.length > 0 && seed.collapsedByDefault === true && !expanded.has(seed.key);

  const node: PlacedNode = {
    key: seed.key,
    title: seed.title,
    hint: seed.hint,
    state: seed.state ?? "dim",
    stepId: seed.stepId,
    depth,
    x,
    y: cursor.y,
    width,
    height: NODE_H,
    hasChildren: seedChildren.length > 0,
    collapsed,
    childCount: seedChildren.length,
    children: [],
  };
  cursor.y += NODE_H + ROW_GAP;

  if (!collapsed) {
    node.children = seedChildren.map((child) => place(child, depth + 1, cursor, expanded));
    if (seed.state === undefined && node.children.length > 0) {
      node.state = rollUp(node.children.map((child) => child.state));
    }
  } else if (seed.state === undefined) {
    // Свёрнутый узел всё равно должен показывать состояние своего содержимого.
    node.state = rollUp(seedChildren.map((child) => child.state ?? "dim"));
  }

  return node;
}

export function buildRoadmapLayout(
  caseInput: SimCase,
  validationIssueCount = 0,
  expandedKeys: Iterable<string> = [],
): RoadmapLayout {
  const expanded = new Set(expandedKeys);
  const cursor = { y: PAD };
  const root = place(buildSeed(caseInput, validationIssueCount), 0, cursor, expanded);

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
