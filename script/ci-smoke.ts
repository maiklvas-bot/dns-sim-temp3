import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import type { NextFunction, Request, Response } from "express";
import { csrfProtection, generateCsrfToken } from "../server/middleware/csrf";
import {
  clearFailedAttempts,
  getFailedLoginAttemptState,
  loginFailedAttemptLimiter,
  recordFailedLogin,
} from "../server/middleware/rate-limiter";
import {
  adminCaseReorderSchema,
  adminSettingsSchema,
  editableSimCaseSchema,
  excelExportSchema,
  listResultsQuerySchema,
  liveRecoverSessionParamSchema,
  pdfExportSchema,
  safeParse,
  sessionIdParamSchema,
} from "../server/middleware/validation";
import { createMediaNotFoundHandler } from "../server/media-static";

const requiredFiles = [
  "package.json",
  "Dockerfile",
  "docker-compose.yml",
  "docker-compose.staging.yml",
  "docker-compose.prod.yml",
  ".env.example",
  "client/src/App.tsx",
  "server/index.ts",
  "shared/schema.ts",
];

const missing = requiredFiles.filter((file) => !existsSync(file));
if (missing.length > 0) {
  throw new Error(`Missing required files: ${missing.join(", ")}`);
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
for (const scriptName of ["build", "check", "lint", "test"]) {
  if (!packageJson.scripts?.[scriptName]) {
    throw new Error(`Missing npm script: ${scriptName}`);
  }
}

type MediaAssetFile = {
  name: string;
  mimeType: string;
  storagePath: string;
};

function normalizeMediaStoragePath(storagePath: string) {
  const normalized = storagePath.replace(/\\/g, "/");
  const parts = normalized.split("/");
  assertCondition(
    normalized.length > 0 && !path.isAbsolute(normalized) && !parts.includes(".."),
    `Unsafe media storage path: ${storagePath}`,
  );

  return normalized;
}

function resolveMediaStoragePath(storagePath: string) {
  const normalized = normalizeMediaStoragePath(storagePath);
  if (normalized.startsWith("library/")) {
    return path.resolve("attached_assets", normalized.slice("library/".length));
  }

  if (normalized.startsWith("uploads/")) {
    return path.resolve("uploads", normalized.slice("uploads/".length));
  }

  throw new Error(`Unsupported media storage path: ${storagePath}`);
}

function detectMediaMime(filePath: string) {
  const bytes = readFileSync(filePath);
  if (bytes.length >= 8 && bytes.subarray(0, 8).toString("hex") === "89504e470d0a1a0a") {
    return "image/png";
  }

  if (bytes.length >= 12 && bytes.subarray(4, 8).toString("ascii") === "ftyp") {
    return "video/mp4";
  }

  if (
    (bytes.length >= 3 && bytes.subarray(0, 3).toString("ascii") === "ID3") ||
    (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
  ) {
    return "audio/mpeg";
  }

  return "unknown";
}

function assertMediaFileExists(asset: MediaAssetFile, source: string) {
  const filePath = resolveMediaStoragePath(asset.storagePath);
  assertCondition(existsSync(filePath), `${source} references missing media file: ${asset.storagePath}`);

  const detectedMime = detectMediaMime(filePath);
  const expectedMime = asset.mimeType;
  if (["audio/mpeg", "image/png", "video/mp4"].includes(expectedMime)) {
    assertCondition(
      detectedMime === expectedMime,
      `${source} media type mismatch for ${asset.storagePath}: expected ${expectedMime}, got ${detectedMime}`,
    );
  }
}

function loadBootstrapMediaAssets() {
  const raw = JSON.parse(readFileSync("script/bootstrap-content.json", "utf8")) as { assets?: MediaAssetFile[] };
  return raw.assets || [];
}

function loadLocalDatabaseMediaAssets() {
  if (!existsSync("data.db")) {
    return [];
  }

  const sqlite = new Database("data.db", { readonly: true });
  try {
    return sqlite.prepare(`
      select name, mime_type as mimeType, storage_path as storagePath
      from media_assets
      order by storage_path
    `).all() as MediaAssetFile[];
  } finally {
    sqlite.close();
  }
}

function runMediaAssetFileChecks() {
  for (const asset of loadBootstrapMediaAssets()) {
    assertMediaFileExists(asset, "Bootstrap content");
  }

  for (const asset of loadLocalDatabaseMediaAssets()) {
    assertMediaFileExists(asset, "Local data.db");
  }
}

runMediaAssetFileChecks();

function runAdminRouteContractChecks() {
  const routesSource = readFileSync("server/routes.ts", "utf8");

  assertCondition(routesSource.includes('app.get("/api/health"'), "Admin acceptance requires the health endpoint");
  assertCondition(routesSource.includes('app.get("/api/admin/staff"'), "Admin acceptance requires staff list endpoint");
  assertCondition(
    routesSource.includes('app.delete("/api/admin/results/:id"'),
    "Admin acceptance requires result deletion endpoint",
  );
  assertCondition(routesSource.includes('app.post("/api/export-pdf"'), "Admin acceptance requires PDF export endpoint");
  assertCondition(routesSource.includes('app.post("/api/export-xlsx"'), "Admin acceptance requires XLSX export endpoint");
  assertCondition(
    !/api\/export-json|exportJson|export-json/i.test(routesSource),
    "JSON export endpoint must not be exposed",
  );
}

async function runAdminStorageAcceptanceChecks() {
  const previousEnv = {
    SQLITE_PATH: process.env.SQLITE_PATH,
    ADMIN_USERNAME: process.env.ADMIN_USERNAME,
    ADMIN_PASSWORD: process.env.ADMIN_PASSWORD,
    ADMIN_DISPLAY_NAME: process.env.ADMIN_DISPLAY_NAME,
    EVALUATOR_USERNAME: process.env.EVALUATOR_USERNAME,
    EVALUATOR_PASSWORD: process.env.EVALUATOR_PASSWORD,
    EVALUATOR_DISPLAY_NAME: process.env.EVALUATOR_DISPLAY_NAME,
  };
  const tempDir = mkdtempSync(path.join(os.tmpdir(), "dns-task023-"));

  process.env.SQLITE_PATH = path.join(tempDir, "acceptance.db");
  process.env.ADMIN_USERNAME = "task023-admin";
  process.env.ADMIN_PASSWORD = "Task023Admin!";
  process.env.ADMIN_DISPLAY_NAME = "Task 023 Admin";
  process.env.EVALUATOR_USERNAME = "task023-evaluator";
  process.env.EVALUATOR_PASSWORD = "Task023Evaluator!";
  process.env.EVALUATOR_DISPLAY_NAME = "Task 023 Evaluator";

  const { sqlite } = await import("../server/db");
  try {
    const { runMigrations } = await import("../server/migrations");
    runMigrations(sqlite);

    const { staffStorage } = await import("../server/staff-storage");
    const { sessionStorage } = await import("../server/session-storage");

    await staffStorage.ensureDefaults();
    const staff = staffStorage.listStaff();
    assertCondition(staff.admins.length === 1, "Admin staff list must include the seeded admin account");
    assertCondition(staff.evaluators.length === 1, "Admin staff list must include the seeded evaluator account");
    assertCondition(staff.admins[0]?.role === "admin", "Admin staff list must preserve admin role");
    assertCondition(staff.evaluators[0]?.role === "evaluator", "Admin staff list must preserve evaluator role");
    assertCondition(!("passwordHash" in (staff.admins[0] || {})), "Admin staff list must not expose password hashes");
    assertCondition(!("passwordHash" in (staff.evaluators[0] || {})), "Evaluator staff list must not expose password hashes");
    assertCondition(
      Boolean(await staffStorage.authenticate({ role: "admin", username: "task023-admin", password: "Task023Admin!" })),
      "Seeded admin account must authenticate in the acceptance database",
    );
    assertCondition(
      Boolean(await staffStorage.authenticate({ role: "evaluator", username: "task023-evaluator", password: "Task023Evaluator!" })),
      "Seeded evaluator account must authenticate in the acceptance database",
    );

    const now = new Date().toISOString();
    const session = sessionStorage.createSimulationSession({
      participantId: null,
      participantName: "Task 023 Participant",
      evaluatorAccountId: null,
      evaluatorName: "Task 023 Admin",
      difficulty: "medium",
      selectedCaseIdsJson: JSON.stringify(["CASE-01"]),
      enabledChannelsJson: JSON.stringify({ audio: true, email: true, messenger: true, video: false }),
      manualSelection: false,
      timeLimit: 60,
      isTestMode: true,
      speedMultiplier: 1,
      startedAt: now,
      completedAt: now,
      technicalStatus: "completed",
    });

    sessionStorage.addSessionAnswer({
      sessionId: session.id,
      sourceType: "main_case",
      contentId: "CASE-01",
      caseTitle: "Task 023 Case",
      cycle: 1,
      optionLevel: 3,
      optionText: "Acceptance answer",
      score: 4,
      rawEffectsJson: JSON.stringify({ queue: -1 }),
      competencyScoresJson: JSON.stringify({ planning: 4 }),
      detailsJson: JSON.stringify({ baseScore: 4 }),
      timestamp: now,
      simTime: "09:10",
    });
    sessionStorage.addSessionMetrics({
      sessionId: session.id,
      timestamp: now,
      queue: 10,
      conversion: 50,
      morale: 70,
      revenueImpact: 100,
      deliveryStatus: 5,
    });
    sessionStorage.upsertSessionResult({
      sessionId: session.id,
      totalScore: 42,
      averageScore: 4,
      competencyAveragesJson: JSON.stringify({ planning: 4 }),
      finalMetricsJson: JSON.stringify({ queue: 10 }),
      timersJson: JSON.stringify([]),
      pausesJson: JSON.stringify([]),
      exportedAt: now,
    });

    assertCondition(sessionStorage.getSessionDetails(session.id) !== null, "Acceptance session must be readable before deletion");
    sessionStorage.deleteSessionResult(session.id);
    assertCondition(sessionStorage.getSimulationSession(session.id) === undefined, "Result deletion must remove the session row");
    assertCondition(sessionStorage.getSessionAnswers(session.id).length === 0, "Result deletion must remove session answers");
    assertCondition(sessionStorage.getSessionMetrics(session.id).length === 0, "Result deletion must remove session metrics");
    assertCondition(sessionStorage.getSessionResult(session.id) === undefined, "Result deletion must remove session result");

    await runLiveSessionRecoveryAcceptanceChecks(sqlite, tempDir);
  } finally {
    sqlite.close();
    for (const [key, value] of Object.entries(previousEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
    rmSync(tempDir, { recursive: true, force: true });
  }
}

runAdminRouteContractChecks();

async function runLiveSessionRecoveryAcceptanceChecks(sqlite: Database.Database, tempDir: string) {
  const { LiveSessionService, normalizeLiveAccessCode } = await import("../server/live-session-service");
  const storePath = path.join(tempDir, "live-sessions.json");
  const service = new LiveSessionService({ sqlite, storePath });
  const sessionInput = {
    assessorName: "Task 024 Assessor",
    participantName: "Task 024 Participant",
    participantRole: "Deputy store manager",
    difficulty: "medium" as const,
    selectedCaseIds: ["CASE-01"],
    selectedChannelItemIds: { email: ["EMAIL-01"], messenger: [], video: [] },
    manualSelection: true,
    repeatCases: false,
    timeLimit: 60,
    isTestMode: true,
    speedMultiplier: 1,
    enabledChannels: { audio: true, email: true, messenger: true, video: false },
    initialMetrics: {
      customersInStore: 12,
      avgCheck: 0,
      conversion: 44,
      nps: 3.3,
      pickupSpeed: 18,
      warehouseLoad: 21,
      teamMorale: 7,
      dailyRevenue: 10000,
    },
  };

  const config = service.createSession(sessionInput);
  assertCondition(config.liveSessionId.length > 0, "Live session creation must assign a stable id");
  assertCondition(/^[A-Z0-9]{6}$/.test(config.accessCode), "Live session creation must assign a six-character access code");
  assertCondition(
    normalizeLiveAccessCode(` ${config.accessCode.toLowerCase()} `) === config.accessCode,
    "Live access codes must normalize case and whitespace",
  );
  assertCondition(service.getSessionByAccessCode(config.accessCode.toLowerCase())?.config.liveSessionId === config.liveSessionId, "Live session lookup must normalize access codes");

  const rejectedSync = service.syncStudentState(config.liveSessionId, "WRONG1", { status: "running" });
  assertCondition(rejectedSync === null, "Live session student sync must reject mismatched access codes");

  const snapshot = {
    liveSessionId: config.liveSessionId,
    updatedAt: Date.now(),
    state: {
      sessionId: 24024,
      isRunning: true,
      isPaused: false,
      isCompleted: false,
      elapsedSeconds: 180,
      timeRemaining: 3420,
      decisions: [
        { score: 4, caseTitle: "Task 024 Case" },
        { score: 5, caseTitle: "Task 024 Follow-up" },
      ],
    },
  };

  const synced = service.syncStudentState(config.liveSessionId, config.accessCode.toLowerCase(), {
    snapshot,
    status: "running",
  });
  assertCondition(synced?.status === "running", "Live session student sync must move the session to running");
  assertCondition(synced?.presence.studentConnected === true, "Live session student sync must mark student presence");
  assertCondition((synced?.snapshot?.state as any)?.elapsedSeconds === 180, "Live session student sync must store snapshots");

  const summary = service.listSessions()[0];
  assertCondition(summary?.runtimeSessionId === 24024, "Live session monitor summary must expose runtime session id");
  assertCondition(summary?.decisionsCount === 2, "Live session monitor summary must count decisions from snapshot");
  assertCondition(summary?.currentAverageScore === 4.5, "Live session monitor summary must average snapshot decision scores");
  assertCondition(summary?.progressPercent === 5, "Live session monitor summary must derive progress from elapsed time");

  service.flushPersistence();
  const persistedRows = sqlite.prepare("SELECT payload FROM app_live_sessions").all() as Array<{ payload: string }>;
  assertCondition(persistedRows.length === 1, "Running live sessions must persist to SQLite");
  const persistedFile = JSON.parse(readFileSync(storePath, "utf8")) as { sessions?: unknown[] };
  assertCondition(persistedFile.sessions?.length === 1, "Running live sessions must persist to the JSON fallback store");

  const restarted = new LiveSessionService({ sqlite, storePath });
  restarted.restorePersistedSessions();
  const restored = restarted.getSessionById(config.liveSessionId);
  assertCondition(restored?.status === "running", "Restarted service must restore running live sessions");
  assertCondition(restored?.presence.assessorConnected === false, "Restored live session assessor presence must start disconnected");
  assertCondition(restored?.presence.studentConnected === false, "Restored live session student presence must start disconnected");
  assertCondition(restored?.config.accessCode === config.accessCode, "Restored live session must preserve access code");
  assertCondition((restored?.snapshot?.state as any)?.sessionId === 24024, "Restored live session must preserve snapshot state");
  assertCondition(
    restarted.getSessionByAccessCode(config.accessCode.toLowerCase())?.config.liveSessionId === config.liveSessionId,
    "Restarted service must restore access-code lookup",
  );

  const completed = restarted.syncStudentState(config.liveSessionId, config.accessCode, {
    status: "completed",
    snapshot: {
      ...snapshot,
      updatedAt: Date.now(),
      state: {
        ...snapshot.state,
        isCompleted: true,
      },
    },
  });
  assertCondition(completed?.status === "completed", "Live session completion must be recorded");
  const blockedRegression = restarted.syncStudentState(config.liveSessionId, config.accessCode, { status: "running" });
  assertCondition(blockedRegression?.status === "completed", "Completed live sessions must not regress to running");

  restarted.flushPersistence();
  const remainingRows = sqlite.prepare("SELECT payload FROM app_live_sessions").all() as Array<{ payload: string }>;
  assertCondition(remainingRows.length === 0, "Completed live sessions must not persist as active restart candidates");
  const completedStore = JSON.parse(readFileSync(storePath, "utf8")) as { sessions?: unknown[] };
  assertCondition(completedStore.sessions?.length === 0, "Completed live sessions must be absent from JSON restart store");

  const afterCompletedRestart = new LiveSessionService({ sqlite, storePath });
  afterCompletedRestart.restorePersistedSessions();
  assertCondition(
    afterCompletedRestart.getSessionById(config.liveSessionId) === null,
    "Restarted service must not restore completed live sessions",
  );
}

type MockCsrfRequest = Pick<Request, "method" | "path" | "headers"> & {
  session?: Partial<Request["session"]>;
};

function runCsrfCheck(req: MockCsrfRequest) {
  let nextCalled = false;
  let statusCode = 200;
  let jsonBody: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  } as Response;

  csrfProtection(
    req as Request,
    res,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  return {
    nextCalled,
    statusCode,
    jsonBody,
  };
}

function createLoginRateLimitRequest(username: string, ip: string) {
  return {
    body: { username },
    ip,
    socket: { remoteAddress: ip },
  } as unknown as Request;
}

function runLoginFailedAttemptCheck(req: Request) {
  let nextCalled = false;
  let statusCode = 200;
  let jsonBody: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  } as Response;

  loginFailedAttemptLimiter(
    req,
    res,
    (() => {
      nextCalled = true;
    }) as NextFunction,
  );

  return {
    nextCalled,
    statusCode,
    jsonBody,
  };
}

function runMediaNotFoundCheck() {
  let statusCode = 200;
  let jsonBody: unknown = null;

  const res = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      jsonBody = body;
      return this;
    },
  } as Response;

  createMediaNotFoundHandler()({} as Request, res);

  return {
    statusCode,
    jsonBody,
  };
}

function assertCondition(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertSchemaAccepts(schema: Parameters<typeof safeParse>[0], payload: unknown, message: string) {
  const result = safeParse(schema, payload);
  assertCondition(result.success, message);
}

function assertSchemaRejects(schema: Parameters<typeof safeParse>[0], payload: unknown, message: string) {
  const result = safeParse(schema, payload);
  assertCondition(!result.success, message);
}

const csrfToken = generateCsrfToken();
assertCondition(/^[0-9a-f]{64}$/.test(csrfToken), "CSRF token must be a 64-character hex string");

const authenticatedSession = {
  staff: {
    id: 1,
    username: "admin",
    displayName: "Admin",
    role: "admin",
  },
  csrfToken,
};

const missingToken = runCsrfCheck({
  method: "POST",
  path: "/api/admin/settings",
  headers: {},
  session: authenticatedSession,
});
assertCondition(!missingToken.nextCalled, "Authenticated mutating request without CSRF token must not continue");
assertCondition(missingToken.statusCode === 403, "Authenticated mutating request without CSRF token must return 403");

const invalidToken = csrfToken[0] === "a" ? `b${csrfToken.slice(1)}` : `a${csrfToken.slice(1)}`;
const invalidTokenResult = runCsrfCheck({
  method: "POST",
  path: "/api/admin/settings",
  headers: { "x-csrf-token": invalidToken },
  session: authenticatedSession,
});
assertCondition(!invalidTokenResult.nextCalled, "Authenticated mutating request with invalid CSRF token must not continue");
assertCondition(invalidTokenResult.statusCode === 403, "Authenticated mutating request with invalid CSRF token must return 403");

const validTokenResult = runCsrfCheck({
  method: "POST",
  path: "/api/admin/settings",
  headers: { "x-csrf-token": csrfToken },
  session: authenticatedSession,
});
assertCondition(validTokenResult.nextCalled, "Authenticated mutating request with valid CSRF token must continue");

const safeMethodResult = runCsrfCheck({
  method: "GET",
  path: "/api/staff/me",
  headers: {},
});
assertCondition(safeMethodResult.nextCalled, "Safe HTTP methods must bypass CSRF protection");

const rateLimitUsername = `task020-user-${Date.now()}`;
const rateLimitReq = createLoginRateLimitRequest(rateLimitUsername, "203.0.113.20");
clearFailedAttempts(rateLimitReq);
for (let attempt = 1; attempt <= 5; attempt++) {
  const preLimitResult = runLoginFailedAttemptCheck(rateLimitReq);
  assertCondition(preLimitResult.nextCalled, `Login attempt ${attempt} must pass before the failed-attempt limit`);
  recordFailedLogin(rateLimitReq);
}

const limitedState = getFailedLoginAttemptState(rateLimitReq);
assertCondition(limitedState?.count === 5, "Failed login tracker must count five failed attempts");
assertCondition(limitedState?.limited === true, "Failed login tracker must mark the sixth attempt as limited");

const blockedLogin = runLoginFailedAttemptCheck(rateLimitReq);
const blockedBody = blockedLogin.jsonBody as { code?: string; retryAfterSeconds?: number } | null;
assertCondition(!blockedLogin.nextCalled, "Sixth failed login attempt must not continue");
assertCondition(blockedLogin.statusCode === 429, "Sixth failed login attempt must return 429");
assertCondition(blockedBody?.code === "LOGIN_RATE_LIMIT_EXCEEDED", "Login rate limit response must expose a stable code");
assertCondition(
  typeof blockedBody?.retryAfterSeconds === "number" && blockedBody.retryAfterSeconds > 0,
  "Login rate limit response must include positive retryAfterSeconds",
);

const sameIpOtherUser = createLoginRateLimitRequest(`${rateLimitUsername}-other`, "203.0.113.20");
assertCondition(
  runLoginFailedAttemptCheck(sameIpOtherUser).nextCalled,
  "Login failed-attempt limit must be isolated by username on the same IP",
);

const sameUserOtherIp = createLoginRateLimitRequest(rateLimitUsername, "203.0.113.21");
assertCondition(
  runLoginFailedAttemptCheck(sameUserOtherIp).nextCalled,
  "Login failed-attempt limit must be isolated by IP for the same username",
);

const recoveryReq = createLoginRateLimitRequest(`${rateLimitUsername}-recovery`, "203.0.113.22");
for (let attempt = 1; attempt <= 4; attempt++) {
  recordFailedLogin(recoveryReq);
}
const recoveryState = getFailedLoginAttemptState(recoveryReq);
assertCondition(recoveryState?.count === 4, "Failed login tracker must retain recoverable attempts before the limit");
assertCondition(recoveryState?.limited === false, "Failed login tracker must not block below the limit");
clearFailedAttempts(recoveryReq);
assertCondition(getFailedLoginAttemptState(recoveryReq) === null, "Successful login cleanup must clear failed attempts");
assertCondition(
  runLoginFailedAttemptCheck(recoveryReq).nextCalled,
  "Login must continue after failed-attempt cleanup",
);

const missingMedia = runMediaNotFoundCheck();
const missingMediaBody = missingMedia.jsonBody as { code?: string } | null;
assertCondition(missingMedia.statusCode === 404, "Missing media assets must return 404 before the SPA fallback");
assertCondition(
  missingMediaBody?.code === "MEDIA_ASSET_NOT_FOUND",
  "Missing media assets must expose a stable MEDIA_ASSET_NOT_FOUND code",
);

assertSchemaAccepts(
  adminCaseReorderSchema,
  { ids: ["CASE-01", "CASE-02"] },
  "Admin case reorder schema must accept string ID arrays",
);
assertSchemaRejects(
  adminCaseReorderSchema,
  { ids: "CASE-01" },
  "Admin case reorder schema must reject non-array ids",
);

assertSchemaAccepts(
  adminSettingsSchema,
  {
    firstSignalMinSeconds: 15,
    waitingImageAssetId: null,
    caseWeights: { "CASE-01": 100 },
    timeInfluenceEnabled: true,
  },
  "Admin settings schema must accept bounded settings payloads",
);
assertSchemaRejects(
  adminSettingsSchema,
  { firstSignalMinSeconds: "15" },
  "Admin settings schema must reject string numbers",
);

const validCasePayload = {
  id: "CASE-01",
  title: "",
  description: "",
  primaryCompetencies: [],
  secondaryCompetencies: [],
  trigger: { type: "message", source: "", text: "" },
  zones_affected: [],
  cycles: [{
    id: "",
    cycle: 1,
    situation: "",
    signal: { type: "message", content: "" },
    options: [],
  }],
  imageAssetId: null,
  audioAssetId: null,
  timing: { minIntervalSeconds: null, maxIntervalSeconds: null, decisionDeadlineSeconds: 180, reminderIntervalSeconds: 180 },
  sortOrder: 1,
  isActive: true,
};
assertSchemaAccepts(
  editableSimCaseSchema,
  validCasePayload,
  "Editable case schema must accept existing admin draft shape",
);
assertSchemaRejects(
  editableSimCaseSchema,
  { ...validCasePayload, cycles: "not-an-array" },
  "Editable case schema must reject malformed cycles",
);

assertSchemaRejects(
  liveRecoverSessionParamSchema,
  { sessionId: "not-a-number" },
  "Live session recovery params must reject non-numeric session ids",
);

assertSchemaAccepts(
  sessionIdParamSchema,
  { id: "123" },
  "Admin result deletion params must accept numeric session ids",
);
assertSchemaRejects(
  sessionIdParamSchema,
  { id: "1 OR 1=1" },
  "Admin result deletion params must reject SQL-like session ids",
);
assertSchemaRejects(
  sessionIdParamSchema,
  { id: "-1" },
  "Admin result deletion params must reject negative session ids",
);

assertSchemaAccepts(
  listResultsQuerySchema,
  { status: "completed", participantName: "Task 023 Participant" },
  "Admin results query schema must accept bounded filters",
);
assertSchemaRejects(
  listResultsQuerySchema,
  { status: "all" },
  "Admin results query schema must reject unsupported status filters",
);

assertSchemaAccepts(
  pdfExportSchema,
  {},
  "PDF export schema must accept minimal report payloads with defaults",
);
assertSchemaRejects(
  pdfExportSchema,
  { participantName: "Task 023 Participant", format: "json" },
  "PDF export schema must reject unknown JSON-export style fields",
);
assertSchemaAccepts(
  excelExportSchema,
  { sheets: [{ name: "Summary", rows: [{ score: 4 }] }] },
  "XLSX export schema must accept sheet payloads",
);
assertSchemaRejects(
  excelExportSchema,
  { sheets: [] },
  "XLSX export schema must reject empty workbook payloads",
);

await runAdminStorageAcceptanceChecks();

console.log("CI smoke checks passed");
