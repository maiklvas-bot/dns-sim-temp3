-- Профиль выпускника: недостающие измерения и пометка критичных компетенций.
--
-- Раньше это делал script/apply-competency-profile.ts, но папка script/ и tsx
-- в production-образ не попадают (npm prune --omit=dev), поэтому на стенде
-- изменения не применялись. Здесь то же самое, но миграцией — она выполняется
-- при старте и ничего не перезаписывает.
--
-- Существующие компетенции не трогаем: под них размечены 225 вариантов ответа.

-- Системность мышления — отдельно от принятия решений: там выбор под давлением,
-- здесь связность картины.
INSERT OR IGNORE INTO competencies (id, name, description, category, is_stop_factor, sort_order, is_active)
VALUES (
  'systems_thinking',
  'Системность мышления',
  'Объясняет причины своих действий, называет причинно-следственные связи, не противоречит себе. Отличается от принятия решений: там — выбор под давлением, здесь — связность картины.',
  'skills',
  0,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM competencies),
  1
);

INSERT OR IGNORE INTO competencies (id, name, description, category, is_stop_factor, sort_order, is_active)
VALUES (
  'staff_motivation',
  'Мотивация сотрудников',
  'Выясняет, что движет сотрудником, и действует исходя из этого. Оценивает, сработало ли.',
  'skills',
  0,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM competencies),
  1
);

INSERT OR IGNORE INTO competencies (id, name, description, category, is_stop_factor, sort_order, is_active)
VALUES (
  'staff_training',
  'Обучение сотрудников',
  'Учит на рабочем месте: объясняет, показывает, даёт обратную связь с опорой на факты и конкретными рекомендациями.',
  'skills',
  0,
  (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM competencies),
  1
);

-- Критичные: провал по ним не закрывается суммой остальных (порог 2.0 из 5).
UPDATE competencies
SET is_stop_factor = 1
WHERE id IN ('planning', 'control', 'responsibility', 'communication', 'result_orientation');
