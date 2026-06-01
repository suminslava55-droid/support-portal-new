# Support Portal — Обновление и деплой

## История изменений

### Апрель 2026

#### UI и производительность
- **Кастомная тема Ant Design** — цвет акцента `#4F46E5` (индиго), скругления 8-12px, улучшенные тени (`customTheme.js`)
- **Прозрачный хедер** — AppLayout больше не хардкодит чёрный цвет шапки
- **Кастомные CSS стили** — `custom-styles.css` с улучшениями для всех компонентов Ant Design
- **Skeleton Loading** — компоненты скелетонов вместо спиннеров (`SkeletonComponents.jsx`)
- **Lazy Loading** — все страницы загружаются по требованию через `React.lazy()`

#### Надёжность
- **Error Boundary** — перехват JS ошибок, показывает понятное сообщение вместо белого экрана (`ErrorBoundary.jsx`)
- **Retry logic** — автоповтор GET-запросов при сетевых ошибках и 5xx через 1 секунду (`axios.js`)

#### Поиск
- **Fuzzy поиск** через PostgreSQL `pg_trgm` — находит клиентов при опечатках (порог 0.1)
- **Конвертация раскладки** — автоматически конвертирует латиницу набранную в русской раскладке (jvcr → Омск)
- Fuzzy поиск применён везде: список клиентов, замена ФН, база знаний, глобальный поиск

#### Провайдеры — импорт данных из XLS
Загружены данные провайдеров для клиентов из файлов:
- Квантум АО (беспроводное)
- Смартком АО, Сибсвязь ООО (кабель)
- Мобильные ТелеСистемы ПАО (модем/кабель, номера в `provider_settings`)
- ЭР-Телеком Холдинг АО — два файла (кабель)
- Новотелеком ООО, ЭР-Телеком (кабель)
- ТТК-Связь ООО (кабель), МТС разное (модем)
- Интелком ООО, Онрэла ООО, Цифровые технологии ООО

#### Исправления
- `ProviderViewSet` — пагинация отключена (`pagination_class = None`), добавлена сортировка по имени

---

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

# После пересборки — проверяем все пакеты
docker compose exec backend python -c "
import cryptography, paramiko, openpyxl, docx, pdfminer, fitz
print('Все пакеты OK')
"
```

---

## Быстрый деплой фронтенда

> ⚠️ **Важно:** всегда выполняй `git pull` перед деплоем фронтенда.

```bash
cd /opt/support-portal
git pull
bash /opt/support-portal/deploy-frontend.sh
```

---

## Регламентные задания и планировщик

### Первичная настройка (один раз)

```bash
python3 /opt/support-portal/setup_scheduler.py
```

Создаёт `scheduler_run.sh` с параметром `"scheduled":true` — при запуске по cron задание ККТ работает только по истекающим ФН (≤30 дней).

### Доступные задания

| Задание | Описание | По расписанию |
|---------|----------|--------------|
| Обновление данных по ККТ | Обходит клиентов, обновляет через lk.ofd.ru | Только ФН ≤30 дней |
| Обновление внешнего IP | SSH к Микротику → ipify.org. Ошибки Микротика не сохраняются | Все клиенты |
| Резервное копирование | Дамп БД + медиафайлы → `.tar.gz` | По расписанию |

### Проверка crontab

```bash
crontab -l
systemctl status cron
tail -50 /var/log/support-portal-scheduler.log
```

---

## Резервное копирование

### Автоматическое

Настройте задание **«Резервное копирование»** в **Настройки → Регламентные задания**. В бэкап включаются: БД (клиенты, ККТ, настройки, **статьи базы знаний**) + медиафайлы (вложения клиентов + **картинки базы знаний**).

### Восстановление из бэкапа

> ⚠️ Убедитесь что `.env` содержит тот же `ENCRYPTION_KEY` что был при создании бэкапа.

```bash
# 1. Распаковать
tar -xzf /opt/support-portal/backups/backup_YYYY-MM-DD_HH-MM-SS.tar.gz -C /tmp/restore/

# 2. Восстановить БД
docker compose exec backend python manage.py flush --no-input
docker compose exec backend python manage.py loaddata \
  /tmp/restore/backup_YYYY-MM-DD_HH-MM-SS/db.json

# 3. Восстановить медиафайлы (включая картинки базы знаний)
cp -r /tmp/restore/backup_YYYY-MM-DD_HH-MM-SS/media/. /opt/support-portal/media/

# 4. Перезапустить
cd /opt/support-portal && docker compose restart backend
```

---

## Полезные команды

```bash
# Статус контейнеров
docker compose ps

# Логи в реальном времени
docker compose logs -f backend

# Перезапустить бэкенд
docker compose restart backend

# Полная пересборка (после изменений в requirements.txt или Dockerfile)
docker compose up -d --build

# Применить миграции
docker compose exec backend python manage.py migrate

# Проверка всех Python-пакетов (включая базу знаний)
docker compose exec backend python -c "
import cryptography, paramiko, openpyxl, docx, pdfminer, fitz
print('Все пакеты OK')
"

# Просмотр статей базы знаний в БД
docker compose exec backend python manage.py shell -c "
from apps.clients.models import FaqArticle
for a in FaqArticle.objects.all():
    print(a.id, a.category.name, '|', a.title[:50], '|', len(a.content), 'байт')
"

# Просмотр регламентных заданий
docker compose exec backend python manage.py shell -c "
from apps.clients.models import ScheduledTask
for t in ScheduledTask.objects.all():
    print(t.task_id, '|', t.status, '|', t.last_run_at)
"
```
