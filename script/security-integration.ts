import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";

interface RunningServer {
  baseUrl: string;
  child: ChildProcess;
  databasePath: string;
  logs: () => string;
  tempDir: string;
}

async function getAvailablePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate integration test port"));
        return;
      }
      const port = address.port;
      server.close(() => resolve(port));
    });
  });
}

async function waitForHealth(baseUrl: string, child: ChildProcess, logs: () => string) {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Integration server exited early (${child.exitCode}).\n${logs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // The server is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Integration server did not become healthy.\n${logs()}`);
}

async function startServer(): Promise<RunningServer> {
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "dns-security-integration-"));
  const databasePath = path.join(tempDir, "integration.db");
  const port = await getAvailablePort();
  const output: string[] = [];
  const child = spawn(
    process.execPath,
    [path.resolve("node_modules/tsx/dist/cli.mjs"), "server/index.ts"],
    {
      cwd: process.cwd(),
      env: {
        ...process.env,
        NODE_ENV: "development",
        PORT: String(port),
        SQLITE_PATH: databasePath,
        SESSION_SECRET: "security-integration-session-secret-000000000000",
        ADMIN_USERNAME: "security-admin",
        ADMIN_PASSWORD: "SecurityAdmin!123",
        ADMIN_DISPLAY_NAME: "Security Admin",
        EVALUATOR_USERNAME: "security-evaluator",
        EVALUATOR_PASSWORD: "SecurityEvaluator!123",
        EVALUATOR_DISPLAY_NAME: "Security Evaluator",
        SYNC_STAFF_FROM_ENV: "true",
      },
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    },
  );
  child.stdout?.on("data", (chunk) => output.push(String(chunk)));
  child.stderr?.on("data", (chunk) => output.push(String(chunk)));

  const server = {
    baseUrl: `http://127.0.0.1:${port}`,
    child,
    databasePath,
    logs: () => output.join(""),
    tempDir,
  };
  await waitForHealth(server.baseUrl, child, server.logs);
  return server;
}

