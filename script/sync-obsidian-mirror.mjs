// Обновляет зеркало рабочих доков в Obsidian (единая база знаний).
// Источник истины — репозиторий (docs/); это зеркало для чтения в Obsidian.
// Запуск: node script/sync-obsidian-mirror.mjs
import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = fileURLToPath(new URL('../docs/', import.meta.url));
const obsidianVault = process.env.OBSIDIAN_VAULT;
if (!obsidianVault) {
  throw new Error('Set OBSIDIAN_VAULT to the local Obsidian vault before syncing.');
}
const DST = join(obsidianVault, 'claude-kb', 'wiki');

const jobs = [
  [join(REPO, 'zrd-wiki'), join(DST, 'zrd', 'wiki')], // вся ЗРД-wiki (каталог)
  [join(REPO, 'zrd-economy-v1.md'), join(DST, 'zrd', 'zrd-economy-v1.md')],
  [join(REPO, 'zrd-scoring-v1.md'), join(DST, 'zrd', 'zrd-scoring-v1.md')],
  [join(REPO, 'zrd-simulation-plan.md'), join(DST, 'zrd', 'zrd-simulation-plan.md')],
  [join(REPO, 'PROJECT_BRIEF.md'), join(DST, 'simcenter', 'PROJECT_BRIEF.md')],
  [join(REPO, 'ARCHITECTURE.md'), join(DST, 'simcenter', 'ARCHITECTURE.md')],
  [join(REPO, 'MODULE_MAP.md'), join(DST, 'simcenter', 'MODULE_MAP.md')],
];

let n = 0;
for (const [src, dst] of jobs) {
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('mirrored:', src.replace(REPO, 'docs'), '->', dst.replace(DST, 'claude-kb/wiki'));
  n++;
}
console.log(`done: ${n} jobs, ${new Date().toISOString()}`);
