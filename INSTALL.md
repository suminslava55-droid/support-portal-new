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
