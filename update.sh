#!/bin/bash
# Обновление сервера из GitHub
# Запускать на боевом сервере: bash /opt/support-portal/update.sh

set -e
cd /opt/support-portal

echo "==> Получаем изменения из GitHub..."
git pull

echo "==> Применяем миграции..."
docker compose exec backend python manage.py migrate

echo "==> Перезапускаем бэкенд..."
docker compose restart backend

echo "==> Собираем и деплоим фронтенд..."
bash /opt/support-portal/deploy-frontend.sh

echo "==> Обновление завершено!"
