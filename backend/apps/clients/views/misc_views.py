from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Client, KktData, Provider, OfdCompany, ClientActivity, SystemSettings
from ..serializers import ProviderSerializer, OfdCompanySerializer, OfdCompanyWriteSerializer
from apps.accounts.permissions import CanEditClient
from .utils import ping_ip

KNOWN_HOSTS_FILE = '/opt/support-portal/known_hosts'


def _make_ssh_client(host):
    """
    Создаёт SSHClient с проверкой host key через known_hosts.
    При первом подключении — запоминает ключ (как ssh-keyscan).
    При повторных — проверяет что ключ не изменился (защита от MITM).
    """
    import paramiko, os
    ssh = paramiko.SSHClient()

    # Загружаем known_hosts если файл существует
    if os.path.exists(KNOWN_HOSTS_FILE):
        ssh.load_host_keys(KNOWN_HOSTS_FILE)

    # При первом подключении к хосту — запоминаем ключ
    # При повторном — RejectPolicy отклонит если ключ изменился
    known_hosts = ssh.get_host_keys()
    if host not in known_hosts:
        # Хост новый — доверяем первому подключению и сохраняем ключ
        ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    else:
        # Хост уже знаком — отклоняем если ключ изменился
        ssh.set_missing_host_key_policy(paramiko.RejectPolicy())

    return ssh


def _save_known_hosts(ssh):
    """Сохраняет known_hosts после подключения."""
    import os
    os.makedirs(os.path.dirname(KNOWN_HOSTS_FILE), exist_ok=True)
    ssh.save_host_keys(KNOWN_HOSTS_FILE)


class FetchExternalIPView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import paramiko
        mikrotik_ip = request.data.get('mikrotik_ip', '').strip()
        old_external_ip = request.data.get('old_external_ip', '').strip()

        if not mikrotik_ip:
            return Response({'error': 'Микротик IP не передан'}, status=400)

        settings_obj = SystemSettings.get()
        if not settings_obj.ssh_user:
            return Response({'error': 'SSH пользователь не задан в настройках системы'}, status=400)
        if not settings_obj.ssh_password_encrypted:
            return Response({'error': 'SSH пароль не задан в настройках системы'}, status=400)

        if not ping_ip(mikrotik_ip):
            return Response({'error': f'Микротик {mikrotik_ip} недоступен'}, status=400)

        try:
            ssh = _make_ssh_client(mikrotik_ip)
            ssh.connect(
                mikrotik_ip,
                username=settings_obj.ssh_user,
                password=settings_obj.ssh_password,
                timeout=10, port=22
            )
            _save_known_hosts(ssh)
            cmd = ':put ([/tool fetch url="https://api.ipify.org" http-method=get output=user as-value]->"data")'
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
            new_ip = stdout.read().decode().strip()
            ssh.close()

            if not new_ip:
                return Response({'error': 'Не удалось получить внешний IP с Микротика'}, status=400)

            import re
            if not re.match(r'^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$', new_ip):
                return Response({'error': f'Микротик вернул неверный ответ: {new_ip}'}, status=400)

            return Response({
                'new_ip': new_ip,
                'old_ip': old_external_ip,
                'changed': new_ip != old_external_ip,
            })
        except paramiko.AuthenticationException:
            return Response({'error': f'Ошибка аутентификации SSH на {mikrotik_ip}'}, status=400)
        except paramiko.SSHException as e:
            err_str = str(e)
            if 'not found in known_hosts' in err_str or 'changed' in err_str.lower():
                return Response({'error': (
                    f'SSH ключ Микротика {mikrotik_ip} изменился — возможно Микротик был заменён. '
                    f'Удалите старую запись из /opt/support-portal/known_hosts и повторите попытку.'
                )}, status=400)
            return Response({'error': f'SSH ошибка {mikrotik_ip}: {err_str}'}, status=400)
        except Exception as e:
            return Response({'error': f'Ошибка подключения к {mikrotik_ip}: {str(e)}'}, status=400)


class OfdCompanyViewSet(viewsets.ModelViewSet):
    queryset = OfdCompany.objects.all()

    def get_permissions(self):
        if self.action in ('create', 'update', 'partial_update', 'destroy'):
            return [IsAuthenticated(), CanEditClient()]
        return [IsAuthenticated()]

    def get_serializer_class(self):
        if self.action in ('create', 'update', 'partial_update'):
            return OfdCompanyWriteSerializer
        return OfdCompanySerializer





class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all().order_by("name")
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated, CanEditClient]

    pagination_class = None


