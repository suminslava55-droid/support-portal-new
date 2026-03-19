from rest_framework import viewsets
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from ..models import Client, KktData, Provider, OfdCompany, ClientActivity, SystemSettings
from ..serializers import ProviderSerializer, OfdCompanySerializer, OfdCompanyWriteSerializer
from apps.accounts.permissions import CanEditClient
from .utils import ping_ip



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
            ssh = paramiko.SSHClient()
            ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
            ssh.connect(
                mikrotik_ip,
                username=settings_obj.ssh_user,
                password=settings_obj.ssh_password,
                timeout=10, port=22
            )
            cmd = ':put ([/tool fetch url="https://api.ipify.org" http-method=get output=user as-value]->"data")'
            stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
            new_ip = stdout.read().decode().strip()
            ssh.close()

            if not new_ip:
                return Response({'error': 'Не удалось получить внешний IP с Микротика'}, status=400)

            return Response({
                'new_ip': new_ip,
                'old_ip': old_external_ip,
                'changed': new_ip != old_external_ip,
            })
        except paramiko.AuthenticationException:
            return Response({'error': f'Ошибка аутентификации SSH на {mikrotik_ip}'}, status=400)
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
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated, CanEditClient]



class DashboardStatsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from django.db.models import Count
        from django.utils import timezone
        from datetime import timedelta

        clients = Client.objects.filter(is_draft=False)
        now = timezone.now()
        month_ago = now - timedelta(days=30)
        week_ago = now - timedelta(days=7)

        total = clients.count()
        active = clients.filter(status='active').count()
        inactive = clients.filter(status='inactive').count()
        new_month = clients.filter(created_at__gte=month_ago).count()
        new_week = clients.filter(created_at__gte=week_ago).count()

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

        conn_labels = {
            'fiber': 'Оптоволокно', 'dsl': 'DSL', 'cable': 'Кабель',
            'wireless': 'Беспроводное', 'modem': 'Модем', 'mrnet': 'MR-Net',
        }
        by_connection = list(
            clients.filter(connection_type__isnull=False)
            .exclude(connection_type='')
            .values('connection_type')
            .annotate(count=Count('id'))
            .order_by('-count')
        )
        by_connection_data = [
            {'name': conn_labels.get(r['connection_type'], r['connection_type']), 'value': r['count']}
            for r in by_connection
        ]

        monthly = []
        for i in range(5, -1, -1):
            d = now - timedelta(days=30 * i)
            month_start = d.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            if i > 0:
                next_month = (d + timedelta(days=32)).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
            else:
                next_month = now
            cnt = clients.filter(created_at__gte=month_start, created_at__lt=next_month).count()
            month_names = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн',
                            'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']
            monthly.append({'month': month_names[month_start.month - 1], 'count': cnt})

        recent_activities = []
        for a in ClientActivity.objects.select_related('user', 'client').order_by('-created_at')[:10]:
            recent_activities.append({
                'id': a.id,
                'action': a.action,
                'user_name': a.user.full_name or a.user.username if a.user else '—',
                'client_id': a.client_id,
                'client_name': a.client.address or a.client.company or f'Клиент #{a.client_id}',
                'created_at': a.created_at.isoformat(),
            })

        return Response({
            'total': total,
            'active': active,
            'inactive': inactive,
            'new_month': new_month,
            'new_week': new_week,
            'by_provider': by_provider_data,
            'by_connection': by_connection_data,
            'monthly': monthly,
            'recent_activities': recent_activities,
        })
