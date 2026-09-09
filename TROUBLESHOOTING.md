# Support Portal — Устранение неполадок

## 🔍 Универсальная диагностика

```bash
cd /opt/support-portal
bash diagnose.sh 2>&1 | tee /tmp/diag_result.txt
cat /tmp/diag_result.txt
```

---

### SSH ключ Микротика изменился (замена оборудования)

При замене Микротика его SSH ключ меняется. Портал хранит ключи в `/opt/support-portal/known_hosts` и отклонит подключение с ошибкой:
```
⚠️ SSH ключ хоста изменился (замена Микротика?). Удалите запись из known_hosts
```

Решение — удалить старую запись для конкретного IP:
```bash
# Посмотреть текущий known_hosts
cat /opt/support-portal/known_hosts

# Удалить запись для конкретного Микротика (замените IP)
ssh-keygen -R 192.168.1.1 -f /opt/support-portal/known_hosts

# Или очистить весь known_hosts (все Микротики запомнятся заново)
rm /opt/support-portal/known_hosts
```

После этого при следующем подключении новый ключ запомнится автоматически.

---



### После docker compose down/up показывается старый фронтенд

```bash
bash /opt/support-portal/deploy-frontend.sh
```

Постоянное решение — убедитесь что в `docker-compose.yml` у nginx есть volume:
```yaml
volumes:
  - ./frontend/build:/usr/share/nginx/html
```

### Белый экран в браузере
```bash
docker compose logs nginx --tail=30
# Жёсткий сброс кэша: Ctrl+Shift+R
```

### Ошибка 500 от API
```bash
docker compose logs backend --tail=50
```

### No module named 'cryptography' / 'paramiko' / 'openpyxl' / 'docx' / 'pdfminer' / 'fitz' / 'bleach' / 'winrm' / 'impacket'

Пакеты устанавливаются автоматически из `requirements.txt` при `docker compose up --build`. При ручной установке:

```bash
docker compose exec backend pip install \
  cryptography paramiko openpyxl python-docx pdfminer.six PyMuPDF bleach pywinrm impacket \
  --break-system-packages
docker compose restart backend
```

Проверка через **Настройки → Диагностика → Проверить** — все 8 пунктов должны быть зелёными.
`pywinrm`/`impacket` нужны для раздела «Управление ПК аптек». Если их нет — сделайте полную пересборку: `docker compose build backend && docker compose up -d backend`.

### DEBUG включён случайно
```bash
grep "DEBUG" /opt/support-portal/.env  # должно быть DEBUG=False
docker compose restart backend
```

### После смены ENCRYPTION_KEY перестали читаться пароли

Введите SSH и SMTP пароли заново в разделе «Настройки», обновите токены ОФД в разделе «Компании».

### Черновики накапливаются в базе
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

---

## Проблемы с базой знаний (FAQ)

### Импорт из .docx — картинки не загружаются

Проверьте наличие `python-docx` и `PyMuPDF`:
```bash
docker compose exec backend python -c "import docx, fitz; print('OK')"
```

Если не установлены — см. раздел «No module named...» выше.

Если картинки в VML-формате (старый Word) — это нормально, они поддерживаются. Если всё равно не грузятся — проверьте логи:
```bash
docker compose logs backend --tail=30
```

### Импорт из .pdf — только текст, без картинок

Проверьте наличие `PyMuPDF`:
```bash
docker compose exec backend python -c "import fitz; print(fitz.version)"
```

Если не установлен:
```bash
docker compose exec backend pip install PyMuPDF --break-system-packages
docker compose restart backend
```

### 404 при импорте из файла

`urls.py` на сервере не содержит endpoint `/api/clients/faq-articles/{id}/import/`. Проверьте:
```bash
grep "faq-import\|import" /opt/support-portal/backend/apps/clients/urls.py
```

Если строки нет — скопируйте актуальный `urls.py` и перезапустите бэкенд.

### Картинки из PDF дублируются

Это баг некоторых PDF где одно изображение хранится в двух `xref`. Исправлено в актуальной версии через дедупликацию по `xref` и близости `bbox_y` (< 15px). Обновите `faq_views.py`.

### Статья не сохраняется — нет id у черновика

При открытии нового редактора автоматически создаётся черновик. Если API недоступен — проверьте:
```bash
docker compose logs backend --tail=20
```

### Ошибка сортировки объектов FaqCategory / FaqArticle

```bash
docker compose exec backend python manage.py migrate
```

---

## Проблемы с регламентными заданиями

### 500 при открытии «Регламентные задания» (GET /api/clients/scheduled-tasks/cron/)

