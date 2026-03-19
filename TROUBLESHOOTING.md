# Support Portal — Устранение неполадок

## 🔍 Универсальная диагностика

При любой непонятной ошибке (500, 400, токены не сохраняются, API не отвечает):

```bash
cd /opt/support-portal
bash diagnose.sh 2>&1 | tee /tmp/diag_result.txt
cat /tmp/diag_result.txt
```

---

## Частые проблемы

### После docker compose down/up показывается старый фронтенд

После полного перезапуска nginx пересобирается из образа и возвращает старую версию фронтенда.

Быстрое исправление — задеплоить фронтенд заново:
```bash
bash /opt/support-portal/deploy-frontend.sh
```

Постоянное решение — убедитесь что в `docker-compose.yml` у nginx есть volume:
```yaml
volumes:
  - ./frontend/build:/usr/share/nginx/html
```
Тогда nginx всегда берёт актуальную сборку с хоста.

### Белый экран в браузере
```bash
docker compose logs nginx --tail=30
# Жёсткий сброс кэша: Ctrl+Shift+R
```

### Ошибка 500 от API
```bash
docker compose logs backend --tail=50
```

### No module named 'cryptography' / 'paramiko' / 'openpyxl'
Пакеты слетели при пересборке контейнера:
```bash
docker compose exec backend pip install cryptography paramiko openpyxl --break-system-packages
docker compose restart backend
```

### Скрипт ОФД не найден в контейнере
```bash
ls -la /opt/support-portal/ofd_fetch.sh
docker compose exec backend ls -la /usr/local/bin/ofd_fetch.sh
```

### Пустой ответ от скрипта ОФД / timeout
```bash
# Тест с хоста (НЕ из контейнера!)
python3 /opt/support-portal/ofd_fetch.sh <ИНН> <ТОКЕН> "Адрес"
```

### Обновление ККТ занимает много времени (это нормально)
API `lk.ofd.ru` — не более 1 запроса в секунду. При 700 кассах ~13 минут. Gunicorn настроен с `--timeout 1000`.

### Токен ОФД не сохраняется / ошибка 500
```bash
# Проверяем — должно быть 1
grep -c "class OfdCompanyViewSet" /opt/support-portal/backend/apps/clients/views.py

# Проверяем импорт
grep "OfdCompanyWriteSerializer" /opt/support-portal/backend/apps/clients/views.py

# Если импорта нет — добавляем
sed -i 's/OfdCompanySerializer,$/OfdCompanySerializer, OfdCompanyWriteSerializer,/' \
  /opt/support-portal/backend/apps/clients/views.py

docker compose restart backend
```

### DEBUG включён случайно
```bash
grep "DEBUG" /opt/support-portal/.env  # должно быть DEBUG=False
docker compose restart backend
```

### Черновики накапливаются в базе
```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import Client
from django.utils import timezone
from datetime import timedelta
old = Client.objects.filter(is_draft=True, created_at__lt=timezone.now()-timedelta(hours=2))
print(f'Найдено черновиков: {old.count()}')
for c in old:
    for f in c.files.all(): f.file.delete(); f.delete()
    c.delete()
print('Готово')
"
```

### После смены ENCRYPTION_KEY перестали читаться пароли
Введите SSH и SMTP пароли заново в разделе «Настройки», обновите токены ОФД в разделе «Компании».

### Конфликт миграций (Conflicting migrations detected)
```bash
cat > /opt/support-portal/backend/apps/accounts/migrations/0004_merge.py << 'MIGRATION'
from django.db import migrations
class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0002_user_birthday'),
        ('accounts', '0003_update_role_choices'),
    ]
    operations = []
MIGRATION
docker compose exec backend python manage.py migrate
```

### Ошибка сборки фронтенда
```bash
cd /opt/support-portal/frontend
rm -rf node_modules
npm install
npm run build
```

### Ошибка сортировки по полям Компания / ИНН
Сортировка идёт через `ofd_company__name` и `ofd_company__inn`. Сбросьте кэш браузера (`Ctrl+Shift+R`).

---

## Проблемы с регламентными заданиями

### «Не удалось прочитать crontab» / ошибка nsenter при сохранении расписания

Причина: `cron_manager.sh` использует `nsenter` для доступа к crontab хоста из контейнера. Требуются `pid: host` и `privileged: true` в `docker-compose.yml`.

```bash
# Проверяем настройки docker-compose.yml
grep -A3 "backend:" /opt/support-portal/docker-compose.yml
# Должны быть строки:
#   pid: host
#   privileged: true

# Проверяем наличие скрипта
docker compose exec backend ls -la /usr/local/bin/cron_manager.sh

# Проверяем что nsenter работает из контейнера
docker compose exec backend nsenter -m -u -i -n -p -t 1 crontab -l
```

Если `pid: host` или `privileged: true` отсутствуют — добавьте и перезапустите:
```bash
docker compose down
docker compose up -d
```

