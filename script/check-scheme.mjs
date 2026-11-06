#!/usr/bin/env node
// Проверка агентской схемы без моделей: файлы согласованы с реестром, настройки на месте,
// скрипт аудита ловит нарушения (положительные, отрицательные и мутационные сценарии).
// Запускается в GitHub Actions: npm run test:scheme
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { auditRows, parseJsonl, loadRegistry, bashTouchesSecrets, bashWritesRepo, pushForbidden, findHashes } from "./scheme-audit.mjs";

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const rel = (...p) => path.join(ROOT, ...p);
const reg = loadRegistry(rel("docs", "project", "routes.json"));
let failed = 0, passed = 0;
function check(name, ok, detail = "") {
  if (ok) passed++; else { failed++; console.error(`FAIL  ${name}${detail ? `\n      ${detail}` : ""}`); }
}
const read = (...p) => fs.readFileSync(rel(...p), "utf8");

function frontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---/.exec(text);
  if (!m) return null;
  const out = {}; let key = null;
  for (const line of m[1].split(/\r?\n/)) {
    const li = /^\s+-\s+(.*)$/.exec(line);
    if (li && key) { (out[key] = Array.isArray(out[key]) ? out[key] : []).push(li[1].trim()); continue; }
    const kv = /^([\w-]+):\s*(.*)$/.exec(line);
    if (kv) { key = kv[1]; out[key] = kv[2].trim().replace(/^"|"$/g, ""); }
  }
  return out;
}

// ---------- 1. Реестр и профили ----------
const roleNames = Object.keys(reg.roles);
for (const [name, role] of Object.entries(reg.roles)) {
  const file = rel(".claude", "agents", `${name}.md`);
  check(`профиль ${name} существует`, fs.existsSync(file));
  if (!fs.existsSync(file)) continue;
  const fm = frontmatter(fs.readFileSync(file, "utf8"));
  check(`профиль ${name}: есть frontmatter`, !!fm);
  if (!fm) continue;
  check(`профиль ${name}: name совпадает с файлом`, fm.name === name);
  check(`профиль ${name}: model = ${role.model}`, fm.model === role.model, `в профиле «${fm.model}»`);
  const tools = (fm.tools || "").split(",").map((s) => s.trim()).filter(Boolean);
  check(`профиль ${name}: tools совпадают с реестром`, JSON.stringify([...tools].sort()) === JSON.stringify([...role.tools].sort()), `профиль [${tools}] реестр [${role.tools}]`);
  const skills = Array.isArray(fm.skills) ? fm.skills : [];
  check(`профиль ${name}: skills совпадают с реестром`, JSON.stringify([...skills].sort()) === JSON.stringify([...role.skills].sort()), `профиль [${skills}] реестр [${role.skills}]`);
  for (const s of role.skills) check(`навык ${s} (роль ${name}) существует`, fs.existsSync(rel(".claude", "skills", s, "SKILL.md")));
  const writes = tools.filter((t) => reg.writeTools.includes(t));
  check(`профиль ${name}: права записи только у ${reg.writers}`, writes.length === 0 || reg.writers.includes(name), `у ${name} есть ${writes}`);
  const web = tools.filter((t) => reg.webTools.includes(t));
  check(`профиль ${name}: сеть только у ${reg.webRoles}`, web.length === 0 || reg.webRoles.includes(name));
  check(`реестр ${name}: model совпадает с family`, role.model === role.family);
  check(`реестр ${name}: Opus только у reviewer и arbiter`, role.family !== "opus" || ["reviewer", "arbiter"].includes(name));
}
for (const f of fs.readdirSync(rel(".claude", "agents")).filter((x) => x.endsWith(".md"))) {
  check(`профиль ${f} есть в реестре`, roleNames.includes(f.replace(/\.md$/, "")));
}
for (const d of fs.readdirSync(rel(".claude", "skills"))) {
  const file = rel(".claude", "skills", d, "SKILL.md");
  const fm = fs.existsSync(file) ? frontmatter(fs.readFileSync(file, "utf8")) : null;
  check(`навык ${d}: SKILL.md с name и description`, !!fm && fm.name === d && !!fm.description);
}

