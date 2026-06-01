# Support Portal — Справочник

## Модули системы

### 📊 Дашборд
- Заглавная страница после входа (`/dashboard`)
- **Метрики:** всего клиентов, активных, ФН просрочен, замена ФН в этом месяце, замена ФН в следующем месяце
- **Клиенты по провайдерам** — горизонтальные бары с количеством
- **Ближайшие замены ФН** — список ближайших 5 с датами
- **Регламентные задания** — статус последнего запуска каждого задания + информация о бэкапах
- **Дежурства сегодня и завтра** — сотрудники с типом дежурства (Телефон, Работа днём, Телефон + день)
- **Последние изменения** — лента активности по клиентам

### 📋 Клиенты
- Карточка клиента: адрес, компания, ИНН, телефон, email, код аптеки (UT), код склада, ICCID
- Три вкладки: **📋 Информация**, **🌐 Провайдеры**, **🧾 ККТ**
- Блок **Сеть**: подсеть, внешний IP, Микротик IP (авто: .1), Сервер IP (авто: .2), проверка доступности
- Провайдер 1 и 2: название, тип подключения, тариф, лицевой счёт, № договора, настройки, оборудование
- Передача провайдера между клиентами с выбором слота и логированием
- Получение внешнего IP с Микротика по SSH (paramiko)
- Заметки и история изменений
- Вложенные файлы до 5 МБ
- Система черновиков (старше 2 часов удаляются автоматически)
- Экспорт списка в Excel с выбором полей и отправкой на Email
- Фильтрация по нескольким провайдерам одновременно
- Поиск с fuzzy (опечатки через pg_trgm) и конвертацией раскладки клавиатуры

### 🧾 ККТ (Кассовая техника)
- Раздел **«Компании»** — справочник с ИНН и зашифрованным токеном ОФД (lk.ofd.ru)
- Вкладка **«ККТ»** в карточке клиента — просмотр, получение и обновление данных
- Поля: РНМ, серийный номер, модель, номер ФН, дата создания, конец срока ФН, конец договора ОФД, адрес установки
- Получение данных через `ofd_fetch.sh` на хосте

### 🔄 Замена ФН
- **Вкладка Общий** — полный список всех ККТ
- **Вкладка По месяцам** — фильтр по месяцу и году окончания срока ФН
- Подсветка: красная (просрочен), оранжевая (≤30 дней), жёлтая (≤90 дней)
- Клик по **адресу** — переход в карточку клиента на вкладку ККТ
- Поиск с конвертацией раскладки клавиатуры

### 📅 Календарь дежурств
- Типы дежурств: Телефон, Работа днём, Телефон + день, Отпуск, Занят
- Мультивыделение: Ctrl+клик, затем «Применить тип…»
- Пагинация отключена — отображаются все записи месяца
- Кнопка **Отчёт за месяц**
- График отпусков с выгрузкой в Excel или на Email

### 📚 База знаний (FAQ)
- Раздел доступен всем сотрудникам портала
- Структура: **Категории** (левая панель) → **Список статей** → **Просмотр статьи**
- **Редактор статей** — WYSIWYG с тулбаром:
  - Форматирование: Жирный, Курсив, Подчёркнутый
  - Заголовки H1, H2, абзац
  - Маркированный и нумерованный списки
  - Ссылки, очистка форматирования
  - Блок кода `<>` — тёмный фон, кнопка копирования в режиме просмотра
  - Вставка изображения (кнопка + Ctrl+V из буфера)
  - Изменение размера картинки (кнопка «Размер» + drag-ручка)
  - Импорт из `.docx` и `.pdf` (текст + картинки включая VML-формат)
- **Прикреплённые файлы** — до 10 МБ, любой тип
- **Черновик** — при открытии нового редактора сразу создаётся черновик
- **Удаление**: свою статью может удалить автор, чужую — только администратор
- **Поиск** по заголовку и содержимому статей с конвертацией раскладки
- Категории создаёт и удаляет только администратор

