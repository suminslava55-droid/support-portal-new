#!/bin/bash
# cron_manager.sh — управление crontab хоста
# Пишет в /var/spool/cron/crontabs/root (volume с хоста)
# Перезагружает cron через PID-файл хоста (тоже volume)

ACTION="$1"
MARKER="$2"
CRON_LINE="$3"

CRONTAB_FILE="/var/spool/cron/crontabs/root"

if [ -z "$ACTION" ] || [ -z "$MARKER" ]; then
    echo "ERROR: usage: cron_manager.sh <list|set|remove> <marker> [cron_line]"
    exit 1
fi

reload_cron() {
    # /var/run смонтирован с хоста — читаем PID cron
    for pidfile in /run/crond.pid /var/run/crond.pid /run/cron.pid /var/run/cron.pid; do
        if [ -f "$pidfile" ]; then
            PID=$(cat "$pidfile" 2>/dev/null)
            if [ -n "$PID" ] && kill -0 "$PID" 2>/dev/null; then
                kill -HUP "$PID" 2>/dev/null
                return 0
            fi
        fi
    done
}

if [ -f "$CRONTAB_FILE" ]; then
    CURRENT=$(cat "$CRONTAB_FILE")
else
    CURRENT=""
fi

case "$ACTION" in

  list)
    FOUND=$(echo "$CURRENT" | grep -F "$MARKER" | head -1)
    echo "$FOUND"
    exit 0
    ;;

  set)
    if [ -z "$CRON_LINE" ]; then
        echo "ERROR: cron_line required for set"
        exit 1
    fi
    NEW=$(echo "$CURRENT" | grep -vF "$MARKER")
    NEW=$(printf "%s\n%s\n" "$NEW" "$CRON_LINE" | sed '/^[[:space:]]*$/d')
    mkdir -p "$(dirname "$CRONTAB_FILE")"
    echo "$NEW" > "$CRONTAB_FILE"
    chmod 600 "$CRONTAB_FILE"
    reload_cron
    echo "OK"
    exit 0
    ;;

  remove)
    NEW=$(echo "$CURRENT" | grep -vF "$MARKER" | sed '/^[[:space:]]*$/d')
    mkdir -p "$(dirname "$CRONTAB_FILE")"
    if [ -z "$NEW" ]; then
        rm -f "$CRONTAB_FILE"
    else
        echo "$NEW" > "$CRONTAB_FILE"
        chmod 600 "$CRONTAB_FILE"
    fi
    reload_cron
    echo "OK"
    exit 0
    ;;

  *)
    echo "ERROR: unknown action: $ACTION"
    exit 1
    ;;
esac
