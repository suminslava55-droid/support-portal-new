"""
Опрос IP-адресов касс по всем клиентам через Микротик (DHCP-аренды kassa1..kassa6).
Запуск (с хоста /opt/support-portal):
    docker compose exec -T backend python manage.py shell -c "exec(open('/app/kassa_ips_dump.py').read())"
Результат: /app/kassa_ips.json  ->  на хосте backend/kassa_ips.json
"""
import json
import re
import datetime
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

settings_obj = SystemSettings.get()
if not settings_obj.ssh_user or not settings_obj.ssh_password_encrypted:
    raise SystemExit('SSH пользователь/пароль не заданы в настройках системы')

ssh_user = settings_obj.ssh_user
ssh_password = settings_obj.ssh_password


def probe(client):
    mikrotik_ip = (client.mikrotik_ip or '').strip()
    entry = {
        'client_id': client.id,
        'client': client.display_name,
        'address': mikrotik_ip,
        'server': (client.server_ip or '').strip(),
        'subnet': client.subnet or '',
        'cr': {},
        'error': None,
    }

    if not mikrotik_ip:
        entry['error'] = 'Микротик IP не задан (нет подсети)'
        return entry

    if not ping_ip(mikrotik_ip):
        entry['error'] = f'Микротик {mikrotik_ip} недоступен'
        return entry

    try:
        ssh = _make_ssh_client(mikrotik_ip)
        ssh.connect(mikrotik_ip, username=ssh_user, password=ssh_password,
                    timeout=10, port=22)
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
    return entry


clients = list(Client.objects.all())
print(f'Клиентов для опроса: {len(clients)}')

results = []
with ThreadPoolExecutor(max_workers=10) as pool:
    futures = {pool.submit(probe, c): c for c in clients}
    for i, fut in enumerate(as_completed(futures), 1):
        entry = fut.result()
        results.append(entry)
        status = entry['error'] or 'OK'
        print(f'[{i}/{len(clients)}] {entry["address"] or "—"}  {entry["client"][:40]}  {status}')

results.sort(key=lambda e: e['client_id'])

payload = {
    'generated_at': datetime.datetime.now().isoformat(timespec='seconds'),
    'total': len(results),
    'ok': sum(1 for e in results if not e['error']),
    'clients': results,
}

with open(OUTPUT_PATH, 'w', encoding='utf-8') as f:
    json.dump(payload, f, ensure_ascii=False, indent=2)

print(f'\nГотово. Записано в {OUTPUT_PATH} (на хосте: backend/kassa_ips.json)')
print(f'Успешно опрошено: {payload["ok"]}/{payload["total"]}')