Скрипт `cron_manager.sh` смонтирован в контейнер без права на исполнение.

```bash
chmod +x /opt/support-portal/cron_manager.sh
```

Если скрипт принадлежит root:
```bash
sudo chmod +x /opt/support-portal/cron_manager.sh
```

Перезапуск контейнера не требуется — bind volume применяет изменения немедленно.

### «Не удалось прочитать crontab» / ошибка nsenter

```bash
grep -A3 "backend:" /opt/support-portal/docker-compose.yml
# Должны быть строки: pid: host и privileged: true

docker compose exec backend nsenter -m -u -i -n -p -t 1 crontab -l
```

### Задание ККТ обновляет все записи вместо истекающих

Проверьте `scheduler_run.sh` — должен содержать `"scheduled":true`:
```bash
grep "scheduled" /opt/support-portal/scheduler_run.sh
```

Если нет — пересоздайте:
```bash
python3 /opt/support-portal/setup_scheduler.py
grep "scheduled" /opt/support-portal/scheduler_run.sh
```

### Задание не запускается по расписанию

```bash
crontab -l
systemctl status cron
tail -50 /var/log/support-portal-scheduler.log
systemctl status cron-watch
```

### Задание висит в статусе «running»

```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import ScheduledTask
for t in ScheduledTask.objects.filter(status='running'):
    t.status = 'idle'; t.progress = 0; t.progress_text = ''; t.save()
    print(f'Сброшено: {t.task_id}')
"
```

### Crontab слетел или пуст

Зайдите в **Настройки → Регламентные задания** и нажмите **«Применить расписание»** для каждого задания.

### Токен планировщика истёк (задание возвращает 401)

```bash
python3 /opt/support-portal/setup_scheduler.py
```

---

## Проблемы с резервным копированием

### Бэкап не появляется в `/opt/support-portal/backups/`

```bash
grep "backups" /opt/support-portal/docker-compose.yml
# Должно быть: - ./backups:/opt/support-portal/backups
```

### После восстановления токены ОФД / SSH пароль не работают

`ENCRYPTION_KEY` в `.env` отличается от того что был при создании бэкапа. Восстановите `.env`:
```bash
docker compose restart backend
```

### Задание «Резервное копирование» висит в статусе «running»

```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import ScheduledTask
t = ScheduledTask.objects.get(task_id='backup_system')
t.status = 'idle'; t.progress = 0; t.progress_text = ''; t.save()
print('Сброшено')
"
```

---

## Проблемы с дашбордом

### Дежурства сегодня/завтра не отображаются

Дашборд показывает только дежурства с типами: Телефон, Работа днём, Телефон + день. Отпуск и «Занят» не отображаются — это норма.

### Метрики ФН показывают неверные данные

```bash
docker compose exec backend python manage.py shell -c "
from apps.clients.models import KktData
from django.utils import timezone
expired = KktData.objects.filter(fn_end_date__lt=timezone.now()).count()
print(f'Просрочено: {expired}')
"
```

---

## Проблемы с поиском

### Fuzzy поиск не работает (500 ошибка при поиске)

Расширение `pg_trgm` не включено в базе данных. Включить:
```bash
docker compose exec db psql -U postgres -d support_portal -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
```

Проверить:
```bash
docker compose exec db psql -U postgres -d support_portal -c "SELECT extname, extversion FROM pg_extension WHERE extname='pg_trgm';"
```

### Поиск не находит клиентов с опечатками

Проверьте порог схожести в `search_utils.py` (по умолчанию `0.1`):
```bash
grep "SIMILARITY_THRESHOLD" /opt/support-portal/backend/apps/clients/views/search_utils.py
```

Если нужно понизить порог (больше результатов, меньше точность):
```bash
docker compose exec backend python -c "
content = open('/app/apps/clients/views/search_utils.py').read()
print(content[:200])
"
```

### Конвертация раскладки не работает

Проверьте что файл существует:
```bash
ls /opt/support-portal/frontend/src/utils/keyboardLayout.js
```

Если файла нет — нужно пересобрать фронтенд после `git pull`.

---

## Проблемы с ComProxy

### Агент получает 403 на все запросы

Переменные `COMPROXY_HUB_USER` / `COMPROXY_HUB_PASSWORD` не заданы в `.env` или контейнер не подхватил их.

```bash
# Проверить что переменные в .env
grep COMPROXY /opt/support-portal/.env

# Проверить что контейнер видит их (restart НЕ перечитывает .env!)
docker compose exec backend sh -c 'echo $COMPROXY_HUB_USER'

# Если пусто — пересоздать контейнер:
docker compose up -d backend
```

