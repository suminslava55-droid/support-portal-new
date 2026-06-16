import hashlib
import os

from django.db.models import Q
from django.utils import timezone
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.accounts.permissions import IsAdminOrSysadmin
from apps.clients.models import KktData
from .models import ProxyDevice, ProxyTelemetry, UpdatePackage, DeviceTask
from .serializers import (
    ProxyDeviceListSerializer, ProxyDeviceDetailSerializer,
    UpdatePackageSerializer, DeviceTaskSerializer,
)


class ProxyDeviceListView(APIView):
    """GET /api/comproxy/devices/ — список всех устройств"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def get(self, request):
        qs = ProxyDevice.objects.select_related(
            'kkt_data', 'kkt_data__client', 'telemetry',
        ).all()

        # Фильтры
        search = request.query_params.get('search', '').strip()
        if search:
            qs = qs.filter(
                Q(registry_number__icontains=search) |
                Q(uuid__icontains=search) |
                Q(inn__icontains=search) |
                Q(fiscal_address__icontains=search) |
                Q(kkt_name__icontains=search)
            )

        matched = request.query_params.get('matched')
        if matched == 'true':
            qs = qs.filter(kkt_data__isnull=False)
        elif matched == 'false':
            qs = qs.filter(kkt_data__isnull=True)

        shift_exceeded = request.query_params.get('shift_exceeded')
        if shift_exceeded == 'true':
            qs = qs.filter(telemetry__shift_exceeded_24h=True)

        serializer = ProxyDeviceListSerializer(qs, many=True)
        return Response(serializer.data)


class ProxyDeviceDetailView(APIView):
    """GET /api/comproxy/devices/<uuid>/ — детали устройства"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def get(self, request, uuid):
        try:
            device = ProxyDevice.objects.select_related(
                'kkt_data', 'kkt_data__client', 'telemetry',
            ).get(uuid=uuid)
        except ProxyDevice.DoesNotExist:
            return Response({'detail': 'Устройство не найдено'}, status=404)

        serializer = ProxyDeviceDetailSerializer(device)
        return Response(serializer.data)


class ProxyDeviceMatchView(APIView):
    """POST /api/comproxy/devices/<uuid>/match/ — ручная привязка"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def post(self, request, uuid):
        try:
            device = ProxyDevice.objects.get(uuid=uuid)
        except ProxyDevice.DoesNotExist:
            return Response({'detail': 'Устройство не найдено'}, status=404)

        kkt_data_id = request.data.get('kkt_data_id')
        if not kkt_data_id:
            return Response({'detail': 'kkt_data_id обязателен'}, status=400)

        try:
            kkt = KktData.objects.get(pk=kkt_data_id)
        except KktData.DoesNotExist:
            return Response({'detail': 'ККТ не найдена'}, status=404)

        device.kkt_data = kkt
        device.match_method = 'manual'
        device.matched_at = timezone.now()
        device.save(update_fields=['kkt_data', 'match_method', 'matched_at'])

        return Response({'detail': 'Привязано', 'kkt_data_id': kkt.pk})


class ProxyDeviceUnmatchView(APIView):
    """POST /api/comproxy/devices/<uuid>/unmatch/ — отвязать"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def post(self, request, uuid):
        try:
            device = ProxyDevice.objects.get(uuid=uuid)
        except ProxyDevice.DoesNotExist:
            return Response({'detail': 'Устройство не найдено'}, status=404)

        device.kkt_data = None
        device.match_method = ''
        device.matched_at = None
        device.save(update_fields=['kkt_data', 'match_method', 'matched_at'])

        return Response({'detail': 'Отвязано'})


