import { existsSync, readFileSync } from "node:fs";
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
  liveRecoverSessionParamSchema,
  safeParse,
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

console.log("CI smoke checks passed");
