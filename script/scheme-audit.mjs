#!/usr/bin/env node
// Механическая проверка работы агентской схемы по журналу сессии Claude Code.
// Проверяет то, что видно без чтения смысла: маршрут назван, роли цепочки позваны по порядку,
// модели совпали с реестром, инструменты не вышли за профиль, есть вердикты и хеши.
// Смысловую проверку делает агент auditor. Реестр: docs/project/routes.json.
//
// Режимы:
//   --hook                    Stop-хук Claude Code: JSON со stdin, при нарушении просит дорабатывать (один раз)
//   --latest [--cwd DIR]      последний журнал проекта, отчёт в текст, код 1 при нарушениях
//   --transcript FILE         журнал из файла
//   --routes FILE             другой реестр (по умолчанию docs/project/routes.json)
//   --json                    отчёт в JSON
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DEFAULT_ROUTES = path.join(HERE, "..", "docs", "project", "routes.json");
const HASH_RE = /\b[0-9a-f]{7,40}\b/g;
/** Хеши коммитов в тексте. Дата вроде 20261105 и слова без цифр хешем не считаются. */
export function findHashes(text) {
  return (String(text).match(HASH_RE) || []).filter((h) => /\d/.test(h) && /[a-f]/.test(h));
}
const SECRET_NAME_RE = /^(\.env(\.(?!example$)[\w.-]+)?|\.mcp\.json|data\.db|live-sessions\.json)$/;
const SECRET_PATH_RE = /(^|[\\/])(\.env(\.(?!example$)[\w.-]+)?|\.mcp\.json|data\.db|live-sessions\.json)$/;
const READERS = new Set(["cat", "type", "less", "more", "head", "tail", "Get-Content", "sed", "awk", "grep", "rg", "cp", "scp", "mv", "tee", "source", "."]);

