"""
Движок удалённого выполнения заданий на ПК аптек.

Транспорты:
  * Копирование файлов  — SMB (impacket), охват ~99%.
  * Выполнение скриптов — WinRM (pywinrm/NTLM) если порт 5985 открыт,
    иначе WMI (impacket DCOM Win32_Process.Create + чтение вывода по SMB).

Все функции транспорта — чистый сетевой ввод-вывод (без ORM); их можно
безопасно вызывать из пула потоков. ORM-операции выполняет только run_job
в своём единственном фоновом потоке.
"""
import os
import re
import time
import socket
import uuid
import datetime
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

import paramiko

logger = logging.getLogger(__name__)

WINRM_PORT = 5985
SMB_PORT = 445
MAX_WORKERS = 25
WINRM_READ_TIMEOUT = 70
WINRM_OP_TIMEOUT = 60
WMI_LOG_WAIT = 90  # сек ожидания появления лог-файла

KASSA_CMD = (
    ':foreach i in={"kassa1";"kassa2";"kassa3";"kassa4";"kassa5";"kassa6"} do={'
    ':local l [/ip dhcp-server lease find where host-name=$i]; '
    ':if ($l!="") do={:put "$i -> $[/ip dhcp-server lease get $l address]"} '
    'else={:put "$i -> not found"}}'
)


# ---------------------------------------------------------------------------
# Вспомогательные
# ---------------------------------------------------------------------------
def _decode(b):
    if not b:
        return ''
    if isinstance(b, str):
        return b
    for enc in ('utf-8', 'cp866', 'cp1251'):
        try:
            s = b.decode(enc)
            if '�' not in s:
                return s
        except Exception:
            pass
    return b.decode('utf-8', errors='replace')


def port_open(ip, port=WINRM_PORT, timeout=3):
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        s.settimeout(timeout)
        rc = s.connect_ex((ip, port))
        s.close()
        return rc == 0
    except Exception:
        return False


def _parse_dest(dest_path, filename):
    """C:\\Temp\\  ->  (share='C$', remote_dir='Temp', remote_path='Temp\\file')."""
    dest_path = (dest_path or '').strip().replace('/', '\\')
    if not dest_path:
        dest_path = 'C:\\Temp\\'
    drive = dest_path[0].upper()
    share = f'{drive}$'
    rest = dest_path[2:].lstrip('\\')
    # если путь похож на каталог (заканчивается \ или без расширения) — добавляем имя файла
    if dest_path.endswith('\\') or '.' not in os.path.basename(rest):
        remote_dir = rest.rstrip('\\')
        remote_path = (remote_dir + '\\' + filename) if remote_dir else filename
    else:
        remote_dir = os.path.dirname(rest)
        remote_path = rest
    return share, remote_dir, remote_path


# ---------------------------------------------------------------------------
# SMB
# ---------------------------------------------------------------------------
def _smb_connect(ip, user, pwd):
    from impacket.smbconnection import SMBConnection
    conn = SMBConnection(ip, ip, timeout=15)
    conn.login(user, pwd)
    return conn


def copy_via_smb(ip, user, pwd, local_path, dest_path):
    """Копирует локальный файл на удалённый ПК по SMB. Возвращает (ok, message)."""
    filename = os.path.basename(local_path)
    share, remote_dir, remote_path = _parse_dest(dest_path, filename)
    conn = None
    try:
        conn = _smb_connect(ip, user, pwd)
        # создаём промежуточные каталоги (best-effort)
        if remote_dir:
            acc = ''
            for part in remote_dir.split('\\'):
                if not part:
                    continue
                acc = (acc + '\\' + part) if acc else part
                try:
                    conn.createDirectory(share, acc)
                except Exception:
                    pass
        with open(local_path, 'rb') as fh:
            conn.putFile(share, remote_path, fh.read)
        return True, f'Скопировано в {dest_path}'
    except Exception as e:
        return False, f'SMB ошибка: {e}'
    finally:
        if conn:
            try:
                conn.logoff()
            except Exception:
                pass


def _smb_upload_bytes(ip, user, pwd, share, remote_path, data):
    from io import BytesIO
    conn = _smb_connect(ip, user, pwd)
    try:
        bio = BytesIO(data)
        conn.putFile(share, remote_path, bio.read)
    finally:
        try:
            conn.logoff()
        except Exception:
            pass


