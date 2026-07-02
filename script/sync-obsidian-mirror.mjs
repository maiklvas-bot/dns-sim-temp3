// Обновляет зеркало рабочих доков в Obsidian (единая база знаний).
// Источник истины — репозиторий (docs/); это зеркало для чтения в Obsidian.
// Запуск: node script/sync-obsidian-mirror.mjs
import { cpSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const REPO = 'D:/MyProject/Simulacia Claude/docs';
const DST = 'D:/MyProject/Obsidian/Pedro78/claude-kb/wiki';

const jobs = [
  [`${REPO}/zrd-wiki`, `${DST}/zrd/wiki`], // вся ЗРД-wiki (каталог)
  [`${REPO}/zrd-economy-v1.md`, `${DST}/zrd/zrd-economy-v1.md`],
  [`${REPO}/zrd-scoring-v1.md`, `${DST}/zrd/zrd-scoring-v1.md`],
  [`${REPO}/zrd-simulation-plan.md`, `${DST}/zrd/zrd-simulation-plan.md`],
  [`${REPO}/PROJECT_BRIEF.md`, `${DST}/simcenter/PROJECT_BRIEF.md`],
  [`${REPO}/ARCHITECTURE.md`, `${DST}/simcenter/ARCHITECTURE.md`],
  [`${REPO}/MODULE_MAP.md`, `${DST}/simcenter/MODULE_MAP.md`],
];

let n = 0;
for (const [src, dst] of jobs) {
  mkdirSync(dirname(dst), { recursive: true });
  cpSync(src, dst, { recursive: true });
  console.log('mirrored:', src.replace(REPO, 'docs'), '->', dst.replace(DST, 'claude-kb/wiki'));
  n++;
}
console.log(`done: ${n} jobs, ${new Date().toISOString()}`);
