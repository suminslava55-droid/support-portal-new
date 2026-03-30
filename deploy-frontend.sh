#!/bin/bash
set -e
cd /opt/support-portal

echo "Сборка фронтенда..."
cd frontend
npm run build
cd /opt/support-portal

echo "Копируем в nginx..."
# Nginx монтирует ./frontend/build напрямую как bind mount
# Просто перезагружаем nginx — файлы уже на месте
docker compose exec nginx nginx -s reload

echo "Готово!"
