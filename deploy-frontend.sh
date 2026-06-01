#!/bin/bash
echo "Очищаем старый build..."
docker run --rm -v /opt/support-portal/frontend/build:/build alpine sh -c "rm -rf /build/static /build/*.js /build/*.json /build/*.ico /build/*.png /build/*.txt 2>/dev/null; true"

echo "Сборка фронтенда..."
cd /opt/support-portal/frontend
npm run build

echo "Копируем в nginx..."
docker run --rm   -v /opt/support-portal/frontend/build:/src:ro   -v support-portal_nginx_html:/dst   alpine sh -c "cp -r /src/. /dst/"

docker compose -f /opt/support-portal/docker-compose.yml exec nginx nginx -s reload

echo "Готово!"
