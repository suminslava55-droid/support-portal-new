# Support Portal — Обновление и деплой

## Когда что использовать

| Изменение | Команда |
|-----------|---------|
| Изменения в Python-коде бэкенда | `docker compose restart backend` |
| Изменения в коде фронтенда (JSX, CSS) | `bash /opt/support-portal/deploy-frontend.sh` |
| Новые Python-зависимости (requirements.txt) | `docker compose up -d --build` |
| Новые миграции базы данных | `docker compose exec backend python manage.py migrate` |
| Обновление токена планировщика (раз в год) | `python3 /opt/support-portal/setup_scheduler.py` |
| Статус службы cron-watch | `systemctl status cron-watch` |
| Перезапуск cron-watch | `systemctl restart cron-watch` |

---

## Обновление системы из git

```bash
cd /opt/support-portal
git pull

# Применяем миграции если они есть
docker compose exec backend python manage.py migrate

# Перезапускаем бэкенд
docker compose restart backend

# Деплоим фронтенд если были изменения в JSX/CSS
bash /opt/support-portal/deploy-frontend.sh

# После пересборки — проверяем пакеты
docker compose exec backend python -c "import cryptography, paramiko, openpyxl; print('OK')"
```

---

## Быстрый деплой фронтенда

> ⚠️ **Важно:** всегда выполняй `git pull` перед деплоем фронтенда. Без этого фронтенд собирается из старых файлов на диске и новые изменения из репозитория не применяются.

```bash
cd /opt/support-portal
git pull
bash /opt/support-portal/deploy-frontend.sh
```

Скрипт собирает React-приложение на хосте (20–40 сек) и копирует в Nginx. Не требует пересборки Docker-контейнеров.

---

## Регламентные задания и планировщик

### Первичная настройка (один раз)

```bash
python3 /opt/support-portal/setup_scheduler.py
```

После этого в **Настройки → Регламентные задания** настройте расписание через интерфейс и нажмите **«Применить расписание»**.

Выберите **часовой пояс** в блоке над расписанием — время вводится по местному времени (через выпадающие списки Час/Минуты), автоматически конвертируется в UTC при сохранении.

### Доступные задания

| Задание | Описание | Ручной запуск |
|---------|----------|---------------|
| Обновление данных по ККТ | Обходит клиентов, обновляет данные через lk.ofd.ru | Все клиенты или отдельная компания |
| Обновление внешнего IP | Подключается к каждому Микротику по SSH, получает внешний IP | Все клиенты |
| Резервное копирование | Дамп БД + медиафайлы → архив `.tar.gz` в `/opt/support-portal/backups/` | Один клик |

При запуске **по расписанию** задание «Обновление данных по ККТ» работает в режиме **только истекающие ФН (≤30 дней)** — это быстрее и щадит лимиты ОФД. При ручном запуске — всегда все ККТ выбранной области.

### Обновление токена планировщика (раз в год)

JWT-токен планировщика действителен 365 дней. За несколько дней до истечения обновите:

```bash
python3 /opt/support-portal/setup_scheduler.py
```

Скрипт безопасен — пересоздаёт токен без потери данных.

### Проверка crontab

```bash
# Просмотр текущих заданий
crontab -l

# Проверка работы cron
systemctl status cron

# Служба cron-watch (перезагружает cron при изменении расписания)
systemctl status cron-watch
journalctl -u cron-watch --no-pager -n 20

# Просмотр лога выполнения заданий
tail -50 /var/log/support-portal-scheduler.log
```

### Если расписание не срабатывает

1. Примените расписание через интерфейс, затем сразу проверьте:

```bash
journalctl -u cron-watch --no-pager -n 5
# Должна появиться строка вида: "Fri Mar 13 08:34:00 UTC 2026: cron reloaded"
```

2. Проверьте что задание есть в crontab и синтаксис правильный:

```bash
crontab -l
```

3. Проверьте лог выполнения:

```bash
grep "scheduler_run" /var/log/syslog | tail -10
```

4. Если `cron-watch` не запущен:

```bash
systemctl restart cron-watch
systemctl status cron-watch
```

