# Docker Deployment

Проект переведен на Docker и разворачивается одной службой через `docker compose`, а внешний доступ и SSL обслуживаются хостовым `nginx + certbot`.

## Что сохраняется между перезапусками

- SQLite база: `storage/data/data.db`
- Загруженные файлы: `uploads/`

При первом старте контейнер автоматически копирует стартовую БД из репозитория, если постоянная БД еще не создана.

## Первичная установка на пустой сервер

Перед запуском:

- укажите `A`-запись домена на IP сервера;
- откройте на сервере порты `80` и `443`;
- загрузите проект на сервер.

1. Загрузите проект на сервер.
2. При необходимости отредактируйте `.env.example`.
3. Запустите:

```bash
sudo bash ./install.sh --domain example.com --email admin@example.com
```

По умолчанию проект будет установлен в:

```text
/opt/dns-simcenter
```

Если нужен другой путь:

```bash
sudo bash ./install.sh --install-dir /srv/dns-simcenter --source-dir /path/to/source
```

Скрипт сам:

- определяет Debian/Ubuntu или RHEL-like систему;
- ставит Docker Engine и Docker Compose plugin;
- ставит `nginx`, `certbot` и плагин для nginx;
- копирует проект в каталог установки;
- создает `.env`, если его еще нет;
- поднимает контейнеры;
- настраивает reverse proxy на домен;
- выпускает и подключает Let's Encrypt сертификат.

Если нужно развернуть сначала без сертификата:

```bash
sudo bash ./install.sh --domain example.com --skip-certbot
```

## Обновление

Если у вас есть новая версия исходников:

```bash
sudo bash ./update.sh --source-dir /path/to/new/source
```

Если обновление приходит архивом в `/root`, распаковка и обновление могут выглядеть так:

```bash
cd /root
unzip -o dns-simcenter-update.zip -d dns-simcenter-update
sudo bash /opt/dns-simcenter/update.sh --source-dir /root/dns-simcenter-update
```

Если вы уже находитесь в каталоге установленного проекта:

```bash
cd /opt/dns-simcenter
sudo bash ./update.sh --source-dir .
```

## Перезапуск

```bash
sudo bash ./restart.sh
```

`restart.sh` пересоздаёт контейнер, поэтому новые переменные из `.env` и обновлённый образ точно подхватываются.

## Полезные команды

```bash
cd /opt/dns-simcenter
docker compose ps
docker compose logs -f
docker compose up -d --build
systemctl status nginx
journalctl -u nginx -n 100 --no-pager
```

## Важные переменные `.env`

```bash
PORT=5000
APP_PORT=5000
SESSION_SECRET=change-me
ADMIN_USERNAME=admin
ADMIN_PASSWORD=strong-password
EVALUATOR_USERNAME=evaluator
EVALUATOR_PASSWORD=strong-password
```

- `PORT` — порт внутри контейнера.
- `APP_PORT` — локальный порт на `127.0.0.1`, на который nginx проксирует запросы.

Для Docker-режима включена синхронизация служебных учетных записей из `.env` при каждом старте контейнера.
