# Инструкция по установке на VPS

## 1. Подготовка сервера

```bash
# Обновляем пакеты
apt update && apt upgrade -y

# Устанавливаем Docker и Docker Compose
curl -fsSL https://get.docker.com | sh
apt install docker-compose-plugin -y

# Проверяем
docker --version
docker compose version
```

## 2. Загружаем проект на сервер

```bash
# Вариант 1 — через git (если проект в репозитории)
git clone <ваш-репозиторий> /opt/support-portal
cd /opt/support-portal

# Вариант 2 — через scp с вашего компьютера
scp -r ./support-portal root@ВАШ_IP:/opt/support-portal
cd /opt/support-portal
```

## 3. Настраиваем переменные окружения

```bash
cp .env.example .env
nano .env
```

Заполните в .env:
- `DB_PASSWORD` — придумайте надёжный пароль для БД
- `SECRET_KEY` — длинная случайная строка (можно сгенерировать: `openssl rand -hex 50`)
- `ALLOWED_HOSTS` — ваш домен или IP, например: `94.130.1.1,support.mycompany.ru`
- `CORS_ALLOWED_ORIGINS` — тот же домен: `http://94.130.1.1` или `https://support.mycompany.ru`

Шаг 3 — Настройка переменных окружения
Сначала создайте файл .env из шаблона:
bashcd /opt/support-portal
cp .env.example .env
nano .env
Откроется редактор с таким содержимым:
env# База данных
DB_NAME=support_portal
DB_USER=postgres
DB_PASSWORD=CHANGE_ME_STRONG_PASSWORD
DB_HOST=db
DB_PORT=5432

# Django
SECRET_KEY=CHANGE_ME_VERY_LONG_SECRET_KEY_HERE
DEBUG=False
ALLOWED_HOSTS=your-domain.com,localhost

# CORS — укажите домен фронтенда
CORS_ALLOWED_ORIGINS=https://your-domain.com,http://localhost
Нужно заменить три вещи:

1. DB_PASSWORD — пароль базы данных
Придумайте любой надёжный пароль. Например:
envDB_PASSWORD=qX7!mN3kP9@support

2. SECRET_KEY — секретный ключ Django
Это должна быть длинная случайная строка. Сгенерируйте прямо на сервере:
bashopenssl rand -hex 50
```
Команда выдаст что-то вроде:
```
a3f8c2d1e4b7a9f0c3d6e2b5a8f1c4d7e0b3a6f9c2d5e8b1a4f7c0d3e6b9a2f5c8d1e4b7
Скопируйте это значение в .env:
envSECRET_KEY=a3f8c2d1e4b7a9f0c3d6e2b5a8f1c4d7e0b3a6f9c2d5e8b1a4f7c0d3e6b9a2f5c8d1e4b7

3. ALLOWED_HOSTS и CORS_ALLOWED_ORIGINS — ваш IP или домен
Если у вас только IP-адрес (например 94.130.1.1):
envALLOWED_HOSTS=94.130.1.1,localhost
CORS_ALLOWED_ORIGINS=http://94.130.1.1,http://localhost
Если уже настроен домен (например support.mycompany.ru):
envALLOWED_HOSTS=support.mycompany.ru,localhost
CORS_ALLOWED_ORIGINS=https://support.mycompany.ru,http://localhost

Итоговый пример заполненного .env
envDB_NAME=support_portal
DB_USER=postgres
DB_PASSWORD=qX7!mN3kP9@support
DB_HOST=db
DB_PORT=5432

SECRET_KEY=a3f8c2d1e4b7a9f0c3d6e2b5a8f1c4d7e0b3a6f9c2d5e8b1a4f7c0d3e6b9a2f5c8d1e4b7
DEBUG=False
ALLOWED_HOSTS=94.130.1.1,localhost
CORS_ALLOWED_ORIGINS=http://94.130.1.1,http://localhost

Сохранение файла в nano
После редактирования нажмите:

Ctrl + O — сохранить
Enter — подтвердить имя файла
Ctrl + X — выйти из редактора


После этого можно переходить к шагу 4 — запуску docker compose up -d --build.


## 4. Запускаем

```bash
docker compose up -d --build
```

Первый запуск займёт 3–5 минут (сборка образов).

## 5. Создаём первого администратора и роли

```bash
docker compose exec backend python create_admin.py
```

Введите email, пароль и имя администратора.

## 6. Проверяем

Откройте в браузере: `http://ВАШ_IP` или `https://ваш-домен.ru`

---

## Полезные команды

```bash
# Посмотреть статус контейнеров
docker compose ps

# Посмотреть логи
docker compose logs -f backend
docker compose logs -f nginx

# Перезапустить после изменений
docker compose restart backend

# Полная пересборка (после изменений в коде)
docker compose up -d --build

# Резервная копия БД
docker compose exec db pg_dump -U postgres support_portal > backup_$(date +%Y%m%d).sql
```

## Настройка HTTPS (опционально, если есть домен)

```bash
# Устанавливаем certbot
apt install certbot python3-certbot-nginx -y

# Останавливаем nginx Docker (чтобы освободить порт 80)
docker compose stop nginx

# Получаем сертификат
certbot certonly --standalone -d ваш-домен.ru

# Обновите nginx/default.conf — добавьте блок с SSL
# Затем запустите снова
docker compose start nginx
```