class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta, date
        import os

        clients = Client.objects.filter(is_draft=False)
        now = timezone.now()
        today = now.date()
        month_ago = now - timedelta(days=30)

        total = clients.count()
        active = clients.filter(status='active').count()
        inactive = clients.filter(status='inactive').count()
        new_month = clients.filter(created_at__gte=month_ago).count()

        by_provider = list(
            clients.filter(provider__isnull=False)
            .values('provider__name')
            .annotate(count=Count('id'))
            .order_by('-count')[:8]
        )
        by_provider_data = [{'name': r['provider__name'], 'value': r['count']} for r in by_provider]
        no_provider = clients.filter(provider__isnull=True).count()
        if no_provider > 0:
            by_provider_data.append({'name': 'Без провайдера', 'value': no_provider})

        # ── ФН статистика ──────────────────────────────────────
        from ..models import KktData
        from django.db.models import Q
        import calendar as cal_mod

        fn_expired = KktData.objects.filter(
            client__is_draft=False,
            fn_end_date__isnull=False,
            fn_end_date__lt=now,
        ).count()

        this_month_start = today.replace(day=1)
        this_month_end = today.replace(day=cal_mod.monthrange(today.year, today.month)[1])
        fn_this_month = KktData.objects.filter(
            client__is_draft=False,
            fn_end_date__date__gte=this_month_start,
            fn_end_date__date__lte=this_month_end,
        ).count()

        if today.month == 12:
            next_month_start = date(today.year + 1, 1, 1)
            next_month_end = date(today.year + 1, 1, 31)
        else:
            next_month_start = date(today.year, today.month + 1, 1)
            next_month_end = date(today.year, today.month + 1,
                                  cal_mod.monthrange(today.year, today.month + 1)[1])

        fn_next_month = KktData.objects.filter(
            client__is_draft=False,
            fn_end_date__date__gte=next_month_start,
            fn_end_date__date__lte=next_month_end,
        ).count()

        # Ближайшие замены ФН
        fn_nearest = []
        for kkt in KktData.objects.filter(
            client__is_draft=False,
            fn_end_date__isnull=False,
            fn_end_date__gte=now,
        ).select_related('client').order_by('fn_end_date')[:5]:
            diff = (kkt.fn_end_date.date() - today).days
            fn_nearest.append({
                'client_id': kkt.client_id,
                'address': kkt.client.address or kkt.client.company or f'Клиент #{kkt.client_id}',
                'fn_end_date': kkt.fn_end_date.strftime('%d.%m.%Y'),
                'days_left': diff,
            })

        # ── Регламентные задания ───────────────────────────────
        from ..models import ScheduledTask
        tasks_data = []
        for t in ScheduledTask.objects.exclude(task_id='restore_backup').order_by('task_id'):
            tasks_data.append({
                'task_id': t.task_id,
                'name': t.name,
                'status': t.status,
                'last_run_at': t.last_run_at.isoformat() if t.last_run_at else None,
                'last_run_result': (t.last_run_result or '')[:200],
            })

        # ── Бэкапы ────────────────────────────────────────────
        BACKUP_DIR = '/opt/support-portal/backups'
        backup_info = {'last_backup': None, 'size_str': None, 'count': 0}
        if os.path.exists(BACKUP_DIR):
            files = sorted([
                f for f in os.listdir(BACKUP_DIR)
                if f.startswith('backup_') and f.endswith('.tar.gz')
            ], reverse=True)
            backup_info['count'] = len(files)
            if files:
                fpath = os.path.join(BACKUP_DIR, files[0])
                import stat as stat_mod
                mtime = os.stat(fpath).st_mtime
                from datetime import datetime
                backup_info['last_backup'] = datetime.fromtimestamp(mtime).strftime('%d.%m.%Y %H:%M')
                size = os.path.getsize(fpath)
                if size >= 1024 ** 2:
                    backup_info['size_str'] = f'{size / 1024 ** 2:.1f} МБ'
                elif size >= 1024:
                    backup_info['size_str'] = f'{size / 1024:.1f} КБ'
                else:
                    backup_info['size_str'] = f'{size} Б'

        # ── Дежурства сегодня и завтра ─────────────────────────
        from ..models import DutySchedule
        from django.contrib.auth import get_user_model
        User = get_user_model()

        DUTY_WORK_TYPES = {'phone', 'day', 'phone_day'}

        def get_duty(target_date):
            entries = DutySchedule.objects.filter(
                date=target_date,
                duty_type__in=DUTY_WORK_TYPES,
            ).select_related('user').exclude(user__email='scheduler@system.local')
            result = []
            for e in entries:
                u = e.user
                name = u.full_name if hasattr(u, 'full_name') and u.full_name else u.email
                initials = ''.join([p[0].upper() for p in name.split()[:2]]) if name else '?'
                result.append({
                    'user_id': u.id,
                    'name': name,
                    'initials': initials,
                    'duty_type': e.duty_type,
                })
            return result

        tomorrow = today + timedelta(days=1)
        duty_today = get_duty(today)
        duty_tomorrow = get_duty(tomorrow)

        # ── Последняя активность ───────────────────────────────
        recent_activities = []
        for a in ClientActivity.objects.select_related('user', 'client').order_by('-created_at')[:10]:
            recent_activities.append({
                'id': a.id,
                'action': a.action,
                'user_name': a.user.full_name or a.user.email if a.user else '—',
                'client_id': a.client_id,
                'client_name': a.client.address or a.client.company or f'Клиент #{a.client_id}',
                'created_at': a.created_at.isoformat(),
            })

        return Response({
            'total': total,
            'active': active,
            'inactive': inactive,
            'new_month': new_month,
            'by_provider': by_provider_data,
            'fn_expired': fn_expired,
            'fn_this_month': fn_this_month,
            'fn_next_month': fn_next_month,
            'fn_this_month_name': this_month_start.strftime('%B %Y'),
            'fn_next_month_name': next_month_start.strftime('%B %Y'),
            'fn_nearest': fn_nearest,
            'tasks': tasks_data,
            'backup': backup_info,
            'duty_today': duty_today,
            'duty_tomorrow': duty_tomorrow,
            'today_str': today.strftime('%d %B, %A'),
            'tomorrow_str': tomorrow.strftime('%d %B, %A'),
            'recent_activities': recent_activities,
        })

