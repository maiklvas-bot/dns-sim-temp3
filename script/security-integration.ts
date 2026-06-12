import assert from "node:assert/strict";
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import WebSocket from "ws";

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

function toWebSocketUrl(baseUrl: string, params: Record<string, string>) {
  const url = new URL("/ws/live", baseUrl);
  url.protocol = "ws:";
  Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
  return url.toString();
}

async function expectSocketRejected(url: string, headers: Record<string, string> = {}) {
  return new Promise<number>((resolve, reject) => {
    const socket = new WebSocket(url, { headers });
    const timeout = setTimeout(() => {
      socket.terminate();
      reject(new Error(`Timed out waiting for rejected WebSocket handshake: ${url}`));
    }, 5_000);

    socket.once("open", () => {
      clearTimeout(timeout);
      socket.close();
      reject(new Error(`WebSocket handshake was unexpectedly accepted: ${url}`));
    });
    socket.once("unexpected-response", (_request, response) => {
      clearTimeout(timeout);
      response.resume();
      resolve(response.statusCode || 0);
    });
    socket.on("error", () => undefined);
  });
}

function waitForSocketMessage(
  socket: WebSocket,
  predicate: (message: any) => boolean,
  timeoutMs = 5_000,
) {
  return new Promise<any>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.off("message", onMessage);
      reject(new Error("Timed out waiting for WebSocket message"));
    }, timeoutMs);
    const onMessage = (raw: WebSocket.RawData) => {
      const message = JSON.parse(raw.toString());
      if (!predicate(message)) {
        return;
      }
      clearTimeout(timeout);
      socket.off("message", onMessage);
      resolve(message);
    };
    socket.on("message", onMessage);
  });
}

async function connectSocketAndWaitForHello(
  url: string,
  headers: Record<string, string> = {},
) {
  const socket = new WebSocket(url, { headers });
  const hello = waitForSocketMessage(socket, (message) => message.type === "hello");
  await new Promise<void>((resolve, reject) => {
    socket.once("open", () => resolve());
    socket.once("error", reject);
    socket.once("unexpected-response", (_request, response) => {
      response.resume();
      reject(new Error(`WebSocket handshake failed with ${response.statusCode}`));
    });
  });
  return { socket, hello: await hello };
}

async function run() {
  console.log("Starting security integration server...");
  const server = await startServer();
  const sockets: WebSocket[] = [];
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

    const liveResponse = await requestJson(server.baseUrl, "/api/live-sessions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: evaluator.cookie,
        "X-CSRF-Token": evaluator.csrfToken,
      },
      body: JSON.stringify({ participantName: "Live Participant" }),
    });
    assert.equal(liveResponse.response.status, 200);
    const liveSessionId = liveResponse.body.liveSessionId as string;
    const accessCode = liveResponse.body.accessCode as string;

    assert.equal(
      await expectSocketRejected(toWebSocketUrl(server.baseUrl, {
        liveSessionId,
        role: "student",
      })),
      401,
    );
    assert.equal(
      await expectSocketRejected(toWebSocketUrl(server.baseUrl, {
        liveSessionId,
        role: "student",
        accessCode: "WRONG1",
      })),
      403,
    );
    assert.equal(
      await expectSocketRejected(toWebSocketUrl(server.baseUrl, {
        liveSessionId,
        role: "assessor",
      })),
      401,
    );

    const studentConnection = await connectSocketAndWaitForHello(
      toWebSocketUrl(server.baseUrl, { liveSessionId, role: "student", accessCode }),
    );
    sockets.push(studentConnection.socket);
    assert.equal(studentConnection.hello.payload.config.liveSessionId, liveSessionId);

    const evaluatorConnection = await connectSocketAndWaitForHello(
      toWebSocketUrl(server.baseUrl, { liveSessionId, role: "assessor" }),
      { Cookie: evaluator.cookie },
    );
    sockets.push(evaluatorConnection.socket);

    const adminConnection = await connectSocketAndWaitForHello(
      toWebSocketUrl(server.baseUrl, { liveSessionId, role: "assessor" }),
      { Cookie: admin.cookie },
    );
    sockets.push(adminConnection.socket);

    const forbiddenStatus = waitForSocketMessage(
      studentConnection.socket,
      (message) => message.type === "error" && /status/i.test(message.payload?.message || ""),
    );
    studentConnection.socket.send(JSON.stringify({ type: "status", payload: "completed" }));
    await forbiddenStatus;

    const forbiddenReset = waitForSocketMessage(
      studentConnection.socket,
      (message) => message.type === "error" && /reset/i.test(message.payload?.message || ""),
    );
    studentConnection.socket.send(JSON.stringify({ type: "reset" }));
    await forbiddenReset;

    const snapshot = {
      liveSessionId,
      updatedAt: Date.now(),
      state: { isRunning: true, isCompleted: false, decisions: [] },
    };
    const assessorSnapshot = waitForSocketMessage(
      evaluatorConnection.socket,
      (message) => message.type === "snapshot" && message.payload?.updatedAt === snapshot.updatedAt,
    );
    studentConnection.socket.send(JSON.stringify({ type: "snapshot", payload: snapshot }));
    await assessorSnapshot;

    const statusAfterStudentCommands = await requestJson(server.baseUrl, `/api/live-sessions/${liveSessionId}`, {
      headers: { Cookie: evaluator.cookie },
    });
    assert.equal(statusAfterStudentCommands.response.status, 200);
    assert.equal(statusAfterStudentCommands.body.status, "running");

    const studentReset = waitForSocketMessage(studentConnection.socket, (message) => message.type === "reset");
    evaluatorConnection.socket.send(JSON.stringify({ type: "reset" }));
    await studentReset;

    const studentStatus = waitForSocketMessage(
      studentConnection.socket,
      (message) => message.type === "status" && message.payload === "running",
    );
    adminConnection.socket.send(JSON.stringify({ type: "status", payload: "running" }));
    await studentStatus;

    const forgedHttpStatus = await requestJson(server.baseUrl, `/api/live-sessions/${liveSessionId}/student-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        accessCode,
        status: "completed",
        snapshot: {
          liveSessionId,
          updatedAt: Date.now(),
          state: { isRunning: true, isCompleted: false, decisions: [] },
        },
      }),
    });
    assert.equal(forgedHttpStatus.response.status, 200);
    assert.equal(forgedHttpStatus.body.status, "running");

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
    sockets.forEach((socket) => socket.close());
    await stopServer(server);
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
