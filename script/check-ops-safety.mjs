import { readFileSync } from "node:fs";

function readText(filePath) {
  return readFileSync(filePath, "utf8").replace(/\r\n/g, "\n");
}

function assertCondition(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

const backup = readText("scripts/backup.sh");
const restore = readText("scripts/restore.sh");
const backupPlan = readText("docs/BACKUP_PLAN.md");

for (const expected of [
  "BACKUP_RETENTION_COUNT",
  "COMPOSE_OVERRIDE",
  "checksums.sha256",
  "sha256sum -c checksums.sha256",
  "tar -tzf",
  "db.backup",
  "storage/data/data.db",
]) {
  assertCondition(backup.includes(expected), `Backup script is missing safety contract: ${expected}`);
}

for (const expected of [
  "CONFIRM_RESTORE",
  "VERIFY_ONLY",
  "COMPOSE_OVERRIDE",
  "checksums.sha256",
  "sha256sum -c checksums.sha256",
  "docker compose",
  ".restore-rollback-",
  "scripts/healthcheck.sh",
]) {
  assertCondition(restore.includes(expected), `Restore script is missing safety contract: ${expected}`);
}

assertCondition(
  !restore.includes("rm -rf storage/data") && !restore.includes("rm -rf uploads"),
  "Restore must preserve current runtime data instead of deleting it directly",
);
assertCondition(
  backupPlan.includes("scripts/restore.sh"),
  "Backup plan must document the executable restore procedure",
);

console.log("Operational safety checks passed: backup integrity, retention and guarded restore verified.");
