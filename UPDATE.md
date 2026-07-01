# Support Portal — Обновление и деплой

## История изменений

### Июль 2026 — Управление ПК аптек: удалённое выполнение заданий

Новый раздел (только Администратор) для удалённого запуска PowerShell/cmd-скриптов и копирования файлов на серверы и кассы (Windows-ПК) аптек.

- **Транспорт** — копирование файлов через SMB (impacket); скрипты через WinRM (pywinrm/NTLM), а где WinRM закрыт (обычно Win7) — через WMI-fallback (impacket, `Win32_Process.Create` + чтение вывода из временного лог-файла по SMB, с автоочисткой).
- **Цели онлайн** — IP сервера из подсети (`.2`), IP касс опрашиваются у Микротика по SSH в момент запуска (DHCP-аренды `kassa1..6`). Режимы: Сервер / Кассы / Сервер + кассы.
- **Фронтенд** — страница «Управление ПК аптек», две вкладки: Клиенты (выбор с чекбоксами, фильтр по компании) и Задания (создание, история, онлайн-прогресс, «Подробно»/«Отменить»/«Повторить»).
- **Умный повтор** — «Повторить» не запускается на ПК, где уже успешно выполнено (по всей цепочке повторов, поле `PcJob.repeat_of`), а кассы опрашивает заново: недоступная ранее касса с новым IP тоже получит задание.
- **УЗ Windows** — единая учётная запись в Настройки → Учётные записи (шифрование Fernet, как SSH/SMTP).
- **Фоновое выполнение** — `threading.Thread` + статус в БД (`PcJob`/`PcJobTarget`), опрос прогресса ~2 с. Файлы заданий — `media/pc_jobs/<id>/<имя>`.

Новые файлы:
- `backend/apps/pcmgmt/` — models, executor, views, serializers, urls, admin
- `frontend/src/pages/PcManagementPage.jsx` — интерфейс раздела

Изменения:
- `SystemSettings` — добавлены `winrm_user` / `winrm_password_encrypted` (+ секция `winrm` в settings API)
- `requirements.txt` — добавлены `pywinrm`, `impacket`

**Деплой этого обновления:**
```bash
cd /opt/support-portal && git pull
# новые зависимости в requirements.txt → полная пересборка бэкенда
docker compose build backend && docker compose up -d backend
docker compose exec backend python manage.py migrate
./deploy-frontend.sh
# проверить пакеты: Настройки → Диагностика (pywinrm, impacket должны быть ✅)
```

---

### Июнь 2026 — ComProxy HUB: удалённое управление кассами

#### ComProxy — приём телеметрии и удалённое обновление ПО/прошивок

- **HUB-сервер** — приём данных от AgentService на кассах (протокол Crystals): handshake, poll, cash_info_report, counters_report, registration_report
- **Автосопоставление** устройств ComProxy с ККТ по регистрационному номеру (РНМ)
- **Удалённое обновление** — загрузка пакетов обновлений (ComProxy `.jar`, прошивки `.bin`/`.hex`/`.frm`), отправка задач `update_software` через poll, раздача метаданных и файлов через `/v2/projects/.../patches/...`
- **Фронтенд** — страница ComProxy с тремя вкладками: Устройства, Обновления, Задачи
- **Права доступа** — раздел доступен только ролям Администратор и Системный администратор
- **Аутентификация HUB** — HTTP Basic Auth из `.env` (`COMPROXY_HUB_USER`/`COMPROXY_HUB_PASSWORD`), без хардкода в коде

Новые файлы:
- `backend/apps/comproxy/` — models, views (HUB), admin_views (API), serializers, authentication, urls
- `frontend/src/pages/ComProxyDevicesPage.jsx` — интерфейс управления
- `comproxy/AgentService_ini_analysis.md` — документация протокола AgentService

Новые переменные `.env`:
```
COMPROXY_HUB_USER=viki
COMPROXY_HUB_PASSWORD=Dms6RcU62YhFxKLPKdwYjQBqaZU7V4Wv
```

---

### Июнь 2026 — Аудит безопасности AUDIT_2026-06-14 (полное устранение)

#### Безопасность (блокеры)
- **Исправление refresh-токена** (B-1) — URL `/api/auth/token/refresh/` вместо неверного `/api/auth/refresh/`; пользователей перестало выбрасывать на логин
- **Stored XSS в базе знаний** (B-2) — серверный санитайзинг через `bleach`, клиентский через `DOMPurify`; экспорт PDF тоже защищён
- **Ограничение типов файлов FAQ** (B-3) — allowlist безопасных расширений; nginx отдаёт вложения только как `attachment` (no inline HTML/SVG)
- **RCE через task_id** (B-4) — allowlist разрешённых task_id в планировщике, hardening `cron_manager.sh` (strip `\n`)
- **Bypass rate-limit** (B-5) — nginx передаёт `X-Forwarded-For: $remote_addr` (реальный IP), брутфорс невозможен
- **nginx/default.conf в git** (B-6) — добавлен `location /static/`, nginx стартует после `git clone`
- **Транзакция в restore backup** (B-7) — `TRUNCATE + loaddata` в `transaction.atomic()`; БД не остаётся пустой при сбое
- **Транзакция в bulk-импорте** (B-8) — все клиенты создаются атомарно или ни одного
- **pg_trgm через миграцию** (B-9) — миграции 0034 (GIN-индексы), fuzzy-поиск надёжен

