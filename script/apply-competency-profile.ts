import { eq } from "drizzle-orm";
import { competencies } from "@shared/schema";
import { CRITICAL_COMPETENCIES, PROFILE_COMPETENCIES } from "@shared/competency-profile";
import { db } from "../server/db";

/**
 * Приводит справочник компетенций в соответствие с принятым решением:
 *
 * — помечает критичные (провал по ним не закрывается суммой остальных);
 * — заводит недостающие измерения, под которые ещё предстоит написать кейсы.
 *
 * Существующие компетенции не удаляются и не переименовываются: под них
 * размечены 225 вариантов ответа, и переразметка обесценила бы эту работу.
 * Свёртка измерений в профиль выпускника живёт в `shared/competency-profile.ts`.
 *
 * НА СТЕНДЕ ЭТОТ СКРИПТ НЕ НУЖЕН: то же самое делает миграция
 * `migrations/0016_competency_profile.sql`, которая выполняется при старте.
 * Скрипт остаётся для локальной работы — папка script/ и tsx в production-образ
 * не попадают (`npm prune --omit=dev`), запустить его там нечем.
 *
 * Запускать повторно безопасно.
 */

/** Измерения, которых не хватает под компетенции профиля. Кейсы под них ещё пишутся. */
const MISSING_MEASUREMENTS = [
  {
    id: "systems_thinking",
    name: "Системность мышления",
    description:
      "Объясняет причины своих действий, называет причинно-следственные связи, не противоречит себе. "
      + "Отличается от принятия решений: там — выбор под давлением, здесь — связность картины.",
    category: "skills",
  },
  {
    id: "staff_motivation",
    name: "Мотивация сотрудников",
    description:
      "Выясняет, что движет сотрудником, и действует исходя из этого. Оценивает, сработало ли.",
    category: "skills",
  },
  {
    id: "staff_training",
    name: "Обучение сотрудников",
    description:
      "Учит на рабочем месте: объясняет, показывает, даёт обратную связь с опорой на факты и конкретными рекомендациями.",
    category: "skills",
  },
];

function main() {
  const existing = db.select().from(competencies).all();
  const known = new Set(existing.map((row) => row.id));
  const maxOrder = existing.reduce((max, row) => Math.max(max, row.sortOrder), 0);

  let added = 0;
  MISSING_MEASUREMENTS.forEach((item, index) => {
    if (known.has(item.id)) return;
    db.insert(competencies).values({
      id: item.id,
      name: item.name,
      description: item.description,
      category: item.category,
      sortOrder: maxOrder + index + 1,
      isActive: true,
      isStopFactor: false,
    }).run();
    added += 1;
    console.log(`  + заведена компетенция: ${item.name}`);
  });

  let flagged = 0;
  for (const id of CRITICAL_COMPETENCIES) {
    const row = db.select().from(competencies).where(eq(competencies.id, id)).get();
    if (!row) {
      console.error(`  ! критичная компетенция ${id} не найдена в справочнике`);
      continue;
    }
    if (row.isStopFactor) continue;
    db.update(competencies).set({ isStopFactor: true }).where(eq(competencies.id, id)).run();
    flagged += 1;
    console.log(`  ⚑ критичная: ${row.name}`);
  }

  const covered = PROFILE_COMPETENCIES.filter((item) => item.measuredBy.length > 0).length;
  const withoutCases = PROFILE_COMPETENCIES.filter((item) => item.assessedElsewhere === "no_cases_yet");

  console.log(`\nЗаведено компетенций: ${added}. Помечено критичными: ${flagged}.`);
  console.log(`Профиль выпускника: ${covered} из ${PROFILE_COMPETENCIES.length} компетенций имеют измерение.`);
  if (withoutCases.length > 0) {
    console.log(`Ждут кейсов: ${withoutCases.map((item) => item.name).join(", ")}.`);
  }
}

main();