// ---------- 2. Маршруты ----------
for (const [name, r] of Object.entries(reg.routes)) {
  for (const s of r.steps) check(`маршрут ${name}: роль ${s} есть в реестре`, roleNames.includes(s));
  if (r.audit) check(`маршрут ${name}: auditor после reviewer`, r.steps.includes("reviewer"));
  if (r.steps.includes("builder")) check(`маршрут ${name}: после builder стоит reviewer`, r.steps.indexOf("reviewer") > r.steps.indexOf("builder"));
}
const docs = { "CLAUDE.md": read("CLAUDE.md"), "claude-headquarters.md": read("docs", "project", "claude-headquarters.md") };
for (const [file, text] of Object.entries(docs)) {
  for (const n of roleNames) check(`${file} упоминает роль ${n}`, text.includes(`\`${n}\``) || file === "CLAUDE.md" && text.includes(n));
}
/** Роли в строке таблицы стоят в том же порядке, что в реестре. */
const inOrder = (row, steps) => { let at = -1; for (const st of steps) { const i = row.indexOf(`\`${st}\``, at + 1); if (i < 0) return false; at = i; } return true; };
check("порядок ролей в строке таблицы проверяется", inOrder("| `x` | `a` → `b` → `c` |", ["a", "b", "c"]) && !inOrder("| `x` | `b` → `a` → `c` |", ["a", "b", "c"]) && !inOrder("| `x` | `a` → `c` |", ["a", "b", "c"]));
const modelWord = { haiku: "Haiku", sonnet: "Sonnet", opus: "Opus" };
const allSkills = reg.coreSkills || [];
for (const [name, role] of Object.entries(reg.roles)) {
  const row = docs["claude-headquarters.md"].split(/\r?\n/).find((l) => l.startsWith(`| \`${name}\` |`));
  check(`штабный документ: строка роли ${name} есть`, !!row);
  if (!row) continue;
  check(`штабный документ: ${name} — модель ${modelWord[role.family]}`, row.includes(modelWord[role.family]));
  check(`штабный документ: ${name} — инструменты как в реестре`, role.tools.every((t) => row.includes(t)) && ["Edit", "Write", "Bash", "WebSearch"].every((t) => role.tools.includes(t) || !row.includes(t)));
  check(`штабный документ: ${name} — навыки как в реестре`, role.skills.every((k) => row.includes(`\`${k}\``)) && allSkills.filter((k) => !role.skills.includes(k) && !["scheme-route", "methodology-change"].includes(k)).every((k) => !row.includes(`\`${k}\``)));
}
for (const [rn, r] of Object.entries(reg.routes)) {
  const row = docs["claude-headquarters.md"].split(/\r?\n/).find((l) => l.startsWith(`| \`${rn}\` |`));
  check(`штабный документ: цепочка маршрута ${rn} как в реестре`, !!row && inOrder(row, r.steps));
}
for (const n of Object.keys(reg.routes)) check(`claude-headquarters.md описывает маршрут ${n}`, docs["claude-headquarters.md"].includes(`\`${n}\``));
check("CLAUDE.md ссылается на routes.json", docs["CLAUDE.md"].includes("routes.json"));
check("CLAUDE.md не разрешает подмену ролей обычным агентом", !/могут не регистрироваться/.test(docs["CLAUDE.md"]) && /Подмену роли обычным агентом не использовать/.test(docs["CLAUDE.md"]));
check("в документах нет внешних ИИ-исполнителей как рабочих ролей", !/\bCodex\b|ChatGPT/.test(docs["CLAUDE.md"] + docs["claude-headquarters.md"].replace(/Других ИИ[^.]*\./g, "")));
check("RULE-PROPOSALS.md существует", fs.existsSync(rel("docs", "project", "RULE-PROPOSALS.md")));

