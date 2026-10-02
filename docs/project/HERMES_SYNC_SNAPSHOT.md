# DNS SimCenter — сверка Git и базы знаний

Дата чтения источников: **2026-10-02**, Asia/Yekaterinburg. [Статус](HERMES_STATE.md) · [Ближайшие действия](HERMES_ROADMAP.md).

## Источники и происхождение

| Источник | Версия / дата | Что подтверждает и чего не подтверждает |
| --- | --- | --- |
| Локальный Git основного checkout, `status`, `log`, `for-each-ref` | HEAD `aa82156380acafa8367b821c3f9ae22f6759ba8b`, прочитан 02.10 | Ветка, отсутствие upstream, незакоммиченный пакет. Не production и не доставка |
| `docs/project/HERMES_STATE.md`, `HERMES_ROADMAP.md`, `HERMES_SYNC_SNAPSHOT.md` основного checkout | Незакоммиченные источники с датами 21/25.09, прочитаны отдельно 02.10 | Исторические результаты и открытые вопросы; не входят в базу `aa82156`. Только факты выборочно перенесены в три документа этой ветки |
| [Knowledge commit](https://github.com/maiklvas-bot/dns-sim-temp3/commit/9328bbd498903ba99d91e23b84aebd2ded4c0198) | `9328bbd`, 25.09 | Публикация 14 файлов контекста в отдельной ветке; не доставка смешанного UI-пакета и не merge |
| Remote refs: `git ls-remote` по URL из `git remote -v` | Повторно прочитаны 02.10, без credential flow | `main=855bb8b`, `feature/methodology-v2=aa82156`, `chore/hermes-knowledge-sync=9328bbd`, `chore/unified-hermes-context=6bde4c3` |
| GitHub REST `pulls?state=open`, `actions/runs`, `actions/runs/{id}/jobs` | Первичная сверка 02.10, до публикации этой редакции; даты runs — 02/21.09 | На момент первичной сверки открыт только PR #70; два failed run и их упавший шаг. На ветках methodology/knowledge API вернул 0 runs |
| GitHub REST `pulls/71`, локальный `git rev-parse HEAD` | Повторная сверка 02.10 после замечаний ревью | PR #71 открыт, не слит; его HEAD и локальный HEAD — `8e1ce553b931ff391d9f129ae791c79d4eebe15c`. Это публикация документации, не подтверждение CI или production |
| `<OBSIDIAN_VAULT>/01-projects/simcenter/WORKLOG.md` | Записи 21–25.09; просмотр заголовков по всему файлу | Последние записи 25.09 находятся в начале, а v4 от 22.09 — в конце. Порядок строк не равен хронологии |
| `01-projects/simcenter/EMPLOYEE-DEVELOPMENT-JOURNEY.md`, `SIMCENTER-DEVELOPMENT-MEMORY.md`, `reviews/2026-09-18-review.md` в vault | 21.09, обсуждение 18.09 | Полный карьерный путь, продуктовый гейт и незакрытые методические решения |
| `01-projects/simcenter/DNS-LEARNING-SYSTEM-OWNER-INTERVIEW-2026-09-22.md` в vault | 22.09 | Подтверждённая владельцем логика; факты отделены от желаемых границ и проектных следствий |
| `DNS-LEARNING-SYSTEM-ANALYSIS-2026-09-22.md`, WORKLOG и MOC в vault | 22.09 | Первый анализ отклонён; v4 названа текущей презентационной версией. Новая приёмка презентаций не проводилась |
| Актуальная локальная orchestration policy и контракт задания | Политика 01.10, прочитана 02.10 | Новая локальная привязка и ответственность за исполнение/доставку; старые project/board и runtime checkpoint из 25.09 не считать актуальными |

Поиск последних записей включал даты в содержимом, все заголовки WORKLOG и даты файлов проектного каталога, а также релевантные wiki и repository docs. В этом охвате более позднее утверждение продуктового паспорта/пилота не найдено. Все внешние решения вне просмотренных источников остаются неизвестными.

## Проверенные команды и границы

- `git --no-optional-locks status --short --branch`, `git branch --show-current`, `git rev-parse HEAD`, `git log`, `git for-each-ref`: чтение обеих рабочих копий и локальных refs.
- `git rev-list --left-right --count HEAD...origin/main`: `4 2`; соответствие использованного `origin/main` живому remote подтверждено `ls-remote`.
- `git show --stat 9328bbd`: 14 файлов knowledge-пакета; `git log HEAD..origin/main`: два UI-коммита 02.09.
- GitHub public API: [PR #70](https://github.com/maiklvas-bot/dns-sim-temp3/pull/70), [main CI](https://github.com/maiklvas-bot/dns-sim-temp3/actions/runs/33638880325), [PR CI](https://github.com/maiklvas-bot/dns-sim-temp3/actions/runs/35631182202). Оба `build-test` завершились failure на `Verify Docker data safety`.
- [Workflow на базе aa82156](https://github.com/maiklvas-bot/dns-sim-temp3/blob/aa82156380acafa8367b821c3f9ae22f6759ba8b/.github/workflows/ci.yml): Node 20; push в `main`/`dev` и PR в эти ветки. Feature push сам по себе не означает запуск CI.

Fetch/pull не выполнялись: текущий контракт запрещает запись Git metadata, основной checkout разрешён только для чтения. Remote проверен read-only, без обновления локальных refs. Старые локальные тесты 25.09 не запускались повторно. Полный suite, build, Playwright и Docker для этих документальных правок не требуются. Production/staging и БД не проверялись.

## Синхронизируемый слой и история

Первичная редакция добавила три `docs/project/HERMES_*.md` в назначенной рабочей копии и обновила связанные локальные заметки Obsidian. Доработка ревью уточняет статус публикации и добавляет [проверяемый отчёт](HERMES_SYNC_REVIEW_EVIDENCE.md). Код, UI, `.env`, `.business`, SQLite/runtime, raw exports и чужой staged-пакет не переносятся. Репозиторные документы не содержат локальных абсолютных путей, delivery IDs или идентификаторов маршрутизации.

Локальная counterpart: `<OBSIDIAN_VAULT>/01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-10-02.md`; навигация — проектный README, WORKLOG и `claude-kb/wiki/proekt-simcenter.md`. Там сохранены конкретные пути и контракт привязки.

Срез 25.09 сохранён в Obsidian и в [историческом Git snapshot](https://github.com/maiklvas-bot/dns-sim-temp3/blob/9328bbd498903ba99d91e23b84aebd2ded4c0198/docs/project/HERMES_SYNC_SNAPSHOT.md). Его формулировки о полном пакете и исключённых UI-файлах относятся к разным попыткам доставки: read-back подтверждает только отдельный knowledge commit. Это уточнение сохраняет историю, но снимает неоднозначное утверждение о публикации всех изменений.

При подготовке первичной редакции 02.10 файлы оставались в working tree для host-owned commit handoff. Затем хост закоммитил их в `8e1ce553b931ff391d9f129ae791c79d4eebe15c` и опубликовал в [PR #71](https://github.com/maiklvas-bot/dns-sim-temp3/pull/71); это подтверждено повторным чтением локального HEAD и публичного API 02.10. Исправления по ревью готовятся поверх этого коммита; их будущий commit/CI нельзя подтверждать результатом проверки `8e1ce55`.

## Проверка редакции 02.10

Историческая проверка первичной редакции охватила 3 репозиторных документа и 9 заметок vault: YAML/frontmatter, парность code fences, 133 вхождения wikilinks/Markdown-ссылок — PASS. Реальный stdout с exit 0 восстановлен из журнала исполнения и приведён в [отчёте](HERMES_SYNC_REVIEW_EVIDENCE.md). Там же перечислены все девять заметок, изменения, новые проверки и ограничения восстановления baseline. Исторический PASS сохранности не подменяет отсутствующие исходные хеши.

При подготовке первичной редакции документы были untracked: тогда выполнены `git diff --check` (exit 0) и дополнительный `git -c core.autocrlf=false diff --no-index --check` для 12 файлов относительно исходного текста, без whitespace-диагностик. Это историческое описание проверки до commit handoff. После публикации выполнен read-back `git diff --check aa82156..8e1ce553b931ff391d9f129ae791c79d4eebe15c` — exit 0, stdout/stderr пусты. Для следующего HEAD нужен отдельный read-back после коммита хостом. Приложение, CI и production документальными проверками не подтверждены.
