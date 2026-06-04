import "../server/load-env";
import crypto from "crypto";
import fs from "fs";
import path from "path";
import { sqlite } from "../server/db";
import { runMigrations } from "../server/migrations";

const SUPPORTED_MEDIA: Record<string, { kind: "image" | "audio" | "video"; mimeType: string; browserPlayable: boolean; note?: string }> = {
  ".png": { kind: "image", mimeType: "image/png", browserPlayable: true },
  ".jpg": { kind: "image", mimeType: "image/jpeg", browserPlayable: true },
  ".jpeg": { kind: "image", mimeType: "image/jpeg", browserPlayable: true },
  ".webp": { kind: "image", mimeType: "image/webp", browserPlayable: true },
  ".gif": { kind: "image", mimeType: "image/gif", browserPlayable: true },
  ".mp3": { kind: "audio", mimeType: "audio/mpeg", browserPlayable: true },
  ".wav": { kind: "audio", mimeType: "audio/wav", browserPlayable: true },
  ".ogg": { kind: "audio", mimeType: "audio/ogg", browserPlayable: true },
  ".oga": { kind: "audio", mimeType: "audio/ogg", browserPlayable: true },
  ".webm": { kind: "video", mimeType: "video/webm", browserPlayable: true },
  ".m4a": { kind: "audio", mimeType: "audio/mp4", browserPlayable: true },
  ".aac": { kind: "audio", mimeType: "audio/aac", browserPlayable: true },
  ".mp4": { kind: "video", mimeType: "video/mp4", browserPlayable: true },
  ".mov": {
    kind: "video",
    mimeType: "video/quicktime",
    browserPlayable: false,
    note: "MOV может не воспроизводиться в браузере; надёжнее перекодировать в MP4/H.264 + AAC.",
  },
};

interface MediaAssetRow {
  id: string;
  name: string;
  kind: string;
  mime_type: string;
  storage_path: string;
  original_filename: string | null;
  size_bytes: number | null;
}

interface SourceMediaFile {
  absolutePath: string;
  sourceRelativePath: string;
  importRelativePath: string;
  basename: string;
  sizeBytes: number;
  definition: typeof SUPPORTED_MEDIA[string];
}

interface ImportOptions {
  sourceDir: string;
  dryRun: boolean;
  copyOnly: boolean;
}

function parseArgs(): ImportOptions {
  const args = process.argv.slice(2);
  let sourceDir = process.env.LOCAL_MEDIA_SOURCE || "";
  let dryRun = false;
  let copyOnly = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--source" || arg === "-s") {
      sourceDir = args[index + 1] || "";
      index += 1;
      continue;
    }
    if (arg.startsWith("--source=")) {
      sourceDir = arg.slice("--source=".length);
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (arg === "--copy-only") {
      copyOnly = true;
      continue;
    }
    if (!sourceDir) {
      sourceDir = arg;
    }
  }

  if (!sourceDir && process.platform === "win32" && process.env.USERPROFILE) {
    sourceDir = path.join(process.env.USERPROFILE, "Downloads", "uploads");
  }

  if (!sourceDir) {
    throw new Error(
      "Укажите папку медиа: npm run media:import-local -- --source \"C:\\Users\\maikl\\Downloads\\uploads\"",
    );
  }

  return {
    sourceDir: path.resolve(sourceDir),
    dryRun,
    copyOnly,
  };
}

function normalizeStoragePath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\/+/, "");
}