> **Важно:** `docker compose restart` не перечитывает `.env`. Нужен `docker compose up -d` для пересоздания контейнера.

### Устройство не появляется в списке

Устройство регистрируется при первом запросе от агента (handshake/poll/cash_info_report). Проверить:
```bash
docker compose logs backend --tail=30 | grep -i comproxy
```

Если запросов нет — проверьте на кассе `AgentService.ini`:
- `hub_url` должен указывать на адрес сервера
- После изменения — перезапуск службы `ComProxy` на кассе

### Задача обновления зависла в статусе SENT

Задача переотправляется автоматически через 10 минут (stale threshold в PollView). Для ручного сброса:
```bash
docker compose exec backend python manage.py shell -c "
from apps.comproxy.models import DeviceTask
stuck = DeviceTask.objects.filter(status='SENT')
for t in stuck:
    print(f'{t.task_id} → PENDING')
    t.status = 'PENDING'
    t.sent_at = None
    t.save()
"
```

### Агент принял задачу но не скачивает обновление

Проверить что `server_url` в `AgentService.ini` на кассе указывает на адрес сервера (тот же что `hub_url`). Агент строит URL обновления как: `http://<server_url>/v2/projects/{project}/products/{product}/patches/{version}`

Проверить что nginx проксирует `/v2/`:
```bash
curl -u viki:PASSWORD http://localhost/v2/projects/CSI/products/Firmware/patches/TEST
# Должен вернуть {"result": ""}  (пакет не найден — это ОК)
```

### Раздел ComProxy не виден в меню

Раздел доступен только ролям **Администратор** и **Системный администратор**. Проверьте роль пользователя.

---

## Проблемы с управлением ПК аптек

### Задание завершается, но все цели «Недоступен» / ошибка авторизации

Проверьте, что задана **УЗ Windows**: Настройки → Учётные записи → «УЗ для подключения к ПК аптек». Без неё задание сразу завершается с ошибкой. Учётная запись должна быть локальным администратором на ПК.

### Кассы не появляются среди целей (режим «Кассы» / «Сервер + кассы»)

IP касс берутся онлайн у Микротика по SSH в момент запуска. Проверьте:
- Задана SSH-учётка Микротика (Настройки → Учётные записи → SSH).
- Микротик доступен (`ping`), кассы получили DHCP-аренды с именами `kassa1..kassa6`.

### Скрипт выполнился через `wmi`, а не `winrm`

Это нормально: если на ПК закрыт порт 5985 (обычно Windows 7), система автоматически использует WMI-fallback (нужен открытый порт 445/SMB). Транспорт по каждой цели виден в окне «Подробно».

### Цель «Недоступен» — «Порты 5985 и 445 закрыты»

Ни WinRM, ни SMB недоступны. Причины: ПК выключен, файрвол блокирует порты, нет сетевой связности (VPN/Микротик). Для скриптов достаточно любого из портов, для копирования файла нужен 445.

### Задание висит в статусе «Выполняется» после перезапуска контейнера

Фоновые потоки не переживают рестарт бэкенда (как и регламентные задания). Незавершённое задание останется в статусе running — запустите заново кнопкой «Повторить».

### Имя скопированного файла искажается (суффикс вида `_XxYyZz`)

Исправлено: файлы теперь хранятся в подпапке по номеру задания (`media/pc_jobs/<id>/<имя>`), имя не меняется. Если видите суффикс на старом задании — это исторические данные до фикса.

### Раздел «Управление ПК аптек» не виден в меню

Доступен ролям **Администратор** и **Системный администратор**. Проверьте роль пользователя.

---

## Проблемы с вкладкой ЧЗ (Честный знак)

### «ЛМ ЧЗ недоступен» при открытии вкладки

Вкладка ходит на `server_ip:5995/api/v2/status` (сервер аптеки, `.2` подсети). Проверьте:
- у клиента задана **подсеть** (иначе нет `server_ip`);
- сервер аптеки доступен и на нём установлен и запущен ЛМ ЧЗ (порт 5995);
- есть сетевая связность (VPN/Микротик) — как для ТС ПИоТ/pcmgmt.

### «ЛМ ЧЗ отклонил авторизацию» при инициализации

`POST /api/v2/init` использует Basic Auth из **Настройки → Учётные записи → УЗ Regime**. Проверьте логин/пароль. Если «не задан Токен ЧЗ» — задайте токен у компании (раздел «Компании»).

### Кнопка «Перезагрузить службу ЧЗ» ничего не делает / задание с ошибкой

