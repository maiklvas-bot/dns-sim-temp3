import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";

function readText(filePath) {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function listFilesRecursive(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    return entry.isDirectory() ? listFilesRecursive(entryPath) : [entryPath];
  });
}

const app = readText("client/src/App.tsx");
const admin = [
  "client/src/features/admin/AdminWorkspace.tsx",
  "client/src/features/admin/AdminWorkspaceRuntime.tsx",
].map(readText).join("\n");
const assessor = [
  "client/src/features/assessor/AssessorWorkspace.tsx",
  "client/src/features/assessor/AssessorWorkspaceRuntime.tsx",
].map(readText).join("\n");
const simulation = readText("client/src/features/simulation/SimulationWorkspace.tsx");
const styles = [
  "client/src/index.css",
  "client/src/styles/base.css",
  "client/src/styles/themes.css",
  "client/src/styles/shared-controls.css",
  "client/src/styles/admin.css",
  "client/src/styles/assessor.css",
  "client/src/styles/simulation.css",
  "client/src/styles/responsive.css",
].map(readText).join("\n");

for (const route of ["/admin", "/assessor", "/evaluator", "/simulation"]) {
  assertCondition(app.includes(`path="${route}"`), `Required product route is missing: ${route}`);
}

for (const [name, source] of [
  ["administrator", admin],
  ["assessor", assessor],
  ["participant simulation", simulation],
]) {
  assertCondition(source.includes("useDnsTheme"), `${name} screen must use the shared DNS theme state`);
  assertCondition(source.includes("<ThemeToggle"), `${name} screen must expose the shared theme toggle`);
  assertCondition(source.includes("dns-product-shell"), `${name} screen must use the product shell`);
}

for (const expected of [
  "dns-admin-main-grid",
  "dns-admin-case-workspace",
  "dns-admin-cycles-grid",
  "dns-admin-option-routing-grid",
  "dns-admin-media-grid",
  "dns-admin-dashboard-shell",
  "dns-admin-structure-nav",
  "dns-admin-case-control-panel",
  "dns-admin-cycle-meta-grid",
  "custom-scroll",
]) {
  assertCondition(admin.includes(expected) || styles.includes(`.${expected}`), `Admin responsive contract is missing: ${expected}`);
}

assertCondition(
  simulation.includes("overflow-y-auto") && simulation.includes("overflow-x-auto"),
  "Participant simulation must preserve vertical and horizontal access to dense panels",
);
assertCondition(
  styles.includes(".dns-product-shell.dns-theme-light") &&
    styles.includes("Admin light theme: placed last"),
  "Light-theme override layer must remain present after dark admin review styles",
);
assertCondition(
  !styles.includes("min-width: 1400px") && !styles.includes("min-width:1400px"),
  "UI must not require a fixed 1400px viewport",
);

for (const expected of [
  "Кандидаты",
  "Настройка запуска",
  "Активные сессии",
  "Результаты",
  "dns-assessor-v2-candidate-summary",
  "dns-assessor-v2-setup-tabs",
  "dns-assessor-v2-validation-list",
  "currentAverageScore",
]) {
  assertCondition(assessor.includes(expected), `Assessor workspace contract is missing: ${expected}`);
}

for (const expected of [
  ".dns-assessor-v2-rail-footer",
  ".dns-assessor-v2-candidate-summary",
  ".dns-assessor-v2-session-score",
  ".dns-assessor-v2-validation-list",
]) {
  assertCondition(styles.includes(expected), `Assessor responsive style contract is missing: ${expected}`);
}

const productionAssetsDirectory = "dist/public/assets";
assertCondition(existsSync(productionAssetsDirectory), "UI bundle contract requires a completed production build");
const productionAssetNames = listFilesRecursive(productionAssetsDirectory).map((filePath) => path.basename(filePath));
for (const forbiddenReference of [
  "reference_main_screen_mockup",
  "reference_full_project_mockup",
]) {
  assertCondition(
    productionAssetNames.every((filename) => !filename.includes(forbiddenReference)),
    `Production bundle must exclude design reference asset: ${forbiddenReference}`,
  );
}

const caseUi = [
  "client/src/features/admin/cases/StructuredOptionsEditor.tsx",
  "client/src/features/admin/cases/CaseDossierEditor.tsx",
  "client/src/features/admin/cases/CaseValidationPanel.tsx",
  "client/src/features/admin/cases/master/CaseMaster.tsx",
  "client/src/features/admin/cases/master/CaseSummaryCard.tsx",
  "client/src/features/admin/cases/master/case-master-support.ts",
].map(readText).join("\n");

assertCondition(
  !caseUi.includes("max={5}"),
  "Баллы компетенций больше не выставляются слайдером 0-5 — должен использоваться выбор уровня BARS",
);
assertCondition(
  caseUi.includes("BARS_OPTIONS"),
  "Редактор вариантов должен предлагать уровни BARS из общего справочника",
);
assertCondition(
  caseUi.includes("hiddenCause") && caseUi.includes("falseTrails") && caseUi.includes("dataPoints"),
  "Редактор паспорта должен закрывать скрытую причину, данные и ложные следы",
);
assertCondition(
  caseUi.includes("validateCase"),
  "Автор кейса должен видеть замечания автопроверки до сохранения",
);
assertCondition(
  caseUi.includes("MASTER_STEPS") && caseUi.includes("CaseSummaryCard"),
  "Кейс редактируется через мастер с этапами и карточкой-хабом",
);
assertCondition(
  !existsSync("client/src/features/admin/cases/CaseCreationWizard.tsx"),
  "Старый визард создания кейса заменён мастером",
);

