"""
Клиент Zabbix API (JSON-RPC, токен Bearer) и расчёт отчёта «Проблемки» —
пропадания связи аптеки по триггеру из настроек (по умолчанию [NET] NO PING IN VPN).

Узел Zabbix ищется по host = Код аптеки (UT) клиента.
Если имя Zabbix не резолвится (тестовый сервер), в настройках задаётся IP: запрос идёт
на IP, а имя из URL передаётся в Host и SNI — сертификат проверяется по имени.
"""
from datetime import datetime, time as dtime, timedelta, timezone as dt_timezone
from urllib.parse import urlsplit

import requests
from requests.adapters import HTTPAdapter

TIMEOUT = 20
# Насколько назад искать начало пропадания, которое ещё длилось в начале периода
LOOKBACK_DAYS = 90


class ZabbixError(Exception):
    """Ошибка с понятным пользователю текстом."""


class _SniAdapter(HTTPAdapter):
    """Подключение по IP с проверкой сертификата и SNI по имени хоста."""

    def __init__(self, hostname, **kwargs):
        self._hostname = hostname
        super().__init__(**kwargs)

    def init_poolmanager(self, *args, **kwargs):
        kwargs['server_hostname'] = self._hostname
        kwargs['assert_hostname'] = self._hostname
        super().init_poolmanager(*args, **kwargs)


class ZabbixClient:
    def __init__(self, settings):
        url = (settings.zabbix_url or '').strip().rstrip('/')
        token = settings.zabbix_token if settings.zabbix_token_encrypted else ''
        if not url or not token:
            raise ZabbixError('Zabbix не настроен (Настройки → Учётные записи → Zabbix)')
        if url.endswith('/api_jsonrpc.php'):
            url = url[:-len('/api_jsonrpc.php')]

        parts = urlsplit(url)
        self.hostname = parts.hostname
        self.token = token
        self.session = requests.Session()
        self.headers = {'Content-Type': 'application/json-rpc'}

        ip = (settings.zabbix_ip or '').strip()
        if ip:
            port = f':{parts.port}' if parts.port else ''
            base = f'{parts.scheme}://{ip}{port}'
            self.session.mount(base, _SniAdapter(self.hostname))
            self.headers['Host'] = self.hostname
            self.endpoint = f'{base}{parts.path}/api_jsonrpc.php'
        else:
            self.endpoint = f'{url}/api_jsonrpc.php'

    def call(self, method, params, auth=True):
        headers = dict(self.headers)
        if auth:
            headers['Authorization'] = f'Bearer {self.token}'
        body = {'jsonrpc': '2.0', 'method': method, 'params': params, 'id': 1}
        try:
            resp = self.session.post(self.endpoint, json=body, headers=headers, timeout=TIMEOUT)
            resp.raise_for_status()
            data = resp.json()
        except requests.exceptions.SSLError as e:
            raise ZabbixError(f'Zabbix: ошибка сертификата ({e.__class__.__name__})')
        except requests.exceptions.RequestException as e:
            raise ZabbixError(f'Zabbix недоступен: {e.__class__.__name__}')
        except ValueError:
            raise ZabbixError('Zabbix вернул не JSON — проверьте URL')
        if 'error' in data:
            err = data['error']
            raise ZabbixError(f"Zabbix: {err.get('data') or err.get('message')}")
        return data['result']

    def test(self):
        """Проверка подключения: версия + доступ токеном."""
        version = self.call('apiinfo.version', {}, auth=False)
        self.call('host.get', {'output': ['hostid'], 'limit': 1})
        return version


def local_tz(settings):
    return dt_timezone(timedelta(hours=settings.timezone_offset or 0))


