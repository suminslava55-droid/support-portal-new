#!/bin/bash
# scheduler_run.sh — запуск регламентного задания через API
# Генерируется автоматически setup_scheduler.py

TASK_ID="${1:-update_rnm}"
COMPANY_ID="${2:-}"
TOKEN_FILE="/opt/support-portal/.scheduler_token"
API_URL="http://localhost/api/clients/scheduled-tasks/run/"
LOG_FILE="/var/log/support-portal-scheduler.log"

if [ ! -f "$TOKEN_FILE" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: Файл токена не найден: $TOKEN_FILE" >> "$LOG_FILE"
    exit 1
fi

TOKEN=$(cat "$TOKEN_FILE")

if [ -n "$COMPANY_ID" ]; then
    BODY=$(printf '{"task_id":"%s","company_id":%s}' "$TASK_ID" "$COMPANY_ID")
else
    BODY=$(printf '{"task_id":"%s"}' "$TASK_ID")
fi

RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d "$BODY" \
    --connect-timeout 10 \
    --max-time 30)

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY_RESP=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "$(date '+%Y-%m-%d %H:%M:%S') task=$TASK_ID status=$HTTP_STATUS response=$BODY_RESP" >> "$LOG_FILE"

if [ "$HTTP_STATUS" = "200" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') OK: Задание $TASK_ID запущено" >> "$LOG_FILE"
    exit 0
else
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: HTTP $HTTP_STATUS" >> "$LOG_FILE"
    exit 1
fi
