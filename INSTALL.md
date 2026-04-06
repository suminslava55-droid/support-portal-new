# Support Portal — Инструкция по установке

## ⚠️ Известные особенности

- **Пакеты слетают при пересборке контейнера** — `python-docx`, `pdfminer.six`, `PyMuPDF` устанавливаются из `requirements.txt` автоматически при `docker compose up --build`
- **Обновление ККТ зависает** — `lk.ofd.ru` лимит 1 запрос/сек, при 700 кассах ~13 мин, это нормально (gunicorn `--timeout 1000`)
- **Токен ОФД не сохраняется** — проверьте наличие `OfdCompanyWriteSerializer` в `views.py` и что класс `OfdCompanyViewSet` один

---

## Описание системы

**Support Portal** — веб-приложение для управления клиентами (аптеками), провайдерами, сетевой инфраструктурой и кассовой техникой (ККТ) с интеграцией ОФД. Включает базу знаний с WYSIWYG редактором и импортом из Word/PDF.

### Стек технологий

| Компонент | Технология | Назначение |
|-----------|-----------|------------|
| Backend | Django 4.x + DRF | REST API, бизнес-логика, аутентификация |
| Frontend | React 18 + Ant Design | Веб-интерфейс |
| База данных | PostgreSQL 16 | Хранение данных |
| Веб-сервер | Nginx | Проксирование, статика |
| Контейнеризация | Docker + Docker Compose | Изоляция сервисов |
| Сборка фронтенда | Node.js 18 + npm | Компиляция React на сервере |
| Планировщик | cron (хост) + cron_manager.sh | Регламентные задания |

---

## Требования к серверу

- Ubuntu 20.04 / 22.04 / 24.04
- 2 ГБ RAM минимум (рекомендуется 4 ГБ)
- 20 ГБ диска
- Открытый порт 80 (и 443 при HTTPS)

---

## 1. Подготовка сервера

### 1.1 Обновление системы

```bash
apt update && apt upgrade -y
```

### 1.2 Установка Docker

```bash
curl -fsSL https://get.docker.com | sh
```

### 1.3 Установка Docker Compose Plugin

```bash
apt install docker-compose-plugin -y
```

### 1.4 Установка Git

```bash
apt install git -y
```

### 1.5 Установка Python 3 и pip

Python нужен для генерации ключей шифрования, запуска скрипта ОФД и настройки планировщика.

```bash
apt install python3 python3-pip -y
```

### 1.6 Установка библиотеки cryptography

Используется для генерации `ENCRYPTION_KEY` — Fernet-ключа, которым шифруются SSH-пароль, SMTP-пароль и токены ОФД.

```bash
pip3 install cryptography --break-system-packages
```

### 1.7 Установка Node.js и npm

Node.js используется для быстрой сборки фронтенда на сервере (20–40 сек вместо 5–10 мин пересборки Docker).

```bash
apt install nodejs npm -y
```

Проверяем версии:

```bash
node --version   # v18.x.x или выше
npm --version    # 9.x.x или выше
```

### 1.8 Установка cron и inotify-tools

На большинстве Ubuntu cron уже установлен. Проверить:

```bash
systemctl status cron
```

Если не установлен:

```bash
apt install cron -y
systemctl enable cron
systemctl start cron
```

`inotify-tools` нужен для службы `cron-watch`:

```bash
apt install inotify-tools -y
```

### 1.9 Установка системных утилит

```bash
apt install curl nano iputils-ping openssl -y
```

### 1.10 Проверка установки

```bash
docker --version
docker compose version
git --version
python3 --version
node --version
npm --version
systemctl is-active cron
```

---

## 2. Загружаем проект

```bash
git clone https://github.com/suminslava55-droid/support-portal-new.git /opt/support-portal
cd /opt/support-portal
```

---

## 3. Настраиваем переменные окружения

```bash
cp .env.example .env
nano .env
```

Содержимое `.env`:

```env
# База данных
DB_NAME=support_portal
DB_USER=postgres
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_HOST=db
DB_PORT=5432

# Django
SECRET_KEY=CHANGE_ME_VERY_LONG_SECRET_KEY_HERE
DEBUG=False
ALLOWED_HOSTS=your-ip-or-domain,localhost
CORS_ALLOWED_ORIGINS=http://your-ip-or-domain,http://localhost

# Ключ шифрования (для SSH, SMTP паролей и токенов ОФД)
ENCRYPTION_KEY=CHANGE_ME_FERNET_KEY
```

### Генерация значений

**SECRET_KEY:**
```bash
openssl rand -hex 50
```

**ENCRYPTION_KEY** (Fernet-ключ):
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

> ⚠️ **Потеря ENCRYPTION_KEY = потеря всех зашифрованных паролей и токенов ОФД.** Делайте резервную копию `.env`.

---

## 4. Хранилище медиафайлов и бэкапов

```bash
mkdir -p /opt/support-portal/media/faq/images
mkdir -p /opt/support-portal/backups
```

---

## 5. Скрипты для работы на хосте