def _smb_wait_read(ip, user, pwd, share, remote_path, timeout=WMI_LOG_WAIT):
    from io import BytesIO
    deadline = time.time() + timeout
    last_err = 'лог не появился'
    while time.time() < deadline:
        conn = None
        try:
            conn = _smb_connect(ip, user, pwd)
            buf = BytesIO()
            conn.getFile(share, remote_path, buf.write)
            return buf.getvalue()
        except Exception as e:
            last_err = str(e)
        finally:
            if conn:
                try:
                    conn.logoff()
                except Exception:
                    pass
        time.sleep(3)
    raise TimeoutError(last_err)


def _smb_delete(ip, user, pwd, share, *remote_paths):
    conn = None
    try:
        conn = _smb_connect(ip, user, pwd)
        for p in remote_paths:
            try:
                conn.deleteFile(share, p)
            except Exception:
                pass
    except Exception:
        pass
    finally:
        if conn:
            try:
                conn.logoff()
            except Exception:
                pass


# ---------------------------------------------------------------------------
# WinRM
# ---------------------------------------------------------------------------
def run_via_winrm(ip, user, pwd, script, kind):
    """Возвращает (exit_code, output)."""
    import winrm
    sess = winrm.Session(
        f'http://{ip}:{WINRM_PORT}/wsman',
        auth=(user, pwd), transport='ntlm',
        read_timeout_sec=WINRM_READ_TIMEOUT, operation_timeout_sec=WINRM_OP_TIMEOUT,
    )
    if kind == 'cmd':
        oneliner = ' & '.join(l.strip() for l in script.splitlines() if l.strip())
        r = sess.run_cmd(oneliner)
    else:
        r = sess.run_ps(script)
    out = _decode(r.std_out)
    err = _decode(r.std_err)
    if err and 'CLIXML' not in err:
        out = (out + '\n' + err).strip()
    return r.status_code, out


# ---------------------------------------------------------------------------
# WMI (fallback, через impacket DCOM)
# ---------------------------------------------------------------------------
def _wmi_create(ip, user, pwd, command):
    from impacket.dcerpc.v5.dcomrt import DCOMConnection
    from impacket.dcerpc.v5.dcom import wmi
    from impacket.dcerpc.v5.dtypes import NULL
    dcom = DCOMConnection(ip, username=user, password=pwd)
    try:
        iInterface = dcom.CoCreateInstanceEx(wmi.CLSID_WbemLevel1Login, wmi.IID_IWbemLevel1Login)
        iLogin = wmi.IWbemLevel1Login(iInterface)
        iServices = iLogin.NTLMLogin('//./root/cimv2', NULL, NULL)
        iLogin.RemRelease()
        win32Process, _ = iServices.GetObject('Win32_Process')
        win32Process.Create(command, r'C:\Windows\Temp', None)
    finally:
        try:
            dcom.disconnect()
        except Exception:
            pass


def run_via_wmi(ip, user, pwd, script, kind):
    """Возвращает (exit_code, output)."""
    uid = uuid.uuid4().hex
    log_name = f'{uid}.log'
    log_path = f'C:\\Windows\\Temp\\{log_name}'
    if kind == 'cmd':
        script_name = f'{uid}.cmd'
        crlf = '\r\n'.join(script.splitlines())
        _smb_upload_bytes(ip, user, pwd, 'ADMIN$', f'Temp\\{script_name}',
                          ('@echo off\r\n' + crlf + '\r\n').encode('cp866', errors='replace'))
        inner = f'C:\\Windows\\Temp\\{script_name}'
    else:
        script_name = f'{uid}.ps1'
        _smb_upload_bytes(ip, user, pwd, 'ADMIN$', f'Temp\\{script_name}',
                          script.encode('utf-8-sig'))
        inner = f'powershell -NoProfile -ExecutionPolicy Bypass -File C:\\Windows\\Temp\\{script_name}'
    wrapper = f'cmd.exe /v:on /c "({inner}) > {log_path} 2>&1 & echo __EXIT__!ERRORLEVEL! >> {log_path}"'

    _wmi_create(ip, user, pwd, wrapper)
    try:
        raw = _smb_wait_read(ip, user, pwd, 'ADMIN$', f'Temp\\{log_name}')
        text = _decode(raw)
    finally:
        _smb_delete(ip, user, pwd, 'ADMIN$', f'Temp\\{script_name}', f'Temp\\{log_name}')

    exit_code = None
    m = re.search(r'__EXIT__(-?\d+)', text)
    if m:
        exit_code = int(m.group(1))
        text = text[:m.start()].rstrip()
    return exit_code, text