async function stopServer(server: RunningServer) {
  if (server.child.exitCode == null) {
    if (process.platform === "win32" && server.child.pid) {
      spawnSync("taskkill.exe", ["/PID", String(server.child.pid), "/T", "/F"], {
        stdio: "ignore",
        windowsHide: true,
      });
    } else {
      server.child.kill("SIGTERM");
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  rmSync(server.tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}

async function requestJson(
  baseUrl: string,
  pathname: string,
  init: RequestInit = {},
): Promise<{ body: any; response: Response }> {
  const response = await fetch(`${baseUrl}${pathname}`, init);
  const raw = await response.text();
  return {
    body: raw ? JSON.parse(raw) : null,
    response,
  };
}

function getCookie(response: Response): string {
  const setCookie = response.headers.get("set-cookie");
  assert.ok(setCookie, "Staff login must set a session cookie");
  return setCookie.split(";")[0];
}

async function loginStaff(
  baseUrl: string,
  role: "admin" | "evaluator",
  username: string,
  password: string,
) {
  const result = await requestJson(baseUrl, "/api/staff/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ role, username, password }),
  });
  assert.equal(result.response.status, 200);
  return {
    cookie: getCookie(result.response),
    csrfToken: result.body.csrfToken as string,
  };
}

function exportWorkbookPayload(sessionId?: number) {
  return {
    ...(sessionId ? { sessionId } : {}),
    sheets: [{ name: "Summary", rows: [["Score"], [4]] }],
  };
}

function postJson(baseUrl: string, pathname: string, body: unknown, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function run() {
  console.log("Starting security integration server...");
  const server = await startServer();
  console.log(`Security integration server ready at ${server.baseUrl}`);
  try {
    const first = await requestJson(server.baseUrl, "/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantName: "Participant A" }),
    });
    console.log(`Created first session with status ${first.response.status}`);
    assert.equal(first.response.status, 200);
    assert.match(first.body.sessionToken, /^[0-9a-f]{64}$/);
    assert.equal("participantTokenHash" in first.body, false);

    const second = await requestJson(server.baseUrl, "/api/sessions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ participantName: "Participant B" }),
    });
    assert.equal(second.response.status, 200);
    assert.match(second.body.sessionToken, /^[0-9a-f]{64}$/);

    const anonymous = await requestJson(server.baseUrl, `/api/sessions/${first.body.id}`);
    assert.equal(anonymous.response.status, 401);

    const wrongToken = await requestJson(server.baseUrl, `/api/sessions/${first.body.id}`, {
      headers: { "X-Simulation-Token": "0".repeat(64) },
    });
    assert.equal(wrongToken.response.status, 403);

    const correctToken = await requestJson(server.baseUrl, `/api/sessions/${first.body.id}`, {
      headers: { "X-Simulation-Token": first.body.sessionToken },
    });
    assert.equal(correctToken.response.status, 200);

    const crossSession = await requestJson(server.baseUrl, `/api/sessions/${second.body.id}`, {
      headers: { "X-Simulation-Token": first.body.sessionToken },
    });
    assert.equal(crossSession.response.status, 403);

    const evaluator = await loginStaff(
      server.baseUrl,
      "evaluator",
      "security-evaluator",
      "SecurityEvaluator!123",
    );
    const evaluatorRead = await requestJson(server.baseUrl, `/api/sessions/${first.body.id}`, {
      headers: { Cookie: evaluator.cookie },
    });
    assert.equal(evaluatorRead.response.status, 200);

    const admin = await loginStaff(
      server.baseUrl,
      "admin",
      "security-admin",
      "SecurityAdmin!123",
    );
    const adminRead = await requestJson(server.baseUrl, `/api/sessions/${second.body.id}`, {
      headers: { Cookie: admin.cookie },
    });
    assert.equal(adminRead.response.status, 200);

    const anonymousExport = await postJson(
      server.baseUrl,
      "/api/export-xlsx",
      exportWorkbookPayload(),
    );
    assert.equal(anonymousExport.status, 401);

    const participantExport = await postJson(
      server.baseUrl,
      "/api/export-xlsx",
      exportWorkbookPayload(first.body.id),
      { "X-Simulation-Token": first.body.sessionToken },
    );
    assert.equal(participantExport.status, 200);

    const crossSessionExport = await postJson(
      server.baseUrl,
      "/api/export-xlsx",
      exportWorkbookPayload(second.body.id),
      { "X-Simulation-Token": first.body.sessionToken },
    );
    assert.equal(crossSessionExport.status, 403);

    const evaluatorExport = await postJson(
      server.baseUrl,
      "/api/export-xlsx",
      exportWorkbookPayload(),
      {
        Cookie: evaluator.cookie,
        "X-CSRF-Token": evaluator.csrfToken,
      },
    );
    assert.equal(evaluatorExport.status, 200);

    const adminExport = await postJson(
      server.baseUrl,
      "/api/export-xlsx",
      exportWorkbookPayload(),
      {
        Cookie: admin.cookie,
        "X-CSRF-Token": admin.csrfToken,
      },
    );
    assert.equal(adminExport.status, 200);

    const anonymousPdf = await postJson(server.baseUrl, "/api/export-pdf", {});
    assert.equal(anonymousPdf.status, 401);

    const sqlite = new Database(server.databasePath);
    const legacyId = Number(sqlite.prepare(`
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
      VALUES (?, '', 'medium', '[]', '{}', 0, 60, 0, 1, ?, 'in_progress', NULL)
    `).run("Legacy Participant", new Date().toISOString()).lastInsertRowid);
    sqlite.close();

    const legacyAnonymous = await requestJson(server.baseUrl, `/api/sessions/${legacyId}`);
    assert.equal(legacyAnonymous.response.status, 401);
    const legacyStaff = await requestJson(server.baseUrl, `/api/sessions/${legacyId}`, {
      headers: { Cookie: evaluator.cookie },
    });
    assert.equal(legacyStaff.response.status, 200);

    console.log("Security integration checks passed: persisted session access matrix verified.");
  } finally {
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