function sanitizePathSegment(value: string) {
  return value
    .replace(/[<>:"|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim() || "media";
}

function stripLeadingUploadsSegment(relativePath: string) {
  const parts = relativePath.split(/[\\/]+/).filter(Boolean);
  while (parts[0]?.toLowerCase() === "uploads") {
    parts.shift();
  }
  return parts.map(sanitizePathSegment).join(path.sep);
}

function createStableAssetId(importRelativePath: string) {
  const hash = crypto.createHash("sha1").update(importRelativePath).digest("hex").slice(0, 12);
  const stem = path.basename(importRelativePath, path.extname(importRelativePath)).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 32) || "asset";
  return `local_${stem}_${hash}`;
}

function collectMediaFiles(sourceDir: string): SourceMediaFile[] {
  const files: SourceMediaFile[] = [];
  const stack = [sourceDir];

  while (stack.length > 0) {
    const currentDir = stack.pop()!;
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        stack.push(absolutePath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      const definition = SUPPORTED_MEDIA[extension];
      if (!definition) {
        continue;
      }

      const sourceRelativePath = path.relative(sourceDir, absolutePath);
      const importRelativePath = stripLeadingUploadsSegment(sourceRelativePath);
      const stat = fs.statSync(absolutePath);
      files.push({
        absolutePath,
        sourceRelativePath,
        importRelativePath,
        basename: path.basename(entry.name).toLowerCase(),
        sizeBytes: stat.size,
        definition,
      });
    }
  }

  const uniqueFiles = new Map<string, SourceMediaFile>();
  for (const file of files) {
    const key = normalizeStoragePath(file.importRelativePath).toLowerCase();
    const existing = uniqueFiles.get(key);
    const fileDepth = file.sourceRelativePath.split(/[\\/]+/).filter(Boolean).length;
    const existingDepth = existing?.sourceRelativePath.split(/[\\/]+/).filter(Boolean).length ?? Number.POSITIVE_INFINITY;
    if (!existing || fileDepth < existingDepth) {
      uniqueFiles.set(key, file);
    }
  }

  return [...uniqueFiles.values()].sort((a, b) => a.importRelativePath.localeCompare(b.importRelativePath, "ru"));
}

function listAssets(): MediaAssetRow[] {
  return sqlite.prepare("select id, name, kind, mime_type, storage_path, original_filename, size_bytes from media_assets order by name").all() as MediaAssetRow[];
}

function existingAssetMatcher(assets: MediaAssetRow[]) {
  const byName = new Map<string, MediaAssetRow[]>();
  for (const asset of assets) {
    const candidates = [asset.original_filename, asset.name, path.basename(asset.storage_path || "")]
      .filter((value): value is string => Boolean(value))
      .map((value) => value.toLowerCase());
    for (const candidate of candidates) {
      const current = byName.get(candidate) || [];
      current.push(asset);
      byName.set(candidate, current);
    }
  }

  return (file: SourceMediaFile) => {
    const matches = byName.get(file.basename) || [];
    return matches.find((asset) => asset.kind === file.definition.kind) || matches[0] || null;
  };
}

function ensureInsideUploads(storagePath: string, fallbackRelativePath: string) {
  const normalized = normalizeStoragePath(storagePath);
  if (normalized.startsWith("uploads/") && !normalized.includes("..")) {
    return normalized;
  }
  return normalizeStoragePath(`uploads/${fallbackRelativePath.replace(/\\/g, "/")}`);
}

function copyMediaFile(sourcePath: string, storagePath: string, dryRun: boolean) {
  const destination = path.resolve(process.cwd(), storagePath);
  const uploadsDir = path.resolve(process.cwd(), "uploads");
  const resolvedDestination = path.resolve(destination);
  if (!resolvedDestination.startsWith(`${uploadsDir}${path.sep}`)) {
    throw new Error(`Некорректный путь назначения: ${storagePath}`);
  }
  if (dryRun) {
    return;
  }
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(sourcePath, destination);
}

function upsertAsset(asset: {
  id: string;
  name: string;
  kind: string;
  mimeType: string;
  storagePath: string;
  originalFilename: string;
  sizeBytes: number;
}, dryRun: boolean) {
  if (dryRun) {
    return;
  }
  sqlite.prepare(`
    insert into media_assets (id, name, kind, mime_type, storage_path, original_filename, size_bytes, updated_at)
    values (@id, @name, @kind, @mimeType, @storagePath, @originalFilename, @sizeBytes, CURRENT_TIMESTAMP)
    on conflict(id) do update set
      name = excluded.name,
      kind = excluded.kind,
      mime_type = excluded.mime_type,
      storage_path = excluded.storage_path,
      original_filename = excluded.original_filename,
      size_bytes = excluded.size_bytes,
      updated_at = CURRENT_TIMESTAMP
  `).run(asset);
}

function storagePathExists(storagePath: string) {
  const normalized = normalizeStoragePath(storagePath);
  if (/^https?:\/\//i.test(normalized)) {
    return true;
  }
  if (normalized.startsWith("library/")) {
    return fs.existsSync(path.resolve(process.cwd(), "attached_assets", normalized.slice("library/".length)));
  }
  return fs.existsSync(path.resolve(process.cwd(), normalized));
}

function validateLinkedMedia() {
  const missingAssets = listAssets().filter((asset) => !storagePathExists(asset.storage_path));
  const missingCaseLinks = sqlite.prepare(`
    select 'main_case' as source_type, id as source_id, title, image_asset_id as asset_id, 'image_asset_id' as field
    from simulation_cases where image_asset_id is not null and image_asset_id not in (select id from media_assets)
    union all
    select 'main_case' as source_type, id as source_id, title, audio_asset_id as asset_id, 'audio_asset_id' as field
    from simulation_cases where audio_asset_id is not null and audio_asset_id not in (select id from media_assets)
    union all
    select channel_type as source_type, id as source_id, title, image_asset_id as asset_id, 'image_asset_id' as field
    from channel_items where image_asset_id is not null and image_asset_id not in (select id from media_assets)
    union all
    select channel_type as source_type, id as source_id, title, audio_asset_id as asset_id, 'audio_asset_id' as field
    from channel_items where audio_asset_id is not null and audio_asset_id not in (select id from media_assets)
  `).all() as Array<{ source_type: string; source_id: string; title: string; asset_id: string; field: string }>;

  const missingSettingsLinks = sqlite.prepare(`
    select 'simulation_settings' as source_type, cast(id as text) as source_id, 'waiting image' as title, waiting_image_asset_id as asset_id, 'waiting_image_asset_id' as field
    from simulation_settings where waiting_image_asset_id is not null and waiting_image_asset_id not in (select id from media_assets)
    union all
    select 'simulation_settings', cast(id as text), 'call sound', call_sound_asset_id, 'call_sound_asset_id'
    from simulation_settings where call_sound_asset_id is not null and call_sound_asset_id not in (select id from media_assets)
    union all
    select 'simulation_settings', cast(id as text), 'email sound', email_sound_asset_id, 'email_sound_asset_id'
    from simulation_settings where email_sound_asset_id is not null and email_sound_asset_id not in (select id from media_assets)
    union all
    select 'simulation_settings', cast(id as text), 'messenger sound', messenger_sound_asset_id, 'messenger_sound_asset_id'
    from simulation_settings where messenger_sound_asset_id is not null and messenger_sound_asset_id not in (select id from media_assets)
    union all
    select 'simulation_settings', cast(id as text), 'video sound', video_sound_asset_id, 'video_sound_asset_id'
    from simulation_settings where video_sound_asset_id is not null and video_sound_asset_id not in (select id from media_assets)
    union all
    select 'simulation_settings', cast(id as text), 'instruction video', pre_simulation_instruction_video_asset_id, 'pre_simulation_instruction_video_asset_id'
    from simulation_settings where pre_simulation_instruction_video_asset_id is not null and pre_simulation_instruction_video_asset_id not in (select id from media_assets)
  `).all() as Array<{ source_type: string; source_id: string; title: string; asset_id: string; field: string }>;

  return { missingAssets, missingLinks: [...missingCaseLinks, ...missingSettingsLinks] };
}

function main() {
  runMigrations(sqlite);
  const options = parseArgs();
  if (!fs.existsSync(options.sourceDir)) {
    throw new Error(`Папка медиа не найдена: ${options.sourceDir}`);
  }

  const files = collectMediaFiles(options.sourceDir);
  if (files.length === 0) {
    throw new Error(`В папке ${options.sourceDir} не найдены поддерживаемые медиафайлы.`);
  }

  const existingAssets = listAssets();
  const findExistingAsset = existingAssetMatcher(existingAssets);
  const importRows: Array<{ file: SourceMediaFile; assetId: string; storagePath: string; created: boolean; matchedExisting: boolean }> = [];

  for (const file of files) {
    const matchedAsset = findExistingAsset(file);
    const storagePath = ensureInsideUploads(matchedAsset?.storage_path || "", file.importRelativePath);
    const assetId = matchedAsset?.id || createStableAssetId(file.importRelativePath.replace(/\\/g, "/"));
    importRows.push({ file, assetId, storagePath, created: !matchedAsset, matchedExisting: Boolean(matchedAsset) });
  }

  const transaction = sqlite.transaction(() => {
    for (const row of importRows) {
      copyMediaFile(row.file.absolutePath, row.storagePath, options.dryRun);
      if (!options.copyOnly) {
        upsertAsset({
          id: row.assetId,
          name: path.basename(row.file.importRelativePath, path.extname(row.file.importRelativePath)),
          kind: row.file.definition.kind,
          mimeType: row.file.definition.mimeType,
          storagePath: row.storagePath,
          originalFilename: path.basename(row.file.sourceRelativePath),
          sizeBytes: row.file.sizeBytes,
        }, options.dryRun);
      }
    }
  });
  transaction();

  const createdCount = importRows.filter((row) => row.created).length;
  const matchedCount = importRows.filter((row) => row.matchedExisting).length;
  const notBrowserPlayable = importRows.filter((row) => !row.file.definition.browserPlayable);
  const validation = validateLinkedMedia();

  console.log(`Источник: ${options.sourceDir}`);
  console.log(`Режим: ${options.dryRun ? "проверка без изменений" : "копирование"}${options.copyOnly ? ", без записи в БД" : ", с регистрацией в БД"}`);
  console.log(`Найдено медиафайлов: ${files.length}`);
  console.log(`Сопоставлено с существующими asset-связями: ${matchedCount}`);
  console.log(`Новых asset-записей: ${createdCount}`);
  console.log(`Папка сайта: ${path.resolve(process.cwd(), "uploads")}`);

  if (notBrowserPlayable.length > 0) {
    console.log("\nФайлы, которые могут не воспроизводиться в браузере без конвертации:");
    for (const row of notBrowserPlayable) {
      console.log(`- ${row.file.sourceRelativePath}: ${row.file.definition.note}`);
    }
  }

  if (validation.missingAssets.length > 0) {
    console.log("\nAsset-записи, у которых файл всё ещё не найден:");
    for (const asset of validation.missingAssets) {
      console.log(`- ${asset.id} (${asset.kind}) -> ${asset.storage_path}`);
    }
  }

  if (validation.missingLinks.length > 0) {
    console.log("\nСвязи контента с отсутствующими asset id:");
    for (const link of validation.missingLinks) {
      console.log(`- ${link.source_type}/${link.source_id} ${link.field}=${link.asset_id} (${link.title})`);
    }
  }

  if (validation.missingAssets.length === 0 && validation.missingLinks.length === 0) {
    console.log("\nПроверка связей: OK — все зарегистрированные локальные файлы и asset-ссылки найдены.");
  }

  console.log("\nДальше запустите: npm.cmd run build && npm.cmd start");
}

main();