# ---------------------------------------------------------------------------
# Опрос Микротика за IP касс (paramiko, SSH-креды Микротика)
# ---------------------------------------------------------------------------
def fetch_kassa_ips(mikrotik_ip, ssh_user, ssh_pwd):
    """Возвращает {'kassa1': ip|None, ...} или {} при ошибке."""
    if not mikrotik_ip:
        return {}
    try:
        ssh = paramiko.SSHClient()
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
        ssh.connect(mikrotik_ip, username=ssh_user, password=ssh_pwd,
                    timeout=10, port=22, look_for_keys=False, allow_agent=False)
        _, stdout, _ = ssh.exec_command(KASSA_CMD, timeout=15)
        output = stdout.read().decode('utf-8', errors='replace')
        ssh.close()
    except Exception as e:
        logger.warning('Микротик %s: %s', mikrotik_ip, e)
        return {}
    result = {}
    for line in output.splitlines():
        m = re.match(r'^(kassa\d+)\s*->\s*(.+)$', line.strip())
        if m:
            name, value = m.group(1), m.group(2).strip()
            result[name] = None if value == 'not found' else value
    return result


# ---------------------------------------------------------------------------
# Выполнение на одной цели (чистый сетевой I/O, без ORM)
# ---------------------------------------------------------------------------
def execute_on_target(spec):
    """
    spec: dict с ключами target_id, ip, job_type, kind, script, local_file,
          dest_path, win_user, win_pwd.
    Возвращает dict с результатом для записи в БД вызывающим потоком.
    """
    ip = spec['ip']
    res = {'target_id': spec['target_id'], 'transport': '', 'exit_code': None,
           'status': '', 'message': ''}

    if not ip:
        res['status'] = 'unreachable'
        res['message'] = 'IP не определён'
        return res

    try:
        if spec['job_type'] == 'copy_file':
            res['transport'] = 'smb'
            if not port_open(ip, SMB_PORT):
                res['status'] = 'unreachable'
                res['message'] = 'Порт 445 (SMB) закрыт'
                return res
            ok, msg = copy_via_smb(ip, spec['win_user'], spec['win_pwd'],
                                   spec['local_file'], spec['dest_path'])
            res['status'] = 'success' if ok else 'error'
            res['message'] = msg
            return res

        # run_script
        if port_open(ip, WINRM_PORT):
            res['transport'] = 'winrm'
            code, out = run_via_winrm(ip, spec['win_user'], spec['win_pwd'],
                                      spec['script'], spec['kind'])
        elif port_open(ip, SMB_PORT):
            res['transport'] = 'wmi'
            code, out = run_via_wmi(ip, spec['win_user'], spec['win_pwd'],
                                    spec['script'], spec['kind'])
        else:
            res['status'] = 'unreachable'
            res['message'] = 'Порты 5985 и 445 закрыты'
            return res
        res['exit_code'] = code
        res['message'] = out or ''
        res['status'] = 'success' if (code in (0, None)) else 'error'
        return res
    except Exception as e:
        res['status'] = 'error'
        res['message'] = f'{type(e).__name__}: {e}'
        return res


