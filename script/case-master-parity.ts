import assert from "node:assert/strict";
import {
  buildCaseSetupIssues,
  buildStepSummaries,
  findBrokenTransitions,
  isCaseStructureBranching,
  issuesForStep,
  MASTER_STEPS,
  signalTypeLabel,
} from "../client/src/features/admin/cases/master/case-master-support";
import { buildRoadmapLayout } from "../client/src/features/admin/cases/master/case-roadmap-layout";
import { validateCase } from "../shared/case-validation";
import type { SimCase } from "../shared/simulation-content";

const baseEffects = { queue: 0, conversion: 0, morale: 0, revenue_impact: 0, delivery_status: 0 };

function buildCase(overrides: Partial<SimCase> = {}): SimCase {
  return {
    id: "CASE-1",
    title: "Очередь на кассе",
    description: "Описание",
    primaryCompetencies: ["org_control"],
    secondaryCompetencies: [],
    trigger: { type: "message", source: "Старший продавец", text: "Очередь растёт" },
    zones_affected: ["торговый_зал"],
    cycles: [{
      id: "C1",
      cycle: 1,
      situation: "Ситуация",
      signal: { type: "message", content: "Сигнал" },
      options: [
        { id: "O1", level: 1, text: "Подождать и посмотреть", score: 1, effects: { ...baseEffects, queue: 5 }, competency_scores: { org_control: 1 } },
        { id: "O2", level: 2, text: "Спросить у коллеги", score: 2, effects: { ...baseEffects, queue: 3 }, competency_scores: { org_control: 3 } },
      ],
    }],
    businessProblem: "Клиенты уходят из очереди",
    hiddenCause: "Кассир не знает про вторую кассу",
    dataPoints: [{ label: "Отчёт по смене" }],
    falseTrails: ["Кажется, что виновата техника"],
    imageAssetId: null,
    imageUrl: null,
    audioAssetId: null,
    audioUrl: null,
    sortOrder: 0,
    isActive: true,
    ...overrides,
  };
}

// Пять этапов в фиксированном порядке
assert.equal(MASTER_STEPS.length, 5);
assert.deepEqual(MASTER_STEPS.map((step) => step.id), ["intent", "situation", "structure", "decisions", "launch"]);
assert.equal(MASTER_STEPS[0].title, "Замысел");
assert.equal(MASTER_STEPS[4].title, "Оформление и запуск");

// Ветвление определяется наличием явных переходов, а не числом циклов
assert.equal(isCaseStructureBranching(buildCase()), false);
const branching = buildCase();
branching.cycles[0].options[0].nextCycleId = "C2";
assert.equal(isCaseStructureBranching(branching), true);
// "__complete" — это тоже явный переход, а не отсутствие ветвления
const terminal = buildCase();
terminal.cycles[0].options[0].nextCycleId = "__complete";
assert.equal(isCaseStructureBranching(terminal), true);

// Сводка по этапам: заполненность считается по содержанию, а не по факту наличия поля
const summaries = buildStepSummaries(buildCase(), []);
assert.equal(summaries.length, 5);
const intent = summaries.find((item) => item.stepId === "intent");
assert.equal(intent?.isFilled, true);
assert.ok(intent?.lines.some((line) => line.includes("Очередь на кассе")), "сводка показывает суть, а не галочку");

const emptyIntent = buildStepSummaries(buildCase({ title: "  ", businessProblem: null }), []);
assert.equal(emptyIntent.find((item) => item.stepId === "intent")?.isFilled, false);

// Замечания раскладываются по этапам: диагностика -> ситуация, BARS/антигейминг/эффекты -> решения
const brokenCase = buildCase({ hiddenCause: null, dataPoints: [], falseTrails: [] });
const brokenIssues = validateCase(brokenCase);
assert.equal(issuesForStep("situation", brokenIssues).length, 3);
assert.equal(issuesForStep("decisions", brokenIssues).length, 0);

const badScores = buildCase();
badScores.cycles[0].options[0].competency_scores = { org_control: 2 };
const scoreIssues = validateCase(badScores);
assert.equal(issuesForStep("decisions", scoreIssues).length, 1);
assert.equal(issuesForStep("situation", scoreIssues).length, 0);

// Сводка несёт число замечаний своего этапа
const withIssues = buildStepSummaries(brokenCase, brokenIssues);
assert.equal(withIssues.find((item) => item.stepId === "situation")?.issueCount, 3);
assert.equal(withIssues.find((item) => item.stepId === "intent")?.issueCount, 0);

