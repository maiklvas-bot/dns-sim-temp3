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

console.log("UI acceptance checks passed: shared themes, responsive admin editor, assessor workspace and simulation scrolling verified.");
