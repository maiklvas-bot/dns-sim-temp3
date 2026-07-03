/**
 * ЗРД v2 — проверка миграции 0009 на чистой временной БД + базовые insert/select.
 * Запуск: npx tsx script/zrd-match-db-check.ts
 */
import fs from "fs";
import os from "os";
import path from "path";
import Database from "better-sqlite3";
import { runMigrations } from "../server/migrations";

let failures = 0;
function check(name: string, ok: boolean, detail = "") {
  if (ok) console.log(`  ok  ${name}`);
  else { failures++; console.error(`FAIL  ${name}${detail ? ` — ${detail}` : ""}`); }
}

const tmpFile = path.join(os.tmpdir(), `zrd-match-check-${Date.now()}.db`);
const sqlite = new Database(tmpFile);
sqlite.pragma("foreign_keys = ON");

runMigrations(sqlite);

const tables = sqlite.prepare("SELECT name FROM sqlite_master WHERE type='table'").all() as { name: string }[];
const names = new Set(tables.map((t) => t.name));
for (const t of ["zrd_matches", "zrd_match_seats", "zrd_match_turns", "zrd_match_results"]) {
  check(`таблица ${t} создана`, names.has(t));
}

// insert матча + 4 мест
const now = new Date().toISOString();
const m = sqlite.prepare(
  "INSERT INTO zrd_matches (config_json, state_json, started_at) VALUES (?, ?, ?)",
).run(JSON.stringify({ scenario: "conquest" }), "{}", now);
const matchId = Number(m.lastInsertRowid);
check("матч вставлен", matchId > 0);

const seatStmt = sqlite.prepare(
  "INSERT INTO zrd_match_seats (match_id, seat_idx, rrs_id, controller_kind, ai_level, participant_name, access_code) VALUES (?, ?, ?, ?, ?, ?, ?)",
);
seatStmt.run(matchId, 0, "ekb", "human", null, "Игрок 1", "AAAAAA");
seatStmt.run(matchId, 1, "chel", "ai", 3, null, null);
seatStmt.run(matchId, 2, "tmn", "ai", 5, null, null);
seatStmt.run(matchId, 3, "perm", "off", null, null, null);
const seats = sqlite.prepare("SELECT * FROM zrd_match_seats WHERE match_id = ? ORDER BY seat_idx").all(matchId) as Array<{ seat_idx: number; controller_kind: string }>;
check("4 места вставлены", seats.length === 4 && seats[3].controller_kind === "off");

// уникальность (match_id, seat_idx)
let dupBlocked = false;
try { seatStmt.run(matchId, 0, "ekb", "human", null, "Дубль", "BBBBBB"); } catch { dupBlocked = true; }
check("дубль места отклонён (unique)", dupBlocked);

// каскадное удаление
sqlite.prepare("INSERT INTO zrd_match_turns (match_id, seat_idx, seq, tick) VALUES (?, 0, 1, 1)").run(matchId);
sqlite.prepare("DELETE FROM zrd_matches WHERE id = ?").run(matchId);
const orphanSeats = sqlite.prepare("SELECT count(*) AS n FROM zrd_match_seats WHERE match_id = ?").get(matchId) as { n: number };
const orphanTurns = sqlite.prepare("SELECT count(*) AS n FROM zrd_match_turns WHERE match_id = ?").get(matchId) as { n: number };
check("каскад: места удалены вместе с матчем", orphanSeats.n === 0);
check("каскад: ходы удалены вместе с матчем", orphanTurns.n === 0);

sqlite.close();
fs.unlinkSync(tmpFile);

if (failures > 0) { console.error(`\n${failures} проверок провалено`); process.exit(1); }
console.log("\nПроверка миграции 0009 пройдена.");
