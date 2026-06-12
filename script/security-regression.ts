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
import { sanitizeSensitiveData } from "../server/sensitive-data";
import { buildContentSecurityPolicyDirectives } from "../server/security-headers";

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

function testSensitiveDataSanitization() {
  const sanitized = sanitizeSensitiveData({
    sessionToken: "session-value",
    participant_token_hash: "participant-hash",
    nested: {
      "csrf-token": "csrf-value",
      accessCode: "access-value",
      password: "password-value",
      authorization: "Bearer value",
      cookie: "cookie-value",
      visible: "safe-value",
    },
  }) as Record<string, any>;

  assert.equal(sanitized.sessionToken, "[REDACTED]");
  assert.equal(sanitized.participant_token_hash, "[REDACTED]");
  assert.equal(sanitized.nested["csrf-token"], "[REDACTED]");
  assert.equal(sanitized.nested.accessCode, "[REDACTED]");
  assert.equal(sanitized.nested.password, "[REDACTED]");
  assert.equal(sanitized.nested.authorization, "[REDACTED]");
  assert.equal(sanitized.nested.cookie, "[REDACTED]");
  assert.equal(sanitized.nested.visible, "safe-value");
}

function testProductionCsp() {
  const production = buildContentSecurityPolicyDirectives("production");
  assert.deepEqual(production.scriptSrc, ["'self'"]);
  assert.equal(production.scriptSrc.includes("'unsafe-eval'"), false);

  const development = buildContentSecurityPolicyDirectives("development");
  assert.equal(development.scriptSrc.includes("'unsafe-eval'"), true);
}

testSimulationSessionTokens();
testSessionForeignKeys();
testSensitiveDataSanitization();
testProductionCsp();

console.log("Security regression checks passed: tokens, foreign keys, sanitization, and CSP verified.");
