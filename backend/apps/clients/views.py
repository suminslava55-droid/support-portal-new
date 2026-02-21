import subprocess
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Client, ClientNote, CustomFieldDefinition, ClientActivity, Provider, ClientFile
from .serializers import (
    ClientListSerializer, ClientDetailSerializer, ClientWriteSerializer,
    ClientNoteSerializer, CustomFieldDefinitionSerializer, ProviderSerializer, ClientFileSerializer
)
from apps.accounts.permissions import CanEditClient, CanManageCustomFields


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
    'provider_equipment': 'Оборудование провайдера',
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
        """Находит клиента включая черновики - для actions файлов и пинга"""
        from django.shortcuts import get_object_or_404
        return get_object_or_404(Client, pk=self.kwargs['pk'])

    def get_object(self):
        """При update/partial_update ищем включая черновики"""
        if self.action in ('update', 'partial_update', 'ping'):
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
        # Если это был черновик — снимаем флаг и логируем как создание
        extra = {}
        if old.is_draft:
            extra['is_draft'] = False
            client = serializer.save(**extra)
            ClientActivity.objects.create(
                client=client, user=self.request.user,
                action='Карточка клиента создана'
            )
            return
        provider_map = {p.id: p.name for p in Provider.objects.all()}
        changes = build_change_log(old, self.request.data, provider_map)
        client = serializer.save(**extra)
        if changes:
            action = 'Изменено: ' + ' | '.join(changes)
            # Обрезаем если слишком длинное
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

    @action(detail=False, methods=['post'], url_path='create_draft')
    def create_draft(self, request):
        # Удаляем старые черновики этого пользователя (старше 1 часа)
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
            # Удаляем файлы
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
            client=client,
            file=file,
            name=file.name,
            size=file.size,
            uploaded_by=request.user,
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

    @action(detail=True, methods=['get'], url_path='ping')
    def ping(self, request, pk=None):
        client = self.get_object()
        results = {}

        external_ip = client.external_ip or ''
        mikrotik_ip = client.mikrotik_ip or ''

        server_ip = client.server_ip or ''

        results['external_ip'] = {
            'ip': external_ip,
            'alive': ping_ip(external_ip) if external_ip else None
        }
        results['mikrotik_ip'] = {
            'ip': mikrotik_ip,
            'alive': ping_ip(mikrotik_ip) if mikrotik_ip else None
        }
        results['server_ip'] = {
            'ip': server_ip,
            'alive': ping_ip(server_ip) if server_ip else None
        }

        return Response(results)


class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated, CanEditClient]