// ---------- 2б. Навыки по вызову и запись в Obsidian ----------
const hq = docs["claude-headquarters.md"];
const onDemand = reg.onDemandSkills?.skills || {};
const demandNames = Object.keys(onDemand);
const skillDirs = fs.readdirSync(rel(".claude", "skills"));
const roleSkillSet = new Set(Object.values(reg.roles).flatMap((r) => r.skills));
check("реестр: coreSkills заданы", Array.isArray(reg.coreSkills) && reg.coreSkills.length >= 6);
check("реестр: навыки по вызову заданы (11)", demandNames.length === 11, `сейчас ${demandNames.length}`);
for (const d of skillDirs) check(`навык ${d}: есть в coreSkills или в onDemandSkills`, reg.coreSkills.includes(d) || demandNames.includes(d));
for (const d of reg.coreSkills) check(`coreSkills ${d}: каталог есть`, skillDirs.includes(d));
for (const d of demandNames) {
  const sk = onDemand[d];
  check(`по вызову ${d}: каталог и SKILL.md на месте (навык не удалён)`, fs.existsSync(rel(".claude", "skills", d, "SKILL.md")));
  check(`по вызову ${d}: не входит в профили ролей и coreSkills`, !roleSkillSet.has(d) && !reg.coreSkills.includes(d));
  check(`по вызову ${d}: триггеры заданы`, Array.isArray(sk.triggers) && sk.triggers.length > 0 && sk.triggers.every((t) => typeof t === "string" && t.trim()));
  check(`по вызову ${d}: маршрут есть в реестре`, !!reg.routes[sk.route], `маршрут «${sk.route}»`);
  check(`по вызову ${d}: описан в штабном документе таблицей`, hq.split(/\r?\n/).some((l) => l.startsWith(`| \`${d}\` |`) && l.includes(`\`${sk.route}\``)));
}
check("по вызову: google-forms требует «да» владельца", onDemand["google-forms"]?.ownerYes === true);
check("по вызову: caller — управляющий, не роль", reg.onDemandSkills?.caller === "orchestrator");
const lock = fs.existsSync(rel("skills-lock.json")) ? read("skills-lock.json") : "";
for (const d of demandNames) check(`skills-lock.json хранит ${d}`, lock.includes(`"${d}"`));
check("штабный документ: раздел «Навыки по вызову» с правилами вызова", /### Навыки по вызову/.test(hq) && /Вызывает управляющий/.test(hq) && /Навык не заменяет маршрут/.test(hq));
check("штабный документ: навыки не удаляются без «да»", /удалять их только по «да» владельца/.test(hq) && !/разрешил их удалить/.test(hq) && !/git rm -r/.test(hq));
check("CLAUDE.md: навыки по вызову и запрет удалять", /remotion-\*/.test(docs["CLAUDE.md"]) && /не удаляются/.test(docs["CLAUDE.md"]) && /onDemandSkills/.test(docs["CLAUDE.md"]));
const routeSkill = read(".claude", "skills", "scheme-route", "SKILL.md");
check("scheme-route: правила навыков по вызову", /Навыки по вызову/.test(routeSkill) && /onDemandSkills/.test(routeSkill));
check("штабный документ: правило записи в Obsidian обязательно", /Правило проекта: запись в Obsidian обязательна/.test(hq) && /01-projects\/simcenter\/WORKLOG\.md/.test(hq) && /не считается завершённым/.test(hq));
check("CLAUDE.md: запись в Obsidian обязательна (WORKLOG)", /Запись в Obsidian обязательна/.test(docs["CLAUDE.md"]) && /WORKLOG\.md/.test(docs["CLAUDE.md"]));
check("scheme-route: запись в WORKLOG перед итогом", /WORKLOG\.md/.test(routeSkill));
check("scheme-audit: аудитор проверяет запись в Obsidian", /no-worklog/.test(read(".claude", "skills", "scheme-audit", "SKILL.md")));
check("роли штаба в vault не пишут (написано в документе)", /Роли штаба[^.]*в vault не пишут/.test(hq));

// ---------- 3. Настройки ----------
const settings = JSON.parse(read(".claude", "settings.json"));
const stopCmds = (settings.hooks?.Stop || []).flatMap((h) => (h.hooks || []).map((x) => x.command || ""));
check("settings: Stop-хук запускает scheme-audit.mjs --hook", stopCmds.some((c) => /scheme-audit\.mjs/.test(c) && /--hook/.test(c)));
check("settings: основная модель sonnet", settings.model === "sonnet");
const deny = settings.permissions?.deny || [];
for (const need of ["Read(./.env)", "Read(./.env.local)", "Read(./.mcp.json)", "Read(./data.db)", "Read(./live-sessions.json)", "Bash(git push --force*)", "Bash(git push -f*)", "Bash(git push *:main*)", "Bash(git push *+*)", "Bash(git push --delete*)", "Bash(git push *--all*)"])
  check(`settings: deny содержит ${need}`, deny.includes(need));
check("settings: deny не блокирует .env.example", !deny.some((d) => /\.env\.example/.test(d)));
check(".gitignore игнорирует .claude/audit", /^\/?\.claude\/audit\/?$/m.test(read(".gitignore")));
check("ci.yml запускает test:scheme", /npm run test:scheme/.test(read(".github", "workflows", "ci.yml")));
const schemeYml = read(".github", "workflows", "scheme.yml");
check("scheme.yml запускается на push в claude/** и на PR", /claude\/\*\*/.test(schemeYml) && /pull_request/.test(schemeYml) && /check-scheme\.mjs/.test(schemeYml));
const pkg = JSON.parse(read("package.json"));
check("package.json: скрипт test:scheme", /check-scheme\.mjs/.test(pkg.scripts?.["test:scheme"] || ""));

// ---------- 4. Скрипт аудита: сценарии ----------
let n = 0;
const user = (t) => ({ type: "user", message: { role: "user", content: t } });
const say = (t) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "text", text: t }] } });
const bash = (command) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: `b${++n}`, name: "Bash", input: { command } }] } });
const tool = (name, input) => ({ type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id: `t${++n}`, name, input }] } });
function agent(role, prompt, o = {}) {
  const id = `a${++n}`;
  const family = reg.roles[role]?.family || "sonnet";
  return [
    { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name: "Agent", input: { subagent_type: role, prompt } }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: o.out ?? "ok" }] }] },
      toolUseResult: { status: o.status || "completed", agentType: role, resolvedModel: o.model ?? `claude-${family}-5-5`, toolsUsed: o.tools ?? ["Read"], content: [{ type: "text", text: o.out ?? "ok" }] } },
  ];
}
const HASH = "abcdef1234567";
const pass = (h = HASH) => agent("reviewer", `Проверь коммит ${h}`, { out: `Вердикт: PASS\nВерсия: ${h}` });
const block = (h = HASH) => agent("reviewer", `Проверь коммит ${h}`, { out: `Вердикт: BLOCK\nВерсия: ${h}` });
const good = () => [
  user("исправь расчёт порога"), say("Маршрут: engineering"),
  ...agent("analyst", "разбери"), ...agent("builder", "правь", { tools: ["Read", "Edit", "Bash"], out: `коммит ${HASH}` }),
  ...pass(), ...agent("auditor", "сверь", { out: "Аудит: OK" }), say("Готово"),
];
const codes = (rows, r = reg) => auditRows(rows, r).violations.map((v) => v.code);
const has = (name, rows, code) => check(`аудит ловит ${code}: ${name}`, codes(rows).includes(code), `получено [${codes(rows)}]`);
const without = (rows, i) => rows.filter((_, k) => k !== i && k !== i + 1);

