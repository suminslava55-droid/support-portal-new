"""
Опрос IP-адресов касс по всем клиентам через Микротик (DHCP-аренды kassa1..kassa6).
Запуск (с хоста /opt/support-portal):
    docker compose exec -T backend python manage.py shell -c "exec(open('/app/kassa_ips_dump.py').read())"
Результат: /app/kassa_ips.json  ->  на хосте backend/kassa_ips.json
"""
import json
import re
import datetime
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed

import paramiko

from apps.clients.models import Client, SystemSettings
from apps.clients.views.utils import ping_ip
from apps.clients.views.misc_views import _make_ssh_client, _save_known_hosts

OUTPUT_PATH = '/app/kassa_ips.json'
KASSA_CMD = (
    ':foreach i in={"kassa1";"kassa2";"kassa3";"kassa4";"kassa5";"kassa6"} do={'
    ':local l [/ip dhcp-server lease find where host-name=$i]; '
    ':if ($l!="") do={:put "$i -> $[/ip dhcp-server lease get $l address]"} '
    'else={:put "$i -> not found"}}'
)

# known_hosts — общий файл, защищаем от одновременной записи из потоков
_known_hosts_lock = threading.Lock()

settings_obj = SystemSettings.get()
if not settings_obj.ssh_user or not settings_obj.ssh_password_encrypted:
    raise SystemExit('SSH пользователь/пароль не заданы в настройках системы')

ssh_user = settings_obj.ssh_user
ssh_password = settings_obj.ssh_password


def probe(client):
    # Адрес аптеки — основной идентификатор в выгрузке
    entry = {
        'client_id': client.id,
        'address': '',          # Адрес аптеки
        'mikrotik': '',         # IP Микротика (.1 подсети)
        'server': '',           # IP сервера (.2 подсети)
        'subnet': '',
        'cr': {},
        'error': None,
    }
    # Любая ошибка по одному клиенту не должна ронять весь прогон
    try:
        entry['address'] = (client.address or '').strip()
        entry['subnet'] = client.subnet or ''
        mikrotik_ip = (client.mikrotik_ip or '').strip()
        entry['mikrotik'] = mikrotik_ip
        entry['server'] = (client.server_ip or '').strip()

        if not mikrotik_ip:
            entry['error'] = 'Микротик IP не задан (нет подсети)'
            return entry

        if not ping_ip(mikrotik_ip, timeout=3):
            entry['error'] = f'Микротик {mikrotik_ip} недоступен'
            return entry

        try:
            ssh = _make_ssh_client(mikrotik_ip)
            ssh.connect(mikrotik_ip, username=ssh_user, password=ssh_password,
                        timeout=10, port=22)
            with _known_hosts_lock:
                _save_known_hosts(ssh)
            _, stdout, _ = ssh.exec_command(KASSA_CMD, timeout=15)
            output = stdout.read().decode('utf-8', errors='replace').strip()
            ssh.close()
        except paramiko.AuthenticationException:
            entry['error'] = 'Ошибка аутентификации SSH'
            return entry
        except Exception as e:
            entry['error'] = f'Ошибка подключения: {e}'
            return entry

        result = {}
        for line in output.splitlines():
            m = re.match(r'^(kassa\d+)\s*->\s*(.+)$', line.strip())
            if m:
                name, value = m.group(1), m.group(2).strip()
                result[name] = None if value == 'not found' else value
        for i in range(1, 7):
            result.setdefault(f'kassa{i}', None)
        entry['cr'] = result
    except Exception as e:
        entry['error'] = f'Внутренняя ошибка: {e}'
    return entry


clients = list(Client.objects.all())
total = len(clients)
print(f'Клиентов для опроса: {total}', flush=True)

results = []
with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(probe, c): c for c in clients}
    for i, fut in enumerate(as_completed(futures), 1):
        try:
            entry = fut.result()
        except Exception as e:
            entry = {'client_id': None, 'address': '', 'mikrotik': '', 'server': '',
                     'subnet': '', 'cr': {}, 'error': f'Сбой задачи: {e}'}
        results.append(entry)
        status = entry['error'] or 'OK'
        addr = (entry.get('address') or '—')[:40]
        print(f'[{i}/{total}] {entry.get("mikrotik") or "—":<15} {addr:<40} {status}', flush=True)

results.sort(key=lambda e: (e.get('client_id') is None, e.get('client_id') or 0))

payload = {
    'generated_at': datetime.datetime.now().isoformat(timespec='seconds'),
    'total': len(results),
    'ok': sum(1 for e in results if not e['error']),
    'clients': results,
}

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f'\nГотово. Записано в {OUTPUT_PATH} (на хосте: backend/kassa_ips.json)', flush=True)
print(f'Обработано: {payload["total"]}/{total}, успешно опрошено: {payload["ok"]}', flush=True)