/** Запрещённая отправка в git: force, main/master/dev, удаление ветки, --all/--mirror. Отправка в claude/* разрешена. */
export function pushForbidden(cmd) {
  for (const seg of String(cmd).split(/\|\||&&|[|;&\n]/)) {
    const tokens = seg.replace(/\d*>>?\s*\S+/g, " ").trim().split(/\s+/).map((t) => t.replace(/^["']|["']$/g, "")).filter(Boolean);
    const gi = tokens.indexOf("git");
    const pi = gi >= 0 ? tokens.indexOf("push", gi) : -1;
    if (pi < 0) continue;
    const args = tokens.slice(pi + 1);
    if (args.some((t) => /^(--force(-with-lease)?(=.*)?|-f|--delete|-d|--all|--mirror)$/.test(t))) return true;
    const refs = args.filter((t) => !t.startsWith("-")).slice(1);
    for (const r of refs) {
      if (r.startsWith("+") || r.startsWith(":")) return true;
      const dest = (r.includes(":") ? r.split(":").pop() : r).replace(/^refs\/heads\//, "");
      if (/^(main|master|dev)$/.test(dest)) return true;
    }
  }
  return false;
}

/** Пишет ли команда оболочки в файлы репозитория: перенаправление, sed -i, tee, git commit/add/apply/merge/rebase. */
export function bashWritesRepo(cmd, cwd = "") {
  const outside = (t) => /^\/dev\//.test(t) || t.startsWith("&") || t.startsWith("/tmp/") || (cwd && path.isAbsolute(t) && !t.startsWith(cwd)) || /(^|[\\/])(RULE-PROPOSALS\.md|\.claude[\\/]audit[\\/].*)$/.test(t);
  for (const seg of String(cmd).split(/\|\|?|&&|[;\n]/)) {
    for (const m of seg.matchAll(/(?:^|[^\d&>])>>?\s*(["']?)([^\s|;&"']+)\1/g)) if (!outside(m[2])) return true;
    const t = seg.trim().split(/\s+/);
    if (t[0] === "sed" && t.some((x) => /^-[a-zA-Z]*i/.test(x) || x.startsWith("--in-place"))) return true;
    if (t[0] === "tee" && t.slice(1).some((x) => !x.startsWith("-") && !outside(x))) return true;
    if (t[0] === "git") {
      let i = 1;
      while (i < t.length && t[i].startsWith("-")) i += ["-C", "-c", "--git-dir", "--work-tree", "--namespace"].includes(t[i]) ? 2 : 1;
      if (["commit", "add", "apply", "merge", "rebase", "cherry-pick", "mv", "rm"].includes(t[i])) return true;
    }
  }
  return false;
}

/** Обращается ли команда оболочки к файлу с секретами: читающая команда и имя файла среди аргументов. */
export function bashTouchesSecrets(cmd) {
  for (const seg of String(cmd).split(/\|\||&&|[|;&\n]/)) {
    const tokens = seg.trim().split(/\s+/).map((t) => t.replace(/^["']|["']$/g, "")).filter(Boolean);
    if (tokens.length < 2 || !READERS.has(tokens[0].replace(/^.*[\\/]/, ""))) continue;
    for (const t of tokens.slice(1)) {
      if (t.startsWith("-")) continue;
      const base = /^[A-Za-z]:\\/.test(t) ? t.split("\\").pop() : t.split("/").pop();
      if (SECRET_NAME_RE.test(base)) return true;
    }
  }
  return false;
}

export function parseJsonl(text) {
  const rows = [];
  for (const line of text.split(/\r?\n/)) {
    if (!line.trim()) continue;
    try { rows.push(JSON.parse(line)); } catch { /* битая строка журнала пропускается */ }
  }
  return rows;
}

function blocks(row) {
  const c = row?.message?.content;
  if (typeof c === "string") return [{ type: "text", text: c }];
  return Array.isArray(c) ? c : [];
}

const NOTE_RE = /^\s*<task-notification>/;
function rowText(row) {
  return blocks(row).map((b) => (typeof b.text === "string" ? b.text : "")).join("\n");
}
function isNotification(row) {
  return row.type === "user" && (row.origin?.kind === "task-notification" || row.promptSource === "system" || NOTE_RE.test(rowText(row)));
}
const SERVICE_RE = /^\s*(<command-name>|<command-message>|<local-command|<bash-input>|<bash-stdout>|\[Request interrupted|Caveat: The messages below)/;
function isRealPrompt(row) {
  if (row.type !== "user" || row.isSidechain || row.isMeta || row.isCompactSummary || isNotification(row)) return false;
  if (SERVICE_RE.test(rowText(row))) return false;
  const b = blocks(row);
  if (b.length === 0) return false;
  return !b.some((x) => x.type === "tool_result");
}

function textOf(content) {
  if (typeof content === "string") return content;
  if (!Array.isArray(content)) return "";
  return content
    .filter((b) => b && b.type === "text" && typeof b.text === "string" && !b.text.startsWith("<tools-used-before-summary>"))
    .map((b) => b.text)
    .join("\n")
    .trim();
}

function firstLine(s) {
  return (s || "").split(/\r?\n/).map((x) => x.trim()).find((x) => x.length > 0 && !x.startsWith("[harness:")) || "";
}

/** Разбор последнего запроса владельца и всего, что было после него. */
export function auditRows(rows, registry) {
  const main = rows.filter((r) => !r.isSidechain);
  let start = -1;
  for (let i = main.length - 1; i >= 0; i--) if (isRealPrompt(main[i])) { start = i; break; }
  const result = { prompt: "", route: null, calls: [], violations: [], warnings: [], pending: [], blocks: 0 };
  if (start < 0) { result.warnings.push({ code: "no-prompt", msg: "В журнале нет запроса владельца." }); return result; }
  result.prompt = blocks(main[start]).map((b) => b.text || "").join(" ").slice(0, 300);
  const turn = main.slice(start + 1);

  const texts = [];
  let metaTools = [];
  const uses = new Map(); // tool_use id -> вызов
  const order = [];
  const mainTools = [];
  let metaAt = -10;
  for (const [ti, r] of turn.entries()) {
    if (r.type === "assistant") {
      for (const b of blocks(r)) {
        if (b.type === "text" && b.text) texts.push(b.text);
        if (b.type === "tool_use") {
          if (b.name === "Agent" || b.name === "Task") {
            const call = { id: b.id, role: b.input?.subagent_type || "", prompt: String(b.input?.prompt || ""), result: null, order: order.length };
            uses.set(b.id, call); order.push(call);
          } else mainTools.push({ name: b.name, input: b.input || {} });
        }
      }
    } else if (r.type === "user") {
      const mt = /<tools-used-before-summary>([^<]*)<\/tools-used-before-summary>/.exec(rowText(r));
      if (mt) { metaTools = mt[1].split(",").map((x) => x.trim()).filter(Boolean); metaAt = ti; }
      if (isNotification(r)) {
        const body = rowText(r);
        const id = /<tool-use-id>([^<]+)<\/tool-use-id>/.exec(body)?.[1];
        const call = id && uses.get(id);
        if (call && call.result) {
          call.result.status = /<status>([^<]+)<\/status>/.exec(body)?.[1] || call.result.status;
          call.result.text = (/<result>([\s\S]*?)<\/result>/.exec(body)?.[1] || "").trim();
          call.result.toolsUsed = ti - metaAt <= 2 ? metaTools : [];
          call.result.async = true;
          metaTools = [];
        }
        continue;
      }
      for (const b of blocks(r)) {
        if (b.type !== "tool_result") continue;
        const call = uses.get(b.tool_use_id);
        if (!call) continue;
        const tur = r.toolUseResult || {};
        call.result = {
          status: tur.status || (b.is_error ? "error" : "unknown"),
          resolvedModel: tur.resolvedModel || "",
          toolsUsed: Array.isArray(tur.toolsUsed) ? tur.toolsUsed : [],
          agentType: tur.agentType || call.role,
          text: tur.status === "async_launched" ? "" : textOf(tur.content ?? b.content),
        };
      }
    }
  }

  // маршрут
  const routeRe = new RegExp(registry.routeLine, "m");
  for (const t of texts) { const m = routeRe.exec(t); if (m) { result.route = m[1]; break; } }
  const writes = mainTools.filter((t) => ["Edit", "Write", "NotebookEdit", "Bash"].includes(t.name));
  if (!result.route) {
    if (order.length === 0 && writes.length === 0) {
      result.route = "question";
      result.warnings.push({ code: "route-implicit", msg: "Маршрут не назван; агентов и правок не было, принят как question." });
    } else {
      result.violations.push({ code: "no-route", msg: "Маршрут не назван строкой «Маршрут: <имя>», хотя были агенты или правки." });
    }
  }
  const route = result.route ? registry.routes[result.route] : null;
  if (result.route && !route) result.violations.push({ code: "unknown-route", msg: `Маршрут «${result.route}» не описан в routes.json.` });

  // вызовы ролей
  for (const c of order) {
    const role = registry.roles[c.role];
    const rec = { role: c.role, model: c.result?.resolvedModel || "", status: c.result?.status || "нет ответа", tools: c.result?.toolsUsed || [], verdict: "" };
    result.calls.push(rec);
    if (!role) { result.violations.push({ code: "foreign-agent", msg: `Вызван «${c.role}» вне реестра ролей.` }); continue; }
    if (!c.result) { result.violations.push({ code: "role-incomplete", msg: `${c.role}: нет результата.` }); continue; }
    if (c.result.status === "async_launched") { rec.status = "ждём ответ"; result.pending.push(c.role); if (c.result.resolvedModel && !c.result.resolvedModel.includes(role.family)) result.violations.push({ code: "wrong-model", msg: `${c.role}: шла модель ${c.result.resolvedModel}, по реестру нужна ${role.family}.` }); continue; }
    if (c.result.status !== "completed") result.violations.push({ code: "role-incomplete", msg: `${c.role}: статус «${c.result.status}», а не completed.` });
    if (!c.result.resolvedModel) result.violations.push({ code: "model-unknown", msg: `${c.role}: журнал не показал модель.` });
    else if (!c.result.resolvedModel.includes(role.family)) result.violations.push({ code: "wrong-model", msg: `${c.role}: шла модель ${c.result.resolvedModel}, по реестру нужна ${role.family}.` });
    const extra = c.result.toolsUsed.filter((t) => !role.tools.includes(t));
    if (extra.length) result.violations.push({ code: "tool-violation", msg: `${c.role}: использовал ${extra.join(", ")} вне списка ${role.tools.join(", ")}.` });
    const vre = registry.verdictRoles[c.role];
    if (vre) {
      const m = new RegExp(vre).exec(firstLine(c.result.text));
      if (!m) result.violations.push({ code: "no-verdict", msg: `${c.role}: первая строка ответа не в формате вердикта.` });
      else rec.verdict = m[1];
    }
    if (c.role === "reviewer") {
      const hashes = findHashes(c.prompt);
      const seen = /^Версия:\s*([0-9a-f]{7,40})/m.exec(c.result.text);
      if (hashes.length === 0) result.violations.push({ code: "reviewer-no-hash", msg: "reviewer: в поручении нет хеша коммита." });
      if (!seen) result.violations.push({ code: "reviewer-no-version", msg: "reviewer: в ответе нет строки «Версия: <хеш>», какую версию он видел, неизвестно." });
      else if (hashes.length && !hashes.some((h) => h.startsWith(seen[1].slice(0, 7)) || seen[1].startsWith(h.slice(0, 7))))
        result.violations.push({ code: "reviewer-hash-mismatch", msg: `reviewer: видел версию ${seen[1]}, в поручении ${hashes[0]}.` });
    }
  }

  // цепочка маршрута
  if (route) {
    const done = order.filter((c) => c.result && c.result.status === "completed");
    let ptr = 0;
    for (const role of route.steps) {
      let idx = -1;
      for (let i = ptr; i < done.length; i++) if (done[i].role === role) { idx = i; break; }
      if (idx >= 0) { ptr = idx + 1; continue; }
      if (done.some((c) => c.role === role)) result.violations.push({ code: "role-order", msg: `${role}: позван не в том порядке, что требует маршрут ${result.route}.` });
      else result.violations.push({ code: "missing-role", msg: `${role}: маршрут ${result.route} требует эту роль, её нет.` });
    }
    if (route.steps.includes("reviewer")) {
      const lastWrite = Math.max(-1, ...order.map((c, i) => (c.role === "builder" && c.result?.status === "completed" ? i : -1)));
      const accepted = order.some((c, i) => c.role === "reviewer" && i > lastWrite && c.result?.status === "completed");
      if (lastWrite >= 0 && !accepted) result.violations.push({ code: "edit-after-review", msg: "После последней правки builder нет проверки reviewer: итог не принят." });
    }
    if (route.audit) {
      const lastRev = Math.max(-1, ...order.map((c, i) => (c.role === "reviewer" ? i : -1)));
      const hasAudit = order.some((c, i) => c.role === "auditor" && i > lastRev && c.result?.status === "completed");
      if (!hasAudit) result.violations.push({ code: "no-audit", msg: `Маршрут ${result.route} требует auditor после reviewer.` });
    }
  }

  // эскалация: арбитр нужен после серии BLOCK подряд (PASS серию обрывает)
  const revCalls = result.calls.map((c, i) => ({ ...c, i })).filter((c) => c.role === "reviewer");
  const revVerdicts = revCalls.map((c) => c.verdict);
  result.blocks = revVerdicts.filter((v) => v === "BLOCK").length;
  const limit = registry.escalation?.arbiterAfterBlocks ?? 2;
  let run = 0;
  const needs = [];
  for (const c of revCalls) {
    if (c.verdict === "BLOCK") { run++; if (run === limit) { needs.push(c.i); run = 0; } } else if (c.verdict === "PASS") run = 0;
  }
  needs.forEach((at, k) => {
    const until = k + 1 < needs.length ? needs[k + 1] : Infinity;
    if (!result.calls.some((c, i) => c.role === "arbiter" && i > at && i < until))
      result.violations.push({ code: "no-arbiter", msg: `Серия из ${limit} BLOCK подряд (вызов ${at + 1}) закончилась без арбитра.` });
  });
  if (revVerdicts.length && revVerdicts[revVerdicts.length - 1] === "BLOCK") result.warnings.push({ code: "final-block", msg: "Последний вердикт reviewer — BLOCK: работа не принята, готовой её называть нельзя." });

  // действия управляющего
  const cwdOf = rows.find((r) => r.cwd)?.cwd || "";
  for (const t of mainTools) {
    if (t.name === "Bash") {
      const cmd = String(t.input.command || "");
      if (pushForbidden(cmd)) result.violations.push({ code: "forbidden-push", msg: `Запрещённая отправка: ${cmd.slice(0, 120)}` });
      if (bashWritesRepo(cmd, cwdOf)) result.violations.push({ code: "orchestrator-wrote", msg: `Управляющий пишет в репозиторий через оболочку: ${cmd.slice(0, 100)}` });
      if (bashTouchesSecrets(cmd)) result.violations.push({ code: "secret-read", msg: `Чтение секретов или живых данных: ${cmd.slice(0, 120)}` });
    }
    const fp = t.input.file_path || t.input.path;
    if (["Read", "Edit", "Write"].includes(t.name) && typeof fp === "string" && SECRET_PATH_RE.test(fp))
      result.violations.push({ code: "secret-read", msg: `${t.name} трогает ${fp}` });
  }
  const cwd = rows.find((r) => r.cwd)?.cwd || "";
  const EXEMPT = /(^|[\\/])(docs[\\/]project[\\/]RULE-PROPOSALS\.md|\.claude[\\/]audit[\\/].*)$/;
  for (const t of mainTools) {
    if (!["Edit", "Write", "NotebookEdit"].includes(t.name)) continue;
    const fp = String(t.input.file_path || t.input.notebook_path || "");
    const inside = fp && (!path.isAbsolute(fp) && !/^[A-Za-z]:[\\/]/.test(fp) || !cwd || fp.startsWith(cwd));
    if (inside && !EXEMPT.test(fp)) result.violations.push({ code: "orchestrator-wrote", msg: `Управляющий сам правит файл репозитория (${fp}); это работа builder.` });
  }
  // запись в Obsidian: изменение без строки в WORKLOG не завершено (раздел 6 штабного документа)
  const changed = (route && (route.steps.includes("builder") || result.route === "knowledge"))
    || order.some((c) => c.role === "builder")
    || mainTools.some((t) => ["Edit", "Write", "NotebookEdit"].includes(t.name) || t.name === "Bash" && bashWritesRepo(String(t.input.command || ""), cwdOf));
  const wroteVault = mainTools.some((t) => /obsidian/i.test(t.name) || /WORKLOG/.test(JSON.stringify(t.input || {})));
  if (changed && !wroteVault && !result.pending.length) result.warnings.push({ code: "no-worklog", msg: "Были изменения, а записи в Obsidian (01-projects/simcenter/WORKLOG.md) в основной сессии нет. Изменение без записи не считается завершённым; если запись невозможна, сказать об этом в итоге." });
  if (result.pending.length) {
    // роли ещё работают: ход не закончен, структурные замечания пока снимаются, безопасность остаётся
    const keep = new Set(["forbidden-push", "secret-read", "wrong-model", "foreign-agent", "unknown-route", "orchestrator-wrote"]);
    result.violations = result.violations.filter((v) => keep.has(v.code));
    result.warnings.push({ code: "pending", msg: `Ещё работают: ${result.pending.join(", ")}. Полная проверка после их ответа.` });
  }
  return result;
}

export function formatReport(rep) {
  const L = [];
  L.push(`Запрос: ${rep.prompt || "(нет)"}`);
  L.push(`Маршрут: ${rep.route || "не назван"}`);
  L.push("Вызовы ролей:");
  if (rep.calls.length === 0) L.push("  (нет)");
  for (const c of rep.calls) L.push(`  - ${c.role}: ${c.status}, модель ${c.model || "?"}, инструменты [${c.tools.join(", ")}]${c.verdict ? `, итог ${c.verdict}` : ""}`);
  L.push(rep.violations.length ? "Нарушения:" : "Нарушений нет.");
  for (const v of rep.violations) L.push(`  - [${v.code}] ${v.msg}`);
  if (rep.warnings.length) { L.push("Замечания:"); for (const w of rep.warnings) L.push(`  - [${w.code}] ${w.msg}`); }
  return L.join("\n");
}

export function loadRegistry(file = DEFAULT_ROUTES) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function projectDirOf(cwd) {
  return path.join(process.env.CLAUDE_CONFIG_DIR || path.join(os.homedir(), ".claude"), "projects", cwd.replace(/[^a-zA-Z0-9]/g, "-"));
}

function latestTranscript(cwd) {
  const dir = projectDirOf(cwd);
  const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).map((f) => ({ f: path.join(dir, f), t: fs.statSync(path.join(dir, f)).mtimeMs })) : [];
  files.sort((a, b) => b.t - a.t);
  return files[0]?.f || null;
}

function writeAudit(cwd, rep, extra = {}) {
  try {
    const dir = path.join(cwd, ".claude", "audit");
    fs.mkdirSync(dir, { recursive: true });
    const rec = { at: new Date().toISOString(), ...extra, route: rep.route, calls: rep.calls, violations: rep.violations, warnings: rep.warnings };
    fs.writeFileSync(path.join(dir, "last.json"), JSON.stringify(rec, null, 2));
    fs.appendFileSync(path.join(dir, "log.jsonl"), JSON.stringify(rec) + "\n");
  } catch { /* отчёт необязателен: сбой записи работу не блокирует */ }
}

async function readStdin() {
  const chunks = [];
  for await (const c of process.stdin) chunks.push(c);
  return Buffer.concat(chunks).toString("utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const opt = (n) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : undefined; };
  const registry = loadRegistry(opt("--routes") || DEFAULT_ROUTES);
  if (args.includes("--hook")) {
    let input = {};
    try { input = JSON.parse(await readStdin()); } catch { return; }
    const cwd = input.cwd || process.cwd();
    if (!input.transcript_path || !fs.existsSync(input.transcript_path)) return;
    const rep = auditRows(parseJsonl(fs.readFileSync(input.transcript_path, "utf8")), registry);
    writeAudit(cwd, rep, { session: input.session_id });
    if (rep.violations.length && !input.stop_hook_active) {
      const reason = "Аудит схемы нашёл нарушения. Исправь по правилам docs/project/claude-headquarters.md и закончи ответ.\n" + formatReport(rep);
      process.stdout.write(JSON.stringify({ decision: "block", reason }));
    }
    return;
  }
  const file = opt("--transcript") || (args.includes("--latest") ? latestTranscript(opt("--cwd") || process.cwd()) : null);
  if (!file || !fs.existsSync(file)) { console.error("Журнал сессии не найден. Укажи --transcript FILE или запусти из каталога проекта с --latest."); process.exit(2); }
  const rep = auditRows(parseJsonl(fs.readFileSync(file, "utf8")), registry);
  console.log(args.includes("--json") ? JSON.stringify(rep, null, 2) : formatReport(rep));
  process.exit(rep.violations.length ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((e) => { console.error(e); process.exit(2); });
}
