#!/bin/bash
# ============================================================
# Проверка токенов всех компаний ОФД
# Использование: bash check_ofd_tokens.sh
# Для каждой компании делает реальный запрос к lk.ofd.ru и
# показывает статус: рабочий токен, 403 (протух/неверный),
# UnicodeEncodeError (кириллица в токене), TimeoutError.
#
# ВНИМАНИЕ: соблюдается rate limit 1 req/sec (требование ОФД).
# Время выполнения: ~1 сек × количество компаний.
# ============================================================
cd /opt/support-portal

echo "=== Токены компаний в базе ==="
docker compose exec backend python manage.py shell -c "
from apps.clients.models import OfdCompany
for c in OfdCompany.objects.all():
    token = c.ofd_token
    if token:
        try:
            token.encode('ascii')
            display = token[:10] + '...'
        except UnicodeEncodeError:
            display = '[КИРИЛЛИЦА/СПЕЦСИМВОЛЫ — НЕВАЛИДНЫЙ ТОКЕН]'
    else:
        display = 'НЕТ'
    print(f'id={c.id} | {c.name} | ИНН: {c.inn} | токен: {display}')
"

echo ""
echo "=== Тест каждого токена через API lk.ofd.ru ==="
echo "(rate limit 1 req/sec — ожидайте ~1 сек на каждую компанию)"
docker compose exec backend python manage.py shell -c "
import urllib.request, json, time
from apps.clients.models import OfdCompany

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://lk.ofd.ru/',
}

for c in OfdCompany.objects.all():
    token = c.ofd_token
    if not token:
        print(f'[{c.id}] {c.name}: ТОКЕН НЕ ЗАДАН — обновите в разделе «Компании»')
        continue
    try:
        token.encode('ascii')
    except UnicodeEncodeError:
        print(f'[{c.id}] {c.name}: КИРИЛЛИЦА В ТОКЕНЕ — замените на настоящий токен из lk.ofd.ru')
        continue
    url = f'https://lk.ofd.ru/api/integration/v2/inn/{c.inn}/kkts?AuthToken={token}'
    time.sleep(1.1)  # rate limit: не более 1 req/sec
    try:
        req = urllib.request.Request(url, headers=HEADERS)
        with urllib.request.urlopen(req, timeout=30) as r:
            data = json.loads(r.read())
            status = data.get('Status')
            count = len(data.get('Data', []))
            if status == 'Success':
                print(f'[{c.id}] {c.name}: ✅ OK | ККТ={count}')
            else:
                errors = data.get('Errors', [])
                print(f'[{c.id}] {c.name}: ⚠️  Status={status} | Errors={errors}')
    except urllib.error.HTTPError as e:
        print(f'[{c.id}] {c.name}: ❌ HTTP {e.code} {e.reason} — токен протух или ИНН неверный, обновите в lk.ofd.ru')
    except TimeoutError as e:
        print(f'[{c.id}] {c.name}: ❌ TimeoutError — сервер не отвечает на этот токен/ИНН')
    except Exception as e:
        print(f'[{c.id}] {c.name}: ❌ {type(e).__name__}: {e}')
"
