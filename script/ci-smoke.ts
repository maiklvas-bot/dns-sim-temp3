import { existsSync, readFileSync } from "node:fs";
import type { NextFunction, Request, Response } from "express";
import { csrfProtection, generateCsrfToken } from "../server/middleware/csrf";
import {
  adminCaseReorderSchema,
  adminSettingsSchema,
  editableSimCaseSchema,
  liveRecoverSessionParamSchema,
  safeParse,
} from "../server/middleware/validation";

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
