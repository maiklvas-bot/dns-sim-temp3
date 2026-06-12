import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { chromium } from "@playwright/test";

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1366, height: 768 },
  { width: 390, height: 844 },
];

function getAvailablePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate browser acceptance port"));
        return;
      }
      server.close(() => resolve(address.port));
    });
  });
}

async function waitForServer(baseUrl, child, logs) {
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    if (child.exitCode != null) {
      throw new Error(`Browser acceptance server exited early (${child.exitCode}).\n${logs()}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/health`);
      if (response.ok) {
        return;
      }
    } catch {
      // Vite and the API are still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Browser acceptance server did not become healthy.\n${logs()}`);
}

function stopServer(child) {
  if (child.exitCode != null) {
    return;
  }
  if (process.platform === "win32" && child.pid) {
    spawnSync("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], {
      stdio: "ignore",
      windowsHide: true,
    });
  } else {
    child.kill("SIGTERM");
  }
}

async function assertNoHorizontalOverflow(page, label) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  assert.ok(
    dimensions.scrollWidth <= dimensions.clientWidth + 1,
    `${label} has horizontal overflow: ${dimensions.scrollWidth}px > ${dimensions.clientWidth}px`,
  );
}

async function verifyRoute(page, baseUrl, route, heading, label) {
  await page.goto(`${baseUrl}/#${route}`, { waitUntil: "domcontentloaded" });
  await page.locator("main").waitFor({ state: "visible" });
  await page.getByRole("heading", { name: heading, exact: true }).waitFor({ state: "visible" });
  await page.waitForTimeout(250);
  await assertNoHorizontalOverflow(page, label);
}

async function runViewport(browser, baseUrl, viewport) {
  const context = await browser.newContext({ viewport });
  await context.addInitScript(() => window.localStorage.clear());
  const page = await context.newPage();
  const browserErrors = [];

  page.on("console", (message) => {
    if (message.type() === "error") {
      browserErrors.push(`console: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => browserErrors.push(`pageerror: ${error.message}`));

  const viewportLabel = `${viewport.width}x${viewport.height}`;
  try {
    await verifyRoute(page, baseUrl, "/", "DNS SimCenter", `${viewportLabel} home`);

    const themeToggle = page.locator(".dns-theme-toggle");
    assert.equal(await themeToggle.count(), 1, `${viewportLabel} must expose one theme toggle`);
    await themeToggle.click();
    await page.locator("html[data-dns-theme='light']").waitFor({ state: "attached" });
    await assertNoHorizontalOverflow(page, `${viewportLabel} home light theme`);

    const instructionButton = page.getByRole("button", { name: "Инструкция", exact: true });
    assert.equal(await instructionButton.count(), 1, `${viewportLabel} must expose one instruction button`);
    await instructionButton.click();
    await page.getByRole("heading", { name: "Инструкция для космонавта", exact: true }).waitFor({ state: "visible" });
    const dialog = page.getByRole("dialog");
    const closeDialog = page.getByRole("button", { name: "Close", exact: true });
    assert.equal(await closeDialog.count(), 1, `${viewportLabel} instruction dialog must expose one close button`);
    await closeDialog.click();
    await dialog.waitFor({ state: "hidden" });

    await page.getByTestId("role-participant").click();
    await page.waitForURL(/#\/student$/);
    await page.getByRole("heading", { name: "Вход космонавта", exact: true }).waitFor({ state: "visible" });
    await assertNoHorizontalOverflow(page, `${viewportLabel} participant CTA target`);

    await verifyRoute(page, baseUrl, "/student", "Вход космонавта", `${viewportLabel} student`);
    assert.equal(await page.getByTestId("student-live-access-code").count(), 1);
    assert.equal(await page.getByTestId("student-join-live-session").count(), 1);

    await verifyRoute(page, baseUrl, "/staff-login", "Служебный вход", `${viewportLabel} staff login`);
    assert.equal(await page.getByTestId("staff-login-username").count(), 1);
    assert.equal(await page.getByTestId("staff-login-password").count(), 1);
    assert.equal(await page.getByTestId("staff-login-submit").count(), 1);

    assert.deepEqual(browserErrors, [], `${viewportLabel} emitted browser errors:\n${browserErrors.join("\n")}`);
  } finally {
    await context.close();
  }
}

const tempDir = mkdtempSync(path.join(os.tmpdir(), "dns-browser-acceptance-"));
const port = await getAvailablePort();
const baseUrl = `http://127.0.0.1:${port}`;
const output = [];
const server = spawn(
  process.execPath,
  [path.resolve("node_modules/tsx/dist/cli.mjs"), "server/index.ts"],
  {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: "development",
      HOST: "127.0.0.1",
      PORT: String(port),
      SQLITE_PATH: path.join(tempDir, "browser.db"),
      SESSION_SECRET: "browser-acceptance-session-secret-000000000",
      ADMIN_PASSWORD: "BrowserAcceptanceAdmin!123",
      EVALUATOR_PASSWORD: "BrowserAcceptanceEvaluator!123",
    },
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  },
);
server.stdout?.on("data", (chunk) => output.push(String(chunk)));
server.stderr?.on("data", (chunk) => output.push(String(chunk)));

let browser;
try {
  await waitForServer(baseUrl, server, () => output.join(""));
  browser = await chromium.launch({ headless: true });
  for (const viewport of viewports) {
    await runViewport(browser, baseUrl, viewport);
  }
  console.log("Browser acceptance checks passed: auth routes, navigation, themes, dialogs, overflow, and console verified.");
} finally {
  await browser?.close();
  stopServer(server);
  rmSync(tempDir, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 });
}