#### Хранение данных базы знаний
| Данные | Где хранится |
|--------|-------------|
| Текст статей (HTML) | PostgreSQL, таблица `clients_faqarticle` (~8 КБ на статью) |
| Картинки в тексте | Файлы на диске `/app/media/faq/images/` |
| Прикреплённые файлы | Файлы на диске `/app/media/faq/` |

### 🔍 Поиск
- Раздел доступен всем пользователям из левого меню
- Поиск по: адресу, телефону, email, кодам аптеки/склада, ICCID, лицевым счетам, ИНН, IP
- Поиск по ККТ: номер ФН, серийный номер, РНМ, модель
- Поиск по истории изменений и заметкам клиентов
- Поиск по базе знаний
- **Fuzzy поиск** через `pg_trgm` — находит при опечатках (порог схожести 0.1)
- **Конвертация раскладки** — автоматически распознаёт латиницу набранную в русской раскладке (jvcr → Омск)
- Минимум 2 символа, задержка 400мс, до 20 результатов каждого типа

### ⚙️ Настройки (только Администратор)
Страница разделена на 4 вкладки:

| Вкладка | Содержимое |
|---------|------------|
| Учётные записи | SSH (Микротик), SMTP (Email) |
| Автоматизация | Массовая загрузка клиентов из JSON |
| Регламентные задания | Часовой пояс + три задания с расписанием |
| Диагностика | Проверка Python-зависимостей (6 пакетов) |

---

## Производительность и UI

### Кастомная тема Ant Design
- Файл: `frontend/src/theme/customTheme.js`
- Цвет акцента: `#4F46E5` (индиго) вместо стандартного синего
- Скругления: 8-12px, улучшенные тени
- Поддержка светлой и тёмной темы

### Lazy Loading
- Все страницы загружаются по требованию через `React.lazy()`
- Уменьшает размер начального бандла
- При переходе на страницу показывается спиннер

### Skeleton Loading
- Компоненты: `SkeletonCard`, `SkeletonTable`, `SkeletonForm`, `SkeletonStats`, `SkeletonDetail`, `SkeletonList`
- Файл: `frontend/src/components/SkeletonComponents.jsx`

### Error Boundary
- Перехватывает JavaScript ошибки в компонентах
- Показывает понятное сообщение вместо белого экрана
- Файл: `frontend/src/components/ErrorBoundary.jsx`
- В режиме разработки показывает стек ошибки

### Retry Logic
- Автоповтор GET-запросов при сетевых ошибках и 5xx ответах
- Одна попытка повтора через 1 секунду
- Файл: `frontend/src/api/axios.js`

---

## Fuzzy поиск

### Как работает
1. Сначала выполняется точный `icontains` поиск
2. Если результатов нет — fuzzy поиск через PostgreSQL `pg_trgm`
3. Порог схожести: `0.1` (настраивается в `search_utils.py`)

### Конвертация раскладки
- Файл: `frontend/src/utils/keyboardLayout.js`
- Определяет доминирующую раскладку по доле латинских символов (>40%)
- Конвертирует латиницу → кириллицу перед отправкой запроса
- Текст в поле ввода не изменяется

### Где применяется
- Список клиентов (`ClientsPage.jsx`)
- Замена ФН (`FnReplacementPage.jsx`)
- База знаний (`FaqPage.jsx`)
- Глобальный поиск (`search_views.py`)

### Требования
- PostgreSQL расширение `pg_trgm` должно быть включено:
  ```sql
  CREATE EXTENSION IF NOT EXISTS pg_trgm;
  ```

---

## Регламентные задания

### Как работает

```
Интерфейс → cron_manager.sh (nsenter) → crontab хоста
cron (хост) → scheduler_run.sh → Django API (контейнер) → ofd_fetch.sh (хост) → lk.ofd.ru
```

### Механизм обновления crontab

Из Docker-контейнера нельзя напрямую вызвать `crontab` хоста. Решение:

1. **`cron_manager.sh`** использует `nsenter -t 1` — входит в пространство имён хоста (PID 1 = systemd) и вызывает там `crontab -` или `crontab -l`
2. **`cron-watch.service`** на хосте следит за изменением файла `/var/spool/cron/crontabs/root` через `inotifywait` и посылает `SIGHUP` процессу cron для применения изменений
3. Перезагрузка cron откладывается если секунды > 55 (чтобы не пропустить ближайший слот)

