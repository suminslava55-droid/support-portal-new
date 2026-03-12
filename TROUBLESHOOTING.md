# Support Portal — Устранение неполадок

## 🔍 Универсальная диагностика

При любой непонятной ошибке (500, 400, токены не сохраняются, API не отвечает) — запустите диагностический скрипт. Он автоматически включит `DEBUG=True`, воспроизведёт запрос, покажет traceback и вернёт `DEBUG=False`.

```bash
cd /opt/support-portal
bash diagnose.sh 2>&1 | tee /tmp/diag_result.txt
cat /tmp/diag_result.txt
```

<details>
<summary>Содержимое diagnose.sh</summary>

```bash
#!/bin/bash
cd /opt/support-portal
DIVIDER="=================================================="

echo "$DIVIDER"; echo "1. ОКРУЖЕНИЕ"; echo "$DIVIDER"
grep -E "DEBUG|ALLOWED_HOSTS|ENCRYPTION_KEY" .env | sed 's/=.*/=***/'
docker compose exec backend python manage.py shell -c "
from django.conf import settings
print('DEBUG:', settings.DEBUG)
print('ALLOWED_HOSTS:', settings.ALLOWED_HOSTS)
print('ENCRYPTION_KEY задан:', bool(getattr(settings, 'ENCRYPTION_KEY', '')))
print('ENCRYPTION_KEY длина:', len(getattr(settings, 'ENCRYPTION_KEY', '')))
"

echo ""; echo "$DIVIDER"; echo "2. СТАТУС КОНТЕЙНЕРОВ"; echo "$DIVIDER"
docker compose ps

echo ""; echo "$DIVIDER"; echo "3. ИМПОРТЫ В VIEWS.PY"; echo "$DIVIDER"
grep -n "from .serializers\|OfdCompanyWriteSerializer\|OfdCompanySerializer" backend/apps/clients/views.py
echo "Количество OfdCompanyViewSet:"
grep -c "class OfdCompanyViewSet" backend/apps/clients/views.py

echo ""; echo "$DIVIDER"; echo "4. ПАКЕТЫ"; echo "$DIVIDER"
docker compose exec backend python -c "
import cryptography, paramiko, openpyxl
print('cryptography:', cryptography.__version__)
print('paramiko:', paramiko.__version__)
print('openpyxl:', openpyxl.__version__)
"

echo ""; echo "$DIVIDER"; echo "5. ТЕСТ ШИФРОВАНИЯ"; echo "$DIVIDER"
docker compose exec backend python manage.py shell -c "
from apps.clients.models import encrypt_value, decrypt_value
try:
    enc = encrypt_value('test_token_diag')
    dec = decrypt_value(enc)
    print('encrypt/decrypt:', 'OK' if dec == 'test_token_diag' else 'FAIL: ' + dec)
except Exception as e:
    import traceback; traceback.print_exc()
"

echo ""; echo "$DIVIDER"; echo "6. ЛОГИ БЭКЕНДА (последние 40 строк)"; echo "$DIVIDER"
docker compose logs --tail=40 backend 2>&1 | grep -v "RuntimeWarning\|warnings.warn\|UnorderedObject\|Booting worker\|Listening at\|Starting gunicorn\|Control socket\|copied to\|No migrations\|Apply all\|accounts, admin"
```
</details>

---

## Частые проблемы

### Белый экран в браузере
```bash
docker compose logs nginx --tail=30
# Жёсткий сброс кэша: Ctrl+Shift+R
```

### Ошибка 500 от API
```bash
docker compose logs backend --tail=50
```

### No module named 'cryptography' / 'paramiko' / 'openpyxl'
Пакеты слетели при пересборке контейнера:
```bash
docker compose exec backend pip install cryptography paramiko openpyxl --break-system-packages
docker compose restart backend
```

### Скрипт ОФД не найден
```bash
ls -la /opt/support-portal/ofd_fetch.sh
# Убедитесь что в docker-compose.yml есть volume для ofd_fetch.sh
docker compose exec backend ls -la /usr/local/bin/ofd_fetch.sh
```

### Пустой ответ от скрипта ОФД / timeout
```bash
# Тест с хоста (НЕ из контейнера!)
python3 /opt/support-portal/ofd_fetch.sh <ИНН> <ТОКЕН> "Адрес"
# Если timeout — проверьте токен и доступ к интернету с хоста
```

### Ошибки при получении данных ККТ

**Проверка сети до lk.ofd.ru:**
```bash
bash /opt/support-portal/check_ofd_network.sh
```
Ожидаемый результат: TCP 443 OK, curl возвращает HTTP 403 на тестовый токен — это нормально.

**Проверка токенов всех компаний:**
```bash
bash /opt/support-portal/check_ofd_tokens.sh
```
Результаты: `✅ OK` — токен рабочий, `❌ HTTP 403` — токен протух (обновите в lk.ofd.ru), `❌ TimeoutError` — сервер не отвечает, `❌ КИРИЛЛИЦА В ТОКЕНЕ` — введён мусор.

### Обновление ККТ занимает много времени
API `lk.ofd.ru` ограничивает частоту: не более 1 запроса в секунду. При 700 кассах — ~13 минут. Это штатное поведение. Gunicorn настроен с `--timeout 1000`.

### DEBUG включён случайно
```bash
grep "DEBUG" /opt/support-portal/.env
# Должно быть DEBUG=False
docker compose restart backend
```

### Черновики накапливаются в базе
Черновики старше 2 часов удаляются автоматически при открытии списка клиентов. Для ручной очистки:
```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import Client
from django.utils import timezone
from datetime import timedelta
old = Client.objects.filter(is_draft=True, created_at__lt=timezone.now()-timedelta(hours=2))
print(f'Найдено черновиков: {old.count()}')
for c in old:
    for f in c.files.all(): f.file.delete(); f.delete()
    c.delete()
print('Готово')
"
```

### После смены ENCRYPTION_KEY перестали читаться пароли
Введите SSH и SMTP пароли заново в разделе «Настройки», обновите токены ОФД в разделе «Компании».

### Конфликт миграций (Conflicting migrations detected)
```bash
cat > /opt/support-portal/backend/apps/accounts/migrations/0004_merge.py << 'MIGRATION'
from django.db import migrations
class Migration(migrations.Migration):
    dependencies = [
        ('accounts', '0002_user_birthday'),
        ('accounts', '0003_update_role_choices'),
    ]
    operations = []
MIGRATION
docker compose exec backend python manage.py migrate
```

### Ошибка сборки фронтенда
```bash
cd /opt/support-portal/frontend
rm -rf node_modules
npm install
npm run build
```

### Токен ОФД не сохраняется / ошибка 500 при сохранении компании
```bash
# Проверяем — должно быть 1
grep -c "class OfdCompanyViewSet" /opt/support-portal/backend/apps/clients/views.py

# Проверяем наличие импорта
grep "OfdCompanyWriteSerializer" /opt/support-portal/backend/apps/clients/views.py

# Если импорта нет — добавляем
sed -i 's/OfdCompanySerializer,$/OfdCompanySerializer, OfdCompanyWriteSerializer,/' \
  /opt/support-portal/backend/apps/clients/views.py

docker compose restart backend
```

### Ошибка сортировки по полям Компания / ИНН
Поля являются вычисляемыми (`@property`) и берутся из связанной модели `OfdCompany`. Сортировка идёт через `ofd_company__name` и `ofd_company__inn`. Сбросьте кэш браузера (`Ctrl+Shift+R`).
