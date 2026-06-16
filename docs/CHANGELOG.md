# Changelog

## 2026-06-16 — UI: масштабируемость, dvh, мобильные табы участника, фундамент токенов темы

- Масштаб: убран `maximum-scale=1` (зум разрешён), `viewport-fit=cover`, `<title>`/`lang=ru`/`theme-color`; корневой `font-size` сделан флюидным (`clamp`) — rem-система масштабируется под разрешение/зум 60–120%.
- Высоты `100vh`/`h-screen` → `dvh` (симуляция, оболочки, журнал решений, результаты) — корректная высота в мобильных браузерах.
- Мобайл: табы «Карта/Сигналы/Метрики» включены и для участника на телефоне (`isReadOnly || isMobile`); десктоп без изменений.
- Тема: добавлен светлый набор семантических токенов (`--background/--card/--foreground/--border/--muted-foreground/…`), `--primary` остаётся оранжевым — фундамент для полного перехода с хардкод-цветов на токены.
- Проверка: `tsc`, `build`, `test:browser` (темы/переполнение/консоль), скрины dark/light на 390/1440/2560 — без регрессий и горизонтального скролла. Только UI/frontend; логика/данные/server не затронуты.

## 2026-06-08 — TASK-038–TASK-041

- Кабинет оценщика переведен на постоянную навигацию: кандидаты, настройка запуска, активные сессии, результаты и Wiki.
- Добавлены карточка текущего кандидата, готовность запуска, проверка настройки и единая панель действий.
- Активные и завершенные сессии разделены; в мониторинге отображается текущий средний балл.
- Обновлены компактная сетка, адаптивность и светлая тема кабинета оценщика.
- Исправлена готовность запуска: корректно заполненные кейсы и каналы больше не требуют скрытых подтверждений старого мастера.

## 2026-06-06

- TASK-035: added verified backups, two-copy retention, guarded restore, staging/production override support and CI operational checks.
- TASK-036: added repeatable UI acceptance contracts without changing the agreed interface.
- TASK-037: documented current content source chain and approval requirements; runtime content was not changed.

## 2026-05-25

- Added GitHub-ready project documentation.
- Added staging and production Docker Compose overrides.
- Added CI workflow for dependency install, lint, tests, build and Docker build.
- Added operational scripts for backup, deploy and healthcheck.
- Added task rules and release process documentation.
# 2026-06-06 — Structural dynamics admin workspace

- Админ-панель получила постоянную компактную навигацию, единый рабочий холст и правую панель статуса/быстрых действий.
- В правой панели кейса добавлены заполненность, ошибки настройки, количество циклов и переходов, сохранение, предпросмотр, проверка логики, Wiki и публикация.
- Цикл кейса расширен до полноценной вложенной сущности: название, описание, источник, зоны, тайминг, статус, финальность, приоритет и критичность сохраняются в SQLite.
- Финальный цикл завершает кейс при отсутствии явно заданного перехода; связь `ответ → цикл` сохранена.
- Добавлен smoke-тест сохранения и повторного чтения метаданных вложенного цикла.