check("аудит: эталонный engineering без нарушений", codes(good()).length === 0, `[${codes(good())}]`);
has("нет reviewer", [user("x"), say("Маршрут: engineering"), ...agent("analyst", "a"), ...agent("builder", "b", { tools: ["Edit"] }), ...agent("auditor", "c", { out: "Аудит: OK" })], "missing-role");
has("reviewer на sonnet", [...good().slice(0, 6), ...agent("reviewer", `коммит ${HASH}`, { model: "claude-sonnet-5-5", out: "Вердикт: PASS" }), ...agent("auditor", "c", { out: "Аудит: OK" })], "wrong-model");
has("reviewer с Bash", [...good().slice(0, 6), ...agent("reviewer", `коммит ${HASH}`, { tools: ["Read", "Bash"], out: "Вердикт: PASS" }), ...agent("auditor", "c", { out: "Аудит: OK" })], "tool-violation");
has("reviewer без хеша", [...good().slice(0, 6), ...agent("reviewer", "проверь работу", { out: "Вердикт: PASS" }), ...agent("auditor", "c", { out: "Аудит: OK" })], "reviewer-no-hash");
has("reviewer видел другую версию", [...good().slice(0, 6), ...agent("reviewer", `коммит ${HASH}`, { out: "Вердикт: PASS\nВерсия: 9999999aaaa" }), ...agent("auditor", "c", { out: "Аудит: OK" })], "reviewer-hash-mismatch");
has("reviewer без формата вердикта", [...good().slice(0, 6), ...agent("reviewer", `коммит ${HASH}`, { out: "Всё хорошо" }), ...agent("auditor", "c", { out: "Аудит: OK" })], "no-verdict");
has("маршрут не назван", good().filter((r, i) => i !== 1), "no-route");
has("маршрут неизвестный", good().map((r, i) => (i === 1 ? say("Маршрут: turbo") : r)), "unknown-route");
has("нет auditor", good().slice(0, 8), "no-audit");
has("reviewer раньше builder", [user("x"), say("Маршрут: engineering"), ...agent("analyst", "a"), ...pass(), ...agent("builder", "b", { tools: ["Edit"] }), ...agent("auditor", "c", { out: "Аудит: OK" })], "role-order");
has("посторонний агент", [user("x"), say("Маршрут: analysis"), ...agent("general-purpose", "a"), ...agent("analyst", "b"), ...pass()], "foreign-agent");
has("scout на opus", [user("x"), say("Маршрут: lookup"), ...agent("scout", "найди", { model: "claude-opus-5-5", tools: ["WebSearch"] })], "wrong-model");
has("scout не завершил", [user("x"), say("Маршрут: lookup"), ...agent("scout", "найди", { status: "error", tools: [] })], "role-incomplete");
has("модель не видна", [user("x"), say("Маршрут: lookup"), ...agent("scout", "найди", { model: "" })], "model-unknown");
const twoBlocks = [user("x"), say("Маршрут: fix"), ...agent("builder", "b", { tools: ["Edit"] }), ...block(), ...block()];
has("два BLOCK без арбитра", twoBlocks, "no-arbiter");
check("аудит: арбитр после двух BLOCK снимает замечание", !codes([...twoBlocks, ...agent("arbiter", "реши", { out: "Решение: ПРОДОЛЖИТЬ" }), ...pass()]).includes("no-arbiter"));
check("аудит: последний BLOCK даёт предупреждение", auditRows(twoBlocks, reg).warnings.some((w) => w.code === "final-block"));
has("git push --force", [user("x"), say("Маршрут: question"), bash("git push --force origin claude/x")], "forbidden-push");
has("git push в main", [user("x"), say("Маршрут: question"), bash("git push origin main")], "forbidden-push");
check("аудит: push в claude/* разрешён", !codes([user("x"), say("Маршрут: question"), bash("git push origin claude/shema-20261105")]).includes("forbidden-push"));
has("чтение .env через Read", [user("x"), say("Маршрут: question"), tool("Read", { file_path: "/repo/.env" })], "secret-read");
has("чтение .env через cat", [user("x"), say("Маршрут: question"), bash("cat .env.local")], "secret-read");
check("секреты в оболочке: cat .env, grep по .env, cp на .env.local ловятся", ["cat .env", "grep KEY .env", "head -n 3 ./app/.env.local", "cat data.db | wc -c", "cp .env /tmp/x"].every(bashTouchesSecrets));
check("секреты в оболочке: поиск слова .env в документе и .env.example не ловятся", ["grep -n -i -E '\\.env|секрет' docs/project/claude-headquarters.md | head", "cat .env.example", "ls -la", "git log --oneline"].every((c) => !bashTouchesSecrets(c)));
check("аудит: .env.example читать можно", !codes([user("x"), say("Маршрут: question"), tool("Read", { file_path: "/repo/.env.example" })]).includes("secret-read"));
check("аудит: без маршрута и без действий это question", codes([user("привет"), say("Привет")]).length === 0);
check("аудит: без маршрута, но с правкой — нарушение", codes([user("x"), say("делаю"), tool("Edit", { file_path: "a.ts" })]).includes("no-route"));
check("аудит: берёт только последний запрос", codes([user("старый"), say("Маршрут: engineering"), ...agent("analyst", "a"), user("новый"), say("Маршрут: question"), say("ответ")]).length === 0);
check("аудит: боковые цепочки не считаются (ни правки, ни секреты, ни агенты)", (() => {
  const side = (row) => ({ ...row, isSidechain: true });
  const rows = [user("x"), say("Маршрут: question"), side(tool("Edit", { file_path: "a.ts" })), side(bash("cat .env")), ...agent("analyst", "a").map(side)];
  return codes(rows).length === 0;
})());
check("аудит: служебные строки сжатия и команд не считаются запросом", codes([user("настоящий запрос"), say("Маршрут: question"), { ...user("сводка"), isCompactSummary: true }, user("<command-name>/compact</command-name>"), user("[Request interrupted by user]"), say("ответ")]).length === 0);
check("вердикты арбитра и аудитора на кириллице распознаются", (() => { const r = auditRows([user("x"), say("Маршрут: lookup"), ...agent("scout", "a"), ...agent("arbiter", "реши", { out: "Решение: ПЕРЕДЕЛАТЬ\nпотому" }), ...agent("auditor", "сверь", { out: "Аудит: ЗАМЕЧАНИЯ" })], reg); return r.calls[1].verdict === "ПЕРЕДЕЛАТЬ" && r.calls[2].verdict === "ЗАМЕЧАНИЯ"; })());
// замечания проверяющего по первому раунду: серия BLOCK, правка после проверки, хеши, push, правки управляющего
has("правка после проверки", [...good().slice(0, 8), ...agent("builder", "ещё правка", { tools: ["Edit"] }), ...agent("auditor", "c", { out: "Аудит: OK" })], "edit-after-review");
check("правка после BLOCK и новая проверка PASS — нормально", !codes([user("x"), say("Маршрут: fix"), ...agent("builder", "b", { tools: ["Edit"] }), ...block(), ...agent("builder", "b2", { tools: ["Edit"] }), ...pass()]).includes("edit-after-review"));
has("две серии BLOCK, арбитр только после первой", [user("x"), say("Маршрут: fix"), ...agent("builder", "b", { tools: ["Edit"] }), ...block(), ...block(), ...agent("arbiter", "реши", { out: "Решение: ПЕРЕДЕЛАТЬ" }), ...agent("builder", "b2", { tools: ["Edit"] }), ...block(), ...block(), ...pass()], "no-arbiter");
check("две серии BLOCK, арбитр после каждой — нормально", !codes([user("x"), say("Маршрут: fix"), ...agent("builder", "b", { tools: ["Edit"] }), ...block(), ...block(), ...agent("arbiter", "реши", { out: "Решение: ПЕРЕДЕЛАТЬ" }), ...agent("builder", "b2", { tools: ["Edit"] }), ...block(), ...block(), ...agent("arbiter", "реши", { out: "Решение: ПРОДОЛЖИТЬ" }), ...pass()]).includes("no-arbiter"));
has("управляющий пишет через оболочку", [user("x"), say("Маршрут: question"), bash("echo x > client/a.ts")], "orchestrator-wrote");
check("оболочка: запись в репозиторий ловится, а /dev/null, /tmp, чтение и RULE-PROPOSALS нет", ["echo x > a.txt", "sed -i s/a/b/ f.ts", "git commit -m x", "git add -A", "cat a | tee out.txt", "git -C repo commit -m x", "git -c user.name=x add ."].every((c) => bashWritesRepo(c, "/work")) && ["ls 2>/dev/null", "echo x > /tmp/o.txt", "git status", "git -C repo status", "git log --oneline", "node script/check-scheme.mjs", "echo x >> docs/project/RULE-PROPOSALS.md", "cmd 2>&1"].every((c) => !bashWritesRepo(c, "/work")));
check("BLOCK, PASS, BLOCK — не серия: арбитр не нужен", !codes([user("x"), say("Маршрут: fix"), ...agent("builder", "b", { tools: ["Edit"] }), ...block(), ...pass(), ...block()]).includes("no-arbiter"));
has("BLOCK, BLOCK, PASS без арбитра", [user("x"), say("Маршрут: fix"), ...agent("builder", "b", { tools: ["Edit"] }), ...block(), ...block(), ...pass()], "no-arbiter");
has("в поручении reviewer только дата в имени ветки", [...good().slice(0, 6), ...agent("reviewer", "проверь ветку claude/shema-shtab-20261105", { out: "Вердикт: PASS\nВерсия: " + HASH }), ...agent("auditor", "c", { out: "Аудит: OK" })], "reviewer-no-hash");
has("reviewer не назвал версию", [...good().slice(0, 6), ...agent("reviewer", `коммит ${HASH}`, { out: "Вердикт: PASS" }), ...agent("auditor", "c", { out: "Аудит: OK" })], "reviewer-no-version");
check("findHashes: дата и слова не хеш, коммит хеш", findHashes("ветка 20261105 feedback deadbeef1 e1b3563e4f70").join() === "deadbeef1,e1b3563e4f70");
has("управляющий сам правит файл репозитория", [user("x"), say("Маршрут: question"), tool("Edit", { file_path: "client/src/app.tsx" })], "orchestrator-wrote");
check("управляющий может дописать RULE-PROPOSALS.md", !codes([user("x"), say("Маршрут: question"), tool("Edit", { file_path: "docs/project/RULE-PROPOSALS.md" })]).includes("orchestrator-wrote"));
check("правка вне репозитория (cwd) не нарушение", !codes([{ ...user("x"), cwd: "/work/repo" }, say("Маршрут: question"), tool("Write", { file_path: "/vault/WORKLOG.md" })]).includes("orchestrator-wrote"));
check("push: разрешён только в claude/*", ["git push origin claude/x", "git push -u origin claude/shema-20261105 2>/dev/null", "git push origin HEAD:refs/heads/claude/x", "git status && ls /dev/null"].every((c) => !pushForbidden(c)));
check("push: force, +refspec, main/master/dev, удаление, --all запрещены", ["git push --force origin claude/x", "git push -f", "git push origin +claude/x", "git push origin HEAD:main", "git push origin dev", "git push origin :claude/x", "git push --delete origin claude/x", "git push --all", "git -C repo push origin master"].every(pushForbidden));
// запись в Obsidian: предупреждение no-worklog
const warns = (rows) => auditRows(rows, reg).warnings.map((w) => w.code);
check("аудит: engineering без записи в Obsidian даёт no-worklog", warns(good()).includes("no-worklog"));
check("аудит: запись через MCP obsidian снимает no-worklog", !warns([...good().slice(0, -1), tool("mcp__obsidian__append_content", { path: "01-projects/simcenter/WORKLOG.md", content: "x" }), say("Готово")]).includes("no-worklog"));
check("аудит: вопрос без изменений не требует записи", !warns([user("привет"), say("Маршрут: question"), say("ответ")]).includes("no-worklog"));
check("аудит: no-worklog не блокирует (это замечание, не нарушение)", codes(good()).length === 0);
// мутации эталона: из каждой роли по очереди
for (const [i, name] of [[2, "analyst"], [4, "builder"], [6, "reviewer"], [8, "auditor"]]) {
  const rows = without(good(), i);
  check(`мутация: без ${name} аудит краснеет`, codes(rows).length > 0, `[${codes(rows)}]`);
}

