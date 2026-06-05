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
