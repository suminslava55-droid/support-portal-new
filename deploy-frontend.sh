#!/bin/bash
echo "Сборка фронтенда..."
cd /opt/support-portal/frontend
npm run build

echo "Копируем в nginx..."
docker run --rm \
  -v /opt/support-portal/frontend/build:/src:ro \
  -v support-portal_nginx_html:/dst \
  alpine sh -c "cp -r /src/. /dst/"

docker compose -f /opt/support-portal/docker-compose.yml exec nginx nginx -s reload

echo "Готово!"
