import subprocess
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Client, ClientNote, CustomFieldDefinition, ClientActivity, Provider, ClientFile, SystemSettings
from .serializers import (
    ClientListSerializer, ClientDetailSerializer, ClientWriteSerializer,
    ClientNoteSerializer, CustomFieldDefinitionSerializer, ProviderSerializer, ClientFileSerializer
)
from apps.accounts.permissions import CanEditClient, CanManageCustomFields, IsAdmin


FIELD_LABELS = {
    'last_name': 'Фамилия',
    'first_name': 'Имя',
    'middle_name': 'Отчество',
    'inn': 'ИНН',
    'phone': 'Телефон',
    'iccid': 'ICCID',
    'email': 'Email',
    'pharmacy_code': 'Код аптеки',
    'company': 'Компания',
    'address': 'Адрес',
    'status': 'Статус',
    'provider_id': 'Провайдер',
    'personal_account': 'Лицевой счёт',
    'contract_number': '№ договора',
    'provider_settings': 'Настройки провайдера',
    'subnet': 'Подсеть аптеки',
    'external_ip': 'Внешний IP',
    'connection_type': 'Тип подключения',
    'tariff': 'Тариф',
    'modem_number': 'Номер модема/SIM',
    'modem_iccid': 'ICCID модема',
    'provider_equipment': 'Оборудование провайдера',
    'provider2_id': 'Провайдер 2',
    'personal_account2': 'Лицевой счёт 2',
    'contract_number2': '№ договора 2',
    'tariff2': 'Тариф 2',
    'connection_type2': 'Тип подключения 2',
    'modem_number2': 'Номер модема/SIM 2',
    'modem_iccid2': 'ICCID модема 2',
    'provider_equipment2': 'Оборудование провайдера 2',
}

STATUS_LABELS = {'active': 'Активен', 'inactive': 'Неактивен'}


def ping_ip(ip, timeout=5):
    try:
        result = subprocess.run(
            ['ping', '-c', '1', '-W', str(timeout), '-i', '0.2', ip],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            timeout=timeout + 1
        )
        return result.returncode == 0
    except Exception:
        return False


def build_change_log(old_client, new_data, provider_map):
    changes = []
    for field, label in FIELD_LABELS.items():
        old_val = getattr(old_client, field, '') or ''
        new_val = new_data.get(field.replace('_id', ''), '') or ''

        if field == 'provider_id':
            new_val = new_data.get('provider', '') or ''
            if str(old_val) == str(new_val):
                continue
            old_name = provider_map.get(old_val, f'#{old_val}') if old_val else '—'
            new_name = provider_map.get(int(new_val), f'#{new_val}') if new_val else '—'
            changes.append(f'{label}: «{old_name}» → «{new_name}»')
            continue

        if field == 'status':
            old_val = STATUS_LABELS.get(str(old_val), old_val)
            new_val = STATUS_LABELS.get(str(new_val), new_val)

        if field == 'provider_equipment':
            old_val = 'Присутствует' if str(old_val) == 'True' else 'Отсутствует'
            new_bool = str(new_data.get('provider_equipment', '')).lower()
            new_val = 'Присутствует' if new_bool in ('true', '1', 'yes') else 'Отсутствует'

        if str(old_val) != str(new_val):
            old_display = str(old_val)[:50] + '...' if len(str(old_val)) > 50 else str(old_val) or '—'
            new_display = str(new_val)[:50] + '...' if len(str(new_val)) > 50 else str(new_val) or '—'
            changes.append(f'{label}: «{old_display}» → «{new_display}»')
    return changes


class CustomFieldDefinitionViewSet(viewsets.ModelViewSet):
    queryset = CustomFieldDefinition.objects.filter(is_active=True)
    serializer_class = CustomFieldDefinitionSerializer
    permission_classes = [IsAuthenticated, CanManageCustomFields]

    def get_permissions(self):
        if self.action in ('list', 'retrieve'):
            return [IsAuthenticated()]
        return super().get_permissions()


