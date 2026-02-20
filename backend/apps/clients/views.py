from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from .models import Client, ClientNote, CustomFieldDefinition, ClientActivity, Provider
from .serializers import (
    ClientListSerializer, ClientDetailSerializer, ClientWriteSerializer,
    ClientNoteSerializer, CustomFieldDefinitionSerializer, ProviderSerializer
)
from apps.accounts.permissions import CanEditClient, CanManageCustomFields


FIELD_LABELS = {
    'last_name': 'Фамилия',
    'first_name': 'Имя',
    'middle_name': 'Отчество',
    'inn': 'ИНН',
    'phone': 'Телефон',
    'email': 'Email',
    'company': 'Компания',
    'address': 'Адрес',
    'status': 'Статус',
    'provider_id': 'Провайдер',
    'personal_account': 'Лицевой счёт',
    'contract_number': '№ договора',
    'provider_settings': 'Настройки провайдера',
    'subnet': 'Подсеть аптеки',
    'external_ip': 'Внешний IP',
    'iccid': 'ICCID',
    'pharmacy_code': 'Код аптеки',
}

STATUS_LABELS = {
    'active': 'Активен',
    'inactive': 'Неактивен',
}


def build_change_log(old_client, new_data, provider_map):
    changes = []
    for field, label in FIELD_LABELS.items():
        old_val = getattr(old_client, field, '') or ''
        new_val = new_data.get(field.replace('_id', ''), '') or ''

        # Для провайдера получаем ID
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

        if str(old_val) != str(new_val):
            old_display = str(old_val) if old_val else '—'
            new_display = str(new_val) if new_val else '—'
            # Обрезаем длинные значения
            if len(old_display) > 50:
                old_display = old_display[:50] + '...'
            if len(new_display) > 50:
                new_display = new_display[:50] + '...'
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
    search_fields = ['last_name', 'first_name', 'middle_name', 'phone', 'email', 'company', 'inn']
    ordering_fields = ['last_name', 'created_at', 'company']
    ordering = ['-created_at']

    def get_queryset(self):
        return Client.objects.select_related('created_by', 'provider').all()

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
        provider_map = {p.id: p.name for p in Provider.objects.all()}
        changes = build_change_log(old, self.request.data, provider_map)
        client = serializer.save()
        if changes:
            for change in changes:
                ClientActivity.objects.create(
                    client=client, user=self.request.user,
                    action=change
                )
        else:
            ClientActivity.objects.create(
                client=client, user=self.request.user,
                action='Карточка обновлена (без изменений в полях)'
            )

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


class ProviderViewSet(viewsets.ModelViewSet):
    queryset = Provider.objects.all()
    serializer_class = ProviderSerializer
    permission_classes = [IsAuthenticated, CanEditClient]
