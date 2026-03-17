#!/usr/local/bin/python3
import sys
import urllib.request
import json
import re
import time

# Ограничение: не более 1 запроса в секунду (требование lk.ofd.ru)
_last_request_time = 0

def _rate_limit():
    global _last_request_time
    elapsed = time.time() - _last_request_time
    if elapsed < 1.1:
        time.sleep(1.1 - elapsed)
    _last_request_time = time.time()

inn = sys.argv[1]
token = sys.argv[2]
search = sys.argv[3] if len(sys.argv) > 3 else ""

HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    "Accept": "application/json, text/plain, */*",
    "Accept-Language": "ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7",
    "Accept-Encoding": "gzip, deflate, br",
    "Referer": "https://lk.ofd.ru/",
    "Origin": "https://lk.ofd.ru",
    "Connection": "keep-alive",
}

def ofd_get(url):
    _rate_limit()
    # Проверяем что URL содержит только ASCII (токен не должен быть кириллицей)
    try:
        url.encode("ascii")
    except UnicodeEncodeError:
        raise ValueError("Токен содержит недопустимые символы (кириллица или спецсимволы). Обновите токен в разделе «Компании».")
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as r:
        raw = r.read()
        encoding = r.headers.get("Content-Encoding", "")
        if encoding == "gzip":
            import gzip
            raw = gzip.decompress(raw)
        elif encoding == "br":
            try:
                import brotli
                raw = brotli.decompress(raw)
            except ImportError:
                pass
        return json.loads(raw.decode("utf-8"))

# Если search — 16 цифр, делаем прямой запрос по РНМ
if search and re.match(r'^\d{16}$', search.strip()):
    rnm = search.strip()
    url = f"https://lk.ofd.ru/api/integration/v2/inn/{inn}/kkts?KKTRegNumber={rnm}&AuthToken={token}"
    data = ofd_get(url)
    print(json.dumps(data))
    sys.exit(0)

# Получаем весь список по ИНН
url = f"https://lk.ofd.ru/api/integration/v2/inn/{inn}/kkts?AuthToken={token}"
data = ofd_get(url)

if data.get("Status") != "Success":
    print(json.dumps({"Status": "Error", "Data": [], "error": str(data)}))
    sys.exit(1)

all_kkts = data.get("Data", [])

if search:
    stop_words = {"ул", "пр", "пом", "д", "кв", "г", "р-н", "ул.", "пр.", "д.", "пом.", "г.",
                  "пр-кт", "пр-кт.", "проспект", "улица", "переулок", "помещ", "помещение",
                  "область", "край", "республика", "город"}

    # Извлекаем слова из адреса
    raw_words = [w.strip('.,()-').lower() for w in re.split(r'[\s,]+', search)]
    raw_words = [w for w in raw_words if w and len(w) > 1 and w not in stop_words]

    # Для дробей типа 47/5 создаём группы: совпадает если нашли саму дробь ИЛИ оба числа
    word_groups = []
    for w in raw_words:
        if re.match(r'^\d+/\d+$', w):
            parts = w.split('/')
            word_groups.append([w] + parts)  # группа: 47/5 ИЛИ (47 И 5)
        else:
            word_groups.append([w])

    def group_matches(fiscal_addr, groups):
        addr_lower = fiscal_addr.lower()
        for group in groups:
            if len(group) == 1:
                if group[0] not in addr_lower:
                    return False
            else:
                # дробь: ищем саму дробь ИЛИ все части отдельно
                fraction = group[0]
                parts = group[1:]
                if fraction not in addr_lower:
                    if not all(p in addr_lower for p in parts):
                        return False
        return True

    # Отдельно извлекаем номер дома
    house_match = re.search(r'(?:д\.?\s*|дом\s*)(\d+)', search, re.IGNORECASE)
    if not house_match:
        numbers = re.findall(r'\b(\d+)\b', search)
        house_num = numbers[-1] if numbers else None
    else:
        house_num = house_match.group(1)

    def matches(fiscal_addr):
        if not group_matches(fiscal_addr, word_groups):
            return False
        if house_num:
            addr_numbers = re.findall(r'\b(\d+)\b', fiscal_addr)
            if house_num not in addr_numbers:
                return False
        return True

    filtered = [k for k in all_kkts if matches(k.get("FiscalAddress", ""))]

    if not filtered:
        # Частичное совпадение — хотя бы 3 слова из групп
        simple_words = [g[0] for g in word_groups]
        def matches_partial(fiscal_addr):
            addr_lower = fiscal_addr.lower()
            matched = sum(1 for w in simple_words if w in addr_lower)
            return matched >= min(3, len(simple_words))
        filtered = [k for k in all_kkts if matches_partial(k.get("FiscalAddress", ""))]
else:
    filtered = all_kkts

result = [k for k in filtered if k.get("KktRegId")]

print(json.dumps({"Status": "Success", "Data": result}))
