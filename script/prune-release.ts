import { existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const releaseDir = join(process.cwd(), "release");
const keepCount = Number.parseInt(process.env.RELEASE_KEEP_COUNT || "2", 10);
const archivePattern = /\.(zip|tar\.gz)$/i;

if (!existsSync(releaseDir)) {
  mkdirSync(releaseDir, { recursive: true });
}

const entries = readdirSync(releaseDir).filter((name) => name !== ".gitkeep");
const archives = entries
  .filter((name) => archivePattern.test(name))
  .map((name) => {
    const path = join(releaseDir, name);
    return { name, path, mtimeMs: statSync(path).mtimeMs };
  })
  .sort((left, right) => right.mtimeMs - left.mtimeMs);

const keepArchives = new Set(archives.slice(0, Math.max(0, keepCount)).map((item) => item.name));
const removed: string[] = [];

for (const name of entries) {
  const path = join(releaseDir, name);
  const stats = statSync(path);
  const shouldKeepArchive = stats.isFile() && archivePattern.test(name) && keepArchives.has(name);

  if (shouldKeepArchive) {
    continue;
  }

  rmSync(path, { recursive: true, force: true });
  removed.push(name);
}

writeFileSync(join(releaseDir, ".gitkeep"), "");

console.log(`release prune complete: kept ${keepArchives.size} archive(s), removed ${removed.length} item(s)`);
if (keepArchives.size > 0) {
  console.log(`kept: ${Array.from(keepArchives).join(", ")}`);
}
