import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

function ensureMigrationTable(sqlite: Database.Database) {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS app_migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

function ensureColumn(
  sqlite: Database.Database,
  tableName: string,
  columnName: string,
  columnDefinition: string,
) {
  const columns = sqlite.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  sqlite.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
}

export function runMigrations(sqlite: Database.Database): void {
  ensureMigrationTable(sqlite);

  const migrationsDir = path.resolve(process.cwd(), "migrations");
  if (!fs.existsSync(migrationsDir)) {
    return;
  }

  const appliedRows = sqlite
    .prepare("SELECT name FROM app_migrations ORDER BY name")
    .all() as Array<{ name: string }>;

  const applied = new Set(appliedRows.map((row) => row.name));

  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith(".sql"))
    .sort();

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }

    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const tx = sqlite.transaction(() => {
      sqlite.exec(sql);
      sqlite.prepare("INSERT INTO app_migrations (name) VALUES (?)").run(file);
    });

    tx();
  }

  ensureColumn(sqlite, "simulation_settings", "pre_simulation_instruction_html", "TEXT");
  ensureColumn(sqlite, "simulation_settings", "pre_simulation_instruction_video_asset_id", "TEXT");
  ensureColumn(sqlite, "simulation_settings", "case_weights_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(sqlite, "simulation_settings", "time_influence_enabled", "INTEGER NOT NULL DEFAULT 0");
}
