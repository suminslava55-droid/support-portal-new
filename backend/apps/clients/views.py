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
        client = serializer.save()
        ClientActivity.objects.create(
            client=client, user=self.request.user,
            action='Карточка клиента обновлена'
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
