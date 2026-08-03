import assert from "node:assert/strict";
import { CASE_TEMPLATES, instantiateTemplate } from "../shared/case-templates";
import { validateCase } from "../shared/case-validation";

// Библиотека непустая и покрывает разные ситуации розницы
assert.ok(CASE_TEMPLATES.length >= 2, "в библиотеке минимум два эталона на этом этапе");

const ids = CASE_TEMPLATES.map((template) => template.id);
assert.equal(new Set(ids).size, ids.length, "идентификаторы эталонов уникальны");

for (const template of CASE_TEMPLATES) {
  assert.ok(template.title.trim().length > 0, `${template.id}: есть название`);
  assert.ok(template.summary.trim().length > 0, `${template.id}: есть краткое описание для выбора`);
  assert.ok(template.teaches.trim().length > 0, `${template.id}: сказано, чему учит`);

  // Главное требование: эталон не может учить плохому
  const issues = validateCase(template.caseData);
  assert.deepEqual(
    issues,
    [],
    `${template.id}: эталон обязан проходить автопроверку чисто, найдено: ${issues.map((i) => i.check).join(", ")}`,
  );
}

// Хотя бы один эталон показывает ветвление, хотя бы один — линейный путь
const branching = CASE_TEMPLATES.filter((template) =>
  template.caseData.cycles.some((cycle) => cycle.options.some((option) => Boolean(option.nextCycleId))),
);
assert.ok(branching.length >= 1, "есть эталон с ветвлением");
assert.ok(branching.length < CASE_TEMPLATES.length, "есть эталон с линейным путём");

// Взятие за основу даёт независимую копию с новым идентификатором
const source = CASE_TEMPLATES[0];
const created = instantiateTemplate(source, "CASE-42");
assert.equal(created.id, "CASE-42");
assert.notEqual(created.cycles[0].id, source.caseData.cycles[0].id, "идентификаторы циклов пересобраны");
assert.equal(created.isActive, false, "копия создаётся черновиком, а не сразу в эфире");
assert.equal(created.qaStatus, "draft");
// Копия не делит ссылки с эталоном
created.cycles[0].situation = "изменено";
assert.notEqual(source.caseData.cycles[0].situation, "изменено", "эталон не мутируется");
// Копия эталона тоже обязана быть валидной
assert.deepEqual(validateCase(created), []);

console.log("case-templates parity checks passed");