Перезагрузка идёт через «Управление ПК аптек» (PowerShell на `server_ip`). Нужны: заданная **УЗ Windows** и открытый порт **5985 (WinRM) или 445 (SMB/WMI)** на сервере аптеки. Ход и вывод — в разделе «Управление ПК аптек» (задание «Перезагрузка службы ЧЗ — <адрес>»). Кнопка видна только при проблеме и ролям Администратор/Системный администратор.

### В выводе задания перезагрузки — «?????» вместо русских строк

Исправлено: лог скрипта перезагрузки выводится латиницей (кодировка консоли Win7 по WinRM не поддерживает кириллицу). Статусы служб (`Running`/`Stopped`) читаются корректно.

---

## Проблемы с HTTPS и SSL-сертификатом

### Где лежит сертификат и где он прописан

| Что | Где |
|-----|-----|
| Файлы | `/opt/support-portal/nginx/certs/` — `root:service 750`, **не в git** |
| Монтирование | `./nginx/certs:/etc/nginx/certs:ro` в `docker-compose.yml` |
| Конфиг | `nginx/default.conf` → `ssl_certificate /etc/nginx/certs/fullchain.crt` |
| Веб-сервер | только в Docker; системного nginx на хосте нет (`systemctl is-active nginx` → `inactive`) |

Быстрая диагностика:

```bash
cd /opt/support-portal
grep -n -i -E "listen|server_name|ssl_certificate" nginx/default.conf
openssl x509 -in nginx/certs/fullchain.crt -noout -subject -issuer -dates
echo | openssl s_client -connect 127.0.0.1:443 -servername ВАШ_ДОМЕН 2>/dev/null \
  | openssl x509 -noout -dates
```

Если даты в файле и на порту 443 разные — nginx не перечитал конфиг (см. ниже).

### Браузер: «Срок действия сертификата истёк» / NET::ERR_CERT_DATE_INVALID

Портал использует платный wildcard-сертификат. **Certbot/Let's Encrypt не применяется, автопродления нет** — перевыпуск только вручную у поставщика. Проверить срок:

```bash
openssl x509 -in /opt/support-portal/nginx/certs/fullchain.crt -noout -dates
```

> **Кассы при этом продолжают работать.** AgentService на кассах написан на Java и срок сертификата не проверяет — телеметрия и раздача обновлений идут в обычном объёме. Просрочка ломает только браузеры. Убедиться, что поллы идут: `docker compose logs --tail=2000 nginx | grep -c 'poll/v3'`.

### Замена (продление) сертификата

**1. Бэкап** — файлов нет в git, восстанавливать больше неоткуда:

```bash
cd /opt/support-portal
sudo cp -a nginx/certs "/root/certs-backup-$(date +%F)"
```

**2. Проверить присланное** до любых подмен:

```bash
cd /opt/support-portal/nginx/certs
CRT="новый_домен.crt"; INT="новый_intermediate.crt"; KEY="новый.key"

openssl x509 -in "$CRT" -noout -subject -issuer -dates -ext subjectAltName
grep -q ENCRYPTED "$KEY" && echo "КЛЮЧ ПОД ПАРОЛЕМ — nginx не стартует"

# ключ подходит к сертификату? хеши должны совпасть
openssl x509 -in "$CRT" -noout -pubkey | openssl md5
openssl pkey  -in "$KEY" -pubout       | openssl md5

# issuer сертификата должен совпасть с subject промежуточного
openssl x509 -in "$CRT" -noout -issuer
openssl x509 -in "$INT" -noout -subject
```

**3. Собрать** — сначала сертификат домена, затем промежуточный, корневой не нужен:

```bash
{ sed 's/\r$//' "$CRT"; echo; sed 's/\r$//' "$INT"; echo; } > fullchain.crt.new
sed 's/\r$//' "$KEY" > privkey.key.new
```

**4. Подменить и перезагрузить** (`reload` graceful, простоя нет):

```bash
mv fullchain.crt fullchain.crt.old && mv fullchain.crt.new fullchain.crt
mv privkey.key   privkey.key.old   && mv privkey.key.new   privkey.key
sudo chown root:service fullchain.crt privkey.key && sudo chmod 640 fullchain.crt privkey.key

cd /opt/support-portal
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
```

**5. Проверить:**

```bash
echo | openssl s_client -connect ВАШ_ДОМЕН:443 -servername ВАШ_ДОМЕН \
  -verify_return_error 2>&1 | grep "Verify return code"
```

Ожидается `Verify return code: 0 (ok)`. Откат: вернуть `.old` на место и повторить `nginx -s reload`.

### Сменился промежуточный CA