// ---------- 5. Журнал реальной сессии ----------
const real = parseJsonl(fs.readFileSync(rel("script", "fixtures", "scheme", "real-question-analyst.jsonl"), "utf8"));
const realRep = auditRows(real, reg);
check("реальный журнал: маршрут question, один вызов analyst, без нарушений", realRep.route === "question" && realRep.calls.length === 1 && realRep.calls[0].role === "analyst" && realRep.violations.length === 0, JSON.stringify(realRep));
check("реальный журнал: модель распознана как sonnet", /sonnet/.test(realRep.calls[0]?.model || ""));
const mutated = real.map((r) => (r.toolUseResult ? { ...r, toolUseResult: { ...r.toolUseResult, resolvedModel: "claude-haiku-5-5" } } : r));
check("реальный журнал: подмена модели на haiku ловится", codes(mutated).includes("wrong-model"));
const mutated2 = real.map((r) => (r.toolUseResult ? { ...r, toolUseResult: { ...r.toolUseResult, toolsUsed: ["Glob", "Write"] } } : r));
check("реальный журнал: запись у analyst ловится", codes(mutated2).includes("tool-violation"));


// Журналы настоящих прогонов (роли в фоне, уведомления, служебные приписки)
const fx = (name) => parseJsonl(fs.readFileSync(rel("script", "fixtures", "scheme", name), "utf8"));
const rA = auditRows(fx("real-lookup-arbiter.jsonl"), reg);
check("реальный прогон lookup: запрос владельца найден, а не уведомление", /Node\.js 20/.test(rA.prompt) && rA.route === "lookup", rA.prompt);
check("реальный прогон lookup: scout на Haiku, arbiter на Opus, нарушений нет", rA.calls.some((c) => c.role === "scout" && /haiku/.test(c.model)) && rA.calls.some((c) => c.role === "arbiter" && /opus/.test(c.model) && c.verdict === "ВЛАДЕЛЬЦУ") && rA.violations.length === 0, JSON.stringify(rA.violations));
const rS = auditRows(fx("real-skipped-review.jsonl"), reg);
check("реальный прогон с пропуском проверки: аудит краснеет", ["missing-role", "no-audit"].every((c) => rS.violations.some((v) => v.code === c)), JSON.stringify(rS.violations));
check("реальный прогон с пропуском проверки: builder шёл на Sonnet", rS.calls.some((c) => c.role === "builder" && /sonnet/.test(c.model)));
const rR = auditRows(fx("real-roles-async.jsonl"), reg);
check("реальный прогон ролей: reviewer и arbiter на Opus, вердикты распознаны", rR.calls.some((c) => c.role === "reviewer" && /opus/.test(c.model) && c.verdict === "BLOCK") && rR.calls.some((c) => c.role === "arbiter" && /opus/.test(c.model) && c.verdict === "ПРОДОЛЖИТЬ"), JSON.stringify(rR.calls));
check("реальный прогон ролей: reviewer не вышел за Read/Grep/Glob", rR.violations.length === 0, JSON.stringify(rR.violations));
// фоновый запуск и уведомление
const asyncCall = (role, prompt, family) => {
  const id = `s${++n}`;
  return [id, { type: "assistant", message: { role: "assistant", content: [{ type: "tool_use", id, name: "Agent", input: { subagent_type: role, prompt } }] } },
    { type: "user", message: { role: "user", content: [{ type: "tool_result", tool_use_id: id, content: [{ type: "text", text: "Async agent launched" }] }] }, toolUseResult: { status: "async_launched", resolvedModel: `claude-${family}-5-5` } }];
};
const note = (id, status, result) => ({ type: "user", origin: { kind: "task-notification" }, promptSource: "system", message: { role: "user", content: `<task-notification>\n<tool-use-id>${id}</tool-use-id>\n<status>${status}</status>\n<result>${result}</result>\n</task-notification>` } });
{
  const [id, a, b] = asyncCall("scout", "найди", "haiku");
  const pendingRows = [user("найди"), say("Маршрут: lookup"), a, b];
  const rep = auditRows(pendingRows, reg);
  check("фон: роль ещё работает — это ожидание, а не нарушение", rep.violations.length === 0 && rep.pending.includes("scout"));
  const done = auditRows([...pendingRows, note(id, "completed", "ответ")], reg);
  check("фон: после уведомления роль завершена, запрос остался прежним", done.violations.length === 0 && done.pending.length === 0 && done.prompt === "найди" && done.calls[0].status === "completed", JSON.stringify(done));
  const [id2, a2, b2] = asyncCall("scout", "найди", "opus");
  check("фон: неверная модель видна уже при запуске", codes([user("найди"), say("Маршрут: lookup"), a2, b2]).includes("wrong-model"));
}
check("вердикт находится под служебной приписью harness", codes([user("x"), say("Маршрут: analysis"), ...agent("analyst", "a"), ...agent("reviewer", `коммит ${HASH}`, { out: "[harness: ...]\n\nВердикт: PASS\nВерсия: " + HASH })]).length === 0);

