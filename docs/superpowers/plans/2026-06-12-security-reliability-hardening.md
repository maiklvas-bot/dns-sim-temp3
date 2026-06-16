# TASK-050 Security and Reliability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Закрыть публичный доступ к persisted/live sessions и экспорту, устранить утечки в логах и расхождение расчетов, укрепить SQLite и добавить поведенческие тесты без изменения пользовательских сценариев.

**Architecture:** Participant получает одноразово выданный token, сервер хранит только SHA-256 hash и проверяет заголовок на каждой операции. Staff-сессия дает admin/evaluator полный доступ ко всем сессиям. Общие вычисления переносятся в чистый shared-модуль, а интеграционные тесты запускают настоящий Express/WebSocket server на временной SQLite DB.

**Tech Stack:** TypeScript, React 18, Express 5, express-session, ws, SQLite/better-sqlite3, Drizzle, Zod, Vite, Playwright Chromium.

---

### Task 1: Participant token primitives and SQLite schema

**Files:**
- Create: `server/simulation-session-access.ts`
- Create: `migrations/0007_session_access_and_integrity.sql`
- Modify: `shared/schema.ts`
- Modify: `server/migrations.ts`
- Test: `script/security-regression.ts`

- [ ] **Step 1: Write failing token and migration tests**

Add assertions to `script/security-regression.ts` that import:

```ts
import {
  createSimulationSessionToken,
  hashSimulationSessionToken,
  verifySimulationSessionToken,
} from "../server/simulation-session-access";
```

The test must assert:

```ts
const token = createSimulationSessionToken();
assert.match(token, /^[0-9a-f]{64}$/);
assert.equal(verifySimulationSessionToken(token, hashSimulationSessionToken(token)), true);
assert.equal(verifySimulationSessionToken(`${token}0`, hashSimulationSessionToken(token)), false);
```

Create a temporary SQLite DB, run migrations, and assert:

```sql
PRAGMA table_info(simulation_sessions)
```

contains `participant_token_hash`, and:

```sql
PRAGMA foreign_key_list(session_answers)
PRAGMA foreign_key_list(session_metrics)
PRAGMA foreign_key_list(session_results)
```

all reference `simulation_sessions` with `on_delete = CASCADE`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/security-regression.ts
```

Expected: failure because `server/simulation-session-access.ts` and migration `0007` do not exist.

- [ ] **Step 3: Implement token primitives**

Create:

```ts
import crypto from "crypto";

export const SIMULATION_TOKEN_HEADER = "x-simulation-token";

export function createSimulationSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function hashSimulationSessionToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

