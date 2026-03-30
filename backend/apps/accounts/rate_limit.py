"""
Rate limiting для защиты от брутфорса логина.
Хранит счётчики в памяти процесса — без Redis, без зависимостей.

Параметры:
  MAX_ATTEMPTS = 5   — максимум попыток
  WINDOW_SEC   = 900 — окно 15 минут
  BLOCK_SEC    = 900 — блок 15 минут после превышения
"""

import threading
import time

MAX_ATTEMPTS = 5    # попыток за окно
WINDOW_SEC   = 900  # 15 минут — окно подсчёта
BLOCK_SEC    = 900  # 15 минут — длительность блока

# Структура: { ip: {'attempts': [...timestamps], 'blocked_until': float} }
_store = {}
_lock  = threading.Lock()


def _get_ip(request):
    """Извлекает реальный IP с учётом Nginx proxy."""
    xff = request.META.get('HTTP_X_FORWARDED_FOR')
    if xff:
        return xff.split(',')[0].strip()
    return request.META.get('REMOTE_ADDR', '0.0.0.0')


def is_blocked(request):
    """
    Возвращает (blocked: bool, retry_after_sec: int).
    blocked=True если IP превысил лимит попыток.
    """
    ip  = _get_ip(request)
    now = time.time()

    with _lock:
        rec = _store.get(ip)
        if not rec:
            return False, 0

        # Проверяем активный блок
        blocked_until = rec.get('blocked_until', 0)
        if blocked_until > now:
            return True, int(blocked_until - now)

        # Убираем устаревшие попытки за пределами окна
        rec['attempts'] = [t for t in rec['attempts'] if now - t < WINDOW_SEC]

        if len(rec['attempts']) >= MAX_ATTEMPTS:
            rec['blocked_until'] = now + BLOCK_SEC
            return True, BLOCK_SEC

    return False, 0


def record_failure(request):
    """Записывает неудачную попытку логина."""
    ip  = _get_ip(request)
    now = time.time()

    with _lock:
        if ip not in _store:
            _store[ip] = {'attempts': [], 'blocked_until': 0}
        _store[ip]['attempts'].append(now)


def reset(request):
    """Сбрасывает счётчик после успешного логина."""
    ip = _get_ip(request)
    with _lock:
        _store.pop(ip, None)


def cleanup():
    """Удаляет устаревшие записи — вызывается периодически."""
    now = time.time()
    with _lock:
        stale = [
            ip for ip, rec in _store.items()
            if rec.get('blocked_until', 0) < now
            and all(now - t > WINDOW_SEC for t in rec.get('attempts', []))
        ]
        for ip in stale:
            del _store[ip]
