# DNS SimCenter

Проект бизнес-симуляции с хранением контента и результатов в SQLite, защищенным входом для оценщика и администратора и административным интерфейсом управления кейсами.

## Динамика проекта

Состояние на 05.11.2026. Подробности: `docs/project/ROADMAP.md` (план) и `docs/project/roadmap-tool/` (живая дорожная карта).

| Дата | Что произошло |
|---|---|
| 10.09 и 18.09 | Встречи команды: нет утверждённого паспорта и профиля компетенций, поэтому спецификации для разработки нет |
| 21.09 | Основа плана работ (`ROADMAP.md`) |
| 25.09 | Снимок состояния (`PROJECT_STATE.md`): методические исправления «Космонавта» не влиты, CI на `main` не зелёный |
| 22–23.10 | Паспорт проекта, редакция 6: цель, состав продукта, три метрики к 31.12.2026 |
| 02–04.11 | Штаб Claude: работа только через Claude, ветки `claude/<тема>-<дата>`, правило записи в Obsidian (#77, #82) |
| 03.11 | Сверка паспорта с собранным продуктом: рецензия «куда шли и куда пришли» |
| 05.11 | Дорожная карта v3: Гант, канбан, история решений, офлайн-версия, таблица в Google Sheets |

Что впереди (сроки предварительные): решения по цели отбора, профилю компетенций, правилам апелляции и API (ноябрь); протокол проверки на 12 людях (до 05.12); требования и сборка MVP (декабрь); проверка на 12 людях и замер трёх метрик к 31.12.2026 (сейчас в плане 16.01, запас до вехи −16 дней); запуск этапа 1 к 01.02.2027.

Живую карту ведёт владелец проекта; здесь фиксируются только решения и вехи.

## Что хранится в БД

- основные кейсы симуляции;
- сценарии, сигналы и варианты решений;
- привязки изображений;
- тайминги и системные настройки симуляции;
- аккаунты администратора и оценщика;
- сессии прохождения, ответы, результаты и технические статусы.

## Основные команды

```bash
npm install
cp .env.example .env
npm run db:generate-bootstrap -- "C:\path\to\dns-simcenter-working-source.tar.gz" ./script/bootstrap-content.json
npm run db:migrate
npm run db:seed-simulation -- ./script/bootstrap-content.json
npm run staff:reset
npm run dev
```

Для production:

```bash
npm install
cp .env.example .env
npm run db:generate-bootstrap -- "C:\path\to\dns-simcenter-working-source.tar.gz" ./script/bootstrap-content.json
npm run db:migrate
npm run db:seed-simulation -- ./script/bootstrap-content.json
npm run staff:reset
npm run build
npm start
```

## Docker deployment

Для серверного развертывания теперь есть готовый Docker-режим:

```bash
sudo bash ./install.sh --domain example.com --email admin@example.com
```

Сценарии обновления и перезапуска:

```bash
sudo bash ./update.sh --source-dir /path/to/new/source
sudo bash ./restart.sh
```

Подробности вынесены в:

```text
README_DEPLOY.md
```

## Импорт контента

Контент больше не берется из хардкода на клиенте. Для первичной загрузки используйте JSON-файл с материалами симуляции:

```bash
npm run db:generate-bootstrap -- "C:\path\to\dns-simcenter-working-source.tar.gz" ./script/bootstrap-content.json
npm run db:seed-simulation -- ./script/bootstrap-content.json
```

Шаблон структуры лежит в:

```text
script/bootstrap-content.example.json
```

Скрипт:

- очищает контентные таблицы;
- загружает системные изображения по умолчанию;
- импортирует кейсы, каналы, чаты, компетенции и настройки в SQLite;
- создает служебные аккаунты, если они отсутствуют.

Если у вас сохранилась старая версия проекта в архиве или распакованной папке, используйте генератор:

```bash
npm run db:generate-bootstrap -- "<LOCAL_ARCHIVE>" ./script/bootstrap-content.json
```

Генератор читает старые файлы `client/src/data/*.ts`, собирает из них `bootstrap-content.json` и подставляет стандартные изображения из `attached_assets`.


## Локальное хранилище медиа

Личные медиафайлы не коммитятся в Git: `uploads/`, `.env` и `data.db` остаются локальными. Чтобы перенести медиа из внешней папки в локальную папку сайта и зарегистрировать файлы в SQLite, используйте:

```powershell
npm.cmd run media:import-local -- --source "<LOCAL_UPLOADS>"
```

Скрипт рекурсивно ищет изображения, аудио и видео, копирует их в `./uploads`, сопоставляет файлы с уже существующими asset-записями по имени файла, создает недостающие записи в `media_assets` и печатает отчет по отсутствующим файлам или битым ссылкам. Если исходная папка содержит вложенную папку `uploads`, ведущий сегмент `uploads` автоматически убирается, чтобы на сайте не получались пути вида `/uploads/uploads/...`.

Полезные режимы:

```powershell
npm.cmd run media:import-local -- --source "<LOCAL_UPLOADS>" --dry-run
npm.cmd run media:import-local -- --source "<LOCAL_UPLOADS>" --copy-only
```

После импорта соберите и запустите сайт:

```powershell
npm.cmd run build
npm.cmd start
```

Если PowerShell показывает ошибку `Missing script: "media:import-local"`, значит в текущей локальной ветке еще нет версии проекта с этим скриптом. Сначала проверьте, что команда есть в `package.json`:

```powershell
Select-String -Path package.json -Pattern "media:import-local"
```

Если команда ничего не вывела, обновите ветку до коммита/PR, где добавлен импорт медиа, или переключитесь на эту ветку. До появления строки `"media:import-local": "tsx script/import-local-media.ts"` команда импорта запускаться не будет, даже если `npm.cmd run build` работает успешно.

Браузеры надежнее всего воспроизводят видео `MP4/H.264 + AAC` и аудио `MP3/WAV/OGG/M4A`. `MOV` импортируется, но скрипт предупреждает, что такой файл может потребовать перекодирования в MP4.

## Служебный доступ

Проект читает переменные из файла `.env` в корне приложения.
Шаблон лежит в:

```text
.env.example
```

По умолчанию создаются:

- `admin / ChangeMe123!`
- `evaluator / ChangeMe123!`

Рекомендуется сразу переопределить через переменные окружения:

```bash
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-strong-password
ADMIN_DISPLAY_NAME=Главный администратор
EVALUATOR_USERNAME=evaluator
EVALUATOR_PASSWORD=your-strong-password
EVALUATOR_DISPLAY_NAME=Оценщик
SESSION_SECRET=your-session-secret
PORT=5000
```

Если база уже существует и аккаунты администратора или оценщика были созданы раньше, просто изменить `.env` недостаточно.
После изменения логинов или паролей нужно выполнить:

```bash
npm run staff:reset
```

## Интерфейсы

- Публичный экран: `/`
- Служебный вход: `/staff-login`
- Оценщик: `/evaluator`
- Админка: `/admin`

## Что умеет админка

- CRUD для основных кейсов;
- CRUD для email, messenger и video-кейсов;
- изменение порядка основных кейсов;
- редактирование текстов, сигналов, вариантов и привязок изображений;
- изменение таймингов и системных настроек;
- просмотр, фильтрация и экспорт результатов в JSON.

## Структура данных

Ключевые таблицы описаны в:

```text
shared/schema.ts
```

Миграции:

```text
migrations/0001_staff_and_content.sql
migrations/0002_sessions_and_results.sql
```

## Важные файлы

- `server/routes.ts` — HTTP API, авторизация и CRUD
- `server/content-storage.ts` — чтение/запись контента симуляции
- `server/session-storage.ts` — сессии, ответы и результаты
- `client/src/pages/admin.tsx` — административный интерфейс
- `client/src/context/SimulationContext.tsx` — рантайм симуляции и сохранение прохождений
- `script/seed-simulation-content.ts` — импорт исходного контента в БД
