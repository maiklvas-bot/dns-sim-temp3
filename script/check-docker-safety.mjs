import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";

function readText(filePath) {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function trackedFiles(pathspec) {
  const output = execFileSync("git", ["ls-files", "--", pathspec], { encoding: "utf8" }).trim();
  return output ? output.split(/\r?\n/) : [];
}

const dockerfile = readText("Dockerfile");
const compose = readText("docker-compose.yml");
const entrypoint = readText("docker/entrypoint.sh");
const dockerignore = readText(".dockerignore");

const transferInstructions = dockerfile
  .split("\n")
  .map((line) => line.trim())
  .filter((line) => /^(?:COPY|ADD)\s/i.test(line));
const repositoryTransferInstructions = transferInstructions.filter((line) => !/^COPY\s+--from=/i.test(line));

assertCondition(
  repositoryTransferInstructions.every((line) => !/^(?:COPY|ADD)\s+(?:--\S+\s+)*\.\s+/i.test(line)),
  "Dockerfile must use an explicit COPY/ADD allowlist instead of copying the repository root",
);
assertCondition(
  repositoryTransferInstructions.every((line) => !/\bdata\.db\b/i.test(line)),
  "Dockerfile must never copy the repository data.db",
);
assertCondition(
  repositoryTransferInstructions.every(
    (line) => !/(?:^|\s)\.env(?:\.[^\s]+)?(?:\s|$)/i.test(line.replaceAll(".env.example", "")),
  ),
  "Dockerfile must never copy environment secret files into an image",
);
assertCondition(
  dockerfile.includes("SQLITE_PATH=/app/bootstrap/data.db npm run db:migrate") &&
    dockerfile.includes("SQLITE_PATH=/app/bootstrap/data.db npm run db:seed-simulation"),
  "Docker bootstrap database must be generated separately from persistent production data",
);
assertCondition(
  dockerfile.includes("ENV SQLITE_PATH=/app/data/data.db"),
  "Production SQLite path must remain inside the persistent /app/data mount",
);
assertCondition(
  dockerfile.includes("COPY --from=builder /app/bootstrap/data.db ./bootstrap/data.db"),
  "Production image must contain the first-run bootstrap database",
);
assertCondition(
  dockerfile.includes("COPY --from=builder /app/uploads ./uploads"),
  "Production image must include the verified bundled media files",
);

assertCondition(
  entrypoint.includes('if [ ! -f "$SQLITE_PATH" ] && [ -f "$BUNDLED_DB" ]; then'),
  "Entrypoint must initialize SQLite only when the persistent database does not exist",
);
assertCondition(
  entrypoint.includes('cp "$BUNDLED_DB" "$SQLITE_PATH"'),
  "Entrypoint must copy only the bundled bootstrap database to a missing persistent database",
);
assertCondition(
  !/(?:rm|mv|truncate)\s+[^\n]*\$SQLITE_PATH|>\s*"?\$SQLITE_PATH"?/i.test(entrypoint),
  "Entrypoint must not delete, move, truncate, or overwrite an existing SQLite database",
);

for (const requiredComposeLine of [
  "SQLITE_PATH: /app/data/data.db",
  "- ./storage/data:/app/data",
  "- ./uploads:/app/uploads",
]) {
  assertCondition(
    compose.includes(requiredComposeLine),
    `docker-compose.yml is missing persistence contract: ${requiredComposeLine}`,
  );
}

for (const requiredIgnoreRule of [".env", "data/", "storage/", "backups/", "*.key", "*.pem"]) {
  assertCondition(
    dockerignore.split("\n").some((line) => line.trim() === requiredIgnoreRule),
    `.dockerignore must protect ${requiredIgnoreRule}`,
  );
}

assertCondition(trackedFiles(".env").length === 0, ".env must not be tracked by Git");
assertCondition(trackedFiles("data.db").length === 0, "data.db must not be tracked by Git");
assertCondition(trackedFiles("storage").length === 0, "Persistent storage must not be tracked by Git");

const bootstrap = JSON.parse(readText("script/bootstrap-content.json"));
const trackedUploads = new Set(trackedFiles("uploads"));
const dockerignoreRules = new Set(dockerignore.split("\n").map((line) => line.trim()));
const bootstrapAssets = (bootstrap.assets || []).map((asset) => asset.storagePath);

for (const storagePath of bootstrapAssets) {
  assertCondition(typeof storagePath === "string", "Bootstrap media asset must have a storagePath");

  const repositoryPath = storagePath.startsWith("library/")
    ? `attached_assets/${storagePath.slice("library/".length)}`
    : storagePath;

  assertCondition(
    storagePath.startsWith("library/") || storagePath.startsWith("uploads/"),
    `Unsupported bootstrap media path: ${storagePath}`,
  );
  assertCondition(existsSync(repositoryPath), `Bootstrap media file is missing: ${repositoryPath}`);
  assertCondition(
    trackedFiles(repositoryPath).includes(repositoryPath),
    `Bootstrap media file is not tracked by Git: ${repositoryPath}`,
  );
}

for (const storagePath of trackedUploads) {
  assertCondition(existsSync(storagePath), `Tracked upload file is missing: ${storagePath}`);
  assertCondition(
    dockerignoreRules.has(`!${storagePath}`),
    `Tracked upload file is excluded from the Docker build context: ${storagePath}`,
  );
}

console.log(
  `Docker safety checks passed: persistent data protected, secrets excluded, ${bootstrapAssets.length} bootstrap assets and ${trackedUploads.size} uploads verified.`,
);
