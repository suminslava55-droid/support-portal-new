#!/bin/bash
# ============================================================
# Проверка сетевого доступа к lk.ofd.ru
# Использование: bash check_ofd_network.sh
# Помогает понять причину ошибок при обращении к API ОФД:
# 403 (невалидный токен), TimeoutError (нет доступа/блокировка),
# UnicodeEncodeError (кириллица в токене)
# ============================================================
cd /opt/support-portal

echo "=== 1. Доступ к интернету ==="
curl -s --max-time 5 https://google.com -o /dev/null -w "google.com: HTTP %{http_code}\n" || echo "НЕДОСТУПЕН"

echo ""
echo "=== 2. Ping lk.ofd.ru ==="
ping -c 3 -W 3 lk.ofd.ru || echo "НЕДОСТУПЕН"

echo ""
echo "=== 3. TCP 443 к lk.ofd.ru ==="
timeout 5 bash -c "echo > /dev/tcp/lk.ofd.ru/443" && echo "TCP 443: OK" || echo "TCP 443: TIMEOUT/НЕДОСТУПЕН"

echo ""
echo "=== 4. curl к API (ожидаем HTTP 403 на невалидный токен — это нормально) ==="
curl -v --max-time 15 \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" \
  -H "Accept: application/json, text/plain, */*" \
  -H "Referer: https://lk.ofd.ru/" \
  "https://lk.ofd.ru/api/integration/v2/inn/0000000000/kkts?AuthToken=test" \
  2>&1 | grep -E "HTTP/|Connected to|SSL|Timeout|curl:|403|401|200|refused|timed out"

echo ""
echo "=== 5. Python версии ==="
python3 --version && which python3

echo ""
echo "=== Интерпретация результатов ==="
echo "HTTP 403 на тестовый токен — сеть работает, проблема в токенах компаний"
echo "TimeoutError / TCP НЕДОСТУПЕН — сервер lk.ofd.ru недоступен с этого хоста"
echo "HTTP 200 — неожиданно, проверьте токены компаний скриптом check_ofd_tokens.sh"
