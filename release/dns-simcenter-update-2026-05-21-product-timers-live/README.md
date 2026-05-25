# DNS SimCenter

Проект бизнес-симуляции с хранением контента и результатов в SQLite, защищенным входом для оценщика и администратора и административным интерфейсом управления кейсами.

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
npm run db:generate-bootstrap -- "C:\Users\al72o\Downloads\dns-simcenter-working-source.tar.gz" ./script/bootstrap-content.json
```

Генератор читает старые файлы `client/src/data/*.ts`, собирает из них `bootstrap-content.json` и подставляет стандартные изображения из `attached_assets`.

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
