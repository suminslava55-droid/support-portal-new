#!/usr/bin/env python3
"""
setup_scheduler.py — Настройка системного пользователя для cron-заданий.

Запускать ОДИН РАЗ после установки:
    cd /opt/support-portal
    python3 setup_scheduler.py

Что делает:
  1. Создаёт системного пользователя scheduler@system.local (если не существует)
  2. Генерирует долгоживущий JWT refresh-токен (365 дней)
  3. Сохраняет access-токен в /opt/support-portal/.scheduler_token
  4. Создаёт скрипт /opt/support-portal/scheduler_run.sh для cron

Повторный запуск безопасен — пересоздаёт токен и обновляет файл.
"""
import os
import sys
import subprocess
import stat

TOKEN_FILE   = '/opt/support-portal/.scheduler_token'
SCRIPT_FILE  = '/opt/support-portal/scheduler_run.sh'
COMPOSE_DIR  = '/opt/support-portal'

def run(cmd, **kwargs):
    result = subprocess.run(cmd, capture_output=True, text=True, **kwargs)
    if result.returncode != 0:
        print(f'ОШИБКА: {result.stderr}')
        sys.exit(1)
    return result.stdout.strip()

def main():
    print('=== Настройка планировщика заданий ===\n')

    # 1. Создаём пользователя scheduler внутри контейнера
    print('1. Создание системного пользователя scheduler...')
    django_cmd = """
import os
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.contrib.auth import get_user_model
from apps.accounts.models import Role
from rest_framework_simplejwt.tokens import RefreshToken
from datetime import timedelta

User = get_user_model()

# Получаем роль администратора
admin_role = Role.objects.filter(name='admin').first()

user, created = User.objects.get_or_create(
    email='scheduler@system.local',
    defaults={
        'first_name': 'Scheduler',
        'last_name':  'System',
        'is_active':  True,
        'is_staff':   False,
        'role':       admin_role,
    }
)
if created:
    user.set_password(None)  # Вход по паролю заблокирован
    user.save()
    print('CREATED')
else:
    print('EXISTS')

# Генерируем токен с длительным сроком жизни (365 дней)
refresh = RefreshToken.for_user(user)
refresh.set_exp(lifetime=timedelta(days=365))
access = str(refresh.access_token)
# Продлеваем access тоже на 365 дней
from rest_framework_simplejwt.tokens import AccessToken
from datetime import timedelta
access_token = RefreshToken.for_user(user).access_token
access_token.set_exp(lifetime=timedelta(days=365))
print('TOKEN:' + str(access_token))
"""
    result = subprocess.run(
        ['docker', 'compose', 'exec', '-T', 'backend',
         'python', 'manage.py', 'shell', '-c', django_cmd],
        capture_output=True, text=True, cwd=COMPOSE_DIR
    )

    if result.returncode != 0:
        print(f'Ошибка создания пользователя:\n{result.stderr}')
        sys.exit(1)

    token = None
    for line in result.stdout.splitlines():
        if line.startswith('TOKEN:'):
            token = line[6:].strip()
        elif line in ('CREATED', 'EXISTS'):
            print(f'   Пользователь scheduler: {line}')

    if not token:
        print('Не удалось получить токен. Вывод:')
        print(result.stdout)
        sys.exit(1)

    print(f'   Токен получен (первые 30 символов): {token[:30]}...')

    # 2. Сохраняем токен в файл
    print(f'\n2. Сохранение токена в {TOKEN_FILE}...')
    with open(TOKEN_FILE, 'w') as f:
        f.write(token)
    os.chmod(TOKEN_FILE, stat.S_IRUSR | stat.S_IWUSR)  # 600 — только root
    print('   OK')

    # 3. Создаём скрипт запуска для cron
    print(f'\n3. Создание скрипта {SCRIPT_FILE}...')
    script_content = f"""#!/bin/bash
# scheduler_run.sh — запуск регламентного задания через API
# Генерируется автоматически setup_scheduler.py

TASK_ID="${{1:-update_rnm}}"
COMPANY_ID="${{2:-}}"
TOKEN_FILE="{TOKEN_FILE}"
API_URL="http://localhost/api/clients/scheduled-tasks/run/"
LOG_FILE="/var/log/support-portal-scheduler.log"

if [ ! -f "$TOKEN_FILE" ]; then
    echo "$(date '+%Y-%m-%d %H:%M:%S') ERROR: Файл токена не найден: $TOKEN_FILE" >> "$LOG_FILE"
    exit 1
fi

TOKEN=$(cat "$TOKEN_FILE")

if [ -n "$COMPANY_ID" ]; then
    BODY=$(printf '{{"task_id":"%s","company_id":%s,"scheduled":true}}' "$TASK_ID" "$COMPANY_ID")
else
    BODY=$(printf '{{"task_id":"%s","scheduled":true}}' "$TASK_ID")
fi

RESPONSE=$(curl -s -w "\\nHTTP_STATUS:%{{http_code}}" -X POST "$API_URL" \\
    -H "Content-Type: application/json" \\
    -H "Authorization: Bearer $TOKEN" \\
    -d "$BODY" \\
    --connect-timeout 10 \\
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
"""
    with open(SCRIPT_FILE, 'w') as f:
        f.write(script_content)
    os.chmod(SCRIPT_FILE, stat.S_IRWXU | stat.S_IRGRP | stat.S_IXGRP | stat.S_IROTH | stat.S_IXOTH)  # 755
    print('   OK')

    # 4. Итог
    print(f"""
=== Готово! ===

Токен сохранён:  {TOKEN_FILE}
Скрипт запуска:  {SCRIPT_FILE}

Для добавления в cron выполните:
    crontab -e

Пример — каждый день в 03:00:
    0 3 * * * {SCRIPT_FILE} update_rnm >> /var/log/support-portal-scheduler.log 2>&1

Или через интерфейс — нажмите «Применить расписание» в настройках.

Токен действителен 365 дней. Для обновления запустите этот скрипт повторно.
""")

if __name__ == '__main__':
    main()