class ProxyStatsView(APIView):
    """GET /api/comproxy/stats/ — статистика"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def get(self, request):
        total = ProxyDevice.objects.count()
        matched = ProxyDevice.objects.filter(kkt_data__isnull=False).count()
        shift_exceeded = ProxyTelemetry.objects.filter(shift_exceeded_24h=True).count()
        fatal_errors = ProxyTelemetry.objects.filter(kkt_flags_fatal__gt=0).count()

        return Response({
            'total': total,
            'matched': matched,
            'unmatched': total - matched,
            'shift_exceeded_24h': shift_exceeded,
            'fatal_errors': fatal_errors,
        })


# ─── Управление обновлениями ─────────────────────────────

ALLOWED_EXTENSIONS = {
    'COMPROXY': {'.jar'},
    'FIRMWARE': {'.bin', '.hex', '.frm', '.jar'},
}
MAX_UPLOAD_SIZE = 50 * 1024 * 1024  # 50 МБ


def _compute_md5(file_obj):
    """Считает MD5 чанками, не загружая весь файл в память."""
    h = hashlib.md5()
    for chunk in file_obj.chunks(8192):
        h.update(chunk)
    file_obj.seek(0)
    return h.hexdigest()


class UpdatePackageListCreateView(APIView):
    """
    GET  /api/comproxy/updates/     — список пакетов обновлений
    POST /api/comproxy/updates/     — загрузка нового пакета (multipart/form-data)
    """
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request):
        qs = UpdatePackage.objects.select_related('uploaded_by').all()
        pt = request.query_params.get('product_type')
        if pt:
            qs = qs.filter(product_type=pt)
        serializer = UpdatePackageSerializer(qs, many=True)
        return Response(serializer.data)

    def post(self, request):
        product_type = request.data.get('product_type', '').strip()
        version = request.data.get('version', '').strip()
        file_obj = request.FILES.get('file')

        if not product_type or not version or not file_obj:
            return Response(
                {'detail': 'Обязательные поля: product_type, version, file'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if product_type not in ('COMPROXY', 'FIRMWARE'):
            return Response({'detail': 'product_type: COMPROXY или FIRMWARE'}, status=400)

        # Валидация расширения
        ext = os.path.splitext(file_obj.name)[1].lower()
        allowed = ALLOWED_EXTENSIONS.get(product_type, set())
        if ext not in allowed:
            return Response(
                {'detail': f'Недопустимый формат файла. Разрешены: {", ".join(allowed)}'},
                status=400,
            )

        # Валидация размера
        if file_obj.size > MAX_UPLOAD_SIZE:
            return Response({'detail': f'Файл слишком большой (макс. {MAX_UPLOAD_SIZE // 1024 // 1024} МБ)'}, status=400)

        # project/product фиксированы — агент строит URL по этим значениям
        PRODUCT_MAP = {
            'COMPROXY': ('CSI', 'ComProxy'),
            'FIRMWARE': ('CSI', 'Firmware'),
        }
        project, product = PRODUCT_MAP[product_type]

        # Проверка дублей
        if UpdatePackage.objects.filter(
            product_type=product_type, project=project, product=product, version=version,
        ).exists():
            return Response({'detail': f'Версия {version} уже загружена'}, status=400)

        md5 = _compute_md5(file_obj)

        pkg = UpdatePackage.objects.create(
            product_type=product_type,
            version=version,
            version_from=request.data.get('version_from', '').strip(),
            project=project,
            product=product,
            file=file_obj,
            filename=file_obj.name,
            file_size=file_obj.size,
            md5=md5,
            info=request.data.get('info', '').strip(),
            enabled=request.data.get('enabled', 'true') != 'false',
            barrier=request.data.get('barrier', 'false') == 'true',
            uploaded_by=request.user,
        )

        return Response(UpdatePackageSerializer(pkg).data, status=201)


class UpdatePackageDetailView(APIView):
    """
    GET    /api/comproxy/updates/<id>/  — детали
    PATCH  /api/comproxy/updates/<id>/  — редактирование метаданных
    DELETE /api/comproxy/updates/<id>/  — удаление
    """
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def _get_pkg(self, pk):
        try:
            return UpdatePackage.objects.select_related('uploaded_by').get(pk=pk)
        except UpdatePackage.DoesNotExist:
            return None

    def get(self, request, pk):
        pkg = self._get_pkg(pk)
        if not pkg:
            return Response({'detail': 'Не найден'}, status=404)
        return Response(UpdatePackageSerializer(pkg).data)

    def patch(self, request, pk):
        pkg = self._get_pkg(pk)
        if not pkg:
            return Response({'detail': 'Не найден'}, status=404)

        for field in ('info', 'version_from'):
            if field in request.data:
                setattr(pkg, field, request.data[field])
        if 'enabled' in request.data:
            pkg.enabled = request.data['enabled'] in (True, 'true', '1')
        if 'barrier' in request.data:
            pkg.barrier = request.data['barrier'] in (True, 'true', '1')
        pkg.save()
        return Response(UpdatePackageSerializer(pkg).data)

    def delete(self, request, pk):
        pkg = self._get_pkg(pk)
        if not pkg:
            return Response({'detail': 'Не найден'}, status=404)

        active_tasks = pkg.tasks.filter(status__in=('PENDING', 'SENT')).count()
        if active_tasks:
            return Response(
                {'detail': f'Невозможно удалить: {active_tasks} активных задач'},
                status=400,
            )

        # Удаляем файл с диска
        if pkg.file:
            pkg.file.delete(save=False)
        pkg.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class CreateUpdateTaskView(APIView):
    """POST /api/comproxy/updates/<id>/deploy/ — отправить обновление на устройства"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def post(self, request, pk):
        try:
            pkg = UpdatePackage.objects.get(pk=pk, enabled=True)
        except UpdatePackage.DoesNotExist:
            return Response({'detail': 'Пакет не найден или отключён'}, status=404)

        all_devices = request.data.get('all_devices', False)
        device_uuids = request.data.get('device_uuids', [])

        if all_devices:
            devices = ProxyDevice.objects.all()
        elif device_uuids:
            devices = ProxyDevice.objects.filter(uuid__in=device_uuids)
        else:
            return Response({'detail': 'Укажите device_uuids или all_devices=true'}, status=400)

        # Агент использует эти поля для:
        # 1) Определения типа (startsWithIgnoreCase "COMPROXY"/"FIRMWARE")
        # 2) Построения URL: /v2/projects/{project}/products/{product}/patches/{version}
        task_data = {
            'project': pkg.project,
            'product': pkg.product,
            'version': pkg.version,
        }

        created = 0
        skipped = 0
        for device in devices:
            # Не создавать дубли — если уже есть активная задача обновления
            if DeviceTask.objects.filter(
                device=device, task_type='update_software',
                status__in=('PENDING', 'SENT'),
            ).exists():
                skipped += 1
                continue

            DeviceTask.objects.create(
                device=device,
                update_package=pkg,
                task_type='update_software',
                task_data=task_data,
                created_by=request.user,
            )
            created += 1

        return Response({
            'created': created,
            'skipped': skipped,
            'message': f'Создано задач: {created}' + (f', пропущено: {skipped}' if skipped else ''),
        })


class DeviceTaskListView(APIView):
    """GET /api/comproxy/tasks/ — список задач"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def get(self, request):
        qs = DeviceTask.objects.select_related(
            'device', 'update_package', 'created_by',
        ).all()

        s = request.query_params.get('status')
        if s:
            qs = qs.filter(status=s)

        device_uuid = request.query_params.get('device_uuid')
        if device_uuid:
            qs = qs.filter(device__uuid=device_uuid)

        qs = qs[:200]
        serializer = DeviceTaskSerializer(qs, many=True)
        return Response(serializer.data)


class DeviceTaskCancelView(APIView):
    """POST /api/comproxy/tasks/<task_id>/cancel/ — отменить задачу"""
    permission_classes = [IsAuthenticated, IsAdminOrSysadmin]

    def post(self, request, task_id):
        updated = DeviceTask.objects.filter(
            task_id=task_id, status='PENDING',
        ).update(status='CANCELLED', completed_at=timezone.now())

        if not updated:
            return Response({'detail': 'Задача не найдена или уже отправлена'}, status=400)
        return Response({'detail': 'Отменена'})