// «Готово» на карточке должно что-то означать. Раньше структура и запуск были готовы всегда.
const emptyShapeCase = buildCase();
emptyShapeCase.cycles[0].situation = "   ";
const emptyShape = buildStepSummaries(emptyShapeCase, []);
assert.equal(
  emptyShape.find((item) => item.stepId === "structure")?.isFilled,
  false,
  "шаг без описания не делает структуру готовой",
);

const withValidationIssues = buildStepSummaries(brokenCase, brokenIssues);
assert.equal(
  withValidationIssues.find((item) => item.stepId === "launch")?.isFilled,
  false,
  "«готово» на запуске означает чистую автопроверку, а не факт открытия экрана",
);
assert.equal(
  buildStepSummaries(buildCase(), []).find((item) => item.stepId === "launch")?.isFilled,
  true,
);

// Тип сигнала показывается человеку словом, а не машинным ключом
assert.equal(signalTypeLabel("zone_signal"), "сигнал зоны");
assert.ok(
  buildStepSummaries(buildCase(), [])
    .find((item) => item.stepId === "situation")
    ?.lines.some((line) => line.includes("сообщение")),
  "в сводке ситуации тип сигнала читается словом",
);

// Обрыв ветки: переход на шаг, которого нет в кейсе
assert.equal(findBrokenTransitions(buildCase()), 0);
assert.equal(findBrokenTransitions(terminal), 0, "__complete — не обрыв");
assert.equal(findBrokenTransitions(branching), 1, "переход на несуществующий C2 — обрыв");

// Замечания готовности знают свой этап, иначе клик по ним некуда вести
const setupIssues = buildCaseSetupIssues(buildCase({ title: "  " }));
assert.ok(setupIssues.some((issue) => issue.step === "intent" && issue.text.includes("название")));
assert.equal(buildCaseSetupIssues(null).length, 0);

const noSituation = buildCase();
noSituation.cycles[0].situation = "";
assert.ok(
  buildCaseSetupIssues(noSituation).some(
    (issue) => issue.step === "decisions" && issue.text.includes("ситуация шага"),
  ),
  "ситуация шага чинится на этапе «Решения», а не на «Ситуации» — иначе клик ведёт не туда",
);

assert.ok(
  buildCaseSetupIssues(branching).some((issue) => issue.step === "structure"),
  "оборванный переход адресуется на этап структуры",
);

// Дерево кейса: ветвящаяся схема всего кейса, а не колонка этапов
const treeCase = buildCase();
treeCase.cycles = [
  {
    id: "C1",
    cycle: 1,
    situation: "Очередь растёт",
    signal: { type: "message", content: "Сигнал" },
    options: [
      { id: "O1", level: 1, text: "Открыть кассу", score: 1, nextCycleId: "C2", effects: { ...baseEffects }, competency_scores: { org_control: 3 } },
      { id: "O2", level: 2, text: "Ничего не делать", score: 1, nextCycleId: "__complete", effects: { ...baseEffects }, competency_scores: { org_control: 1 } },
    ],
  },
  {
    id: "C2",
    cycle: 2,
    situation: "Приёмка встала",
    signal: { type: "message", content: "Сигнал" },
    options: [
      { id: "O3", level: 1, text: "Предупредить кладовщика", score: 1, effects: { ...baseEffects }, competency_scores: { org_control: 5 } },
    ],
  },
];

const tree = buildRoadmapLayout(treeCase);

// Дерево описывает мастер целиком: карточка, пять этапов и подблоки каждого
assert.equal(tree.nodes.find((node) => node.depth === 0)?.key, "root", "корень дерева — карточка кейса");
assert.deepEqual(
  tree.nodes.filter((node) => node.depth === 1).map((node) => node.key),
  ["intent", "situation", "structure", "decisions", "launch"],
  "первый уровень — пять этапов мастера",
);
for (const subKey of ["intent-comp", "sit-cause", "sit-data", "sit-trails", "launch-media", "launch-timing"]) {
  assert.ok(tree.nodes.some((node) => node.key === subKey), `подблок ${subKey} есть в дереве`);
}

// Добавленные автором шаги и варианты ответа появляются в дереве
assert.equal(
  tree.nodes.filter((node) => node.key.startsWith("structure-cycle-")).length,
  2,
  "каждый добавленный шаг — своя ветка структуры",
);
assert.equal(
  tree.nodes.filter((node) => node.key.startsWith("decisions-option-")).length,
  3,
  "каждый добавленный вариант ответа — своя ветка решений",
);

