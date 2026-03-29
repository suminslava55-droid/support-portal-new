# Support Portal — Устранение неполадок

## 🔍 Универсальная диагностика

```bash
cd /opt/support-portal
bash diagnose.sh 2>&1 | tee /tmp/diag_result.txt
cat /tmp/diag_result.txt
```

---

### SSH ключ Микротика изменился (замена оборудования)

При замене Микротика его SSH ключ меняется. Портал хранит ключи в `/opt/support-portal/known_hosts` и отклонит подключение с ошибкой:
```
⚠️ SSH ключ хоста изменился (замена Микротика?). Удалите запись из known_hosts
```

Решение — удалить старую запись для конкретного IP:
```bash
# Посмотреть текущий known_hosts
cat /opt/support-portal/known_hosts

# Удалить запись для конкретного Микротика (замените IP)
ssh-keygen -R 192.168.1.1 -f /opt/support-portal/known_hosts

# Или очистить весь known_hosts (все Микротики запомнятся заново)
rm /opt/support-portal/known_hosts
```

После этого при следующем подключении новый ключ запомнится автоматически.

---



### После docker compose down/up показывается старый фронтенд

```bash
bash /opt/support-portal/deploy-frontend.sh
```

Постоянное решение — убедитесь что в `docker-compose.yml` у nginx есть volume:
```yaml
volumes:
  - ./frontend/build:/usr/share/nginx/html
```

### Белый экран в браузере
```bash
docker compose logs nginx --tail=30
# Жёсткий сброс кэша: Ctrl+Shift+R
```

### Ошибка 500 от API
```bash
docker compose logs backend --tail=50
```

### No module named 'cryptography' / 'paramiko' / 'openpyxl' / 'docx' / 'pdfminer' / 'fitz'

Пакеты устанавливаются автоматически из `requirements.txt` при `docker compose up --build`. При ручной установке:

```bash
docker compose exec backend pip install \
  cryptography paramiko openpyxl python-docx pdfminer.six PyMuPDF \
  --break-system-packages
docker compose restart backend
```

Проверка через **Настройки → Диагностика → Проверить** — все 6 пунктов должны быть зелёными.

### DEBUG включён случайно
```bash
grep "DEBUG" /opt/support-portal/.env  # должно быть DEBUG=False
docker compose restart backend
```

### После смены ENCRYPTION_KEY перестали читаться пароли

Введите SSH и SMTP пароли заново в разделе «Настройки», обновите токены ОФД в разделе «Компании».

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

---

## Проблемы с базой знаний (FAQ)

### Импорт из .docx — картинки не загружаются

Проверьте наличие `python-docx` и `PyMuPDF`:
```bash
docker compose exec backend python -c "import docx, fitz; print('OK')"
```

Если не установлены — см. раздел «No module named...» выше.

Если картинки в VML-формате (старый Word) — это нормально, они поддерживаются. Если всё равно не грузятся — проверьте логи:
```bash
docker compose logs backend --tail=30
```

### Импорт из .pdf — только текст, без картинок

Проверьте наличие `PyMuPDF`:
```bash
docker compose exec backend python -c "import fitz; print(fitz.version)"
```

Если не установлен:
```bash
docker compose exec backend pip install PyMuPDF --break-system-packages
docker compose restart backend
```

### 404 при импорте из файла

`urls.py` на сервере не содержит endpoint `/api/clients/faq-articles/{id}/import/`. Проверьте:
```bash
grep "faq-import\|import" /opt/support-portal/backend/apps/clients/urls.py
```

Если строки нет — скопируйте актуальный `urls.py` и перезапустите бэкенд.

### Картинки из PDF дублируются

Это баг некоторых PDF где одно изображение хранится в двух `xref`. Исправлено в актуальной версии через дедупликацию по `xref` и близости `bbox_y` (< 15px). Обновите `faq_views.py`.

### Статья не сохраняется — нет id у черновика

При открытии нового редактора автоматически создаётся черновик. Если API недоступен — проверьте:
```bash
docker compose logs backend --tail=20
```

### Ошибка сортировки объектов FaqCategory / FaqArticle

```bash
docker compose exec backend python manage.py migrate
```

---

## Проблемы с регламентными заданиями

### «Не удалось прочитать crontab» / ошибка nsenter

```bash
grep -A3 "backend:" /opt/support-portal/docker-compose.yml
# Должны быть строки: pid: host и privileged: true

docker compose exec backend nsenter -m -u -i -n -p -t 1 crontab -l
```

### Задание ККТ обновляет все записи вместо истекающих

Проверьте `scheduler_run.sh` — должен содержать `"scheduled":true`:
```bash
grep "scheduled" /opt/support-portal/scheduler_run.sh
```

Если нет — пересоздайте:
```bash
python3 /opt/support-portal/setup_scheduler.py
grep "scheduled" /opt/support-portal/scheduler_run.sh
```

### Задание не запускается по расписанию

```bash
crontab -l
systemctl status cron
tail -50 /var/log/support-portal-scheduler.log
systemctl status cron-watch
```

### Задание висит в статусе «running»

```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import ScheduledTask
for t in ScheduledTask.objects.filter(status='running'):
    t.status = 'idle'; t.progress = 0; t.progress_text = ''; t.save()
    print(f'Сброшено: {t.task_id}')
"
```

### Crontab слетел или пуст

Зайдите в **Настройки → Регламентные задания** и нажмите **«Применить расписание»** для каждого задания.

### Токен планировщика истёк (задание возвращает 401)

```bash
python3 /opt/support-portal/setup_scheduler.py
```

---

## Проблемы с резервным копированием

### Бэкап не появляется в `/opt/support-portal/backups/`

```bash
grep "backups" /opt/support-portal/docker-compose.yml
# Должно быть: - ./backups:/opt/support-portal/backups
```

### После восстановления токены ОФД / SSH пароль не работают

`ENCRYPTION_KEY` в `.env` отличается от того что был при создании бэкапа. Восстановите `.env`:
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

---

## Проблемы с дашбордом

### Дежурства сегодня/завтра не отображаются

Дашборд показывает только дежурства с типами: Телефон, Работа днём, Телефон + день. Отпуск и «Занят» не отображаются — это норма.

### Метрики ФН показывают неверные данные

```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import KktData
from django.utils import timezone
expired = KktData.objects.filter(fn_end_date__lt=timezone.now()).count()
print(f'Просрочено: {expired}')
"
```

---

## Прочее

### Конфликт миграций

```bash
docker compose exec backend python manage.py migrate --run-syncdb
```

### Ошибка сборки фронтенда

```bash
cd /opt/support-portal/frontend
rm -rf node_modules
npm install
npm run build
```

### Проверка сети до lk.ofd.ru
```bash
bash /opt/support-portal/check_ofd_network.sh
```

### Проверка токенов всех компаний
```bash
bash /opt/support-portal/check_ofd_tokens.sh
```
