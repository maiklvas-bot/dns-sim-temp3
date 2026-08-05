import { CORRECTED_CASES } from "../shared/corrected-cases";
import { validateCase } from "../shared/case-validation";
import { contentStorage } from "../server/content-storage";
import type { EditableSimCase } from "../server/content-storage";

/**
 * Заливка кейсов-исправлений в базу.
 *
 * Оригиналы не трогаются вообще — сидер только добавляет дубли. Дубли приходят
 * выключенными (`isActive: false`): исправление не должно молча попасть в живое
 * прохождение и изменить то, что видят участники. Включает его человек, когда
 * сравнил и согласился.
 *
 * Повторный запуск обновляет дубли по id и остаётся безопасным.
 */

const existing = contentStorage.getPublicContent(true).cases as { id: string; sortOrder?: number }[];
const originalById = new Map(existing.map((item) => [item.id, item]));
const maxSortOrder = existing.reduce((max, item) => Math.max(max, item.sortOrder ?? 0), 0);

let saved = 0;
let index = 0;

for (const corrected of CORRECTED_CASES) {
  const original = originalById.get(corrected.correctionOfCaseId);
  if (!original) {
    console.error(`ПРОПУЩЕН ${corrected.id}: оригинал ${corrected.correctionOfCaseId} не найден`);
    continue;
  }

  const issues = validateCase(corrected);
  if (issues.length > 0) {
    console.error(`ПРОПУЩЕН ${corrected.id}: не проходит автопроверку (${issues.length} замечаний)`);
    continue;
  }

  index += 1;
  contentStorage.saveCase({
    ...corrected,
    sortOrder: maxSortOrder + index,
    isActive: false,
  } as EditableSimCase);
  saved += 1;
  console.log(`${corrected.id} ← исправление для ${corrected.correctionOfCaseId} (${corrected.corrections.length} правок)`);
}

console.log(`\nЗалито исправленных кейсов: ${saved} из ${CORRECTED_CASES.length}. Оригиналы не изменялись.`);
console.log("Дубли выключены (isActive=false) — включите вручную, когда сверите.");
