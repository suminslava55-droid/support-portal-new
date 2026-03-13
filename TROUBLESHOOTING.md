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

### «Не удалось прочитать crontab» при сохранении расписания

Причина: Django-контейнер пытается вызвать `crontab` напрямую, которого нет внутри контейнера.

Решение: убедитесь что `cron_manager.sh` смонтирован в контейнер:

```bash
# Проверяем наличие скрипта на хосте
ls -la /opt/support-portal/cron_manager.sh

# Проверяем права
chmod +x /opt/support-portal/cron_manager.sh

# Проверяем что смонтирован в контейнер
docker compose exec backend ls -la /usr/local/bin/cron_manager.sh

# Если не смонтирован — проверьте docker-compose.yml
grep "cron_manager" /opt/support-portal/docker-compose.yml
# Должна быть строка:
# - ./cron_manager.sh:/usr/local/bin/cron_manager.sh:ro
```

Если строки нет в `docker-compose.yml` — добавьте и перезапустите:
```bash
docker compose up -d
```

### Задание не запускается по расписанию

```bash
# Проверить что cron-строка добавлена
crontab -l | grep support-portal

# Проверить что cron запущен
systemctl status cron

# Посмотреть лог выполнения
tail -50 /var/log/support-portal-scheduler.log

# Проверить токен планировщика
ls -la /opt/support-portal/.scheduler_token
cat /opt/support-portal/.scheduler_token
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
t = ScheduledTask.objects.get(task_id='update_rnm')
t.status = 'idle'
t.progress = 0
t.progress_text = ''
t.save()
print('Сброшено')
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

---

## Проблемы с ОФД

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
