import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";

const SQL_IDENTIFIER_RE = /^[A-Za-z_][A-Za-z0-9_]*$/;
const COLUMN_DEFINITION_RE =
  /^(TEXT|INTEGER|REAL|BLOB|NUMERIC)(\s+NOT\s+NULL)?(\s+DEFAULT\s+('([^']|'')*'|-?\d+(\.\d+)?|CURRENT_TIMESTAMP|NULL))?$/i;

function quoteSqlIdentifier(identifier: string): string {
  if (!SQL_IDENTIFIER_RE.test(identifier)) {
    throw new Error(`Invalid SQL identifier: ${identifier}`);
  }

  return `"${identifier}"`;
}

function assertSafeColumnDefinition(columnDefinition: string): void {
  const normalized = columnDefinition.trim();
  if (!COLUMN_DEFINITION_RE.test(normalized)) {
    throw new Error(`Invalid SQL column definition: ${columnDefinition}`);
  }
}

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
  const quotedTableName = quoteSqlIdentifier(tableName);
  const quotedColumnName = quoteSqlIdentifier(columnName);
  assertSafeColumnDefinition(columnDefinition);

  const columns = sqlite.prepare(`PRAGMA table_info(${quotedTableName})`).all() as Array<{ name: string }>;
  if (columns.some((column) => column.name === columnName)) {
    return;
  }

  sqlite.exec(`ALTER TABLE ${quotedTableName} ADD COLUMN ${quotedColumnName} ${columnDefinition.trim()};`);
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
  ensureColumn(sqlite, "case_timings", "decision_deadline_seconds", "INTEGER");
  ensureColumn(sqlite, "case_cycles", "image_asset_id", "TEXT");
  ensureColumn(sqlite, "case_cycles", "audio_asset_id", "TEXT");
  ensureColumn(sqlite, "case_cycles", "title", "TEXT");
  ensureColumn(sqlite, "case_cycles", "description", "TEXT");
  ensureColumn(sqlite, "case_cycles", "source", "TEXT");
  ensureColumn(sqlite, "case_cycles", "zones_affected_json", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(sqlite, "case_cycles", "timing_json", "TEXT NOT NULL DEFAULT '{}'");
  ensureColumn(sqlite, "case_cycles", "status", "TEXT NOT NULL DEFAULT 'active'");
  ensureColumn(sqlite, "case_cycles", "is_final", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn(sqlite, "case_cycles", "priority", "TEXT NOT NULL DEFAULT 'normal'");
  ensureColumn(sqlite, "case_cycles", "criticality", "TEXT NOT NULL DEFAULT 'normal'");
  ensureColumn(sqlite, "case_options", "comment", "TEXT");
  ensureColumn(sqlite, "case_options", "next_cycle_id", "TEXT");
  ensureColumn(sqlite, "case_options", "next_delay_seconds", "INTEGER");
  ensureColumn(sqlite, "case_options", "next_channel", "TEXT");
  ensureColumn(sqlite, "case_options", "status", "TEXT NOT NULL DEFAULT 'active'");
}