def get_outages(settings, pharmacy_code, date_from, date_to):
    """
    Пропадания связи за период [date_from 00:00; date_to 23:59:59] в поясе из настроек.
    Пропадание, начавшееся до периода, но длившееся в нём, учитывается с обрезкой по границам.
    """
    pharmacy_code = (pharmacy_code or '').strip()
    if not pharmacy_code:
        raise ZabbixError('У клиента не задан Код аптеки (UT)')
    trigger_name = (settings.zabbix_trigger or '').strip() or '[NET] NO PING IN VPN'

    tz = local_tz(settings)
    now = datetime.now(tz).replace(microsecond=0)
    period_from = datetime.combine(date_from, dtime.min, tz)
    period_to = min(datetime.combine(date_to, dtime.max, tz), now)
    if period_to <= period_from:
        raise ZabbixError('Пустой период')
    ts_from, ts_to = int(period_from.timestamp()), int(period_to.timestamp())

    zbx = ZabbixClient(settings)
    hosts = zbx.call('host.get', {'filter': {'host': [pharmacy_code]}, 'output': ['hostid', 'host', 'name']})
    if not hosts:
        raise ZabbixError(f'Узел {pharmacy_code} не найден в Zabbix')
    host = hosts[0]

    triggers = zbx.call('trigger.get', {
        'hostids': [host['hostid']],
        'filter': {'description': trigger_name},
        'output': ['triggerid', 'description', 'value', 'lastchange'],
    })
    if not triggers:
        raise ZabbixError(f'На узле {pharmacy_code} нет триггера «{trigger_name}»')
    trigger = triggers[0]

    problems = zbx.call('event.get', {
        'objectids': [trigger['triggerid']],
        'source': 0, 'object': 0, 'value': 1,
        'time_from': ts_from - LOOKBACK_DAYS * 86400,
        'time_till': ts_to,
        'output': ['eventid', 'clock', 'r_eventid'],
        'sortfield': ['clock'], 'sortorder': 'ASC',
    })
    r_ids = [p['r_eventid'] for p in problems if p['r_eventid'] != '0']
    recoveries = {}
    if r_ids:
        for e in zbx.call('event.get', {'eventids': r_ids, 'output': ['eventid', 'clock']}):
            recoveries[e['eventid']] = int(e['clock'])

    now_ts = int(now.timestamp())
    items, total = [], 0
    for p in problems:
        start = int(p['clock'])
        end = recoveries.get(p['r_eventid'])
        if end is not None and end <= ts_from:
            continue  # закончилось до начала периода
        clipped_start = max(start, ts_from)
        clipped_end = min(end if end is not None else now_ts, ts_to)
        seconds = max(clipped_end - clipped_start, 0)
        total += seconds
        items.append({
            'start': datetime.fromtimestamp(start, tz).isoformat(),
            'end': datetime.fromtimestamp(end, tz).isoformat() if end is not None else None,
            'open': end is None,
            'started_before': start < ts_from,
            'duration_sec': seconds,
        })
    items.reverse()  # свежие пропадания — первыми

    period_sec = ts_to - ts_from
    return {
        'host': host['host'],
        'host_name': host['name'],
        'trigger': trigger['description'],
        'current_problem': trigger['value'] == '1',
        'period': {'from': period_from.isoformat(), 'to': period_to.isoformat()},
        'items': items,
        'total_count': len(items),
        'total_sec': total,
        'percent': round(total / period_sec * 100, 2) if period_sec else 0,
    }


def format_duration(seconds):
    seconds = int(seconds)
    d, rem = divmod(seconds, 86400)
    h, rem = divmod(rem, 3600)
    m = rem // 60
    parts = ([f'{d} д'] if d else []) + ([f'{h} ч'] if h else []) + [f'{m} мин']
    return ' '.join(parts)


# ──────────────── Вкладка «Сервер»: здоровье сервера аптеки ────────────────

SEVERITY_NAMES = ['Не классифицировано', 'Информация', 'Предупреждение', 'Средняя', 'Высокая', 'Чрезвычайная']
DISK_FIELDS = ['modelname', 'disktype', 'lifetimeperc', 'temperature', 'powerondays', 'crcerror', 'reallocsector']
IPERF_RX = 'vfs.file.contents[C:\\rx.txt,utf8]'
IPERF_TX = 'vfs.file.contents[C:\\tx.txt,utf8]'
FLEET_CACHE_SEC = 3600
_fleet_cache = {'ts': 0, 'data': None}


def _find_host(zbx, pharmacy_code):
    pharmacy_code = (pharmacy_code or '').strip()
    if not pharmacy_code:
        raise ZabbixError('У клиента не задан Код аптеки (UT)')
    hosts = zbx.call('host.get', {'filter': {'host': [pharmacy_code]}, 'output': ['hostid', 'host', 'name']})
    if not hosts:
        raise ZabbixError(f'Узел {pharmacy_code} не найден в Zabbix')
    return hosts[0]