export function verifySimulationSessionToken(token: string, expectedHash: string | null | undefined): boolean {
  if (!token || !expectedHash) return false;
  const actual = Buffer.from(hashSimulationSessionToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}
```

- [ ] **Step 4: Implement migration and Drizzle schema**

Migration `0007_session_access_and_integrity.sql` must:

1. Add nullable `participant_token_hash`.
2. Rebuild `session_answers`, `session_metrics`, and `session_results`.
3. Copy rows through `INNER JOIN simulation_sessions`.
4. Add `FOREIGN KEY(session_id) REFERENCES simulation_sessions(id) ON DELETE CASCADE`.
5. Restore indexes and the unique result constraint.

Update `shared/schema.ts` with `participantTokenHash` and `.references(() => simulationSessions.id, { onDelete: "cascade" })`.

Add `ensureColumn(..., "participant_token_hash", "TEXT")` as compatibility defense.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/security-regression.ts
npm.cmd run check
```

Expected: token/schema assertions pass and TypeScript exits 0.

- [ ] **Step 6: Commit**

```powershell
git add server/simulation-session-access.ts migrations/0007_session_access_and_integrity.sql shared/schema.ts server/migrations.ts script/security-regression.ts
git commit -m "TASK-050: add participant session credentials"
```

### Task 2: Protect persisted simulation session APIs

**Files:**
- Modify: `server/simulation-session-access.ts`
- Modify: `server/session-storage.ts`
- Modify: `server/routes.ts`
- Modify: `server/middleware/validation.ts`
- Test: `script/security-integration.ts`

- [ ] **Step 1: Write failing HTTP integration tests**

Start `server/index.ts` as a child process with temporary `SQLITE_PATH`, random port, and known admin/evaluator credentials.

Test this sequence:

```text
POST /api/sessions -> 200, response contains 64-char sessionToken
GET /api/sessions/:id without token -> 401
GET /api/sessions/:id with wrong token -> 403
GET /api/sessions/:id with correct X-Simulation-Token -> 200
token from session A against session B -> 403
evaluator login cookie GET session A without participant token -> 200
admin login cookie GET session B without participant token -> 200
legacy row with NULL participant_token_hash -> participant 401, staff 200
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/security-integration.ts
```

Expected: anonymous GET currently returns 200.

- [ ] **Step 3: Add session access middleware**

Implement:

```ts
export function requireSimulationAccess(sessionStorage: SessionStorage) {
  return (req: Request, res: Response, next: NextFunction) => {
    const id = Number((req.validatedParams as { id: string }).id);
    const simulationSession = sessionStorage.getSimulationSession(id);
    if (!simulationSession) return res.status(404).json({ message: "Session not found" });
    if (req.session.staff) {
      req.simulationSession = simulationSession;
      return next();
    }
    const token = String(req.headers[SIMULATION_TOKEN_HEADER] || "");
    if (!simulationSession.participantTokenHash || !token) {
      return res.status(401).json({ message: "Simulation token required", code: "SIMULATION_TOKEN_REQUIRED" });
    }
    if (!verifySimulationSessionToken(token, simulationSession.participantTokenHash)) {
      return res.status(403).json({ message: "Invalid simulation token", code: "SIMULATION_TOKEN_INVALID" });
    }
    req.simulationSession = simulationSession;
    next();
  };
}
```

Extend the Express request type for `simulationSession`.

- [ ] **Step 4: Generate and store tokens**

In `POST /api/sessions`:

```ts
const sessionToken = createSimulationSessionToken();
const session = sessionStorage.createSimulationSession({
  ...input,
  participantTokenHash: hashSimulationSessionToken(sessionToken),
});
res.json({ ...session, participantTokenHash: undefined, sessionToken });
```

Never return `participantTokenHash`.

- [ ] **Step 5: Apply middleware**

Apply `requireSimulationAccess` after parameter validation to every `/api/sessions/:id` read/write endpoint. Ensure answer, metric and result insertion first verifies parent access.

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/security-integration.ts
npm.cmd run test
npm.cmd run check
```

Expected: all access matrix assertions pass.

- [ ] **Step 7: Commit**

```powershell
git add server/simulation-session-access.ts server/session-storage.ts server/routes.ts server/middleware/validation.ts script/security-integration.ts
git commit -m "TASK-050: protect persisted simulation sessions"
```

### Task 3: Persist participant token on the client

**Files:**
- Create: `client/src/lib/simulation-session-access.ts`
- Create: `client/src/features/simulation-engine/persistence/session-sync-client.ts`
- Modify: `client/src/lib/queryClient.ts`
- Modify: `client/src/features/simulation-engine/SimulationProviderRuntime.tsx`
- Modify: `client/src/pages/results.tsx`
- Test: `script/client-session-access-regression.ts`

- [ ] **Step 1: Write failing client credential tests**

Use a minimal fake `window.sessionStorage` and assert:

```ts
setSimulationSessionCredential(12, "abc");
assert.equal(getSimulationSessionToken(12), "abc");
assert.equal(getSimulationSessionToken(13), null);
clearSimulationSessionCredential();
assert.equal(getSimulationSessionToken(12), null);
```

Assert `buildSimulationAccessHeaders(12)` returns `{ "X-Simulation-Token": "abc" }`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/client-session-access-regression.ts
```

Expected: module import fails.

- [ ] **Step 3: Implement credential storage**

Store one credential object:

```ts
interface SimulationSessionCredential {
  sessionId: number;
  token: string;
}
```

under `dns-simcenter.simulation-session`, using `sessionStorage` only.

- [ ] **Step 4: Extend API requests**

Change:

```ts
apiRequest(method, url, data?, options?: { headers?: Record<string, string>; keepalive?: boolean })
```

Merge caller headers after standard content type and CSRF headers. Do not log them.

- [ ] **Step 5: Extract authorized sync client**

`session-sync-client.ts` exports:

```ts
createPersistedSession(payload)
getPersistedSession(id)
updatePersistedSession(id, payload, options?)
appendPersistedAnswer(id, payload)
appendPersistedMetrics(id, payload)
savePersistedResult(id, payload)
```

Every operation after creation reads the token for the matching ID and sends `X-Simulation-Token`. Creation stores `{ sessionId, sessionToken }`.

- [ ] **Step 6: Integrate provider and results**

Replace direct `/api/sessions` calls in `SimulationProviderRuntime.tsx` with the sync client. The `beforeunload` request must include the token and `keepalive: true`.

In `results.tsx`, participant GET/export paths use the matching credential. Staff persisted result pages continue using `/api/staff/results/:id`.

- [ ] **Step 7: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/client-session-access-regression.ts
npm.cmd run check
npm.cmd run test
```

- [ ] **Step 8: Commit**

```powershell
git add client/src/lib/simulation-session-access.ts client/src/lib/queryClient.ts client/src/features/simulation-engine/persistence/session-sync-client.ts client/src/features/simulation-engine/SimulationProviderRuntime.tsx client/src/pages/results.tsx script/client-session-access-regression.ts
git commit -m "TASK-050: authorize participant session sync"
```

### Task 4: Protect exports and make PDF generation asynchronous

**Files:**
- Create: `server/export-access.ts`
- Create: `server/pdf-export.ts`
- Modify: `server/middleware/validation.ts`
- Modify: `server/routes.ts`
- Modify: `client/src/lib/report-data.tsx`
- Modify: `client/src/pages/results.tsx`
- Test: `script/security-integration.ts`

- [ ] **Step 1: Add failing export tests**

Verify:

```text
anonymous XLSX without sessionId/token -> 401
participant XLSX with own sessionId/token -> 200
participant XLSX with another sessionId/token -> 403
evaluator XLSX without sessionId/token -> 200
admin PDF/XLSX without participant token -> authorized
```

The PDF authorization assertion may stop before Python execution by testing exported middleware directly; the XLSX route proves complete HTTP flow.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/security-integration.ts
```

Expected: anonymous export currently succeeds.

- [ ] **Step 3: Add export access middleware**

Add optional positive integer `sessionId` to both export schemas.

Implement:

```ts
if (req.session.staff) return next();
if (!body.sessionId) return res.status(401).json({ message: "Simulation token required" });
return requireAccessForId(body.sessionId, req, res, next);
```

- [ ] **Step 4: Add session ID to participant export payloads**

`buildPdfPayloadFromReport` includes `sessionId: report.sessionId || undefined`. XLSX participant payload includes `sessionId: state.sessionId`.

Staff aggregate exports omit `sessionId` and remain authorized by cookie.

- [ ] **Step 5: Replace blocking PDF process**

`server/pdf-export.ts` uses `spawn("python3", [scriptPath])`, writes JSON to stdin, collects stdout/stderr with a 20 MB cap, kills the child after 60 seconds, and resolves a `Buffer`.

Route awaits:

```ts
const pdf = await generatePdfBuffer(payload, scriptPath);
res.send(pdf);
```

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/security-integration.ts
npm.cmd run check
npm.cmd run test
```

- [ ] **Step 7: Commit**

```powershell
git add server/export-access.ts server/pdf-export.ts server/middleware/validation.ts server/routes.ts client/src/lib/report-data.tsx client/src/pages/results.tsx script/security-integration.ts
git commit -m "TASK-050: secure report exports"
```

### Task 5: Authenticate WebSocket roles and commands

**Files:**
- Create: `server/staff-session.ts`
- Create: `server/live-socket-auth.ts`
- Modify: `server/index.ts`
- Modify: `server/routes.ts`
- Modify: `server/live-session-service.ts`
- Modify: `client/src/lib/live-session.ts`
- Modify: `client/src/features/simulation-engine/SimulationProviderRuntime.tsx`
- Test: `script/security-integration.ts`

- [ ] **Step 1: Add failing WebSocket tests**

Verify:

```text
student without accessCode -> handshake rejected
student with wrong accessCode -> rejected
student with matching accessCode -> hello received
assessor without staff cookie -> rejected
evaluator/admin cookie -> assessor hello received
student status/reset messages -> error and unchanged session
student snapshot -> assessor receives snapshot
assessor reset/status -> accepted
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/security-integration.ts
```

Expected: forged assessor/student connections are accepted.

- [ ] **Step 3: Share staff session middleware**

Move `SqliteSessionStore`, session secret resolution and configured `session(...)` instance into `server/staff-session.ts`.

Export:

```ts
export const staffSessionMiddleware: RequestHandler;
export function parseStaffUpgradeSession(request: IncomingMessage): Promise<StaffPrincipal | null>;
```

Both HTTP and WebSocket use the same cookie name, secret and SQLite store.

- [ ] **Step 4: Validate handshake**

`live-socket-auth.ts` resolves:

```ts
type SocketContext =
  | { liveSessionId: string; role: "student" }
  | { liveSessionId: string; role: "assessor"; staff: StaffPrincipal };
```

Student requires matching `accessCode`. Assessor requires parsed staff session.

- [ ] **Step 5: Enforce message permissions**

In `handleSocketMessage`:

```ts
snapshot -> student only
reset -> assessor only
status -> assessor only
```

Student completion/running status is derived from snapshot state.

- [ ] **Step 6: Update client socket URL**

`connectToLiveSimulationSession` accepts `accessCode?: string`. Student connection appends it; assessor relies on same-origin cookie. Remove `sendStatus` calls from student provider effects.

- [ ] **Step 7: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/security-integration.ts
npm.cmd run check
npm.cmd run test
```

- [ ] **Step 8: Commit**

```powershell
git add server/staff-session.ts server/live-socket-auth.ts server/index.ts server/routes.ts server/live-session-service.ts client/src/lib/live-session.ts client/src/features/simulation-engine/SimulationProviderRuntime.tsx script/security-integration.ts
git commit -m "TASK-050: authenticate live session sockets"
```

### Task 6: Sanitize logging and tighten production CSP

**Files:**
- Create: `server/sensitive-data.ts`
- Modify: `server/audit-storage.ts`
- Modify: `server/index.ts`
- Test: `script/security-regression.ts`
- Test: `script/security-integration.ts`

- [ ] **Step 1: Write failing sanitizer/log/CSP tests**

Assert recursive sanitization redacts normalized keys including:

```text
sessionToken
participantTokenHash
csrfToken
accessCode
password
authorization
cookie
```

Start the test server, create/login/join, capture stdout, and assert known token values are absent.

Build production CSP directives and assert `script-src` excludes `unsafe-eval`.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/security-regression.ts
npx.cmd tsx script/security-integration.ts
```

Expected: participant token is not currently covered and response JSON appears in access logs.

- [ ] **Step 3: Centralize sanitization**

Export `sanitizeSensitiveData(value)` from `server/sensitive-data.ts`. Normalize keys by removing `_` and `-` before checking the sensitive set.

Use it in audit storage for `before`, `after`, and `metadata`.

- [ ] **Step 4: Remove response bodies from access logs**

Delete `res.json` interception and log:

```ts
log(`${req.method} ${req.path} ${res.statusCode} in ${duration}ms requestId=${requestId}`);
```

Use the existing request ID from error middleware or assign one at request start.

- [ ] **Step 5: Make CSP environment-aware**

Set:

```ts
scriptSrc: process.env.NODE_ENV === "development"
  ? ["'self'", "'unsafe-inline'", "'unsafe-eval'"]
  : ["'self'"]
```

- [ ] **Step 6: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/security-regression.ts
npx.cmd tsx script/security-integration.ts
npm.cmd run check
```

- [ ] **Step 7: Commit**

```powershell
git add server/sensitive-data.ts server/audit-storage.ts server/index.ts script/security-regression.ts script/security-integration.ts
git commit -m "TASK-050: redact sensitive server data"
```

### Task 7: Make SQLite authoritative for live persistence

**Files:**
- Modify: `server/live-session-service.ts`
- Modify: `server/session-storage.ts`
- Test: `script/security-regression.ts`

- [ ] **Step 1: Write failing persistence and cascade tests**

Create orphan-prone session children, delete the parent through `SessionStorage.deleteSessionResult`, and assert all child counts are zero.

Create a legacy `live-sessions.json` with an active session and empty `app_live_sessions`; restore and assert:

```text
session exists in SQLite
legacy JSON no longer exists
subsequent persistence writes only SQLite
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/security-regression.ts
```

Expected: live service writes JSON again.

- [ ] **Step 3: Use cascade delete**

Replace manual child deletes with:

```ts
db.delete(simulationSessions).where(eq(simulationSessions.id, sessionId)).run();
```

- [ ] **Step 4: Change live persistence**

`persistSessions()` updates SQLite only.

`restorePersistedSessions()`:

1. Restores SQLite rows.
2. If rows exist, skips JSON.
3. If SQLite is empty and JSON exists, restores JSON.
4. Calls `persistSessions()`.
5. Deletes JSON only after successful SQLite write.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/security-regression.ts
npm.cmd run test:ops
npm.cmd run check
```

- [ ] **Step 6: Commit**

```powershell
git add server/live-session-service.ts server/session-storage.ts script/security-regression.ts
git commit -m "TASK-050: make sqlite live storage authoritative"
```

### Task 8: Unify scoring calculations

**Files:**
- Create: `shared/simulation-scoring.ts`
- Modify: `client/src/features/simulation-engine/SimulationProviderRuntime.tsx`
- Modify: `client/src/lib/report-data.tsx`
- Modify: `server/routes.ts`
- Test: `script/scoring-parity.ts`

- [ ] **Step 1: Write failing parity fixture**

Define decisions with:

```ts
[
  { caseId: "CASE-01", sourceType: "main_case", score: 4, competencyScores: { planning: 4 } },
  { caseId: "EMAIL-01", sourceType: "email", score: 2, competencyScores: { planning: 3, communication: 2 } },
]
```

Settings include `caseWeights: { "CASE-01": 2 }` and `timeInfluenceEnabled: true`.

Assert a single shared function returns exact total, average and competency averages expected by current runtime formula.

- [ ] **Step 2: Verify RED**

Run:

```powershell
npx.cmd tsx script/scoring-parity.ts
```

Expected: shared module missing.

- [ ] **Step 3: Implement shared scorer**

Export:

```ts
getCaseWeightRatio(...)
getTimeEvaluationCoefficient(...)
accumulateCompetencyTotals(...)
buildCompetencyAverageMap(...)
calculateSimulationScoreSummary(...)
```

Inputs contain plain JSON-compatible decisions/settings; no React or browser dependencies.

- [ ] **Step 4: Replace duplicate formulas**

Runtime result persistence, report building and server recovery call the shared functions. Preserve existing clamping, weight and time coefficient behavior exactly.

- [ ] **Step 5: Verify GREEN**

Run:

```powershell
npx.cmd tsx script/scoring-parity.ts
npm.cmd run test
npm.cmd run check
```

- [ ] **Step 6: Commit**

```powershell
git add shared/simulation-scoring.ts client/src/features/simulation-engine/SimulationProviderRuntime.tsx client/src/lib/report-data.tsx server/routes.ts script/scoring-parity.ts
git commit -m "TASK-050: centralize simulation scoring"
```

### Task 9: Remove reference assets from production bundle

**Files:**
- Modify: `client/src/lib/brand-assets.ts`
- Modify: `script/check-ui-acceptance.mjs`
- Test: `script/check-ui-acceptance.mjs`

- [ ] **Step 1: Write failing bundle contract**

After build, recursively inspect `dist/public/assets` and fail if a filename contains:

```text
reference_main_screen_mockup
reference_full_project_mockup
```

- [ ] **Step 2: Verify RED**

Run:

```powershell
npm.cmd run build
npm.cmd run test:ui
```

Expected: reference assets are present.

- [ ] **Step 3: Remove static reference imports**

Delete the two imports and `BRAND_ASSETS.reference` runtime entries. Keep source PNG files untouched.

- [ ] **Step 4: Verify GREEN**

Run:

```powershell
npm.cmd run build
npm.cmd run test:ui
```

Expected: bundle contract passes.

- [ ] **Step 5: Commit**

```powershell
git add client/src/lib/brand-assets.ts script/check-ui-acceptance.mjs
git commit -m "TASK-050: exclude design references from bundle"
```

### Task 10: Add real browser acceptance and final verification

**Files:**
- Create: `script/browser-acceptance.mjs`
- Modify: `package.json`
- Modify: `package-lock.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `docs/TEST_PLAN.md`

- [ ] **Step 1: Add Playwright and failing browser test**

Install:

```powershell
npm.cmd install --save-dev @playwright/test
```

Create `script/browser-acceptance.mjs` that starts the dev server with a temporary DB, launches Chromium, and checks `/`, `/student`, `/staff-login`.

For viewports `1920x1080`, `1366x768`, `390x844`, assert:

```js
document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1
```

Also assert CTA navigation, instruction dialog, theme toggle and no console errors.

- [ ] **Step 2: Verify RED**

Temporarily assert a nonexistent heading and run:

```powershell
npm.cmd run test:browser
```

Expected: Playwright failure naming the missing heading. Restore the real assertion before implementation proceeds.

- [ ] **Step 3: Wire scripts and CI**

Add:

```json
"test:browser": "node script/browser-acceptance.mjs"
```

CI installs Chromium:

```yaml
- name: Install browser
  run: npx playwright install --with-deps chromium
- name: Browser acceptance
  run: npm run test:browser
```

Document local browser installation and test command.

- [ ] **Step 4: Run browser acceptance**

```powershell
npx.cmd playwright install chromium
npm.cmd run test:browser
```

Expected: all routes/viewports pass with zero console errors.

- [ ] **Step 5: Run complete verification**

```powershell
npm.cmd run check
npm.cmd run test
npm.cmd run test:ui
npm.cmd run test:ops
npm.cmd run test:browser
npm.cmd run build
node script/check-docker-safety.mjs
docker compose build app
```

Expected: every available command exits 0. If `docker` is unavailable, record the exact environment error and do not claim Docker verification.

- [ ] **Step 6: Review diff and protected scope**

Run:

```powershell
git diff origin/main...HEAD --check
git status --short
git diff origin/main...HEAD --name-only
```

Confirm scenario content, media files, visual layouts, `.env*`, Docker deployment files and backup scripts were not modified.

- [ ] **Step 7: Commit**

```powershell
git add script/browser-acceptance.mjs package.json package-lock.json .github/workflows/ci.yml docs/TEST_PLAN.md
git commit -m "TASK-050: add browser security acceptance"
```
