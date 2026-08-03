import assert from "node:assert/strict";
import { CASE_TEMPLATES, instantiateTemplate } from "../shared/case-templates";
import { spearmanRho, validateCase } from "../shared/case-validation";

// Библиотека содержит ровно пять эталонов
assert.equal(CASE_TEMPLATES.length, 5, "библиотека содержит пять эталонов");

// Сюжеты не повторяются: каждый эталон учит своему
const lessons = CASE_TEMPLATES.map((template) => template.teaches);
assert.equal(new Set(lessons).size, lessons.length, "каждый эталон учит своему");

// Разные эталоны опираются на разные ведущие компетенции
const primary = CASE_TEMPLATES.map((template) => template.caseData.primaryCompetencies[0]);
assert.ok(new Set(primary).size >= 3, "эталоны покрывают минимум три разные ведущие компетенции");

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

// Эталон учит не только тем, что проходит проверку, но и тем, насколько уверенно.
// Набор, где корреляция уровней впритык под порогом, показывает автору почти лестницу.
// Требуем заметный запас: ни в одном шаге компетенции не должны идти почти вместе.
// Одна компетенция может расти от слабого ответа к сильному — это нормально.
// Профиль возникает там, где хотя бы одна другая ведёт себя иначе. Требуем не
// просто «прошло проверку», а заметный запас: иначе эталон учит почти лестнице.
const PROFILE_MAX_RHO = 0.75;
for (const template of CASE_TEMPLATES) {
  for (const cycle of template.caseData.cycles) {
    // На двух вариантах корреляция всегда ±1: профиль по двум точкам не строится,
    // и механика антигейминга такие шаги тоже не судит.
    const options = [...cycle.options].sort((a, b) => a.level - b.level);
    if (options.length < 3) continue;
    const levels = options.map((option) => option.level);
    const competencyIds = Array.from(
      new Set(options.flatMap((option) => Object.keys(option.competency_scores || {}))),
    );
    if (competencyIds.length < 2) continue;

    const correlations = competencyIds.map((competencyId) => ({
      competencyId,
      rho: Math.abs(
        spearmanRho(
          levels,
          options.map((option) => Number((option.competency_scores || {})[competencyId] || 0)),
        ),
      ),
    }));
    assert.ok(
      correlations.some((item) => item.rho <= PROFILE_MAX_RHO),
      `${template.id}, шаг ${cycle.cycle}: все компетенции идут почти вместе `
        + `(${correlations.map((item) => `${item.competencyId} ${item.rho.toFixed(2)}`).join(", ")}). `
        + "Эталон должен показывать явный профиль, а не проходить проверку впритык.",
    );
  }
}

// Ни один вариант не должен быть сильным сразу по всем размеченным компетенциям:
// именно так выглядит «правильная кнопка», от которой кейс и должен уходить.
for (const template of CASE_TEMPLATES) {
  for (const cycle of template.caseData.cycles) {
    for (const option of cycle.options) {
      const scores = Object.values(option.competency_scores || {});
      if (scores.length < 2) continue;
      assert.ok(
        !scores.every((score) => score === 5),
        `${template.id}, шаг ${cycle.cycle}, «${option.text}»: вариант силён по всему — это правильная кнопка, а не профиль`,
      );
    }
  }
}

console.log("case-templates parity checks passed");
