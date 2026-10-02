# DNS SimCenter — доказательства доработки ревью 02.10.2026

## Актуальное уточнение 03.10.2026

Разделы ниже сохраняют исторический отчёт попытки 3. Его команды и результаты относятся к прошлой редакции, а не к окончательному результату текущей доработки. SHA документационных коммитов фиксируются только во внешних артефактах: запись текущего HEAD внутри изменяемого документа неизбежно устаревает после следующего commit handoff.

### Отдельные артефакты и финальный handoff

Локальный каталог: `<OBSIDIAN_VAULT>/01-projects/simcenter/evidence/2026-10-02-review/`. Прежние `verification.json`, `run3.diff`, `run1-reconstructed.diff`, `baseline-run7.json`, `run7.diff`, `run7-verification.json` и `run7-pr-readback.json` сохранены без перезаписи. Полные артефакты остаются локальными, поскольку содержат машинные пути и операционные идентификаторы.

По замечанию ревью выполнена повторная проверка уже закоммиченной входной редакции в чистом worktree. `run9-input-commit-verification.json` содержит полный SHA, время, stdout/stderr/exit code `git diff --check aa82156..<INPUT_SHA>`, frontmatter, wikilinks/Markdown-ссылки и хеши девяти заметок. `run9-input-pr-readback.json` содержит свежий read-back PR #71 и сравнение с локальным коммитом. Это доказательства входного коммита; последующие изменения текста ими не покрываются.

`run9-working-tree-verification.json` фиксирует проверку этой доработки до handoff; `run9-working-tree.diff` сохраняет изменения vault относительно baseline попытки 7. Прямые ссылки и фактический diff только попытки 9 находятся в локальном snapshot Obsidian. Результаты не дописываются в проверяемый Markdown после проверки.

После финального коммита хост выполняет, подставив полный SHA полученного коммита:

```text
python <LOCAL_EVIDENCE>/verify-run7.py --repo <ASSIGNED_WORKTREE> --primary <PRIMARY_CHECKOUT> --expected-head <FINAL_SHA> --require-clean --label post-commit-<FINAL_SHA>
```

Скрипт проверяет SHA и чистоту дерева, запускает `git diff --check aa82156..<FINAL_SHA>` и сохраняет stdout/stderr/exit code в отдельном `post-commit-<FINAL_SHA>-verification.json` вне репозитория. При несовпадении SHA, dirty state или ошибке проверки возвращает ненулевой код. Хост прикладывает JSON и отдельный read-back опубликованного HEAD PR #71, который должен совпадать с FINAL_SHA. Документы после этого не переписываются ради нового SHA. До выполнения обоих шагов финальный коммит и его публикация не считаются проверенными. CI и production эта процедура не подтверждает.

Исторические SHA документационных редакций ниже заменены обозначением `<HISTORICAL_DOC_SHA>`; точные значения сохранены в прежних JSON-артефактах. База сравнения — `aa82156380acafa8367b821c3f9ae22f6759ba8b`. [Snapshot](HERMES_SYNC_SNAPSHOT.md) · [Статус](HERMES_STATE.md).

## Все девять заметок первой редакции

Пути относительно vault. Полный diff остаётся локальным: он содержит машинные пути и операционные идентификаторы, которые нельзя переносить в публичный репозиторий.

| Заметка | Изменения первой редакции |
| --- | --- |
| `01-projects/simcenter/README.md` | Дата обновления, актуальная привязка проекта/доски, ссылка на новый snapshot, замена устаревшего текущего этапа; прежняя привязка помечена исторической |
| `01-projects/simcenter/WORKLOG.md` | Новая запись 02.10 перед записью 25.09, дата обновления; исправлена относительная ссылка на MOC с одного на два уровня вверх. Старые записи сохранены |
| `01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-09-25.md` | `status: archived`, дата обновления, пять тегов вместо шести; добавлена оговорка о происхождении и ссылка на свежий срез. Историческое тело сохранено |
| `01-projects/simcenter/DNS-LEARNING-SYSTEM-ANALYSIS-2026-09-22.md` | Добавлены frontmatter и предупреждение об отклонённом анализе; исходный текст сохранён целиком после предупреждения |
| `01-projects/simcenter/SIMCENTER-DEVELOPMENT-MEMORY.md` | Добавлено поле `date`, обновлена дата, вставлено уточнение состояния и ссылки на snapshot/интервью; предыдущие разделы сохранены |
| `claude-kb/wiki/proekt-simcenter.md` | Новый текущий статус 02.10, дата обновления, два прежних заголовка помечены историческими; сентябрьский контекст сохранён |
| `99-meta/index.md` | Только строка навигации DNS SimCenter: ссылка на свежий snapshot и краткий статус |
| `05-daily/2026-10-02.md` | Добавлен раздел DNS SimCenter. Позднейший чужой раздел о Codex CLI сохранён; он не относится к этой задаче |
| `01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-10-02.md` | Новая заметка: источники, Git/PR/CI, решения, ограничения проверок и навигация |