5. Если crontab пуст или слетел — восстановите через интерфейс, нажав «Применить расписание» для каждого задания.

> ⚠️ **Не изменяйте расписание менее чем за 5 секунд до времени срабатывания** — cron может пропустить слот. Устанавливайте расписание заранее.

### Ручной запуск задания (минуя интерфейс)

```bash
# Обновление ККТ — все клиенты
bash /opt/support-portal/scheduler_run.sh update_rnm

# Обновление внешнего IP — все клиенты
bash /opt/support-portal/scheduler_run.sh fetch_external_ip
```

---

## Резервное копирование

### Автоматическое

Настройте задание **«Резервное копирование»** в **Настройки → Регламентные задания**. Рекомендуется запускать ежедневно ночью. Хранит последние 7 копий автоматически.

Бэкапы создаются в `/opt/support-portal/backups/` — папка смонтирована на хост через volume.

### Ручной запуск

```bash
# Только БД
docker compose exec backend python manage.py dumpdata \
  --natural-foreign --natural-primary \
  --exclude=contenttypes --exclude=auth.permission \
  --indent=2 > /opt/support-portal/backups/db_manual_$(date +%Y%m%d).json

# Только медиафайлы
tar -czf /opt/support-portal/backups/media_$(date +%Y%m%d).tar.gz \
  -C /opt/support-portal media/
```

### Восстановление из бэкапа

> ⚠️ Убедитесь что `.env` содержит тот же `ENCRYPTION_KEY` что был при создании бэкапа.

```bash
# 1. Распаковать архив
tar -xzf /opt/support-portal/backups/backup_YYYY-MM-DD_HH-MM-SS.tar.gz \
  -C /tmp/restore/

# 2. Очистить БД и загрузить бэкап
docker compose exec backend python manage.py flush --no-input
docker compose exec backend python manage.py loaddata \
  /tmp/restore/backup_YYYY-MM-DD_HH-MM-SS/db.json

# 3. Восстановить медиафайлы
cp -r /tmp/restore/backup_YYYY-MM-DD_HH-MM-SS/media/. \
  /opt/support-portal/media/

# 4. Перезапустить
cd /opt/support-portal && docker compose restart backend
```

> ⚠️ Файл `.env` в бэкап **не входит** — храните его отдельно. Без `ENCRYPTION_KEY` токены ОФД, SSH и SMTP пароли не расшифруются.

---

## Полезные команды

```bash
# Статус контейнеров
docker compose ps

# Логи в реальном времени
docker compose logs -f backend
docker compose logs -f nginx

# Перезапустить бэкенд
docker compose restart backend

# Полная пересборка (после изменений в requirements.txt или Dockerfile)
docker compose up -d --build

# Применить миграции
docker compose exec backend python manage.py migrate

# Резервная копия БД
docker compose exec db pg_dump -U postgres support_portal > backup_$(date +%Y%m%d).sql

# Восстановление из резервной копии
cat backup_20240101.sql | docker compose exec -T db psql -U postgres support_portal

# Проверка всех Python-пакетов
docker compose exec backend python -c "import cryptography, paramiko, openpyxl; print('Все пакеты OK')"

# Проверка доступности скриптов в контейнере
docker compose exec backend ls -la /usr/local/bin/ofd_fetch.sh
docker compose exec backend ls -la /usr/local/bin/cron_manager.sh

# Просмотр компаний и токенов ОФД
docker compose exec backend python manage.py shell -c "
from apps.clients.models import OfdCompany
for c in OfdCompany.objects.all():
    print(c.id, c.name, c.inn, 'токен:', c.ofd_token[:10] + '...' if c.ofd_token else 'НЕТ')
"

# Просмотр регламентных заданий и их статуса
docker compose exec backend python manage.py shell -c "
from apps.clients.models import ScheduledTask
for t in ScheduledTask.objects.all():
    print(t.task_id, '|', t.status, '|', t.last_run_at, '|', t.schedule_time if t.enabled else 'выкл')
"
```

---

> ⚠️ Файл `.env` содержит `ENCRYPTION_KEY` — без него зашифрованные пароли и токены нечитаемы. Храните резервную копию `.env` в надёжном месте отдельно от сервера.