Необходимые настройки в `docker-compose.yml` для бэкенда:
```yaml
pid: host
privileged: true
```

### Часовой пояс расписания

Время в интерфейсе выбирается через два выпадающих списка (Час + Минуты) по **местному времени**. Бэкенд автоматически конвертирует в UTC перед записью в crontab. Смещение хранится в `SystemSettings.timezone_offset`.

### Режимы работы задания «Обновление ККТ»

| Запуск | Режим | Описание |
|--------|-------|----------|
| По расписанию (cron) | Только истекающие ФН (≤30 дней) | Быстрее, щадит лимиты ОФД |
| Вручную — все клиенты | Все ККТ | Полное обновление |
| Вручную — компания | Все ККТ выбранной компании | Фильтр по компании |

### Доступные задания

| task_id | Название | Описание |
|---------|----------|----------|
| `update_rnm` | Обновление данных по ККТ | Обходит клиентов с ККТ, обновляет данные через lk.ofd.ru (1 запрос/сек) |
| `fetch_external_ip` | Обновление внешнего IP | Подключается к каждому Микротику по SSH, получает внешний IP через ipify.org |
| `backup_system` | Резервное копирование | Создаёт дамп БД + копирует медиафайлы, хранит последние 7 копий |

### Файлы планировщика

| Файл | Описание |
|------|----------|
| `/opt/support-portal/setup_scheduler.py` | Создаёт пользователя и токен, запускать один раз |
| `/opt/support-portal/.scheduler_token` | JWT-токен (365 дней). **Не в git!** |
| `/opt/support-portal/scheduler_run.sh` | Скрипт для cron. **Не в git!** |
| `/opt/support-portal/cron_manager.sh` | Управляет crontab хоста из контейнера через nsenter |
| `/usr/local/bin/cron-watch.sh` | Скрипт службы-наблюдателя |
| `/etc/systemd/system/cron-watch.service` | Служба-наблюдатель |
| `/var/log/support-portal-scheduler.log` | Лог выполнения cron-заданий |