При перевыпуске поставщик может выдать сертификат под **новым** промежуточным CA (например, GlobalSign `GCC R3 DV TLS CA 2020` → `GCC R46 DV TLS CA 2025`). Старый intermediate в этом случае цепочку не соберёт. Всегда берите тот промежуточный, что пришёл вместе с новым сертификатом, и сверяйте `issuer` сертификата с `subject` промежуточного (шаг 2 выше).

### Ключ не подходит к сертификату

`nginx -t` падает с `key values mismatch`. Причина — прислали ключ от другого запроса (CSR). Проверка:

```bash
openssl x509 -in fullchain.crt -noout -pubkey | openssl md5
openssl pkey  -in privkey.key  -pubout       | openssl md5
```

Хеши разные — запрашивайте у поставщика правильную пару, подменять файлы нельзя.

> `file` на ключе в формате PKCS#8 (`-----BEGIN PRIVATE KEY-----`) может написать «OpenSSH private key» — это ложная тревога, ориентируйтесь только на совпадение хешей выше.

### nginx не подхватил новый сертификат

Даты в файле новые, а на порту 443 старые:

```bash
cd /opt/support-portal
docker compose exec nginx nginx -t && docker compose exec nginx nginx -s reload
# если не помогло:
docker compose restart nginx
```

Проверить, что контейнер видит те же файлы:

```bash
docker compose exec nginx ls -la /etc/nginx/certs/
docker compose exec nginx nginx -T | grep -i ssl_certificate
```

### Неполная цепочка — браузер доверяет, а часть клиентов нет

Браузеры кэшируют промежуточные CA, поэтому неполный `fullchain.crt` у них проходит, а curl/Java/мобильные клиенты ругаются. В файле должно быть **два** сертификата:

```bash
openssl crl2pkcs7 -nocrl -certfile /opt/support-portal/nginx/certs/fullchain.crt \
  | openssl pkcs7 -print_certs -noout
```

Один сертификат — забыт промежуточный, пересоберите `fullchain.crt` (шаг 3 выше).

### `ls: cannot open directory 'certs/': Permission denied`

Каталог принадлежит `root`, а работа идёт под `service`. Вернуть доступ группе:

```bash
cd /opt/support-portal/nginx
sudo chown -R root:service certs
sudo chmod 750 certs
sudo chmod 640 certs/*
```

> Порядок важен: `chown` идёт **до** `chmod`. Иначе шелл не сможет раскрыть маску `certs/*` — glob разворачивает ваша оболочка, а не `sudo`.

### Как узнать заранее, что сертификат скоро истечёт

Ежедневная проверка с записью в системный журнал за 30 дней до конца:

```bash
sudo tee /etc/cron.d/cert-expiry-check > /dev/null <<'EOF'
0 9 * * * root openssl x509 -in /opt/support-portal/nginx/certs/fullchain.crt -noout -checkend 2592000 >/dev/null || logger -t cert-expiry "VNIMANIE: sertifikat istekaet menee chem cherez 30 dney"
EOF
sudo chmod 644 /etc/cron.d/cert-expiry-check
```

Проверить вручную (`2592000` секунд = 30 дней):

```bash
openssl x509 -in /opt/support-portal/nginx/certs/fullchain.crt -noout -checkend 2592000 \
  && echo "OK, bolshe 30 dney" || echo "ISTEKAET SKORO"
sudo journalctl -t cert-expiry -n 10 --no-pager
```

> Текст сообщения латиницей намеренно — `logger` пишет кириллицу в journald неровно, в зависимости от локали cron.

---

## Прочее

### Конфликт миграций

```bash
docker compose exec backend python manage.py migrate --run-syncdb
```

### nginx не стартует после git clone

Файл `nginx/default.conf` **не в git** (он в `.gitignore` — конфиг свой на каждом сервере), поэтому после `git clone` его нет. Создайте из шаблона:

```bash
cd /opt/support-portal
cp nginx/default.conf.example nginx/default.conf
nano nginx/default.conf          # заменить techportal.example.com на свой домен
docker compose restart nginx
```

> `git checkout -- nginx/default.conf` **не сработает** — файл не отслеживается git (`did not match any file(s) known to git`).

Также проверьте что backend прошёл healthcheck перед nginx:
```bash
docker compose ps
docker compose logs backend --tail=20
```

### Ошибка сборки фронтенда

```bash
cd /opt/support-portal/frontend
rm -rf node_modules
npm ci
npm run build
```

### Проверка сети до lk.ofd.ru
```bash
bash /opt/support-portal/check_ofd_network.sh
```

### Проверка токенов всех компаний
```bash
bash /opt/support-portal/check_ofd_tokens.sh
```
