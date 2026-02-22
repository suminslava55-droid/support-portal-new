#!/bin/bash
echo "Сборка фронтенда..."
cd /opt/support-portal/frontend
npm run build

echo "Копируем в nginx..."
docker cp build/. support-portal-nginx-1:/usr/share/nginx/html/
docker exec support-portal-nginx-1 nginx -s reload

echo "Готово!"
