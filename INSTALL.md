# Support Portal — Установка

## Описание системы

**Support Portal** — веб-приложение для управления клиентами (аптеками), провайдерами, сетевой инфраструктурой и кассовой техникой (ККТ) с интеграцией ОФД.

| Компонент | Технология |
|-----------|-----------|
| Backend | Django 4.x + Django REST Framework |
| Frontend | React 18 + Ant Design |
| База данных | PostgreSQL 16 |
| Веб-сервер | Nginx (Alpine) |
| Контейнеризация | Docker + Docker Compose |
| Сборка фронтенда | Node.js 18 + npm |

---

## Требования к серверу

- Ubuntu 20.04 / 22.04 / 24.04
- 2 ГБ RAM минимум (рекомендуется 4 ГБ)
- 20 ГБ диска
- Открытый порт 80 (и 443 при HTTPS)

---

## Шаг 1 — Подготовка сервера

```bash
# Обновление системы
apt update && apt upgrade -y

# Docker
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# Git
apt install git -y

# Python (для генерации ключей и запуска скрипта ОФД на хосте)
apt install python3 python3-pip -y
pip3 install cryptography --break-system-packages

# Node.js (для быстрой сборки фронтенда)
apt install nodejs npm -y

# Утилиты
apt install curl nano iputils-ping openssl -y
```

Проверяем:
```bash
docker --version && docker compose version
git --version
python3 --version
node --version && npm --version
```

---

## Шаг 2 — Загрузка проекта

```bash
git clone https://github.com/suminslava55-droid/support-portal-new.git /opt/support-portal
cd /opt/support-portal
```

---

## Шаг 3 — Переменные окружения

```bash
cp .env.example .env
nano .env
```

Генерируем значения:

```bash
# SECRET_KEY
openssl rand -hex 50

# ENCRYPTION_KEY (Fernet)
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

Заполненный `.env`:

```env
DB_NAME=support_portal
DB_USER=postgres
DB_PASSWORD=СИЛЬНЫЙ_ПАРОЛЬ
DB_HOST=db
DB_PORT=5432

SECRET_KEY=сгенерированный_ключ
DEBUG=False
ALLOWED_HOSTS=ВАШ_IP,localhost
CORS_ALLOWED_ORIGINS=http://ВАШ_IP,http://localhost

ENCRYPTION_KEY=сгенерированный_fernet_ключ
```

> ⚠️ **Потеря ENCRYPTION_KEY = потеря всех зашифрованных паролей и токенов ОФД.** Сохраните резервную копию `.env`.

Сохранение в nano: `Ctrl+O` → `Enter` → `Ctrl+X`

---

## Шаг 4 — Папка медиафайлов

```bash
mkdir -p /opt/support-portal/media
```

---

## Шаг 5 — Скрипт ОФД

Скрипт `ofd_fetch.sh` запускается на **хосте** (из контейнера нет доступа к интернету).

```bash
# Убедитесь что скрипт есть в репозитории
ls /opt/support-portal/ofd_fetch.sh

# Сделайте исполняемым
chmod +x /opt/support-portal/ofd_fetch.sh
```

В `docker-compose.yml` должен быть volume:
```yaml
- /opt/support-portal/ofd_fetch.sh:/usr/local/bin/ofd_fetch.sh:ro
```

---

## Шаг 6 — Запуск

```bash
cd /opt/support-portal
docker compose up -d --build
```

Первый запуск занимает 5–10 минут. Следим за логами:

```bash
docker compose logs -f
```

Должны быть запущены три контейнера:
```bash
docker compose ps
# support-portal-db-1
# support-portal-backend-1
# support-portal-nginx-1
```

---

## Шаг 7 — Проверка пакетов

```bash
docker compose exec backend python -c "
import cryptography, paramiko, openpyxl
print('cryptography OK')
print('paramiko OK')
print('openpyxl OK')
"
```

Если пакет отсутствует:
```bash
docker compose exec backend pip install cryptography paramiko openpyxl --break-system-packages
docker compose restart backend
```

> ⚠️ Пакеты могут слетать при пересборке контейнера (`--build`) если нет доступа к интернету. Устанавливайте вручную после каждой пересборки.

---

## Шаг 8 — Создание администратора и ролей

```bash
docker compose exec backend python create_admin.py
```

Роли после установки:

| Роль | Клиенты | Провайдеры | Компании | Замена ФН | Календарь | Пользователи | Настройки |
|------|---------|-----------|---------|----------|----------|-------------|----------|
| Администратор | Полный | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Системный администратор | Полный | ✅ | ✅ | ✅ | ✅ | ❌ | ❌ |
| Связист | Полный | ✅ | 👁 просмотр | ✅ | ❌ | ❌ | ❌ |

---

## Шаг 9 — Первоначальная настройка в интерфейсе

1. Откройте `http://ВАШ_IP` в браузере
2. Войдите под учётными данными администратора
3. **Настройки** → SSH пользователь/пароль для Микротиков, SMTP для отправки писем → кнопка «Тест отправки»
4. **Компании** → добавьте компании с ИНН и токеном ОФД (из `lk.ofd.ru → Настройки → API`)
5. **Провайдеры** → добавьте провайдеров
6. **Пользователи** → заполните дни рождения сотрудников
7. Создавайте карточки клиентов

---

## Установка Node.js зависимостей (один раз)

```bash
cd /opt/support-portal/frontend
npm install
```

---

## Настройка HTTPS (опционально)

```bash
apt install certbot python3-certbot-nginx -y
docker compose stop nginx
certbot certonly --standalone -d ваш-домен.ru
# Обновите nginx/default.conf — добавьте блок SSL
docker compose start nginx
```

---

## Безопасность

Файл `.env` **не должен попадать в git**. Убедитесь что `.gitignore` содержит:
```
.env
media/
*.pyc
__pycache__/
```

При компрометации ключей:
```bash
openssl rand -hex 50                                                                         # новый SECRET_KEY
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"  # новый ENCRYPTION_KEY
docker compose restart backend
# После — заново введите SSH/SMTP пароли и токены ОФД
```
