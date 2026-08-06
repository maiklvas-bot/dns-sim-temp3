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

// Обновление приложения не должно стоить данных.
//
// Миграции доливают структуру и запоминаются в app_migrations — повторно не
// применяются. Опасен сид контента: он чистит таблицы и заливает заново.
// На пустой базе это разворачивание, на рабочей — потеря настроенного.
const seedScript = readText("script/seed-simulation-content.ts");
assertCondition(
  /if \(hasContent && !force\)[\s\S]{0,900}process\.exit\(1\)/.test(seedScript),
  "Сид контента должен останавливаться на непустой базе, пока не передан --force",
);
assertCondition(
  seedScript.indexOf("clearContentTables();\n  seedDefaultAssets") > seedScript.indexOf("if (hasContent && !force)"),
  "Проверка непустой базы обязана стоять до очистки таблиц, а не после",
);
const migrationFiles = readText("server/migrations.ts");
assertCondition(
  /applied\.has\(file\)/.test(migrationFiles),
  "Миграции должны применяться однократно: повторный прогон не должен трогать данные",
);

// Загруженные файлы — это контент кейсов и материалов справочника. Они едут в
// репозитории, и синхронизация обязана быть только на добавление: случайное
// удаление на стенде или влетевшее с чужим PR не должно терять файл.
const gitignore = readText(".gitignore");
assertCondition(
  !/^uploads\/\s*$/m.test(gitignore),
  "Папка uploads не должна исключаться из репозитория: без неё кейсы теряют медиа",
);
const syncUploads = readText("script/sync-uploads.ts");
assertCondition(
  !/\brm\b|unlinkSync|rmSync|git\(\["rm"/.test(syncUploads),
  "Синхронизация загруженных файлов не должна ничего удалять",
);
assertCondition(
  /=\s*listHistoricalFiles\(\)/.test(syncUploads) && /\.\.\.lost\]/.test(syncUploads),
  "Файл, удалённый и с диска, и из репозитория, должен восстанавливаться из истории",
);

console.log("Operational safety checks passed: backup integrity, retention, guarded restore, non-destructive seed and uploads sync verified.");
