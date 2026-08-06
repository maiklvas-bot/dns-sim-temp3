import assert from "node:assert/strict";
import {
  CRITICAL_COMPETENCIES,
  CRITICAL_THRESHOLD,
  PROFILE_COMPETENCIES,
  buildProfileScores,
  findRedFlags,
} from "../shared/competency-profile";
import { contentStorage } from "../server/content-storage";

/**
 * Контракт карты компетенций.
 *
 * Симуляция меряет дробно, отчёт говорит на языке профиля выпускника. Проверяем,
 * что связь между уровнями цела: каждое измерение существует в справочнике,
 * непокрытое честно объяснено, критичные помечены.
 */

const competencies = contentStorage.getPublicContent(true).competencies as Array<{
  id: string;
  name: string;
  isStopFactor?: boolean;
}>;
const known = new Set(competencies.map((item) => item.id));

assert.equal(PROFILE_COMPETENCIES.length, 14, "в профиле выпускника четырнадцать компетенций");

// Нумерация профиля идёт подряд: по ней сверяются с бумажным документом.
PROFILE_COMPETENCIES.forEach((item, index) => {
  assert.equal(item.number, index + 1, `нарушена нумерация профиля на «${item.name}»`);
});

for (const item of PROFILE_COMPETENCIES) {
  for (const measurement of item.measuredBy) {
    assert.ok(
      known.has(measurement),
      `«${item.name}» ссылается на измерение «${measurement}», которого нет в справочнике`,
    );
  }
  // Непокрытая компетенция обязана объяснять, где её оценивают. Молчаливый
  // пропуск в отчёте читается как «провалил», хотя это «не измеряли».
  if (item.measuredBy.length === 0) {
    assert.ok(
      item.assessedElsewhere,
      `«${item.name}» ничем не меряется и не сказано, где оценивается`,
    );
  }
}

// Критичные должны быть помечены в справочнике: иначе красный флаг не сработает.
for (const id of CRITICAL_COMPETENCIES) {
  const row = competencies.find((item) => item.id === id);
  assert.ok(row, `критичная компетенция «${id}» отсутствует в справочнике`);
  assert.ok(row.isStopFactor, `«${row.name}» должна быть помечена критичной`);
}

// Критичное измерение обязано входить в профиль: иначе провал по нему
// не отразится в отчёте, который читает комиссия.
for (const id of CRITICAL_COMPETENCIES) {
  const inProfile = PROFILE_COMPETENCIES.some((item) => item.measuredBy.includes(id));
  assert.ok(inProfile, `критичное измерение «${id}» не входит ни в одну компетенцию профиля`);
}

// Свёртка: балл профиля — среднее по измерениям, пусто вместо нуля при отсутствии данных.
const scores = buildProfileScores({ planning: 4, control: 2, delegation: 3, communication: 5 });
const orgControl = scores.find((item) => item.competency.id === "org_control");
assert.ok(orgControl);
assert.equal(orgControl.score, 3, "организация и контроль — среднее планирования, контроля и делегирования");
assert.equal(orgControl.parts.length, 3, "видно, из чего сложился балл");

const notMeasured = scores.find((item) => item.competency.id === "company_ideology");
assert.equal(notMeasured?.score, null, "неизмеренная компетенция даёт пусто, а не ноль");

// Частичные данные: считаем по тому, что есть, а не занижаем отсутствующим.
const partial = buildProfileScores({ communication: 4 });
const communication = partial.find((item) => item.competency.id === "communication_profile");
assert.equal(communication?.score, 4, "при одном измерении из двух балл берётся по имеющемуся");

// Красный флаг: ниже порога — да, ровно на пороге — нет.
assert.equal(findRedFlags({ control: CRITICAL_THRESHOLD - 0.1 }).length, 1, "ниже порога — флаг");
assert.equal(findRedFlags({ control: CRITICAL_THRESHOLD }).length, 0, "ровно на пороге флага нет");
assert.equal(findRedFlags({ flexibility: 0.5 }).length, 0, "некритичная компетенция флага не даёт");

console.log(
  `competency-profile parity checks passed (${PROFILE_COMPETENCIES.filter((i) => i.measuredBy.length).length} из 14 измеряются, критичных ${CRITICAL_COMPETENCIES.length}, порог ${CRITICAL_THRESHOLD})`,
);
