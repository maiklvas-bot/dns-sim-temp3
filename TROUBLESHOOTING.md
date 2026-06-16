# TROUBLESHOOTING

## Claude Code не запускается
- Проверь расширение в VS Code: Cmd+Shift+P → Reload Window
- Авторизация: `claude auth login`

## Звуковые хуки не работают (Windows)
- PowerShell Beep уже настроен в `.claude/settings.json`
- Если не работает: Cmd+Shift+P → Open Settings → проверь hooks

## .business/ не видна в сайдбаре
- `.vscode/settings.json`: `"**/.business": false` (не true)

## git push отклонён
- `git pull --rebase origin main` перед push
- Убедись что `.business/` в `.gitignore` и снято с tracking:
  `git rm -r --cached .business/`

## Данные расходятся в разных источниках
- Для каждого показателя: источник + дата обновления + метод расчёта
- При расхождении 1С vs ClickHouse → см. `.business/economics/unit-economics.md`