def _num(v):
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _median(values):
    values = sorted(v for v in values if v)
    return round(values[len(values) // 2], 1) if values else None


def _fleet_iperf(zbx):
    """Медиана iperf по всей сети — для сравнения; кэш на час."""
    now = datetime.now().timestamp()
    if _fleet_cache['data'] is None or now - _fleet_cache['ts'] > FLEET_CACHE_SEC:
        items = zbx.call('item.get', {'filter': {'key_': [IPERF_RX, IPERF_TX]}, 'output': ['key_', 'lastvalue']})
        _fleet_cache['data'] = {
            'rx': _median(_num(i['lastvalue']) for i in items if i['key_'] == IPERF_RX),
            'tx': _median(_num(i['lastvalue']) for i in items if i['key_'] == IPERF_TX),
        }
        _fleet_cache['ts'] = now
    return _fleet_cache['data']


def _problems(zbx, hostid):
    rows = zbx.call('problem.get', {
        'hostids': [hostid],
        'output': ['eventid', 'name', 'severity', 'clock', 'acknowledged'],
        'sortfield': ['eventid'], 'sortorder': 'DESC',
    })
    out = [{
        'name': p['name'],
        'severity': int(p['severity']),
        'severity_name': SEVERITY_NAMES[int(p['severity'])],
        'since': int(p['clock']),
        'acknowledged': p['acknowledged'] == '1',
    } for p in rows]
    out.sort(key=lambda p: (-p['severity'], -p['since']))
    return out


def zabbix_web_url(settings):
    url = (settings.zabbix_url or '').strip().rstrip('/')
    if url.endswith('/api_jsonrpc.php'):
        url = url[:-len('/api_jsonrpc.php')]
    return url


def get_problems_summary(settings, pharmacy_code):
    """Лёгкий запрос для бейджа: число активных проблем и максимальная важность."""
    zbx = ZabbixClient(settings)
    host = _find_host(zbx, pharmacy_code)
    problems = _problems(zbx, host['hostid'])
    return {
        'count': len(problems),
        'max_severity': max((p['severity'] for p in problems), default=None),
    }


def get_server_health(settings, pharmacy_code):
    """Метрики сервера аптеки + активные проблемы узла. Значения — как есть, с временем замера."""
    zbx = ZabbixClient(settings)
    host = _find_host(zbx, pharmacy_code)
    raw = zbx.call('item.get', {
        'hostids': [host['hostid']],
        'output': ['key_', 'lastvalue', 'lastclock'],
        'filter': {'status': 0},
    })
    items = {i['key_']: i for i in raw}

    def val(key, numeric=True):
        it = items.get(key)
        if not it or not it['lastclock'] or it['lastclock'] == '0':
            return None
        v = _num(it['lastvalue']) if numeric else it['lastvalue'].strip()
        return {'value': v, 'clock': int(it['lastclock'])}

    def disk(prefix):
        d = {f: val(f'{prefix}_{f}', numeric=f not in ('modelname', 'disktype')) for f in DISK_FIELDS}
        return d if any(d.values()) else None

    auth_key = next((k for k in items if k.startswith('icmpping[auth.')), None)
    base = zabbix_web_url(settings)
    return {
        'host': host['host'],
        'host_name': host['name'],
        'zabbix_link': f"{base}/zabbix.php?action=problem.view&filter_set=1&hostids%5B%5D={host['hostid']}" if base else None,
        'problems': _problems(zbx, host['hostid']),
        'uptime': val('system.uptime'),
        'ram_available': val('vm.memory.size[pavailable]'),
        'agent_ping': val('agent.ping'),
        'agent_version': val('agent.version', numeric=False),
        'disks': [{'title': title, **d} for title, d in
                  [('Системный диск', disk('osdrive')), ('Диск базы', disk('pgdbdrive'))] if d],
        'volumes': {
            'c_free': val('vfs.fs.size[C:,free]'),
            'd_free': val('vfs.fs.size[D:,free]'),
            'e_free': val('vfs.fs.size[E:,free]'),
            'e_used': val('vfs.fs.size[E:,used]'),
        },
        'iperf': {'rx': val(IPERF_RX), 'tx': val(IPERF_TX), 'fleet': _fleet_iperf(zbx)},
        'auth_ping': val(auth_key) if auth_key else None,
    }
