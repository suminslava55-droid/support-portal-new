# Support Portal — Инструкция по установке от 23-02-2026 15-36

## Описание системы

**Support Portal** — веб-приложение для управления клиентами (аптеками), провайдерами и сетевой инфраструктурой.

### Стек технологий

| Компонент | Технология | Назначение |
|-----------|-----------|------------|
| Backend | Django 4.x + Django REST Framework | REST API, бизнес-логика, аутентификация |
| Frontend | React 18 + Ant Design | Веб-интерфейс |
| База данных | PostgreSQL 16 | Хранение данных |
| Веб-сервер | Nginx (Alpine) | Проксирование, раздача статики и медиафайлов |
| Контейнеризация | Docker + Docker Compose | Изоляция и управление сервисами |
| Сборка фронтенда | Node.js 18 + npm | Компиляция React-приложения на сервере |

### Основные модули и функции

**Клиенты**
- Карточка клиента: адрес, компания, ИНН, телефон, email, код аптеки, ICCID
- Блок **Сеть**: подсеть аптеки, внешний IP, Микротик IP (авто: .1), Сервер IP (авто: .2), проверка доступности
- **Провайдер 1 и Провайдер 2**: название, тип подключения, тариф, лицевой счёт, № договора, настройки, оборудование
- При типе Модем или MR-Net: дополнительные поля Номер (модем/SIM) и ICCID модема
- Передача провайдера между клиентами с выбором слота и логированием
- Получение внешнего IP с Микротика по SSH (paramiko)
- Заметки и история изменений
- Вложенные файлы (до 5 МБ): скачивание, удаление
- Система черновиков при создании клиента
- Экспорт списка клиентов в Excel с выбором полей и отправкой на Email

**Пользователи и роли**
- RBAC: роли с настраиваемыми правами
- Права: просмотр, создание, редактирование, удаление клиентов, управление пользователями, ролями, полями

**Провайдеры**
- Справочник провайдеров для выбора в карточке клиента

**Настройки системы** (только для администраторов)
- SSH-параметры для подключения к Микротикам (логин, пароль шифруется через Fernet/cryptography)
- SMTP-параметры для отправки Email (логин, пароль шифруется через Fernet/cryptography)
- Кнопка тестовой отправки письма
- Кнопки очистки данных

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

Python нужен для генерации ключей шифрования.

```bash
apt install python3 python3-pip -y
```

### 1.6 Установка библиотеки cryptography

Используется для генерации `ENCRYPTION_KEY` — Fernet-ключа, которым шифруются SSH и SMTP пароли в базе данных.

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

После установки устанавливаем зависимости фронтенда (выполняется один раз):

```bash
cd /opt/support-portal/frontend
npm install
```

### 1.8 Установка системных утилит

```bash
apt install curl nano iputils-ping openssl -y
```

### 1.9 Проверка установки

```bash
docker --version
docker compose version
git --version
python3 --version
node --version
npm --version
ping -c1 8.8.8.8
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

# Шифрование паролей (SSH и SMTP) в базе данных
ENCRYPTION_KEY=CHANGE_ME_FERNET_KEY
```

### Генерация значений

**SECRET_KEY:**
```bash
openssl rand -hex 50
```

**ENCRYPTION_KEY** (Fernet-ключ для шифрования SSH и SMTP паролей):
```bash
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"
```

### Итоговый пример заполненного .env

```env
DB_NAME=support_portal
DB_USER=postgres
DB_PASSWORD=qX7!mN3kP9@support
DB_HOST=db
DB_PORT=5432

SECRET_KEY=a3f8c2d1e4b7a9f0c3d6e2b5a8f1c4d7e0b3a6f9c2d5e8b1a4f7c0d3e6b9a2f5c8d1e4b7
DEBUG=False
ALLOWED_HOSTS=94.130.1.1,localhost
CORS_ALLOWED_ORIGINS=http://94.130.1.1,http://localhost

ENCRYPTION_KEY=ySKoI9K2_Uj2qjNUSxREYTFIW3o-HILiIMYZ5enMgYs=
```

> **Сохранение в nano:** `Ctrl+O` → `Enter` → `Ctrl+X`

---

## 4. Хранилище медиафайлов

```bash
mkdir -p /opt/support-portal/media
```

---

## 5. Запускаем

```bash
cd /opt/support-portal
docker compose up -d --build
```

Первый запуск занимает 5–10 минут. Следим:

```bash
docker compose logs -f
```

Проверяем контейнеры:

```bash
docker compose ps
```

Должны быть запущены: `support-portal-db-1`, `support-portal-backend-1`, `support-portal-nginx-1`.

---

## 6. Создаём администратора и роли

```bash
docker compose exec backend python create_admin.py
```

---

## 7. Первоначальная настройка в интерфейсе

1. Откройте `http://ВАШ_IP` в браузере
2. Войдите под учётными данными администратора
3. Перейдите в **Настройки**:
   - Укажите SSH пользователь и пароль для Микротиков
   - Укажите SMTP настройки для отправки Email (сервер, порт, логин, пароль, адрес отправителя)
   - Проверьте отправку кнопкой «Тест отправки»
