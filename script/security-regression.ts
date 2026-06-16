import assert from "node:assert/strict";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

async function testSessionDeletionAndLegacyLiveMigration() {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "dns-storage-regression-"));
  const databasePath = path.join(tempDir, "storage.db");
  const legacyStorePath = path.join(tempDir, "live-sessions.json");
  process.env.SQLITE_PATH = databasePath;

  const { sqlite } = await import("../server/db");
  const { SessionStorage } = await import("../server/session-storage");
  const { LiveSessionService } = await import("../server/live-session-service");

  try {
    sqlite.pragma("foreign_keys = ON");
    runMigrations(sqlite);

    const sessionId = Number(sqlite.prepare(`
      INSERT INTO simulation_sessions (
        participant_name,
        evaluator_name,
        difficulty,
        selected_case_ids_json,
        enabled_channels_json,
        manual_selection,
        time_limit,
        is_test_mode,
        speed_multiplier,
        started_at,
        technical_status,
        participant_token_hash
      )
      VALUES ('Cascade Participant', '', 'medium', '[]', '{}', 0, 60, 0, 1, ?, 'completed', NULL)
    `).run(new Date().toISOString()).lastInsertRowid);
    sqlite.prepare(`
      INSERT INTO session_answers (
        session_id, source_type, content_id, case_title, cycle, option_level,
        option_text, score, raw_effects_json, competency_scores_json, timestamp,
        sim_time, details_json
      ) VALUES (?, 'case', 'case-1', 'Case', 1, 1, 'Answer', 4, '{}', '{}', ?, '00:01', '{}')
    `).run(sessionId, new Date().toISOString());
    sqlite.prepare(`
      INSERT INTO session_metrics (
        session_id, timestamp, queue, conversion, morale, revenue_impact, delivery_status
      ) VALUES (?, ?, 1, 1, 1, 1, 1)
    `).run(sessionId, new Date().toISOString());
    sqlite.prepare(`
      INSERT INTO session_results (
        session_id, total_score, average_score, competency_averages_json,
        final_metrics_json, timers_json, pauses_json
      ) VALUES (?, 4, 4, '{}', '{}', '[]', '[]')
    `).run(sessionId);

    new SessionStorage().deleteSessionResult(sessionId);
    for (const table of ["simulation_sessions", "session_answers", "session_metrics", "session_results"]) {
      const count = Number((sqlite.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as { count: number }).count);
      assert.equal(count, 0, `${table} must be empty after deleting the parent session`);
    }

    const liveSessionId = "legacy-live-session";
    writeFileSync(legacyStorePath, JSON.stringify({
      version: 1,
      sessions: [{
        config: {
          liveSessionId,
          accessCode: "ABC123",
          assessorName: "Legacy Evaluator",
          participantName: "Legacy Participant",
          participantRole: "Participant",
          difficulty: "medium",
          selectedCaseIds: [],
          manualSelection: false,
          repeatCases: false,
          timeLimit: 60,
          isTestMode: false,
          speedMultiplier: 1,
          enabledChannels: { audio: true, email: true, messenger: true, video: false },
          initialMetrics: {},
          createdAt: Date.now(),
        },
        snapshot: null,
        presence: { assessorConnected: false, studentConnected: false },
        status: "waiting",
        completedAt: null,
        updatedAt: Date.now(),
        lastSeenAt: { assessor: null, student: null },
      }],
    }));

    const liveService = new LiveSessionService({ sqlite, storePath: legacyStorePath });
    liveService.restorePersistedSessions();
    assert.ok(liveService.getSessionById(liveSessionId));
    const persisted = sqlite
      .prepare("SELECT COUNT(*) AS count FROM app_live_sessions WHERE live_session_id = ?")
      .get(liveSessionId) as { count: number };
    assert.equal(Number(persisted.count), 1, "Legacy live session must be migrated into SQLite");
    assert.equal(existsSync(legacyStorePath), false, "Legacy JSON must be removed after successful migration");

    liveService.flushPersistence();
    assert.equal(existsSync(legacyStorePath), false, "Subsequent persistence must not recreate legacy JSON");
  } finally {
    sqlite.close();
    rmSync(tempDir, { recursive: true, force: true });
  }
}

testSimulationSessionTokens();
testSessionForeignKeys();
testSensitiveDataSanitization();
testProductionCsp();
await testSessionDeletionAndLegacyLiveMigration();

console.log("Security regression checks passed: tokens, foreign keys, sanitization, and CSP verified.");