### Задание не запускается по расписанию

```bash
# Проверить что cron-строка есть
crontab -l

# Проверить что cron запущен
systemctl status cron

# Посмотреть лог выполнения заданий
grep "scheduler_run" /var/log/syslog | tail -20

# Посмотреть лог планировщика
tail -50 /var/log/support-portal-scheduler.log

# Проверить статус cron-watch
systemctl status cron-watch
journalctl -u cron-watch --no-pager -n 10
```

### Crontab слетел или пуст

При полной остановке контейнеров (`docker compose down`) crontab может обнулиться. Восстановление:

Зайдите в **Настройки → Регламентные задания** и нажмите **«Применить расписание»** для каждого задания.

Или вручную:
```bash
crontab -l   # проверяем
# Если пусто — вручную восстанавливаем через crontab -e
```

### Токен планировщика истёк (задание возвращает 401)

```bash
# Обновить токен
python3 /opt/support-portal/setup_scheduler.py

# Проверить что новый токен сохранился
ls -la /opt/support-portal/.scheduler_token
```

### Задание висит в статусе «running»

Если сервер перезапускался во время выполнения задания, статус может зависнуть. Сброс вручную:

```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import ScheduledTask
for t in ScheduledTask.objects.filter(status='running'):
    t.status = 'idle'
    t.progress = 0
    t.progress_text = ''
    t.save()
    print(f'Сброшено: {t.task_id}')
"
```

### scheduler_run.sh не найден

```bash
ls -la /opt/support-portal/scheduler_run.sh
```

Если файл отсутствует — повторно запустите настройку:
```bash
python3 /opt/support-portal/setup_scheduler.py
```

### cron-watch не перезагружает cron (нет строки «cron reloaded» в логе)

```bash
# Проверяем статус
systemctl status cron-watch

# Проверяем что скрипт существует и исполняемый
ls -la /usr/local/bin/cron-watch.sh

# Проверяем что inotify-tools установлен
which inotifywait

# Перезапускаем
systemctl restart cron-watch
```

Если служба падает с ошибкой — пересоздайте:
```bash
cat > /usr/local/bin/cron-watch.sh << 'EOF'
#!/bin/bash
while true; do
  inotifywait -e close_write,modify /var/spool/cron/crontabs/root 2>/dev/null
  SEC=$((10#$(date +%S)))
  if [ "$SEC" -gt 55 ]; then
    sleep 10
  fi
  kill -HUP $(cat /run/crond.pid) && echo "$(date): cron reloaded"
  sleep 1
done
EOF

chmod +x /usr/local/bin/cron-watch.sh
systemctl daemon-reload
systemctl restart cron-watch
```

---

## Проблемы с резервным копированием

### Бэкап создаётся но файл не появляется в `/opt/support-portal/backups/`

Папка не смонтирована в контейнер. Проверьте `docker-compose.yml`:

```bash
grep "backups" /opt/support-portal/docker-compose.yml
# Должно быть:
#   - ./backups:/opt/support-portal/backups
```

Если строки нет — добавьте и пересоздайте контейнер:
```bash
mkdir -p /opt/support-portal/backups
# Добавьте в docker-compose.yml в секцию volumes backend:
#   - ./backups:/opt/support-portal/backups
docker compose up -d backend
```

### Ошибка `pg_dump: command not found`

`pg_dump` не установлен в контейнере бэкенда. Задание использует Django `dumpdata` — убедитесь что установлена актуальная версия `scheduler_views.py`.

### Ошибка при восстановлении `loaddata`: `DeserializationError` / `IntegrityError`

Вероятная причина — в БД уже есть данные. Очистите перед восстановлением:
```bash
docker compose exec backend python manage.py flush --no-input
docker compose exec backend python manage.py loaddata /tmp/restore/.../db.json
```

### После восстановления токены ОФД / SSH пароль не работают

`ENCRYPTION_KEY` в `.env` отличается от того что был при создании бэкапа. Восстановите `.env` из резервной копии и перезапустите:
```bash
docker compose restart backend
```

### Задание «Резервное копирование» висит в статусе «running»

```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import ScheduledTask
t = ScheduledTask.objects.get(task_id='backup_system')
t.status = 'idle'; t.progress = 0; t.progress_text = ''; t.save()
print('Сброшено')
"
```

### Проверка сети до lk.ofd.ru
```bash
bash /opt/support-portal/check_ofd_network.sh
```
Ожидаемый результат: TCP 443 OK, curl HTTP 403 — это нормально.

### Проверка токенов всех компаний
```bash
bash /opt/support-portal/check_ofd_tokens.sh
```
Результаты: `✅ OK` — токен рабочий, `❌ HTTP 403` — токен протух (обновите в lk.ofd.ru), `❌ TimeoutError` — сервер не отвечает, `❌ КИРИЛЛИЦА В ТОКЕНЕ` — введён мусор.