```bash
chmod +x /opt/support-portal/ofd_fetch.sh
chmod +x /opt/support-portal/cron_manager.sh
```

В `docker-compose.yml` у бэкенда должны быть:
```yaml
pid: host
privileged: true
volumes:
  - ./cron_manager.sh:/usr/local/bin/cron_manager.sh:ro
  - ./backups:/opt/support-portal/backups
```

У nginx должен быть volume для фронтенда:
```yaml
volumes:
  - ./frontend/build:/usr/share/nginx/html
```

---

## 6. Запускаем

```bash
cd /opt/support-portal
docker compose up -d --build
```

Первый запуск занимает 5–10 минут (включая установку python-docx, pdfminer.six, PyMuPDF из requirements.txt). Следим:

```bash
docker compose logs -f
```

Проверяем контейнеры:

```bash
docker compose ps
```

Должны быть запущены: `support-portal-db-1`, `support-portal-backend-1`, `support-portal-nginx-1`.

---

## 7. Устанавливаем зависимости фронтенда

Выполняется один раз после клонирования:

```bash
cd /opt/support-portal/frontend
npm install
```

---

## 8. Проверяем Python-пакеты в контейнере

```bash
docker compose exec backend python -c "
import cryptography, paramiko, openpyxl, docx, pdfminer, fitz
print('Все пакеты OK')
"
```

Если какой-то пакет отсутствует:

```bash
docker compose exec backend pip install cryptography paramiko openpyxl python-docx pdfminer.six PyMuPDF --break-system-packages
docker compose restart backend
```

---

## 9. Применяем миграции и создаём администратора

```bash
docker compose exec backend python manage.py migrate
docker compose exec backend python create_admin.py
```

| Роль | Клиенты | Провайдеры | Компании | Замена ФН | Календарь | База знаний | Пользователи | Настройки |
|------|---------|-----------|---------|----------|----------|------------|-------------|----------|
| Администратор | Полный | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Системный администратор | Полный | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Связист | Полный | ✅ | 👁 | ✅ | ❌ | ✅ | ❌ | ❌ |

---

## 10. Включаем расширение pg_trgm (fuzzy поиск)

```bash
docker compose exec db psql -U postgres -d support_portal -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

Проверяем:
```bash
docker compose exec db psql -U postgres -d support_portal -c "SELECT extname, extversion FROM pg_extension WHERE extname='pg_trgm';"
```

Должна появиться строка с `pg_trgm | 1.6`.

---

## 11. Настройка планировщика заданий ⚡

```bash
cd /opt/support-portal
python3 setup_scheduler.py
```

Скрипт создаёт `scheduler_run.sh` с параметром `"scheduled":true` — при запуске по cron задание обновления ККТ работает только по истекающим ФН (≤30 дней).

---

## 12. Установка службы cron-watch ⚡

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

cat > /etc/systemd/system/cron-watch.service << 'EOF'
[Unit]
Description=Reload cron when crontab file changes
After=cron.service

[Service]
Type=simple
ExecStart=/usr/local/bin/cron-watch.sh
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now cron-watch
systemctl status cron-watch
```

---

## 13. Деплой фронтенда

```bash
cd /opt/support-portal
./deploy-frontend.sh
```

После этого портал доступен по адресу `http://ВАШ_IP`. Заглавная страница — **Дашборд**.

---

## 14. Первоначальная настройка в интерфейсе

1. Откройте `http://ВАШ_IP` — попадёте на дашборд
2. Перейдите в **Настройки**:
   - SSH пользователь и пароль для Микротиков
   - SMTP настройки + кнопка «Тест отправки»
3. **Компании** → добавьте компании с ИНН и токеном ОФД
4. **Провайдеры** → добавьте провайдеров
5. **Регламентные задания** → настройте расписание и нажмите «Применить расписание»
6. **Диагностика** → нажмите «Проверить» — все 6 пакетов должны быть зелёными

---

## 15. Когда что использовать

| Изменение | Команда |
|-----------|---------|
| Изменения в Python-коде бэкенда | `docker compose restart backend` |
| Изменения в коде фронтенда (JSX, CSS) | `bash /opt/support-portal/deploy-frontend.sh` |
| Новые Python-зависимости (requirements.txt) | `docker compose up -d --build` |
| Новые миграции базы данных | `docker compose exec backend python manage.py migrate` |
| Обновление токена планировщика | `python3 /opt/support-portal/setup_scheduler.py` |

---

## Безопасность

Файлы **не попадают в git** (добавлены в `.gitignore`):
- `.env` — ключи и пароли
- `.scheduler_token` — JWT-токен планировщика
- `scheduler_run.sh` — скрипт с токеном
- `nginx/default.conf` — специфичен для каждого сервера
- `media/` — загруженные файлы
- `backups/` — резервные копии
- `frontend/package-lock.json`

> ⚠️ **Потеря ENCRYPTION_KEY = потеря всех зашифрованных паролей и токенов ОФД.** Храните резервную копию `.env` отдельно от сервера.