В доработке обновлены два репозиторных документа и добавлен этот отчёт. В vault добавлено уточнение к snapshot 02.10 и daily, уточнена строка index; остальные шесть заметок повторно проверены без изменения.

## Происхождение доказательств и сохранность

Исходный `.doc-audit-baseline.json` первой попытки был удалён после проверки. Его первоначальные байтовые хеши сейчас недоступны; утверждать их повторное сравнение нельзя. В журнале первой попытки сохранились точный скрипт изменений, код проверки и реальные tool outputs.

В локальном каталоге `<OBSIDIAN_VAULT>/01-projects/simcenter/evidence/2026-10-02-review/` сохранены:

- `run1-verification.json`: реальные результаты инструмента, а не текст отчёта исполнителя; включает exit code и stdout.
- `run1-reconstructed.diff` и `baseline-reconstructed.json`: восстановленное сравнение по обратным операциям записанного скрипта. Прямое повторение восьми наборов строковых операций даёт наблюдаемые тексты. Это реконструкция, не сохранившийся оригинальный baseline; окончания строк нормализованы, исходные конечные пробелы daily невосстановимы. Позднейший раздел Codex CLI исключён из сравнения первой попытки, но сохранён в снимке начала доработки. Прочие позднейшие изменения вне этих операций реконструкция датировать не может.
- `verify.py`, `verification.json`, `run3.diff`: повторяемая целевая проверка, фактический результат нового запуска, хеши текстов и байтов до/после доработки и diff. Конкретные пути остаются в локальном контексте.

Реконструированный diff позволяет проверить состав изменений; исторический tool output подтверждает, что исходная проверка действительно выполнялась. Ни один из них не превращается в независимое побайтовое доказательство полного состояния vault до первой попытки.

## Реальный вывод первой проверки

Из tool output первой попытки, exit code **0** (два успешных запуска с одинаковым результатом):

```text
Checked 3 repository docs, 9 vault notes, 133 link occurrences
PASS: YAML/frontmatter, code fences, public path/routing exclusion, primary hashes/status/diffs, historical content preservation
NEW BROKEN LINKS: []
PREEXISTING BROKEN LINKS: []
```

Финальный whitespace tool output той попытки, exit code **0**:

```text
Final whitespace check: PASS, 12 files
?? docs/project/HERMES_ROADMAP.md
?? docs/project/HERMES_STATE.md
?? docs/project/HERMES_SYNC_SNAPSHOT.md
```

Это доказательство состояния до handoff. Слово `untracked` не описывает опубликованный `<HISTORICAL_DOC_SHA>`.

## Commit read-back и границы

