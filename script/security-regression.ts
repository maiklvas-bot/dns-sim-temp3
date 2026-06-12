import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { runMigrations } from "../server/migrations";
import {
  createSimulationSessionToken,
  hashSimulationSessionToken,
  verifySimulationSessionToken,
} from "../server/simulation-session-access";

function testSimulationSessionTokens() {
  const token = createSimulationSessionToken();
  const tokenHash = hashSimulationSessionToken(token);

  assert.match(token, /^[0-9a-f]{64}$/);
  assert.match(tokenHash, /^[0-9a-f]{64}$/);
  assert.equal(verifySimulationSessionToken(token, tokenHash), true);
  assert.equal(verifySimulationSessionToken(`${token}0`, tokenHash), false);
  assert.equal(verifySimulationSessionToken("", tokenHash), false);
  assert.equal(verifySimulationSessionToken(token, null), false);
}

function testSessionForeignKeys() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "dns-security-regression-"));
  const sqlite = new Database(path.join(tempDir, "security.db"));

  try {
    sqlite.pragma("foreign_keys = ON");
    runMigrations(sqlite);

    const sessionColumns = sqlite
      .prepare("PRAGMA table_info(simulation_sessions)")
      .all() as Array<{ name: string }>;
    assert.ok(
      sessionColumns.some((column) => column.name === "participant_token_hash"),
      "simulation_sessions must store the participant token hash",
    );

    for (const tableName of ["session_answers", "session_metrics", "session_results"]) {
      const foreignKeys = sqlite
        .prepare(`PRAGMA foreign_key_list("${tableName}")`)
        .all() as Array<{ table: string; from: string; on_delete: string }>;

      assert.ok(
        foreignKeys.some((foreignKey) => (
          foreignKey.table === "simulation_sessions" &&
          foreignKey.from === "session_id" &&
          foreignKey.on_delete.toUpperCase() === "CASCADE"
        )),
        `${tableName} must cascade when its simulation session is deleted`,
      );
    }
  } finally {
    sqlite.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

testSimulationSessionTokens();
testSessionForeignKeys();

console.log("Security regression checks passed: participant tokens and session foreign keys verified.");
