#!/bin/bash
# Деплой support-portal на 192.168.142.145
# Использование:
#   ./deploy.sh          — push + бэкенд + фронтенд
#   ./deploy.sh frontend — push + только фронт
#   ./deploy.sh backend  — push + только бэкенд

set -e

SERVER="git@192.168.142.145"
REMOTE="/opt/support-portal"
MODE="${1:-all}"

echo "==> Пушим изменения в GitHub..."
git push || true

deploy_backend() {
  echo "==> [Backend] git pull + migrate + restart..."
  ssh $SERVER "cd $REMOTE && git pull && docker compose -f $REMOTE/docker-compose.yml exec backend python manage.py migrate && docker compose -f $REMOTE/docker-compose.yml restart backend"
  echo "==> [Backend] Готово!"
}

deploy_frontend() {
  echo "==> [Frontend] git pull + build..."
  ssh $SERVER "cd $REMOTE && git pull && bash $REMOTE/deploy-frontend.sh"
  echo "==> [Frontend] Готово!"
}

case "$MODE" in
  frontend) deploy_frontend ;;
  backend)  deploy_backend  ;;
  all)
    deploy_backend
    ssh $SERVER "bash $REMOTE/deploy-frontend.sh"
    echo "==> [All] Готово!"
    ;;
  *)
    echo "Использование: $0 [frontend|backend|all]"
    exit 1
    ;;
esac