### Endpoints API планировщика

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/clients/scheduled-tasks/` | Список заданий |
| PATCH | `/api/clients/scheduled-tasks/` | Сохранить настройки задания |
| POST | `/api/clients/scheduled-tasks/run/` | Ручной запуск |
| GET | `/api/clients/scheduled-tasks/{task_id}/progress/` | Статус выполнения |
| GET | `/api/clients/scheduled-tasks/cron/` | Текущая cron-строка |
| POST | `/api/clients/scheduled-tasks/cron/` | Применить расписание в crontab |
| GET | `/api/clients/search/?q=` | Глобальный поиск |

### Endpoints API базы знаний

| Метод | URL | Описание |
|-------|-----|----------|
| GET/POST | `/api/clients/faq-categories/` | Список / создание категорий |
| GET/POST | `/api/clients/faq-articles/?category=ID&search=Q` | Список / создание статей |
| PUT/DELETE | `/api/clients/faq-articles/{id}/` | Обновление / удаление статьи |
| GET/POST | `/api/clients/faq-articles/{id}/files/` | Файлы статьи |
| DELETE | `/api/clients/faq-files/{id}/` | Удаление файла |
| POST | `/api/clients/faq-articles/{id}/images/` | Загрузка изображения в текст |
| POST | `/api/clients/faq-articles/{id}/import/` | Импорт из .docx/.pdf |

---

## Массовая загрузка клиентов (Автоматизация)

Раздел **Настройки → Автоматизация → Массовая загрузка клиентов**

Принимает JSON-файл. Маппинг полей:

| Поле JSON | Поле модели | Примечание |
|-----------|-------------|------------|
| `id_pharm` | `pharmacy_code` | Обязательное; дубли пропускаются |
| `address_pharm_zabbix` | `address` | |
| `ip_pharm_ad` | `subnet` | Первые 3 октета + `.0/24` |
| `pharmacy_id` | `warehouse_code` | |
| `mail` | `email` | |
| `organization_inn` | `ofd_company` | Поиск по ИНН в справочнике компаний |
| `telephone_number` | `phone` | |
| `cashbox[].kkt_reg_id` | `KktData` (РНМ) | |

---

## Архитектура ОФД

```
Браузер → Django API (контейнер) → ofd_fetch.sh (хост) → lk.ofd.ru
```

### Разница между кнопками получения ККТ

| Кнопка | Метод | Что делает |
|--------|-------|-----------|
| Получить данные ККТ по ИНН | POST | Полный поиск по ИНН + фильтрация по адресу. Находит новые ККТ |
| Обновить по РНМ | PATCH | Обновляет только уже сохранённые ККТ по РНМ. Быстрее |
| По РНМ (при создании) | PATCH | Получает по введённым РНМ, проверяет адрес |

---

## Структура проекта

```
support-portal/
├── backend/
│   ├── apps/
│   │   ├── accounts/             # Пользователи, роли, JWT
│   │   └── clients/
│   │       ├── models.py         # Client, Provider, OfdCompany, KktData, ScheduledTask,
│   │       │                     # FaqCategory, FaqArticle, FaqFile, DutySchedule
│   │       ├── views/            # API разбит по модулям
│   │       │   ├── __init__.py       # Re-export всего для urls.py
│   │       │   ├── client_views.py   # ClientViewSet, CustomFieldDefinitionViewSet
│   │       │   ├── misc_views.py     # FetchExternalIPView, OfdCompanyViewSet, ProviderViewSet, DashboardStatsView
│   │       │   ├── calendar_views.py # DutyScheduleViewSet (пагинация отключена)
│   │       │   ├── kkt_views.py      # OfdKktView, KktListView, KktExportView
│   │       │   ├── bulk_views.py     # BulkImportClientsView
│   │       │   ├── scheduler_views.py # ScheduledTask*, _run_update_rnm, _run_fetch_external_ip, _run_backup_system
│   │       │   ├── search_views.py    # GlobalSearchView — глобальный поиск с fuzzy
│   │       │   ├── search_utils.py    # fuzzy_filter_clients, build_exact_q (pg_trgm)
│   │       │   ├── faq_views.py       # FaqCategoryViewSet, FaqArticleViewSet, FaqFileView,
│   │       │   │                      # FaqFileDeleteView, FaqImageUploadView, FaqImportView
│   │       │   └── utils.py          # ping_ip, build_change_log, FIELD_LABELS
│   │       ├── serializers.py    # Сериализаторы моделей
│   │       ├── settings_views.py # Настройки SSH и SMTP
│   │       ├── urls.py           # Маршруты приложения clients
│   │       └── migrations/       # Миграции базы данных
│   ├── config/
│   │   ├── settings.py           # Настройки Django
│   │   ├── urls.py               # Корневые маршруты
│   │   └── wsgi.py
│   ├── requirements.txt          # Python-зависимости
│   ├── create_admin.py           # Создание администратора и ролей
│   └── Dockerfile
├── frontend/src/
│   ├── pages/
│   │   ├── DashboardPage.jsx         # Заглавная страница
│   │   ├── ClientsPage.jsx           # Список клиентов с fuzzy поиском
│   │   ├── ClientDetailPage.jsx      # Просмотр карточки клиента
│   │   ├── client-detail/
│   │   │   ├── ClientDetailInfo.jsx
│   │   │   ├── ClientDetailProviders.jsx
│   │   │   ├── ClientDetailKkt.jsx
│   │   │   └── helpers.js
│   │   ├── ClientFormPage.jsx        # Создание/редактирование клиента
│   │   ├── client-form/
│   │   │   ├── ClientFormInfo.jsx
│   │   │   ├── ClientFormProviders.jsx
│   │   │   ├── ClientFormKkt.jsx
│   │   │   └── TransferModal.jsx
│   │   ├── FaqPage.jsx               # База знаний с fuzzy поиском
│   │   ├── OfdCompaniesPage.jsx
│   │   ├── FnReplacementPage.jsx     # Замена ФН с fuzzy поиском
│   │   ├── CalendarPage.jsx
│   │   ├── SettingsPage.jsx
│   │   ├── settings/
│   │   │   ├── SettingsAccounts.jsx
│   │   │   ├── SettingsAutomation.jsx
│   │   │   ├── SettingsScheduler.jsx
│   │   │   └── SettingsDiagnostics.jsx
│   │   ├── SearchPage.jsx            # Глобальный поиск с fuzzy
│   │   ├── UsersPage.jsx
│   │   └── ProvidersPage.jsx
│   ├── components/
│   │   ├── AppLayout.jsx             # Основной layout с меню
│   │   ├── ErrorBoundary.jsx         # Перехват JS ошибок
│   │   └── SkeletonComponents.jsx    # Skeleton loading компоненты
│   ├── theme/
│   │   └── customTheme.js            # Кастомная тема Ant Design (индиго)
│   ├── styles/
│   │   └── custom-styles.css         # Кастомные CSS стили
│   ├── utils/
│   │   └── keyboardLayout.js         # Конвертация раскладки клавиатуры
│   └── api/
│       ├── axios.js                  # Axios instance с retry logic
│       ├── auth.js
│       ├── clients.js
│       ├── index.js
│       └── users.js
├── nginx/default.conf
├── media/
├── backups/
├── ofd_fetch.sh
├── cron_manager.sh
├── setup_scheduler.py
├── deploy-frontend.sh
├── docker-compose.yml
├── .env                          # Не в git!
└── .env.example
```

---

## Резервное копирование

### Автоматическое (через регламентное задание)

Задание `backup_system` — создаёт полный бэкап, хранит последние 7 копий.

Что входит:
- **БД** — дамп через Django `dumpdata`
- **Медиафайлы** — из `/app/media`

Бэкапы хранятся в `/opt/support-portal/backups/`.

### Ручное создание бэкапа

```bash
docker compose exec backend python manage.py dumpdata \
  --natural-foreign --natural-primary \
  --exclude=contenttypes --exclude=auth.permission \
  --indent=2 > /opt/support-portal/backups/db_manual_$(date +%Y%m%d).json

