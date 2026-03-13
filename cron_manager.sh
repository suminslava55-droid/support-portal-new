#!/bin/bash
# cron_manager.sh — управление crontab с хоста
# Вызывается из Django-контейнера через subprocess
# Монтируется как: ./cron_manager.sh:/usr/local/bin/cron_manager.sh
#
# Использование:
#   cron_manager.sh list   <marker>               — показать строку
#   cron_manager.sh set    <marker> <cron_line>   — добавить/заменить
#   cron_manager.sh remove <marker>               — удалить

ACTION="$1"
MARKER="$2"
CRON_LINE="$3"

if [ -z "$ACTION" ] || [ -z "$MARKER" ]; then
    echo "ERROR: usage: cron_manager.sh <list|set|remove> <marker> [cron_line]"
    exit 1
fi

# Читаем текущий crontab (пустой если нет)
CURRENT=$(crontab -l 2>/dev/null || true)

case "$ACTION" in

  list)
    # Выводим строку с маркером или пустую строку
    FOUND=$(echo "$CURRENT" | grep "$MARKER" | head -1)
    echo "$FOUND"
    exit 0
    ;;

  set)
    if [ -z "$CRON_LINE" ]; then
        echo "ERROR: cron_line required for set"
        exit 1
    fi
    # Убираем старые строки с этим маркером, добавляем новую
    NEW=$(echo "$CURRENT" | grep -v "$MARKER")
    NEW=$(printf "%s\n%s\n" "$NEW" "$CRON_LINE" | sed '/^[[:space:]]*$/d')
    echo "$NEW" | crontab -
    echo "OK"
    exit 0
    ;;

  remove)
    # Убираем строки с маркером
    NEW=$(echo "$CURRENT" | grep -v "$MARKER" | sed '/^[[:space:]]*$/d')
    if [ -z "$NEW" ]; then
        crontab -r 2>/dev/null || true
    else
        echo "$NEW" | crontab -
    fi
    echo "OK"
    exit 0
    ;;

  *)
    echo "ERROR: unknown action: $ACTION"
    exit 1
    ;;
esac