4. Перейдите в **Провайдеры** → добавьте провайдеров
5. Создавайте карточки клиентов

---

## 8. Обновление фронтенда (быстрый деплой)

```bash
/opt/support-portal/deploy-frontend.sh
```

---

## 9. Когда что использовать

| Изменение | Команда |
|-----------|---------|
| Изменения в Python-коде бэкенда | `docker compose restart backend` |
| Изменения в коде фронтенда (JSX, CSS) | `/opt/support-portal/deploy-frontend.sh` |
| Новые Python-зависимости (requirements.txt) | `docker compose up -d --build` |
| Новые миграции базы данных | `docker compose exec backend python manage.py migrate` |

---

## Полезные команды

```bash
# Статус контейнеров
docker compose ps

# Логи в реальном времени
docker compose logs -f backend

# Перезапустить бэкенд
docker compose restart backend

# Быстрый деплой фронтенда
/opt/support-portal/deploy-frontend.sh

# Полная пересборка (после изменений в requirements.txt или Dockerfile)
docker compose up -d --build

# Применить миграции
docker compose exec backend python manage.py migrate

# Резервная копия БД
docker compose exec db pg_dump -U postgres support_portal > backup_$(date +%Y%m%d).sql

# Восстановление из резервной копии
cat backup_20240101.sql | docker compose exec -T db psql -U postgres support_portal
```

---

## Обновление системы

```bash
cd /opt/support-portal
git pull

# Применяем миграции если они есть
docker compose exec backend python manage.py migrate

# Перезапускаем бэкенд
docker compose restart backend

# Деплоим фронтенд
/opt/support-portal/deploy-frontend.sh
```

---

## Устранение неполадок

**Белый экран в браузере**
```bash
docker compose logs nginx --tail=30
# Жёсткий сброс кэша: Ctrl+Shift+R
```

**Ошибка 500 от API**
```bash
docker compose logs backend --tail=50
```

**Ошибка шифрования (No module named 'cryptography' или 'paramiko')**

Пакеты не установились при сборке (например, не было интернета). Установите вручную:
```bash
docker compose exec backend pip install cryptography paramiko
docker compose restart backend
```

**Ошибка сборки фронтенда**
```bash
cd /opt/support-portal/frontend
rm -rf node_modules
npm install
npm run build
```

**Черновики накапливаются в базе**
```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import Client
from django.utils import timezone
from datetime import timedelta
old = Client.objects.filter(is_draft=True, created_at__lt=timezone.now()-timedelta(days=1))
print(f'Найдено: {old.count()}')
for c in old:
    for f in c.files.all(): f.file.delete(); f.delete()
    c.delete()
print('Готово')
"
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

---

## Настройка HTTPS

```bash
apt install certbot python3-certbot-nginx -y
docker compose stop nginx
certbot certonly --standalone -d ваш-домен.ru
# Обновите nginx/default.conf — добавьте блок SSL
docker compose start nginx
```

---

## Структура проекта

```
support-portal/
├── backend/
│   ├── apps/
│   │   ├── accounts/             # Пользователи, роли, JWT
│   │   └── clients/
│   │       ├── models.py         # Client, Provider, ClientFile, SystemSettings
│   │       ├── views.py          # API, SSH, экспорт Excel, передача провайдера
│   │       ├── serializers.py
│   │       ├── settings_views.py # Настройки SSH и SMTP, тест отправки email
│   │       └── migrations/
│   ├── config/settings.py
│   ├── requirements.txt
│   └── Dockerfile
├── frontend/
│   ├── src/pages/
│   │   ├── ClientsPage.jsx       # Список + экспорт Excel с выбором полей
│   │   ├── ClientDetailPage.jsx  # Карточка: Основное/Сеть/Провайдер 1/Провайдер 2
│   │   ├── ClientFormPage.jsx    # Создание/редактирование + передача провайдера
│   │   ├── SettingsPage.jsx      # SSH + SMTP настройки
│   │   ├── UsersPage.jsx
│   │   └── ProvidersPage.jsx
│   └── src/api/index.js
├── nginx/default.conf
├── media/                        # Медиафайлы (не в git)
├── deploy-frontend.sh
├── docker-compose.yml
├── .env                          # Не в git!
└── .env.example
```

---

## Python-зависимости (requirements.txt)

| Пакет | Назначение |
|-------|-----------|
| django | Основной веб-фреймворк |
| djangorestframework | REST API |
| djangorestframework-simplejwt | JWT аутентификация |
| psycopg2-binary | Драйвер PostgreSQL |
| django-cors-headers | CORS заголовки для фронтенда |
| django-filter | Фильтрация в API |
| python-dotenv | Загрузка .env файла |
| cryptography | Шифрование паролей SSH и SMTP (Fernet) |
| paramiko | SSH-подключение к Микротику |
| openpyxl | Генерация Excel файлов для экспорта |
| gunicorn | WSGI-сервер для продакшена |
| Pillow | Обработка изображений |
