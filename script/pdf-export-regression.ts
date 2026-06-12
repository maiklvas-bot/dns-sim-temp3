import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { generatePdfBuffer } from "../server/pdf-export";

const tempDir = mkdtempSync(path.join(os.tmpdir(), "dns-pdf-export-"));

try {
  const echoScript = path.join(tempDir, "echo-pdf.mjs");
  writeFileSync(
    echoScript,
    [
      "const chunks = [];",
      "process.stdin.on('data', (chunk) => chunks.push(chunk));",
      "process.stdin.on('end', () => {",
      "  const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));",
      "  process.stdout.write(Buffer.from(`%PDF-${payload.participantName}`));",
      "});",
    ].join("\n"),
  );

  const pdf = await generatePdfBuffer(
    { participantName: "Participant" },
    echoScript,
    { executable: process.execPath, timeoutMs: 5_000 },
  );
  assert.equal(pdf.toString("utf8"), "%PDF-Participant");

  await assert.rejects(
    generatePdfBuffer(
      { participantName: "Participant" },
      echoScript,
      { executable: process.execPath, maxBufferBytes: 4, timeoutMs: 5_000 },
    ),
    /output limit/,
  );

  console.log("PDF export checks passed: child execution is asynchronous and output-bounded.");
} finally {
  rmSync(tempDir, { recursive: true, force: true });
}
