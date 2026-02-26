#!/usr/local/bin/python3
import sys
import urllib.request
import json
import re

inn = sys.argv[1]
token = sys.argv[2]
search = sys.argv[3] if len(sys.argv) > 3 else ""

# Если search — 16 цифр, делаем прямой запрос по РНМ
if search and re.match(r'^\d{16}$', search.strip()):
    rnm = search.strip()
    url = f"https://lk.ofd.ru/api/integration/v2/inn/{inn}/kkts?KKTRegNumber={rnm}&AuthToken={token}"
    with urllib.request.urlopen(url, timeout=30) as r:
        data = json.loads(r.read().decode("utf-8"))
    print(json.dumps(data))
    sys.exit(0)

# Получаем весь список по ИНН
url = f"https://lk.ofd.ru/api/integration/v2/inn/{inn}/kkts?AuthToken={token}"
with urllib.request.urlopen(url, timeout=30) as r:
    data = json.loads(r.read().decode("utf-8"))

if data.get("Status") != "Success":
    print(json.dumps({"Status": "Error", "Data": [], "error": str(data)}))
    sys.exit(1)

all_kkts = data.get("Data", [])

if search:
    stop_words = {"ул", "пр", "пом", "д", "кв", "г", "р-н", "ул.", "пр.", "д.", "пом.", "г.",
                  "пр-кт", "пр-кт.", "проспект", "улица", "переулок", "помещ", "помещение",
                  "область", "край", "республика", "город"}
    
    # Извлекаем слова из адреса
    words = [w.strip('.,()-').lower() for w in re.split(r'[\s,]+', search)]
    words = [w for w in words if w and len(w) > 1 and w not in stop_words]
    
    # Отдельно извлекаем номер дома (число после д., д, дом или просто число в конце)
    house_match = re.search(r'(?:д\.?\s*|дом\s*)(\d+)', search, re.IGNORECASE)
    if not house_match:
        # Ищем последнее число в адресе как номер дома
        numbers = re.findall(r'\b(\d+)\b', search)
        house_num = numbers[-1] if numbers else None
    else:
        house_num = house_match.group(1)
    
    def matches(fiscal_addr):
        addr_lower = fiscal_addr.lower()
        # Все слова должны присутствовать
        word_match = all(w in addr_lower for w in words)
        if not word_match:
            return False
        # Номер дома должен совпадать точно
        if house_num:
            addr_numbers = re.findall(r'\b(\d+)\b', fiscal_addr)
            if house_num not in addr_numbers:
                return False
        return True
    
    filtered = [k for k in all_kkts if matches(k.get("FiscalAddress", ""))]
    
    if not filtered:
        # Fallback — хотя бы по словам без строгой проверки дома
        def matches_partial(fiscal_addr):
            addr_lower = fiscal_addr.lower()
            matched = sum(1 for w in words if w in addr_lower)
            return matched >= min(3, len(words))
        filtered = [k for k in all_kkts if matches_partial(k.get("FiscalAddress", ""))]
    
    if not filtered:
        filtered = all_kkts
else:
    filtered = all_kkts

result = []
for kkt in filtered:
    rnm = kkt.get("KktRegId")
    if not rnm:
        continue
    detail_url = f"https://lk.ofd.ru/api/integration/v2/inn/{inn}/kkts?KKTRegNumber={rnm}&AuthToken={token}"
    try:
        with urllib.request.urlopen(detail_url, timeout=30) as r:
            detail = json.loads(r.read().decode("utf-8"))
        if detail.get("Status") == "Success":
            result.extend(detail.get("Data", []))
    except Exception:
        pass

print(json.dumps({"Status": "Success", "Data": result}))