// ---------- 6. Хук ----------
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "scheme-"));
const writeLog = (name, rows) => { const f = path.join(tmp, name); fs.writeFileSync(f, rows.map((r) => JSON.stringify(r)).join("\n") + "\n"); return f; };
const runHook = (input) => spawnSync(process.execPath, [rel("script", "scheme-audit.mjs"), "--hook"], { input: JSON.stringify({ cwd: tmp, ...input }), encoding: "utf8" });
const badLog = writeLog("bad.jsonl", good().slice(0, 6));
const goodLog = writeLog("good.jsonl", good());
const h1 = runHook({ transcript_path: badLog });
let parsed = null; try { parsed = JSON.parse(h1.stdout); } catch { /* пусто */ }
check("хук: при нарушении просит доработать", h1.status === 0 && parsed?.decision === "block" && /missing-role|no-audit/.test(parsed.reason), h1.stdout + h1.stderr);
check("хук: повторно не блокирует (stop_hook_active)", runHook({ transcript_path: badLog, stop_hook_active: true }).stdout === "");
check("хук: чистый ход проходит молча", runHook({ transcript_path: goodLog }).stdout === "");
check("хук: пишет отчёт .claude/audit/last.json", fs.existsSync(path.join(tmp, ".claude", "audit", "last.json")));
check("хук: нет журнала — не падает и не блокирует", (() => { const r = runHook({ transcript_path: path.join(tmp, "нет.jsonl") }); return r.status === 0 && r.stdout === ""; })());
check("хук: мусор на входе — не падает", spawnSync(process.execPath, [rel("script", "scheme-audit.mjs"), "--hook"], { input: "не json", encoding: "utf8" }).status === 0);
fs.rmSync(tmp, { recursive: true, force: true });

console.log(`Схема: проверок пройдено ${passed}, провалено ${failed}`);
process.exit(failed ? 1 : 0);
