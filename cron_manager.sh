#!/bin/bash
# cron_manager.sh — управление crontab хоста
# Использует nsenter для вызова crontab команды хоста из контейнера

ACTION="$1"
MARKER="$2"
CRON_LINE="$3"

if [ -z "$ACTION" ] || [ -z "$MARKER" ]; then
    echo "ERROR: usage: cron_manager.sh <list|set|remove> <marker> [cron_line]"
    exit 1
fi

# Получаем текущий crontab хоста через nsenter (PID 1 = init хоста)
HOST_CRONTAB=$(nsenter -m -u -i -n -p -t 1 crontab -l 2>/dev/null || true)

case "$ACTION" in

  list)
    FOUND=$(echo "$HOST_CRONTAB" | grep -F "$MARKER" | head -1)
    echo "$FOUND"
    exit 0
    ;;

  set)
    if [ -z "$CRON_LINE" ]; then
        echo "ERROR: cron_line required for set"
        exit 1
    fi
    NEW=$(echo "$HOST_CRONTAB" | grep -vF "$MARKER")
    NEW=$(printf "%s\n%s\n" "$NEW" "$CRON_LINE" | sed '/^[[:space:]]*$/d')
    echo "$NEW" | nsenter -m -u -i -n -p -t 1 crontab -
    echo "OK"
    exit 0
    ;;

  remove)
    NEW=$(echo "$HOST_CRONTAB" | grep -vF "$MARKER" | sed '/^[[:space:]]*$/d')
    if [ -z "$NEW" ]; then
        nsenter -m -u -i -n -p -t 1 crontab -r 2>/dev/null || true
    else
        echo "$NEW" | nsenter -m -u -i -n -p -t 1 crontab -
    fi
    echo "OK"
    exit 0
    ;;

  *)
    echo "ERROR: unknown action: $ACTION"
    exit 1
    ;;
esac