#### Безопасность (дополнительно)
- **SSRF в FetchExternalIPView** (S-1) — проверка что mikrotik_ip принадлежит подсети клиента; добавлено разрешение `CanEditClient`
- **Path traversal в экспорте docx** (S-2) — `os.path.realpath()` для изображений из FAQ
- **BulkImportClientsView** (S-3) — добавлено разрешение `CanEditClient`
- **RnmSyncView** (S-4) — добавлено разрешение `IsAdmin`
- **IDOR в дежурствах** (S-5) — `set_duty`, `bulk_set_duty`, `toggle_holiday` проверяют права администратора
- **ККТ write-эндпоинты** (S-6) — `OfdKktView`, `KktListView` требуют `CanEditClient`
- **Argument injection в ping** (S-8) — добавлен `--` перед IP

#### Безопасность (фронтенд)
- **sanitizeHTML** блокирует `data:image/svg+xml` и добавляет `rel="noopener noreferrer"` (F-14)
- **Контраст текста** `colorTextTertiary` → `#6B7280` (WCAG AA 4.6:1) (F-5)
- **Кликабельные `div`** → `role="button"` + `tabIndex` + `onKeyDown` (F-6, WCAG 2.1.1)

#### Надёжность backend
- **Race condition в планировщике** (A-1) — `select_for_update()` в `transaction.atomic()`
- **LOGGING в settings.py** (A-2) — структурированные логи в stdout/docker logs
- **Логирование decrypt_value()** (A-4) — `logger.warning()` вместо тихого `except: return ''`
- **Cleanup в backup при ошибке** (A-5) — неполные папки удаляются при исключении

#### База данных
- **UniqueConstraint на KktData** (D-1) — миграция 0036, дубли РНМ невозможны
- **unique на OfdCompany.inn** (D-2) — миграция 0037
- **Фильтр is_draft=False в ККТ** (D-7) — черновые клиенты не попадают в список замены ФН
- **Параметры year/month обязательны** (D-8) — Calendar API без параметров возвращает текущий месяц
- **select_related + prefetch_related** (D-5, D-11) — устранены N+1 запросы в клиентах
- **annotate Count** (D-10) — счётчик статей в категориях через один запрос
- **Защита удаления OfdCompany** (D-6) — нельзя удалить компанию с привязанными клиентами

#### Фронтенд UX
- **AppLayout** — base64 JPEG 63КБ заменён на `/saint.jpg` (F-1)
- **Мёртвый код удалён** — `MainLayout.jsx`, `ProtectedRoute.js`, дубли страниц clients/, users/ (F-2)
- **Навигационный блокировщик** — предупреждение при уходе с несохранённой формой клиента (F-4)
- **Обработка ошибок API** — DashboardPage error state + кнопка «Повторить»; CalendarPage/FaqPage message.error (F-7, F-8, F-9)
- **Валидация CIDR** для поля «Подсеть аптеки» (F-11)
- **Адаптивность** — Dashboard grid auto-fit, таблица клиентов scroll x (F-13)
- **validatePassword** вынесен в `utils/validators.js`, используется в AppLayout и UsersPage (F-15)
- **InputNumber** вместо `<input type="number">` в CalendarPage (F-19)
- **Memory leak** — cleanup `setInterval` при unmount в SettingsPage (F-18)

#### DevOps
- **Health endpoint** `/api/clients/health/` — без аутентификации (O-3)
- **docker-compose.yml** — healthcheck для backend, nginx `depends_on: service_healthy` (O-3)
- **Версии образов зафиксированы** — postgres:16.12, python:3.11.15, nginx:1.29, node:20.19 (O-7)
- **npm ci** вместо npm install в Dockerfile фронтенда (O-7)
- **frontend/package-lock.json** добавлен в git (O-5)
- **.dockerignore** для backend и frontend (O-11)
- **robots.txt** — запрет индексации поисковиками (O-13)
- **diagnose.sh** — исправлены пути на `views/` (O-4)
- **ROLLBACK.md** — инструкция отката (O-8)

---

### Июнь 2026 — Первоначальная настройка аудита

#### Безопасность и надёжность
- **Подтверждение** при отправке Excel на Email — диалог с адресом получателя
- **Allowlist доменов** для Email-экспорта — настраивается в Настройки → Учётные записи → SMTP
- **GIN-индексы** для fuzzy-поиска через миграцию 0034

#### DevOps
- Исправлен `location /static/` в nginx для раздачи Django staticfiles

---

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
import cryptography, paramiko, openpyxl, docx, pdfminer, fitz, bleach
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
