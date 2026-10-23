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