// Нейтральный серый в кабинете запрещён (см. CLAUDE.md, «Правила интерфейса»):
// серый текст на сером фоне — то, из-за чего интерфейс выглядит нечитаемо.
// Считаем настоящую насыщенность HSL, а не разброс каналов: у #8b929c разброс 17,
// но насыщенность 8% — это серый. Чистый белый и чёрный исключены по светлоте:
// они читаются как поверхность, а не как оттенок серого.
const adminCss = readText("client/src/styles/admin.css");
// Атрибутные селекторы вида [class*="text-[#8890a8]"] адресуют классы разметки,
// а не задают цвет — их из проверки убираем, иначе ловим ремап вместо палитры.
const adminCssDeclarations = adminCss.replace(/\[[^\]]*\]/g, "");
const isNeutralColor = (hex) => {
  const [r, g, b] = [0, 2, 4].map((offset) => parseInt(hex.slice(offset, offset + 2), 16) / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const chromaRange = 1 - Math.abs(2 * lightness - 1);
  const saturation = chromaRange === 0 ? 0 : (max - min) / chromaRange;
  return saturation < 0.2 && lightness > 0.1 && lightness < 0.92;
};
const neutralHexes = [...adminCssDeclarations.matchAll(/#([0-9a-fA-F]{6})\b/g)]
  .map((match) => match[1].toLowerCase())
  .filter((hex) => {
    return isNeutralColor(hex);
  });
assertCondition(
  neutralHexes.length === 0,
  `В кабинете не должно быть нейтральных серых, найдены: ${[...new Set(neutralHexes)].map((hex) => `#${hex}`).join(", ")}`,
);
assertCondition(
  !/--(muted-foreground|foreground|border|input|card-border):\s*0 0%/.test(adminCss),
  "Токены темы кабинета не должны иметь нулевую насыщенность — серый запрещён",
);

// Плитки набора выкладываются равной сеткой, а не блоками вразнобой со span.
// Ищем класс в разметке, а не слово в тексте: упоминание в комментарии
// не должно удерживать проверку зелёной.
const summaryCard = readText("client/src/features/admin/cases/master/CaseSummaryCard.tsx");
assertCondition(
  /className=(?:"|\{`)grid auto-rows-fr/.test(summaryCard),
  "Плитки карточки кейса должны быть одного размера (grid auto-rows-fr)",
);
assertCondition(
  !/md:col-span-2/.test(summaryCard),
  "Плитки карточки кейса не растягиваются на несколько колонок — набор должен быть равномерным",
);

// Дерево кейса — карта, а не навигация. Единственное действие в нём: раскрыть
// или свернуть набор. Переходов на этапы мастера из дерева быть не должно.
const roadmap = readText("client/src/features/admin/cases/master/CaseRoadmap.tsx");
assertCondition(
  !roadmap.includes("onOpenStep") && !roadmap.includes("setView"),
  "Из дерева кейса нельзя переходить на этапы — это карта, а не навигация",
);
assertCondition(
  roadmap.includes("expandedKeys") && roadmap.includes("toggle"),
  "Наборы в дереве должны раскрываться и сворачиваться автором",
);
assertCondition(
  roadmap.includes("onMouseEnter") && roadmap.includes(".hint"),
  "При наведении на блок дерева должно появляться объяснение, за что он отвечает",
);
assertCondition(
  readText("client/src/features/admin/AdminWorkspaceRuntime.tsx").includes("<CaseRoadmap"),
  "Дерево кейса должно быть постоянной панелью рабочей области, а не частью этапа",
);
// Дерево вписывается в панель целиком: никаких полос прокрутки.
assertCondition(
  roadmap.includes("viewBox") && roadmap.includes("preserveAspectRatio"),
  "Дерево кейса должно масштабироваться в панель через viewBox, а не прокручиваться",
);
assertCondition(
  !/overflow-(x|y)-auto|overflow-auto|overflow-x-scroll/.test(roadmap),
  "У дерева кейса не должно быть полос прокрутки — оно помещается на один экран",
);
// Рабочая область кейса — три колонки. Правило для широких экранов раньше
// задавало две, и панель влияния уезжала вниз левой колонки под дерево.
const wideWorkspaceRule = adminCss.match(
  /@media \(min-width: 1536px\)\s*\{[^}]*\.dns-admin-case-workspace\s*\{[^}]*grid-template-columns:([^;]*);/,
);
// Колонки считаем по-настоящему: пробелы внутри minmax(...) не разделяют колонки,
// иначе проверка зелёная при любом значении и ничего не стережёт.
const countColumns = (value) => {
  let depth = 0;
  let columns = 0;
  let inToken = false;
  for (const char of value.trim()) {
    if (char === "(") depth += 1;
    else if (char === ")") depth -= 1;
    if (depth === 0 && /\s/.test(char)) {
      inToken = false;
    } else if (!inToken) {
      inToken = true;
      columns += 1;
    }
  }
  return columns;
};
assertCondition(
  Boolean(wideWorkspaceRule) && countColumns(wideWorkspaceRule[1]) === 3,
  "На широких экранах рабочая область кейса должна быть трёхколоночной: дерево, редактор, влияние",
);

console.log("UI acceptance checks passed: shared themes, responsive admin editor, assessor workspace and simulation scrolling verified.");
