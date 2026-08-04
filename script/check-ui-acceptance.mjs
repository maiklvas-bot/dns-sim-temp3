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

// История изменений продукта доступна из обоих кабинетов по клику на версию.
// Это пользовательский журнал: что менялось на экранах и какие задачи закрывал
// релиз — без кода и коммитов.
for (const [name, source] of [["administrator", admin], ["assessor", assessor]]) {
  assertCondition(
    /<ReleaseHistoryDialog[\s/>]/.test(source),
    `${name}: история изменений должна открываться из кабинета`,
  );
  assertCondition(
    source.includes("onVersionClick"),
    `${name}: номер версии должен открывать историю изменений`,
  );
}
// Справочник: разделы открываются из меню, а не вываливаются одной лентой,
// и в нём есть теория — зачем симуляция и почему её оценке можно верить.
const wikiReference = readText("client/src/features/admin/wiki/AdminWikiReference.tsx");
assertCondition(
  /\bWIKI_THEORY\b/.test(wikiReference) && wikiReference.includes("setSelection"),
  "Wiki должна быть справочником с выбором раздела, а не сплошным списком карточек",
);
// Колонки справочника прокручиваются каждая сама: иначе при открытии длинного
// раздела дерево уезжает вверх и до нижних пунктов приходится мотать обратно.
assertCondition(
  (wikiReference.match(/overflow-y-auto/g) || []).length >= 2,
  "Дерево и содержание справочника должны прокручиваться независимо друг от друга",
);
// Высота колонок считается от их фактической позиции до низа окна. Фиксированное
// вычитание вроде calc(100dvh - 19rem) — угадывание высоты шапки: на другом окне
// низ колонок уезжает за экран.
assertCondition(
  /useAvailableHeight\(\w+\)/.test(wikiReference) && wikiReference.includes("window.innerHeight"),
  "Высоту колонок справочника нужно измерять, а не вычитать угаданную величину",
);
assertCondition(
  !/h-\[calc\(100dvh/.test(wikiReference),
  "Фиксированное вычитание из 100dvh возвращает прежний баг с уехавшим низом",
);
// Дерево остаётся компактным: описание раздела прячется под «+».
assertCondition(
  wikiReference.includes("expandedKeys"),
  "Описание раздела в дереве должно раскрываться по «+», а не занимать место всегда",
);
const wikiTheory = readText("client/src/features/admin/wiki/wiki-theory.ts");
for (const topic of ["Зачем симуляция", "Откуда взялась оценка", "Как устроен кейс", "Риски механики"]) {
  assertCondition(wikiTheory.includes(topic), `В теории симуляции должен быть раздел «${topic}»`);
}
assertCondition(
  wikiTheory.includes("sources"),
  "Утверждения теории должны ссылаться на матчасть, иначе их нечем проверить",
);
assertCondition(
  /diagram:/.test(wikiTheory) && readText("client/src/features/admin/wiki/WikiDiagrams.tsx").includes("<svg"),
  "Теория должна показываться схемами, а не только текстом",
);

// Всплывающие окна — только порталом (см. CLAUDE.md, «Правила интерфейса»).
// Панели кабинета обрезают содержимое, поэтому absolute-подсказка внутри панели
// прячется под её краем, и z-index этого не лечит.
const floatingCard = readText("client/src/components/floating-card.tsx");
assertCondition(
  /createPortal\(/.test(floatingCard) && /document\.body/.test(floatingCard) && floatingCard.includes("fixed"),
  "Всплывающая карточка должна рендериться порталом в body с фиксированным позиционированием",
);
assertCondition(
  floatingCard.includes("window.innerWidth") && floatingCard.includes("window.innerHeight"),
  "Всплывающая карточка должна подстраиваться под края окна",
);
for (const popoverFile of [
  "client/src/features/admin/cases/master/MasterHelp.tsx",
  "client/src/features/admin/cases/master/CaseRoadmap.tsx",
]) {
  const source = readText(popoverFile);
  assertCondition(
    /<FloatingCard[\s/>]/.test(source),
    `${popoverFile}: всплывающее окно должно использовать FloatingCard, а не absolute внутри панели`,
  );
  assertCondition(
    !/absolute[^"]*\bz-\d/.test(source),
    `${popoverFile}: всплывающее окно не должно позиционироваться absolute внутри обрезающего контейнера`,
  );
}

const releaseHistory = readText("client/src/data/release-history.ts");
assertCondition(
  releaseHistory.includes("problems") && releaseHistory.includes("solved"),
  "История релизов должна показывать, какие задачи закрыты, а какие остались открытыми",
);
// Запись журнала — про экраны и задачи, а не про репозиторий. Проверяем сами
// записи, а не комментарии файла: иначе правило спотыкается о собственный текст.
const releaseEntries = releaseHistory
  .split("\n")
  .filter((line) => /^\s*(what|before|detail|title|scope):/.test(line))
  .join("\n");
assertCondition(
  !/коммит|commit|pull request|рефактор|TypeScript|tsc\b/i.test(releaseEntries),
  "История изменений пишется для пользователя: в записях не должно быть разработческих терминов",
);

const caseUi = [
  "client/src/features/admin/cases/StructuredOptionsEditor.tsx",
  "client/src/features/admin/cases/CaseDossierEditor.tsx",
  "client/src/features/admin/cases/CaseValidationPanel.tsx",
  "client/src/features/admin/cases/master/CaseMaster.tsx",
  "client/src/features/admin/cases/master/CaseSummaryCard.tsx",
  "client/src/features/admin/cases/master/case-master-support.ts",
  "client/src/features/admin/cases/master/IssueCard.tsx",
  "client/src/features/admin/cases/master/CompetencyLadderHint.tsx",
  "client/src/features/admin/cases/master/steps/StepDecisions.tsx",
  "client/src/features/admin/cases/master/TemplatePicker.tsx",
  "client/src/features/admin/cases/master/TemplatePeek.tsx",
  "client/src/features/admin/cases/master/CaseRoadmap.tsx",
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

// Обучающий слой: замечание объясняет себя и может быть осознанно принято.
// Компонент карточки мало создать — он должен быть подключён, иначе принять негде.
const validationPanel = readText("client/src/features/admin/cases/CaseValidationPanel.tsx");
assertCondition(
  /<IssueCard[\s/>]/.test(validationPanel),
  "Замечания показываются карточкой с объяснением, а не сухим списком",
);
assertCondition(
  validationPanel.includes("acceptedIssues"),
  "Панель замечаний должна уметь принимать замечание с обоснованием",
);
const issueCard = readText("client/src/features/admin/cases/master/IssueCard.tsx");
assertCondition(
  issueCard.includes("explainIssue") && issueCard.includes(".why"),
  "Карточка замечания объясняет, чем оно вредит оценке, а не только что не так",
);
assertCondition(
  issueCard.includes("issue.cycleId") && issueCard.includes("issue.optionId"),
  "Запись принятия обязана копировать привязку из замечания — иначе принятие не сработает",
);
assertCondition(
  readText("client/src/features/admin/cases/master/steps/StepLaunch.tsx").includes("onChange={onChange}"),
  "Панель замечаний должна получать обработчик изменения — без него принятие некуда сохранить",
);
assertCondition(
  caseUi.includes("explainIssue"),
  "Замечание должно объясняться автору, а не показываться технической строкой",
);
assertCondition(
  caseUi.includes("isIssueAccepted"),
  "Автор должен иметь возможность осознанно принять замечание",
);
// Лестница мало что объясняет, если её не показать на этапе решений.
assertCondition(
  /<CompetencyLadderHint[\s/>]/.test(readText("client/src/features/admin/cases/master/steps/StepDecisions.tsx")),
  "Единая «шкала хорошести» показывается наглядно на этапе решений",
);
// Вердикт лестницы обязан приходить из автопроверки: своя формула означала бы,
// что картинка и механика расходятся.
// Библиотека эталонов: обе роли — точка старта и учебник.
assertCondition(
  caseUi.includes("instantiateTemplate"),
  "Эталон можно взять за основу нового кейса",
);
assertCondition(
  existsSync("shared/case-templates-data.json"),
  "Библиотека эталонов хранится в репозитории, а не в базе — это версионируемый учебный материал",
);

// Эталон как учебник: «как в образце» доступно на каждом содержательном этапе.
for (const step of ["StepIntent", "StepSituation", "StepStructure", "StepDecisions"]) {
  assertCondition(
    /<TemplatePeek[\s/>]/.test(readText(`client/src/features/admin/cases/master/steps/${step}.tsx`)),
    `Просмотр образца должен быть доступен на этапе ${step}`,
  );
}
// Просмотр образца — только чтение: он не должен уметь менять кейс автора.
// Проверяем сигнатуру, а не тело: onChange у select внутри — это переключение
// образца, а не правка кейса. Опасно другое — обработчик, приходящий снаружи.
const templatePeek = readText("client/src/features/admin/cases/master/TemplatePeek.tsx");
const peekProps = templatePeek.match(/export function TemplatePeek\(\{([^}]*)\}/)?.[1] || "";
assertCondition(
  !/on[A-Z]/.test(peekProps),
  `Просмотр образца не должен получать обработчиков снаружи — он затрёт работу автора. Пропсы: ${peekProps.trim()}`,
);
assertCondition(
  readText("client/src/features/admin/cases/master/CompetencyLadderHint.tsx").includes("findLadderIssue"),
  "Лестница берёт вердикт из автопроверки, а не считает его заново",
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

// Бренд DNS: акцент и радиус берутся из общих токенов, а не подбираются на месте.
assertCondition(
  !/#FF6B00/i.test(readText("client/src/features/admin/AdminWorkspaceRuntime.tsx")),
  "Кабинет использует брендовый оранжевый #f68b1f, а не #FF6B00",
);
assertCondition(
  /--dns-admin-radius-panel:\s*calc\(var\(--radius\)/.test(adminCss),
  "Радиус панелей кабинета должен наследоваться от брендового --radius, а не быть фиксированным",
);
assertCondition(
  !/--radius:\s*0\.375rem/.test(adminCss),
  "Кабинет не должен переопределять брендовый --radius",
);

// Типографика: все начертания DNS RotondaC подключены. Если объявлен только
// Regular, браузер синтезирует жирность сам — заголовки выглядят грубо жирными.
const baseCss = readText("client/src/styles/base.css");
const rotondaFaces = (baseCss.match(/font-family:\s*"DNS RotondaC";/g) || []).length;
assertCondition(
  rotondaFaces >= 3,
  `Должны быть подключены Regular, Bold и Black — объявлено начертаний: ${rotondaFaces}`,
);
assertCondition(
  /DNS RotondaC-Bold\.ttf/.test(baseCss) && /DNS RotondaC-Black\.ttf/.test(baseCss),
  "Файлы Bold и Black должны быть подключены, а не лежать без дела",
);
assertCondition(
  !/font-weight:\s*(800|900)/.test(adminCss),
  "В кабинете не используются веса 800/900 — на мелком тексте они читаются грязно",
);

// Кабинет был набран почти целиком 10–12px: иерархии не видно, экран плотный.
// Шкала поднимается ремапом по классам — разметка набрана хардкод-размерами.
assertCondition(
  /\[class\*="text-\[11px\]"\]/.test(adminCss) && /\[class\*="text-\[12px\]"\]/.test(adminCss),
  "Мелкие размеры текста должны подниматься шкалой кабинета, иначе экран читается как сплошная сетка",
);

assertCondition(
  /--roadmap-dim-fill/.test(adminCss) && /dns-theme-light[\s\S]{0,400}--roadmap-dim-fill/.test(adminCss),
  "Цвета дерева кейса должны быть заданы переменными для обеих тем",
);

// Правило «никаких нейтральных серых» должно распространяться и на разметку
// кабинета, а не только на admin.css: иначе новый компонент вносит их заново.
const neutralInMarkup = [...caseUi.matchAll(/#([0-9a-fA-F]{6})\b/g)]
  .map((match) => match[1].toLowerCase())
  .filter(isNeutralColor);
assertCondition(
  neutralInMarkup.length === 0,
  `В разметке мастера не должно быть нейтральных серых, найдены: ${[...new Set(neutralInMarkup)].map((hex) => `#${hex}`).join(", ")}`,
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
// Дерево рисуется атрибутами SVG — ремап хексов по классам их не ловит, поэтому
// цвета обязаны идти переменными: иначе в светлой теме дерево остаётся тёмным.
assertCondition(
  !/fill="#[0-9a-fA-F]{6}"/.test(roadmap),
  "В дереве кейса не должно быть хардкод-заливок — они не переключаются вместе с темой",
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
