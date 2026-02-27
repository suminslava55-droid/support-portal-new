#!/bin/bash
# ============================================================
# УНИВЕРСАЛЬНЫЙ ДИАГНОСТИЧЕСКИЙ СКРИПТ
# Использование: bash diagnose.sh
# ============================================================

cd /opt/support-portal
DIVIDER="=================================================="

# ── 1. ОКРУЖЕНИЕ ─────────────────────────────────────────────
echo "$DIVIDER"
echo "1. ОКРУЖЕНИЕ"
echo "$DIVIDER"
echo "--- .env ---"
grep -E "DEBUG|ALLOWED_HOSTS|ENCRYPTION_KEY|SECRET_KEY" .env | sed 's/=.*/=***/' 
echo "--- Реальные значения в контейнере ---"
docker compose exec backend python manage.py shell -c "
from django.conf import settings
print('DEBUG:', settings.DEBUG)
print('ALLOWED_HOSTS:', settings.ALLOWED_HOSTS)
print('ENCRYPTION_KEY задан:', bool(getattr(settings, 'ENCRYPTION_KEY', '')))
print('ENCRYPTION_KEY длина:', len(getattr(settings, 'ENCRYPTION_KEY', '')))
"

# ── 2. КОНТЕЙНЕРЫ ────────────────────────────────────────────
echo ""
echo "$DIVIDER"
echo "2. СТАТУС КОНТЕЙНЕРОВ"
echo "$DIVIDER"
docker compose ps

# ── 3. ИМПОРТЫ В VIEWS.PY ────────────────────────────────────
echo ""
echo "$DIVIDER"
echo "3. ИМПОРТЫ В VIEWS.PY"
echo "$DIVIDER"
echo "--- Строка импорта сериализаторов ---"
grep -n "from .serializers\|OfdCompanyWriteSerializer\|OfdCompanySerializer" backend/apps/clients/views.py
echo "--- Количество OfdCompanyViewSet ---"
grep -c "class OfdCompanyViewSet" backend/apps/clients/views.py
echo "--- ViewSet и его методы ---"
grep -n "class OfdCompanyViewSet\|get_serializer_class\|OfdCompanyWriteSerializer\|serializer_class" backend/apps/clients/views.py | grep -A5 "OfdCompanyViewSet"

# ── 4. ПАКЕТЫ ────────────────────────────────────────────────
echo ""
echo "$DIVIDER"
echo "4. PYTHON ПАКЕТЫ"
echo "$DIVIDER"
docker compose exec backend python -c "
import cryptography, paramiko, openpyxl
print('cryptography:', cryptography.__version__)
print('paramiko:', paramiko.__version__)
print('openpyxl:', openpyxl.__version__)
"

# ── 5. ENCRYPT/DECRYPT ───────────────────────────────────────
echo ""
echo "$DIVIDER"
echo "5. ТЕСТ ШИФРОВАНИЯ"
echo "$DIVIDER"
docker compose exec backend python manage.py shell -c "
from apps.clients.models import encrypt_value, decrypt_value
try:
    enc = encrypt_value('test_token_diag')
    dec = decrypt_value(enc)
    ok = dec == 'test_token_diag'
    print('encrypt/decrypt:', 'OK' if ok else 'FAIL — расшифровано:', dec)
except Exception as e:
    import traceback
    print('ОШИБКА:')
    traceback.print_exc()
"

# ── 6. ВКЛЮЧАЕМ DEBUG ────────────────────────────────────────
echo ""
echo "$DIVIDER"
echo "6. ВКЛЮЧАЕМ DEBUG=True ДЛЯ РЕАЛЬНОГО TRACEBACK"
echo "$DIVIDER"
cp .env .env.diag_backup
sed -i 's/DEBUG=False/DEBUG=True/' .env
docker compose restart backend > /dev/null 2>&1
sleep 7
echo "DEBUG включён, бэкенд перезапущен"

# ── 7. РЕАЛЬНЫЙ PATCH ЗАПРОС ─────────────────────────────────
echo ""
echo "$DIVIDER"
echo "7. PATCH ЗАПРОС С TRACEBACK"
echo "$DIVIDER"
docker compose exec backend python manage.py shell -c "
import traceback
from rest_framework.test import APIClient
from apps.clients.models import OfdCompany
from django.contrib.auth import get_user_model

User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
company = OfdCompany.objects.first()

print(f'Пользователь: {user}')
print(f'Компания: {company.name} (id={company.id})')
print()

client = APIClient()
client.force_authenticate(user=user)

# PATCH с правильным Host
try:
    r = client.patch(
        f'/api/clients/ofd-companies/{company.id}/',
        {'ofd_token': 'DIAG_TEST_TOKEN'},
        format='json',
        HTTP_HOST='192.168.142.145',
    )
    print('HTTP статус:', r.status_code)
    if hasattr(r, 'data'):
        print('response.data:', r.data)
    print('content:', r.content[:1000].decode('utf-8', errors='replace'))
except Exception as e:
    print('ИСКЛЮЧЕНИЕ:')
    traceback.print_exc()

# Проверяем что в БД
company.refresh_from_db()
print()
print('В БД после запроса:')
print('  has_token:', bool(company.ofd_token_encrypted))
print('  token:', company.ofd_token)
"

# ── 8. ЛОГИ БЭКЕНДА ПОСЛЕ ЗАПРОСА ───────────────────────────
echo ""
echo "$DIVIDER"
echo "8. ЛОГИ БЭКЕНДА (последние 40 строк, только ошибки)"
echo "$DIVIDER"
docker compose logs --tail=40 backend 2>&1 | grep -v "RuntimeWarning\|warnings.warn\|UnorderedObject\|Booting worker\|Listening at\|Starting gunicorn\|Control socket\|copied to\|No migrations\|Apply all\|accounts, admin"

# ── 9. CURL ТЕСТ ─────────────────────────────────────────────
echo ""
echo "$DIVIDER"
echo "9. CURL ТЕСТ (через nginx, как браузер)"
echo "$DIVIDER"
TOKEN=$(docker compose exec backend python manage.py shell -c "
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
User = get_user_model()
user = User.objects.filter(is_superuser=True).first()
refresh = RefreshToken.for_user(user)
print(str(refresh.access_token))
" 2>/dev/null | tail -1)

echo "Токен: ${TOKEN:0:30}..."
echo ""
echo "--- curl через nginx (порт 80) ---"
curl -s -X PATCH \
  "http://localhost/api/clients/ofd-companies/1/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Host: 192.168.142.145" \
  -d '{"ofd_token": "CURL_TEST"}' \
  2>&1 | head -c 1000

echo ""
echo ""
echo "--- curl напрямую к бэкенду (порт 8000) ---"
curl -s -X PATCH \
  "http://localhost:8000/api/clients/ofd-companies/1/" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Host: 192.168.142.145" \
  -d '{"ofd_token": "CURL_DIRECT_TEST"}' \
  2>&1 | head -c 1000

# ── 10. ВОЗВРАЩАЕМ DEBUG=False ───────────────────────────────
echo ""
echo ""
echo "$DIVIDER"
echo "10. ВОЗВРАЩАЕМ DEBUG=False"
echo "$DIVIDER"
cp .env.diag_backup .env
docker compose restart backend > /dev/null 2>&1
echo "DEBUG=False восстановлен, бэкенд перезапущен"
echo ""
echo "✅ Диагностика завершена. Скиньте весь вывод."
