/**
 * ЗРД v2 — smoke API матчей: контракт маршрутов (source-check, как в ci-smoke)
 * + zod-схемы валидации. Живой цикл сервиса покрыт zrd-match-service-check.ts;
 * HTTP-уровень E2E — Playwright-скрипты этапов 3–4.
 * Запуск: npx tsx script/zrd-match-api-smoke.ts
 */
import { readFileSync } from "node:fs";
import {
  safeParse,
  createZrdMatchSchema,
  joinZrdMatchSchema,
  zrdMatchSeatQuerySchema,
  zrdMatchIntentSchema,
  zrdMatchSwanSchema,
  zrdMatchPauseSchema,
} from "../server/middleware/validation";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}
function accepts(schema: Parameters<typeof safeParse>[0], payload: unknown, name: string) {
  const r = safeParse(schema, payload);
  check(name, r.success, r.success ? "" : r.errors);
}
function rejects(schema: Parameters<typeof safeParse>[0], payload: unknown, name: string) {
  check(name, !safeParse(schema, payload).success);
}

console.log("── Контракт маршрутов ──");
const src = readFileSync("server/routes.ts", "utf8");
for (const route of [
  'app.post("/api/zrd/match"',
  'app.post("/api/zrd/match/join"',
  'app.get("/api/zrd/match/:id/seat"',
  'app.get("/api/zrd/match/:id/version"',
  'app.post("/api/zrd/match/:id/intent"',
  'app.get("/api/zrd/match/:id/observer"',
  'app.post("/api/zrd/match/:id/swan"',
  'app.post("/api/zrd/match/:id/pause"',
]) check(`маршрут ${route.split('"')[1]}`, src.includes(route));
check("создание матча — только staff", /app\.post\("\/api\/zrd\/match", requireStaff/.test(src));
check("observer — только staff", /observer", validateParams\(sessionIdParamSchema\), requireStaff/.test(src));
check("swan — только staff", /swan", validateParams\(sessionIdParamSchema\), requireStaff/.test(src));

console.log("── Схемы валидации ──");
const seats4 = [
  { rrsId: "ekb", controller: "human", participantName: "Анна" },
  { rrsId: "chel", controller: "ai", aiLevel: 4 },
  { rrsId: "tmn", controller: "ai", aiLevel: 2 },
  { rrsId: "perm", controller: "off" },
];
accepts(createZrdMatchSchema, { scenario: "conquest", seats: seats4 }, "createMatch: минимальный валидный payload");
accepts(createZrdMatchSchema, {
  scenario: "race", difficulty: 5, winMode: "race", missionMode: "manual",
  missionIds: ["m_race_flag", "m_sales_growth"], keyMissionId: "m_race_flag",
  swanFrequency: "storm", minutesPerTick: 4, seed: 42, seats: seats4,
}, "createMatch: полный payload");
rejects(createZrdMatchSchema, { scenario: "conquest", seats: seats4.slice(0, 3) }, "createMatch: 3 места отклонены");
rejects(createZrdMatchSchema, { scenario: "unknown", seats: seats4 }, "createMatch: неизвестный сценарий отклонён");
rejects(createZrdMatchSchema, { scenario: "conquest", seats: seats4, minutesPerTick: 60 }, "createMatch: темп 60 мин отклонён");
rejects(createZrdMatchSchema, { scenario: "conquest", seats: [...seats4.slice(0, 3), { rrsId: "perm", controller: "ai", aiLevel: 9 }] }, "createMatch: уровень ИИ 9 отклонён");

accepts(joinZrdMatchSchema, { code: "AB23CD" }, "join: валидный код");
rejects(joinZrdMatchSchema, { code: "AB23C" }, "join: короткий код отклонён");
rejects(joinZrdMatchSchema, { code: "AB23CD'" }, "join: инъекция отклонена");

accepts(zrdMatchSeatQuerySchema, { seat: "0" }, "seat query: 0 валиден");
rejects(zrdMatchSeatQuerySchema, { seat: "4" }, "seat query: 4 отклонён");

accepts(zrdMatchIntentSchema, { seatIdx: 1, intent: { kind: "playCard", cardId: "pr_ad_t1_v1" } }, "intent: playCard");
accepts(zrdMatchIntentSchema, { seatIdx: 0, intent: { kind: "swanChoice", swanId: "kiberataka", optionId: "recover" } }, "intent: swanChoice");
accepts(zrdMatchIntentSchema, { seatIdx: 3, intent: { kind: "pass" } }, "intent: pass");
rejects(zrdMatchIntentSchema, { seatIdx: 4, intent: { kind: "pass" } }, "intent: место 4 отклонено");
rejects(zrdMatchIntentSchema, { seatIdx: 0, intent: { kind: "playCard", cardId: "DROP TABLE" } }, "intent: SQL-подобный id отклонён");
rejects(zrdMatchIntentSchema, { seatIdx: 0, intent: { kind: "keepCards", cardIds: [] } }, "intent: соло-интент keepCards отклонён");

accepts(zrdMatchSwanSchema, { swanId: "epidemiya", target: "all" }, "swan: all");
accepts(zrdMatchSwanSchema, { swanId: "pozhar_sklada", target: "tmn" }, "swan: конкретная РРС");
rejects(zrdMatchSwanSchema, { swanId: "epidemiya", target: "msk" }, "swan: чужая РРС отклонена");

accepts(zrdMatchPauseSchema, { paused: true }, "pause: true");
rejects(zrdMatchPauseSchema, { paused: "yes" }, "pause: строка отклонена");

if (failures > 0) { console.error(`\n${failures} проверок провалено`); process.exit(1); }
console.log("\nSmoke API матчей пройден.");
