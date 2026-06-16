import json
import logging
from datetime import timedelta

from django.db.models import Q
from django.utils import timezone
from rest_framework.permissions import AllowAny
from rest_framework.renderers import JSONRenderer
from rest_framework.response import Response
from rest_framework.views import APIView

from apps.clients.models import KktData
from .authentication import HubBasicAuthentication
from .models import ProxyDevice, ProxyTelemetry, DeviceTask, UpdatePackage

logger = logging.getLogger(__name__)


class HubBaseView(APIView):
    """Базовый класс для всех HUB-эндпоинтов AgentService"""
    authentication_classes = [HubBasicAuthentication]
    permission_classes = [AllowAny]
    renderer_classes = [JSONRenderer]

    def _get_or_create_device(self, uuid):
        device, created = ProxyDevice.objects.get_or_create(uuid=uuid)
        if not created:
            ProxyDevice.objects.filter(pk=device.pk).update(last_seen_at=timezone.now())
        return device, created


class HandshakeView(HubBaseView):
    """POST /printers/v1/handshake/v2"""

    def post(self, request):
        uuid = request.data.get('uuid', '')
        data = request.data.get('data', {})

        if not uuid:
            return Response({'result': 'ERROR', 'message': 'uuid required'}, status=400)

        device, _ = self._get_or_create_device(uuid)
        methods = data.get('methods', {})
        if methods:
            ProxyDevice.objects.filter(pk=device.pk).update(
                supported_methods=methods,
                last_seen_at=timezone.now(),
            )

        logger.info('Handshake от %s', uuid[:8])
        return Response({'result': 'OK', 'methods': {'out': [], 'in': []}})


class CashInfoReportView(HubBaseView):
    """POST /printers/v1/cash_info_report/v2"""

    def post(self, request):
        uuid = request.data.get('uuid', '')
        data = request.data.get('data', {})

        if not uuid:
            return Response({'result': 'ERROR', 'message': 'uuid required'}, status=400)

        device, _ = self._get_or_create_device(uuid)

        # Извлекаем версии
        versions = {}
        for v in data.get('versions', []):
            versions[v.get('type', '')] = v.get('version', '')

        # Извлекаем данные из вложенных структур
        kkt_info = data.get('kkt_info', {})
        reg_info = data.get('kkt_registration_info', {})
        shop_info = data.get('shop_info', {})
        device_config = data.get('device_configuration', {})

        old_registry_number = device.registry_number
        new_registry_number = reg_info.get('registry_number', '')

        update_fields = {
            'comproxy_version': versions.get('COM_PROXY', ''),
            'firmware_version': versions.get('FIRMWARE', ''),
            'fito_version': versions.get('FITO', ''),
            'ffd_version': kkt_info.get('ffd_version', ''),
            'fn_number': kkt_info.get('fn_number', ''),
            'factory_number': kkt_info.get('kkt_factory_number', ''),
            'kkt_name': kkt_info.get('kkt_registry_name', ''),
            'registry_number': new_registry_number,
            'inn': shop_info.get('inn', ''),
            'fiscal_address': shop_info.get('address', ''),
            'ip_address': str(device_config.get('ip', '')),
            'raw_cash_info': data,
            'cash_info_at': timezone.now(),
            'last_seen_at': timezone.now(),
        }

        ProxyDevice.objects.filter(pk=device.pk).update(**update_fields)

        # Автосопоставление по РНМ
        if new_registry_number:
            # Если РНМ изменился — сбросить привязку
            if old_registry_number and old_registry_number != new_registry_number:
                ProxyDevice.objects.filter(pk=device.pk).update(
                    kkt_data=None, match_method='', matched_at=None,
                )
                device.refresh_from_db()

            # Попытка автопривязки если не привязан
            device.refresh_from_db()
            if not device.kkt_data_id:
                match = KktData.objects.filter(kkt_reg_id=new_registry_number).first()
                if match:
                    ProxyDevice.objects.filter(pk=device.pk).update(
                        kkt_data=match,
                        match_method='auto',
                        matched_at=timezone.now(),
                    )
                    logger.info(
                        'Автопривязка %s → KktData %s (РНМ %s)',
                        uuid[:8], match.pk, new_registry_number,
                    )

        logger.info('cash_info_report от %s (РНМ %s)', uuid[:8], new_registry_number)
        return Response({'result': 'OK'})