# ---------------------------------------------------------------------------
# Оркестрация задания (единственный фоновый поток, здесь — весь ORM)
# ---------------------------------------------------------------------------
def run_job(job_id):
    from django.utils import timezone
    from django.db import close_old_connections
    from apps.clients.models import Client, SystemSettings
    from .models import PcJob, PcJobTarget

    close_old_connections()
    try:
        job = PcJob.objects.get(id=job_id)
    except PcJob.DoesNotExist:
        return

    s = SystemSettings.get()
    win_user = s.winrm_user
    win_pwd = s.winrm_password
    ssh_user = s.ssh_user
    ssh_pwd = s.ssh_password

    job.status = PcJob.STATUS_RUNNING
    job.save(update_fields=['status'])

    if not win_user or not win_pwd:
        job.status = PcJob.STATUS_ERROR
        job.error_message = ('Не задана УЗ Windows. Заполните её в '
                             'Настройки → Учётные записи → «УЗ для подключения к ПК аптек».')
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'error_message', 'finished_at'])
        return

    mode = job.target_mode
    want_server = mode in (PcJob.MODE_SERVER, PcJob.MODE_BOTH)
    want_kassa = mode in (PcJob.MODE_KASSA, PcJob.MODE_BOTH)

    # При повторе — собираем уже успешно выполненные (client_id, role)
    # по всей цепочке исходных заданий, чтобы не выполнять на них повторно.
    done_pairs = set()
    anc = job.repeat_of
    seen = set()
    while anc and anc.id not in seen:
        seen.add(anc.id)
        for cid, role in anc.targets.filter(status=PcJobTarget.STATUS_SUCCESS).values_list('client_id', 'role'):
            done_pairs.add((cid, role))
        anc = anc.repeat_of

    clients = list(Client.objects.filter(id__in=job.client_ids))

    # 1. Опрос Микротиков за IP касс (параллельно, без ORM)
    kassa_map = {}
    if want_kassa:
        to_probe = [(c.id, c.mikrotik_ip) for c in clients if c.mikrotik_ip]
        with ThreadPoolExecutor(max_workers=15) as pool:
            futs = {pool.submit(fetch_kassa_ips, mip, ssh_user, ssh_pwd): cid
                    for cid, mip in to_probe}
            for fut in as_completed(futs):
                kassa_map[futs[fut]] = fut.result() or {}

    # 2. Создаём строки целей (пропускаем те, где уже успешно выполнено при повторе)
    targets = []
    for c in clients:
        addr = c.address or ''
        if want_server and c.server_ip and (c.id, 'server') not in done_pairs:
            targets.append(PcJobTarget(job=job, client=c, client_address=addr,
                                       role='server', ip=c.server_ip))
        if want_kassa:
            for name, ip in (kassa_map.get(c.id) or {}).items():
                if ip and (c.id, name) not in done_pairs:
                    targets.append(PcJobTarget(job=job, client=c, client_address=addr,
                                               role=name, ip=ip))
    PcJobTarget.objects.bulk_create(targets)
    targets = list(job.targets.all())

    job.total_targets = len(targets)
    job.save(update_fields=['total_targets'])

    if not targets:
        job.status = PcJob.STATUS_DONE
        job.progress = 100
        if want_kassa and not want_server:
            job.error_message = ('Не найдено ни одной доступной кассы. Проверьте SSH-доступ '
                                 'к Микротику (Настройки → Учётные записи → SSH) и что кассы '
                                 'получили DHCP-аренды kassa1..6.')
        else:
            job.error_message = 'Нет целей: у выбранных клиентов не определились IP (нет подсети).'
        job.finished_at = timezone.now()
        job.save(update_fields=['status', 'progress', 'error_message', 'finished_at'])
        return

    local_file = job.file.path if (job.job_type == PcJob.TYPE_COPY and job.file) else None

    specs = []
    for t in targets:
        specs.append({
            'target_id': t.id, 'ip': t.ip,
            'job_type': job.job_type, 'kind': job.script_kind,
            'script': job.script_text, 'local_file': local_file,
            'dest_path': job.dest_path, 'win_user': win_user, 'win_pwd': win_pwd,
        })

    # 3. Выполняем (пул — чистый I/O; запись результатов — здесь, последовательно)
    done = ok = err = 0
    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futs = {pool.submit(execute_on_target, sp): sp['target_id'] for sp in specs}
        PcJobTarget.objects.filter(id__in=[s['target_id'] for s in specs]).update(
            status=PcJobTarget.STATUS_RUNNING, started_at=timezone.now())
        for fut in as_completed(futs):
            close_old_connections()
            r = fut.result()
            PcJobTarget.objects.filter(id=r['target_id']).update(
                status=r['status'], transport=r['transport'], exit_code=r['exit_code'],
                result_message=r['message'][:20000], finished_at=timezone.now())
            done += 1
            if r['status'] == 'success':
                ok += 1
            else:
                err += 1
            job.done_targets = done
            job.ok_targets = ok
            job.err_targets = err
            job.progress = int(done * 100 / len(targets))
            job.save(update_fields=['done_targets', 'ok_targets', 'err_targets', 'progress'])

            job.refresh_from_db(fields=['cancel_requested'])
            if job.cancel_requested:
                break

    close_old_connections()
    job.refresh_from_db(fields=['cancel_requested'])
    if job.cancel_requested:
        job.targets.filter(status=PcJobTarget.STATUS_PENDING).update(
            status=PcJobTarget.STATUS_SKIPPED)
        job.status = PcJob.STATUS_CANCELLED
    else:
        job.status = PcJob.STATUS_DONE
    job.finished_at = timezone.now()
    job.save(update_fields=['status', 'finished_at'])
