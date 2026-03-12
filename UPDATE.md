# Support Portal — Обновление и деплой

## Когда что использовать

| Изменение | Команда |
|-----------|---------|
| Изменения в Python-коде бэкенда | `docker compose restart backend` |
| Изменения в коде фронтенда (JSX, CSS) | `bash /opt/support-portal/deploy-frontend.sh` |
| Новые Python-зависимости (requirements.txt) | `docker compose up -d --build` |
| Новые миграции базы данных | `docker compose exec backend python manage.py migrate` |

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

# После пересборки — проверяем пакеты
docker compose exec backend python -c "import cryptography, paramiko, openpyxl; print('OK')"
```

---

## Быстрый деплой фронтенда

```bash
bash /opt/support-portal/deploy-frontend.sh
```

Скрипт собирает React-приложение на хосте (20–40 сек) и копирует в Nginx. Не требует пересборки Docker-контейнеров.

---

## Полезные команды

```bash
# Статус контейнеров
docker compose ps

# Логи в реальном времени
docker compose logs -f backend
docker compose logs -f nginx

# Перезапустить бэкенд
docker compose restart backend

# Полная пересборка (после изменений в requirements.txt или Dockerfile)
docker compose up -d --build

# Применить миграции
docker compose exec backend python manage.py migrate

# Резервная копия БД
docker compose exec db pg_dump -U postgres support_portal > backup_$(date +%Y%m%d).sql

# Восстановление из резервной копии
cat backup_20240101.sql | docker compose exec -T db psql -U postgres support_portal

# Проверка всех Python-пакетов
docker compose exec backend python -c "import cryptography, paramiko, openpyxl; print('Все пакеты OK')"

# Проверка доступности скрипта ОФД в контейнере
docker compose exec backend ls -la /usr/local/bin/ofd_fetch.sh

# Просмотр компаний и токенов ОФД
docker compose exec backend python manage.py shell -c "
from apps.clients.models import OfdCompany
for c in OfdCompany.objects.all():
    print(c.id, c.name, c.inn, 'токен:', c.ofd_token[:10] + '...' if c.ofd_token else 'НЕТ')
"

# Создать тестовых провайдеров
docker compose exec backend python manage.py shell -c "
from apps.clients.models import Provider
providers = [('Ростелеком','8-800-100-08-00'),('МТС','8-800-250-08-90')]
for name, phone in providers:
    p, created = Provider.objects.get_or_create(name=name, defaults={'support_phones': phone})
    print('Создан' if created else 'Уже есть', name)
"
```

---

## Резервное копирование

Регулярно делайте резервные копии:

```bash
# База данных
docker compose exec db pg_dump -U postgres support_portal > /backup/db_$(date +%Y%m%d).sql

# Медиафайлы (вложения клиентов)
tar -czf /backup/media_$(date +%Y%m%d).tar.gz /opt/support-portal/media/

# Файл окружения (содержит ключи шифрования!)
cp /opt/support-portal/.env /backup/.env.$(date +%Y%m%d)
```