class ClientViewSet(viewsets.ModelViewSet):
    permission_classes = [IsAuthenticated, CanEditClient]
    filter_backends = [DjangoFilterBackend, SearchFilter, OrderingFilter]
    filterset_fields = ['status', 'provider']
    search_fields = ['company', 'address', 'phone', 'email', 'inn', 'pharmacy_code']
    ordering_fields = ['company', 'address', 'created_at']
    ordering = ['-created_at']

    def get_queryset(self):
        return Client.objects.select_related('created_by', 'provider').filter(is_draft=False)

    def get_object_including_draft(self):
        from django.shortcuts import get_object_or_404
        return get_object_or_404(Client, pk=self.kwargs['pk'])

    def get_object(self):
        if self.action in ('update', 'partial_update', 'ping', 'files', 'delete_file', 'discard_draft'):
            from django.shortcuts import get_object_or_404
            obj = get_object_or_404(Client, pk=self.kwargs['pk'])
            self.check_object_permissions(self.request, obj)
            return obj
        return super().get_object()

    def get_serializer_class(self):
        if self.action == 'list':
            return ClientListSerializer
        if self.action in ('create', 'update', 'partial_update'):
            return ClientWriteSerializer
        return ClientDetailSerializer

    def perform_create(self, serializer):
        client = serializer.save(created_by=self.request.user)
        ClientActivity.objects.create(
            client=client, user=self.request.user,
            action='Карточка клиента создана'
        )

    def perform_update(self, serializer):
        old = self.get_object()
        if old.is_draft:
            client = serializer.save(is_draft=False)
            ClientActivity.objects.create(
                client=client, user=self.request.user,
                action='Карточка клиента создана'
            )
            return
        provider_map = {p.id: p.name for p in Provider.objects.all()}
        changes = build_change_log(old, self.request.data, provider_map)
        client = serializer.save()
        if changes:
            action = 'Изменено: ' + ' | '.join(changes)
            if len(action) > 490:
                action = action[:490] + '...'
        else:
            action = 'Карточка обновлена'
        ClientActivity.objects.create(client=client, user=self.request.user, action=action)

    def destroy(self, request, *args, **kwargs):
        if not request.user.has_perm_flag('can_delete_client'):
            return Response({'detail': 'Недостаточно прав.'}, status=status.HTTP_403_FORBIDDEN)
        return super().destroy(request, *args, **kwargs)

    @action(detail=True, methods=['get', 'post'])
    def notes(self, request, pk=None):
        client = self.get_object()
        if request.method == 'GET':
            return Response(ClientNoteSerializer(client.notes.all(), many=True).data)
        serializer = ClientNoteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        note = serializer.save(client=client, author=request.user)
        ClientActivity.objects.create(client=client, user=request.user, action='Добавлена заметка')
        return Response(ClientNoteSerializer(note).data, status=status.HTTP_201_CREATED)

    @action(detail=False, methods=['get'], url_path='export_excel')
    def export_excel(self, request):
        import openpyxl
        from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
        from django.http import HttpResponse

        qs = Client.objects.select_related('provider').filter(is_draft=False)
        search = request.query_params.get('search', '').strip()
        status_filter = request.query_params.get('status', '').strip()
        if search:
            from django.db.models import Q
            qs = qs.filter(
                Q(company__icontains=search) | Q(address__icontains=search) |
                Q(phone__icontains=search) | Q(email__icontains=search) |
                Q(inn__icontains=search) | Q(pharmacy_code__icontains=search)
            )
        if status_filter:
            qs = qs.filter(status=status_filter)
        clients = qs.order_by('-created_at')

        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = 'Клиенты'

        # Стили
        header_font = Font(name='Arial', bold=True, color='FFFFFF', size=11)
        header_fill = PatternFill('solid', start_color='1677FF')
        header_align = Alignment(horizontal='center', vertical='center', wrap_text=True)
        cell_align = Alignment(vertical='center', wrap_text=True)
        thin = Side(style='thin', color='CCCCCC')
        border = Border(left=thin, right=thin, top=thin, bottom=thin)

        CONNECTION_LABELS = {
            'fiber': 'Оптоволокно', 'dsl': 'DSL', 'cable': 'Кабель',
            'wireless': 'Беспроводное', 'modem': 'Модем', 'mrnet': 'MR-Net',
        }

        headers = [
            ('ID', 5), ('Адрес', 35), ('Компания', 25), ('ИНН', 14),
            ('Телефон', 16), ('Email', 25), ('Код аптеки', 12), ('ICCID', 22),
            ('Статус', 10), ('Провайдер', 20), ('Тип подключения', 18),
            ('Тариф (Мбит/с)', 14), ('Лицевой счёт', 16), ('№ договора', 20),
            ('Подсеть', 16), ('Внешний IP', 14), ('Микротик IP', 14), ('Сервер IP', 12),
            ('Номер модема', 16), ('ICCID модема', 22),
            ('Оборудование провайдера', 12),
        ]

        for col, (header, width) in enumerate(headers, 1):
            cell = ws.cell(row=1, column=col, value=header)
            cell.font = header_font
            cell.fill = header_fill
            cell.alignment = header_align
            cell.border = border
            ws.column_dimensions[openpyxl.utils.get_column_letter(col)].width = width

        ws.row_dimensions[1].height = 35

        STATUS_LABELS = {'active': 'Активен', 'inactive': 'Неактивен'}

        for row, c in enumerate(clients, 2):
            values = [
                c.id,
                c.address or '',
                c.company or '',
                c.inn or '',
                c.phone or '',
                c.email or '',
                c.pharmacy_code or '',
                c.iccid or '',
                STATUS_LABELS.get(c.status, c.status),
                c.provider.name if c.provider else '',
                CONNECTION_LABELS.get(c.connection_type, c.connection_type or ''),
                c.tariff or '',
                c.personal_account or '',
                c.contract_number or '',
                c.subnet or '',
                c.external_ip or '',
                c.mikrotik_ip or '',
                c.server_ip or '',
                c.modem_number or '',
                c.modem_iccid or '',
                'Присутствует' if c.provider_equipment else 'Отсутствует',
            ]
            fill = PatternFill('solid', start_color='F8FBFF') if row % 2 == 0 else PatternFill('solid', start_color='FFFFFF')
            for col, value in enumerate(values, 1):
                cell = ws.cell(row=row, column=col, value=value)
                cell.font = Font(name='Arial', size=10)
                cell.alignment = cell_align
                cell.border = border
                cell.fill = fill
            ws.row_dimensions[row].height = 20

        ws.freeze_panes = 'A2'
        ws.auto_filter.ref = f'A1:{openpyxl.utils.get_column_letter(len(headers))}1'

        response = HttpResponse(
            content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
        response['Content-Disposition'] = 'attachment; filename="clients.xlsx"'
        wb.save(response)
        return response

    @action(detail=False, methods=['post'], url_path='create_draft')
    def create_draft(self, request):
        from django.utils import timezone
        from datetime import timedelta
        old_drafts = Client.objects.filter(
            is_draft=True,
            created_by=request.user,
            created_at__lt=timezone.now() - timedelta(hours=1)
        )
        for draft in old_drafts:
            for f in draft.files.all():
                f.file.delete()
                f.delete()
            draft.delete()
        client = Client.objects.create(
            is_draft=True,
            created_by=request.user,
            last_name='', first_name='',
        )
        return Response({'id': client.id}, status=status.HTTP_201_CREATED)

    @action(detail=True, methods=['delete', 'post'], url_path='discard_draft')
    def discard_draft(self, request, pk=None):
        try:
            client = Client.objects.get(pk=pk, is_draft=True, created_by=request.user)
            for f in client.files.all():
                f.file.delete()
                f.delete()
            client.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except Client.DoesNotExist:
            return Response(status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['get', 'post'], url_path='files')
    def files(self, request, pk=None):
        client = self.get_object_including_draft()
        if request.method == 'GET':
            files = client.files.all()
            return Response(ClientFileSerializer(files, many=True, context={'request': request}).data)
        file = request.FILES.get('file')
        if not file:
            return Response({'detail': 'Файл не передан.'}, status=status.HTTP_400_BAD_REQUEST)
        if file.size > 5 * 1024 * 1024:
            return Response({'detail': 'Файл слишком большой. Максимум 5 МБ.'}, status=status.HTTP_400_BAD_REQUEST)
        client_file = ClientFile.objects.create(
            client=client, file=file, name=file.name,
            size=file.size, uploaded_by=request.user,
        )
        ClientActivity.objects.create(
            client=client, user=request.user,
            action=f'Загружен файл: {file.name}'
        )
        return Response(
            ClientFileSerializer(client_file, context={'request': request}).data,
            status=status.HTTP_201_CREATED
        )

    @action(detail=True, methods=['delete'], url_path='files/(?P<file_id>[^/.]+)')
    def delete_file(self, request, pk=None, file_id=None):
        client = self.get_object_including_draft()
        try:
            client_file = ClientFile.objects.get(id=file_id, client=client)
            name = client_file.name
            client_file.file.delete()
            client_file.delete()
            ClientActivity.objects.create(
                client=client, user=request.user,
                action=f'Удалён файл: {name}'
            )
            return Response(status=status.HTTP_204_NO_CONTENT)
        except ClientFile.DoesNotExist:
            return Response({'detail': 'Файл не найден.'}, status=status.HTTP_404_NOT_FOUND)

    @action(detail=True, methods=['post'], url_path='transfer_modem')
    def transfer_modem(self, request, pk=None):
        from_client = self.get_object()
        to_client_id = request.data.get('to_client_id')
        from_slot = str(request.data.get('from_slot', '1'))  # '1' или '2'
        to_slot = str(request.data.get('to_slot', '1'))      # '1' или '2'

        if not to_client_id:
            return Response({'error': 'Не указан клиент для передачи'}, status=400)

        try:
            to_client = Client.objects.get(pk=to_client_id, is_draft=False)
        except Client.DoesNotExist:
            return Response({'error': 'Клиент не найден'}, status=400)

        if from_client.pk == to_client.pk:
            return Response({'error': 'Нельзя передать самому себе'}, status=400)

        # Суффиксы полей в зависимости от слота
        from_sfx = '' if from_slot == '1' else '2'
        to_sfx   = '' if to_slot   == '1' else '2'

        PROVIDER_FIELDS = [
            'provider', 'personal_account', 'contract_number', 'tariff',
            'connection_type', 'modem_number', 'modem_iccid',
            'provider_settings', 'provider_equipment',
        ]

        # Читаем данные из исходного слота
        from_data = {}
        for f in PROVIDER_FIELDS:
            from_data[f] = getattr(from_client, f + from_sfx, None)

        # Записываем в целевой слот получателя
        for f in PROVIDER_FIELDS:
            setattr(to_client, f + to_sfx, from_data[f])
        to_client.save()

        # Готовим читаемые значения для логов
        prov_name = (from_data['provider'].name if from_data['provider'] else '—')
        from_name = from_client.company or from_client.address or f'Клиент #{from_client.pk}'
        to_name   = to_client.company   or to_client.address   or f'Клиент #{to_client.pk}'
        conn_labels = {
            'fiber': 'Оптоволокно', 'dsl': 'DSL', 'cable': 'Кабель',
            'wireless': 'Беспроводное', 'modem': 'Модем', 'mrnet': 'MR-Net',
        }
        conn_label = conn_labels.get(from_data['connection_type'] or '', from_data['connection_type'] or '—')
        equip_label = 'Присутствует' if from_data['provider_equipment'] else 'Отсутствует'

        log_fields = (
            f'Провайдер: {prov_name}\n'
            f'Тип: {conn_label}\n'
            f'Тариф: {from_data["tariff"] or "—"} Мбит/с\n'
            f'Лицевой счёт: {from_data["personal_account"] or "—"}\n'
            f'№ договора: {from_data["contract_number"] or "—"}\n'
            f'Номер модема: {from_data["modem_number"] or "—"}\n'
            f'ICCID модема: {from_data["modem_iccid"] or "—"}\n'
            f'Оборудование: {equip_label}'
        )

        # Лог у получателя — что получили и от кого
        ClientActivity.objects.create(
            client=to_client, user=request.user,
            action=(
                f'Получен провайдер {to_slot} от клиента «{from_name}»:\n{log_fields}'
            )
        )

        # Очищаем исходный слот отправителя
        EMPTY_VALUES = {
            'provider': None, 'personal_account': '', 'contract_number': '', 'tariff': '',
            'connection_type': '', 'modem_number': '', 'modem_iccid': '',
            'provider_settings': '', 'provider_equipment': False,
        }
        for f, empty in EMPTY_VALUES.items():
            setattr(from_client, f + from_sfx, empty)
        from_client.save()

        # Лог у отправителя — что передали и кому
        ClientActivity.objects.create(
            client=from_client, user=request.user,
            action=(
                f'Провайдер {from_slot} передан клиенту «{to_name}» в слот {to_slot}:\n{log_fields}'
            )
        )

        return Response({
            'success': True,
            'to_client': {'id': to_client.pk, 'name': to_client.company or to_client.address or f'#{to_client.pk}'},
        })

    @action(detail=True, methods=['get'], url_path='ping')
    def ping(self, request, pk=None):
        client = self.get_object_including_draft()
        external_ip = client.external_ip or ''
        mikrotik_ip = client.mikrotik_ip or ''
        server_ip = client.server_ip or ''
        results = {
            'external_ip': {'ip': external_ip, 'alive': ping_ip(external_ip) if external_ip else None},
            'mikrotik_ip': {'ip': mikrotik_ip, 'alive': ping_ip(mikrotik_ip) if mikrotik_ip else None},
            'server_ip': {'ip': server_ip, 'alive': ping_ip(server_ip) if server_ip else None},
        }
        return Response(results)


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


class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated, CanEditClient]
