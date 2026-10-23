"""
Вкладка «Сервер» → «Железо»: живой опрос сервера аптеки (server_ip) через WinRM
(WMI-fallback), как задания «Управления ПК аптек». Плата, процессор, ОС, память по слотам.
В БД не пишется.
"""
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrSysadmin
from apps.pcmgmt.executor import execute_on_target
from ..models import Client, SystemSettings

# Строки вида «ТИП|поле|поле…» — разбираются в _parse
HW_SCRIPT = r"""[Console]::OutputEncoding = [Text.Encoding]::UTF8
$ErrorActionPreference = 'SilentlyContinue'
$b = Get-CimInstance Win32_BaseBoard
$p = Get-CimInstance Win32_Processor | Select-Object -First 1
$o = Get-CimInstance Win32_OperatingSystem
$a = Get-CimInstance Win32_PhysicalMemoryArray
"BOARD|$($b.Manufacturer)|$($b.Product)"
"CPU|$($p.Name.Trim())|$($p.NumberOfCores)|$($p.NumberOfLogicalProcessors)"
"OS|$($o.Caption)|$($o.Version)|$($o.OSArchitecture)"
"SLOTS|$($a.MemoryDevices)|$([math]::Round($a.MaxCapacityEx / 1MB))"
Get-CimInstance Win32_PhysicalMemory | ForEach-Object {
  "RAM|$($_.DeviceLocator)|$($_.BankLabel)|$([math]::Round($_.Capacity / 1GB))|$($_.ConfiguredClockSpeed)|$($_.Manufacturer)|$($_.PartNumber.Trim())"
}
"""


def _int(v):
    try:
        return int(float(v))
    except (TypeError, ValueError):
        return None


def _parse(output):
    hw = {'board': None, 'cpu': None, 'os': None, 'slots_total': None, 'max_ram_gb': None, 'modules': []}
    for line in (output or '').splitlines():
        f = [x.strip() for x in line.strip().split('|')]
        kind = f[0] if f else ''
        if kind == 'BOARD' and len(f) >= 3:
            hw['board'] = {'manufacturer': f[1], 'product': f[2]}
        elif kind == 'CPU' and len(f) >= 4:
            hw['cpu'] = {'name': f[1], 'cores': _int(f[2]), 'threads': _int(f[3])}
        elif kind == 'OS' and len(f) >= 4:
            hw['os'] = {'caption': f[1], 'version': f[2], 'arch': f[3]}
        elif kind == 'SLOTS' and len(f) >= 3:
            hw['slots_total'] = _int(f[1])
            hw['max_ram_gb'] = _int(f[2])
        elif kind == 'RAM' and len(f) >= 7:
            hw['modules'].append({
                'slot': f[1], 'bank': f[2], 'size_gb': _int(f[3]), 'speed': _int(f[4]),
                'manufacturer': f[5], 'part_number': f[6],
            })
    hw['ram_total_gb'] = sum(m['size_gb'] or 0 for m in hw['modules'])
    return hw


class ClientServerHardwareView(APIView):
    """GET /api/clients/{pk}/server/hardware/ — железо сервера аптеки (живой опрос, обычно 2–5 с, бывает до 20)."""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def get(self, request, pk=None):
        try:
            client = Client.objects.get(pk=pk)
        except Client.DoesNotExist:
            return Response({'error': 'Клиент не найден'}, status=404)
        ip = client.server_ip
        if not ip:
            return Response({'error': 'У клиента не задана подсеть — IP сервера неизвестен'}, status=400)
        s = SystemSettings.get()
        if not s.winrm_user or not s.winrm_password:
            return Response({'error': 'Не задана УЗ Windows (Настройки → Учётные записи)'}, status=400)

        res = execute_on_target({
            'target_id': 0, 'ip': ip, 'job_type': 'run_script', 'kind': 'powershell',
            'script': HW_SCRIPT, 'local_file': None, 'dest_path': None,
            'win_user': s.winrm_user, 'win_pwd': s.winrm_password,
        })
        if res['status'] != 'success':
            return Response({'error': f"Сервер {ip}: {res['message'] or res['status']}"}, status=502)
        hw = _parse(res['message'])
        if not hw['board'] and not hw['cpu']:
            return Response({'error': f'Сервер {ip} ответил, но данные не разобраны'}, status=502)
        hw.update({'ip': ip, 'transport': res['transport']})
        return Response(hw)