class CountersReportView(HubBaseView):
    """POST /printers/v1/counters_report/v2"""

    def post(self, request):
        uuid = request.data.get('uuid', '')
        data = request.data.get('data', {})

        if not uuid:
            return Response({'result': 'ERROR', 'message': 'uuid required'}, status=400)

        device, _ = self._get_or_create_device(uuid)

        kkt_flags = data.get('kkt_flags', {})
        kkt_flags_current = kkt_flags.get('current', 0)
        not_sent = data.get('not_sent_docs', {})

        ofd_data = not_sent.get('ofd', {}) if isinstance(not_sent, dict) else {}
        oism_data = not_sent.get('oism', {}) if isinstance(not_sent, dict) else {}

        telemetry_data = {
            'shift_status': data.get('shift_status', ''),
            'shift_exceeded_24h': bool(kkt_flags_current & 8),
            'kkt_flags_fatal': kkt_flags.get('fatal', 0),
            'kkt_flags_current': kkt_flags_current,
            'fn_flags': data.get('fn_flags', 0),
            'unsent_ofd_count': ofd_data.get('count', 0) if isinstance(ofd_data, dict) else 0,
            'unsent_oism_count': oism_data.get('count', 0) if isinstance(oism_data, dict) else 0,
            'raw_counters': data,
        }

        ProxyTelemetry.objects.update_or_create(
            device=device,
            defaults=telemetry_data,
        )

        return Response({'result': 'OK'})


class PollView(HubBaseView):
    """POST /printers/v1/poll/v3"""

    def post(self, request):
        uuid = request.data.get('uuid', '')
        if not uuid:
            return Response({'result': 'ERROR', 'message': 'uuid required'}, status=400)

        device, _ = self._get_or_create_device(uuid)
        data = request.data.get('data', {})

        # 1. Обработка результатов ранее отправленных задач
        for tr in data.get('task_results', []):
            task_id = tr.get('task_id', '')
            if not task_id:
                continue
            result = tr.get('result', '')
            new_status = 'SUCCESS' if result == 'SUCCESS' else 'ERROR'
            updated = DeviceTask.objects.filter(
                task_id=task_id, device=device, status='SENT',
            ).update(
                status=new_status,
                result_message=tr.get('message', ''),
                completed_at=timezone.now(),
            )
            if updated:
                logger.info('Задача %s → %s (%s)', task_id[:8], new_status, device.uuid[:8])

        # 2. Собираем задачи для отправки: PENDING + зависшие SENT (>10 мин)
        stale_threshold = timezone.now() - timedelta(minutes=10)
        tasks_qs = DeviceTask.objects.filter(
            device=device,
        ).filter(
            Q(status='PENDING') | Q(status='SENT', sent_at__lt=stale_threshold)
        ).select_related('update_package')

        tasks_list = []
        for task in tasks_qs:
            tasks_list.append({
                'task_id': str(task.task_id),
                'Rem_id': str(task.task_id),
                'type': task.task_type,
                'data': task.task_data,
            })

        if tasks_list:
            tasks_qs.update(status='SENT', sent_at=timezone.now())
            logger.info('Отправлено %d задач на %s', len(tasks_list), uuid[:8])
            return Response({
                'result': 'OK',
                'data': {'tasks': tasks_list},
            })

        return Response({'result': 'OK'})


class RegistrationReportView(HubBaseView):
    """POST /printers/v1/registration_report/v1"""

    def post(self, request):
        uuid = request.data.get('uuid', '')
        data = request.data.get('data', {})

        if not uuid:
            return Response({'result': 'ERROR', 'message': 'uuid required'}, status=400)

        device, _ = self._get_or_create_device(uuid)
        ProxyDevice.objects.filter(pk=device.pk).update(
            raw_registration_report=data,
            last_seen_at=timezone.now(),
        )

        logger.info('registration_report от %s', uuid[:8])
        return Response({'result': 'OK'})


class PatchMetadataView(HubBaseView):
    """GET /v2/projects/{project}/products/{product}/patches/{version}
    Отдаёт метаданные пакета обновления для AgentService.
    """

    def get(self, request, project, product, version):
        pkg = UpdatePackage.objects.filter(
            project=project, product=product, version=version, enabled=True,
        ).first()
        if not pkg:
            return Response({'result': ''})
        # Все поля — строки; обёртка "data" обязательна (RequestPatchResponseDeserializer)
        return Response({
            'result': 'OK',
            'data': {
                'version': pkg.version,
                'version_from': pkg.version_from or '',
                'url': request.build_absolute_uri(pkg.file.url),
                'md5': pkg.md5,
                'size': str(pkg.file_size),
                'barrier': str(pkg.barrier).lower(),
                'enabled': str(pkg.enabled).lower(),
                'date': pkg.created_at.strftime('%Y-%m-%d'),
                'info': pkg.info or '',
                'notification_text': '',
            },
        })