02.10 публичный GitHub API `pulls/71` вернул `state=open`, `merged=false`, `head.sha=<HISTORICAL_DOC_SHA>`; локальный `git rev-parse HEAD` совпал. [PR #71](https://github.com/maiklvas-bot/dns-sim-temp3/pull/71).

```text
git diff --check aa82156..<HISTORICAL_DOC_SHA>
exit code: 0
stdout: empty
stderr: empty
```

Следующий HEAD создаёт хост после выхода исполнителя. Поэтому read-back `git diff --check aa82156..<новый HEAD>` остаётся обязательным шагом хоста: записать точный SHA, stdout/stderr и exit code; не заменять его проверкой рабочего дерева или предыдущего коммита. Исполнитель не создаёт коммит ради этой проверки. CI, приложение, production и deploy этой документальной доработкой не проверены.

## Новый целевой прогон

Команда (локальные корни передаются явно):

```text
python <LOCAL_EVIDENCE>/verify.py --repo <ASSIGNED_WORKTREE> --primary <PRIMARY_CHECKOUT>
exit code: 0
PASS: 4 repository docs, 9 vault notes, 148 link occurrences
BROKEN LINKS / ERRORS: []
Primary run-3 hashes: PASS
git diff --check aa82156..<HISTORICAL_DOC_SHA>: exit=0
git diff --check aa82156: exit=0
git diff --check: exit=0
```

`<LOCAL_EVIDENCE>` — каталог evidence выше. Проверены YAML с обязательными полями и числом тегов, парность code fences, существование локальных целей wikilinks/Markdown и отсутствие приватных путей/маршрутизации в публичных документах. HTTP-доступность внешних ссылок и heading/block anchors не проверяются этим скриптом. Новый untracked отчёт отдельно проверен на trailing whitespace; обычный `git diff` его не охватывает.

| Файл | Frontmatter | Fences | Wikilinks | Markdown links |
| --- | --- | --- | ---: | ---: |
| `01-projects/simcenter/README.md` | PASS | PASS | 14 | 0 |
| `01-projects/simcenter/WORKLOG.md` | PASS | PASS | 15 | 0 |
| `01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-09-25.md` | PASS | PASS | 4 | 0 |
| `claude-kb/wiki/proekt-simcenter.md` | PASS | PASS | 26 | 0 |
| `01-projects/simcenter/SIMCENTER-DEVELOPMENT-MEMORY.md` | PASS | PASS | 22 | 0 |
| `01-projects/simcenter/DNS-LEARNING-SYSTEM-ANALYSIS-2026-09-22.md` | PASS | PASS | 2 | 0 |
| `99-meta/index.md` | PASS | PASS | 14 | 0 |
| `05-daily/2026-10-02.md` | PASS | PASS | 3 | 0 |
| `01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-10-02.md` | PASS | PASS | 10 | 14 |
| `docs/project/HERMES_ROADMAP.md` | not-required | PASS | 0 | 3 |
| `docs/project/HERMES_STATE.md` | not-required | PASS | 0 | 7 |
| `docs/project/HERMES_SYNC_REVIEW_EVIDENCE.md` | not-required | PASS | 0 | 3 |
| `docs/project/HERMES_SYNC_SNAPSHOT.md` | not-required | PASS | 0 | 11 |

## SHA-256 девяти заметок: начало и результат доработки

Это настоящие байтовые SHA-256, снятые в попытке доработки, **не** восстановленные хеши состояния до первой редакции. Шесть неизменённых заметок имеют одинаковые хеши. Для snapshot и daily проверен полный неизменный префикс; для index — единственное дополнение строки SimCenter. Все различия сохранены в локальном `run3.diff`. Исходный раздел daily другого проекта не удалён.

| Заметка | До доработки, raw SHA-256 | После доработки, raw SHA-256 |
| --- | --- | --- |
| `01-projects/simcenter/README.md` | `8d80edcfd51181021877a187f7c1db8c3f3f113cb30ae8e977bd49a579fa90e8` | `8d80edcfd51181021877a187f7c1db8c3f3f113cb30ae8e977bd49a579fa90e8` |
| `01-projects/simcenter/WORKLOG.md` | `80091ba1457a8f2bd5d48296ef745a52f204d24124e8ac479cc3c9bb95739eb4` | `80091ba1457a8f2bd5d48296ef745a52f204d24124e8ac479cc3c9bb95739eb4` |
| `01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-09-25.md` | `7f13d632c360ed830ec4d61dac0d68e34713528110f4a01d1634578187d95e8a` | `7f13d632c360ed830ec4d61dac0d68e34713528110f4a01d1634578187d95e8a` |
| `claude-kb/wiki/proekt-simcenter.md` | `8085a4205c25c99af0d4b0e589c9b02a9ca37d2f94d4256f1bbdd9016772bbeb` | `8085a4205c25c99af0d4b0e589c9b02a9ca37d2f94d4256f1bbdd9016772bbeb` |
| `01-projects/simcenter/SIMCENTER-DEVELOPMENT-MEMORY.md` | `3c8f0cfc47c0c5b47e1ff0cbbdfb08f40933fe52ec64a89c46791501f83ae698` | `3c8f0cfc47c0c5b47e1ff0cbbdfb08f40933fe52ec64a89c46791501f83ae698` |
| `01-projects/simcenter/DNS-LEARNING-SYSTEM-ANALYSIS-2026-09-22.md` | `e75a936c111d73e0590de4c5238bb3859f4c2056400306ef5a9154d61ca38d1f` | `e75a936c111d73e0590de4c5238bb3859f4c2056400306ef5a9154d61ca38d1f` |
| `99-meta/index.md` | `d2dba09e6446be9d08badeb814548bb862b15477bd9a7e8b6ddcbd1c7417332a` | `6926d37df8c39e3399ace83714316978b0fe3152550a47b2ab1a3d741d05508d` |
| `05-daily/2026-10-02.md` | `7bf470dc201bccbbcc2ce4da4dab6dd3b28d5558748ef618341aa8a2b624bc1d` | `154c2e8df12a83b23ce71d7591da75e7507b85331669bd693357bbab11acd405` |
| `01-projects/simcenter/HERMES-GIT-OBSIDIAN-SNAPSHOT-2026-10-02.md` | `d9be9d1bf4ff42ffc0a0574bc983a1303fd61175b7774b44649b53170a03e1cb` | `c535165d2cc451ae1c75d79105dcea253d9a1ceb1ecf58b1dbcd2e3d053ca97e` |

Проверка неизменности основного checkout в этой попытке сравнила хеши трёх исходных `HERMES_*.md`, stdout `status --porcelain=v1`, `diff --binary` и `diff --cached --binary`; все шесть пар совпали. Значения сохранены в `verification.json`. Это доказательство интервала доработки, не повторная проверка удалённого baseline первой попытки.