tar -czf /opt/support-portal/backups/media_$(date +%Y%m%d).tar.gz \
  -C /opt/support-portal media/
```

### Восстановление из бэкапа

> ⚠️ Убедитесь что `.env` содержит тот же `ENCRYPTION_KEY` — иначе токены не расшифруются.

```bash
tar -xzf /opt/support-portal/backups/backup_YYYY-MM-DD_HH-MM-SS.tar.gz -C /tmp/restore/
docker compose exec backend python manage.py flush --no-input
docker compose exec backend python manage.py loaddata /tmp/restore/.../db.json
cp -r /tmp/restore/.../media/. /opt/support-portal/media/
docker compose restart backend
```

---

## Python-зависимости (requirements.txt)

| Пакет | Назначение |
|-------|-----------|
| django | Основной веб-фреймворк |
| djangorestframework | REST API |
| djangorestframework-simplejwt | JWT аутентификация |
| psycopg2-binary | Драйвер PostgreSQL |
| django-cors-headers | CORS заголовки |
| django-filter | Фильтрация в API |
| python-dotenv | Загрузка .env |
| cryptography | Шифрование паролей и токенов (Fernet) |
| paramiko | SSH-подключение к Микротику |
| openpyxl | Генерация Excel файлов |
| python-docx | Импорт из Word (.docx) в базу знаний |
| pdfminer.six | Извлечение текста из PDF |
| PyMuPDF | Извлечение картинок из PDF |
| gunicorn | WSGI-сервер |
| Pillow | Обработка изображений |

---

## Роли и доступ

| Роль | Клиенты | Провайдеры | Компании | Замена ФН | Календарь | База знаний | Пользователи | Настройки |
|------|---------|-----------|---------|----------|----------|------------|-------------|----------|
| Администратор | Полный | ✅ | ✅ | ✅ | ✅ | ✅ (+ удаление любых) | ✅ | ✅ |
| Системный администратор | Полный | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Связист | Полный | ✅ | 👁 | ✅ | ❌ | ✅ | ❌ | ❌ |