// Дерево вертикальное: узлы идут сверху вниз, вложенность показана отступом.
// Горизонтальная раскладка упиралась в ширину узкой панели и ужимала текст.
const stageNode = tree.nodes.find((node) => node.key === "decisions");
const optionNode = tree.nodes.find((node) => node.key.startsWith("decisions-option-"));
const rootNode = tree.nodes.find((node) => node.key === "root");
assert.ok(rootNode && stageNode && stageNode.y > rootNode.y, "этапы ниже карточки");
assert.ok(rootNode && stageNode && stageNode.x > rootNode.x, "этапы смещены отступом вправо");
assert.ok(stageNode && optionNode && optionNode.y > stageNode.y, "варианты ниже своего этапа");
assert.ok(stageNode && optionNode && optionNode.x > stageNode.x, "варианты смещены глубже этапа");
// Каждый узел занимает собственную строку — это и отличает вертикальное дерево
// от колоночного, где несколько узлов делят одну высоту.
const ys = tree.nodes.map((node) => node.y);
assert.equal(new Set(ys).size, tree.nodes.length, "каждый узел на своей строке");
assert.deepEqual(ys, [...ys].sort((a, b) => a - b), "узлы идут строго сверху вниз");

// Вложенность показана небольшим отступом, а не переносом в отдельную колонку.
// Крупный шаг по x означает горизонтальное дерево — оно упрётся в ширину панели.
const xByDepth = new Map<number, number>();
tree.nodes.forEach((node) => xByDepth.set(node.depth, node.x));
const depths = [...xByDepth.keys()].sort((a, b) => a - b);
for (let index = 1; index < depths.length; index += 1) {
  const step = xByDepth.get(depths[index])! - xByDepth.get(depths[index - 1])!;
  assert.ok(step > 0 && step <= 20, `отступ уровня ${depths[index]} должен быть небольшим, получено ${step}`);
}

// Схема без прокрутки: на большом кейсе варианты сворачиваются в счётчик,
// иначе холст растёт и текст ужимается до нечитаемого
const bigCase = buildCase();
bigCase.cycles = Array.from({ length: 8 }, (_, cycleIndex) => ({
  id: `B${cycleIndex + 1}`,
  cycle: cycleIndex + 1,
  situation: "Ситуация",
  signal: { type: "message" as const, content: "Сигнал" },
  options: Array.from({ length: 5 }, (_, optionIndex) => ({
    id: `B${cycleIndex + 1}O${optionIndex + 1}`,
    level: optionIndex + 1,
    text: "Ответ",
    score: 1,
    effects: { ...baseEffects },
    competency_scores: { org_control: 3 },
  })),
}));
const bigTree = buildRoadmapLayout(bigCase);
assert.equal(
  bigTree.nodes.filter((node) => node.key.startsWith("decisions-option-")).length,
  0,
  "на большом кейсе варианты свёрнуты в счётчик",
);
assert.ok(
  bigTree.nodes.some((node) => node.title.includes("ответов 5")),
  "свёрнутый шаг показывает, сколько в нём ответов",
);
assert.ok(bigTree.nodes.length < 45, "свёрнутая схема остаётся компактной");

// Незаполненное уходит в тень, заполненное светится, частичное — промежуточное
const emptyTree = buildRoadmapLayout(buildCase({ title: "  ", description: "", businessProblem: null, primaryCompetencies: [], secondaryCompetencies: [] }));
assert.equal(emptyTree.nodes.find((node) => node.key === "intent")?.state, "dim", "пустой замысел в тени");
assert.equal(tree.nodes.find((node) => node.key === "intent")?.state, "bright", "заполненный замысел светится");
assert.equal(
  buildRoadmapLayout(buildCase({ businessProblem: null })).nodes.find((node) => node.key === "intent")?.state,
  "partial",
  "частично заполненный этап — не тень и не полный свет",
);

// Узлы знают свой этап — по этому полю подсвечивается активное окно мастера
assert.equal(tree.nodes.find((node) => node.key === "sit-cause")?.stepId, "situation");
assert.equal(optionNode?.stepId, "decisions");

// Каждый узел, кроме корня, связан ребром — иначе ветка висит в воздухе
assert.equal(tree.edges.length, tree.nodes.length - 1, "каждый узел кроме корня связан с родителем");

console.log("case-master parity checks passed");
