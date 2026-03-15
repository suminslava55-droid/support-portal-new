import subprocess
import json
import os
from datetime import datetime
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.views import APIView
from django_filters.rest_framework import DjangoFilterBackend
from rest_framework.filters import SearchFilter, OrderingFilter
from ..models import Client, ClientNote, CustomFieldDefinition, ClientActivity, Provider, ClientFile, SystemSettings, DutySchedule, CustomHoliday, KktData, OfdCompany
from ..serializers import (
    ClientListSerializer, ClientDetailSerializer, ClientWriteSerializer,
    ClientNoteSerializer, CustomFieldDefinitionSerializer, ProviderSerializer, ClientFileSerializer,
    DutyScheduleSerializer, CustomHolidaySerializer, OfdCompanySerializer, OfdCompanyWriteSerializer,
)
from apps.accounts.permissions import CanEditClient, CanManageCustomFields, IsAdmin
from .utils import ping_ip, build_change_log, FIELD_LABELS, STATUS_LABELS


class BulkImportClientsView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import re

        raw = request.data.get('clients')
        if not raw or not isinstance(raw, list):
            return Response({'error': 'Ожидается массив clients'}, status=400)

        created_list   = []  # {'pharmacy_code', 'address'}
        skipped_null   = []  # записи без id_pharm
        skipped_dup    = []  # уже существующие
        errors         = []  # прочие ошибки

        for idx, item in enumerate(raw):
            row_label = item.get('id_pharm') or f'строка #{idx + 1}'

            # 1. Пропускаем без id_pharm
            pharmacy_code = (item.get('id_pharm') or '').strip()
            if not pharmacy_code:
                skipped_null.append({
                    'row': idx + 1,
                    'reason': 'Пустой id_pharm — пропущено',
                })
                continue

            # 2. Пропускаем дубли
            if Client.objects.filter(pharmacy_code=pharmacy_code, is_draft=False).exists():
                skipped_dup.append({
                    'pharmacy_code': pharmacy_code,
                    'address': (item.get('address_pharm_zabbix') or '').strip(),
                    'reason': 'Уже существует в базе',
                })
                continue

            # 3. Адрес обязателен
            address = (item.get('address_pharm_zabbix') or '').strip()
            if not address:
                errors.append({
                    'pharmacy_code': pharmacy_code,
                    'reason': 'Пустой адрес (address_pharm_zabbix)',
                })
                continue

            # 4. Подсеть: берём первые 3 октета, дописываем .0/24
            subnet = ''
            ip_raw = (item.get('ip_pharm_ad') or '').strip()
            if ip_raw:
                parts = ip_raw.split('.')
                if len(parts) == 4:
                    subnet = f'{parts[0]}.{parts[1]}.{parts[2]}.0/24'

            # 5. Компания по ИНН
            inn = (item.get('organization_inn') or '').strip()
            ofd_company = None
            if inn:
                ofd_company = OfdCompany.objects.filter(inn=inn).first()

            # 6. Создаём клиента
            try:
                client = Client.objects.create(
                    is_draft=False,
                    created_by=request.user,
                    address=address,
                    pharmacy_code=pharmacy_code,
                    warehouse_code=(item.get('pharmacy_id') or '').strip(),
                    email=(item.get('mail') or '').strip(),
                    phone=(item.get('telephone_number') or '').strip(),
                    subnet=subnet,
                    ofd_company=ofd_company,
                    last_name='',
                    first_name='',
                )
            except Exception as e:
                errors.append({'pharmacy_code': pharmacy_code, 'reason': str(e)})
                continue

            # 7. РНМ из cashbox
            rnm_saved = []
            cashbox = item.get('cashbox') or []
            for cb in cashbox:
                rnm = str(cb.get('kkt_reg_id') or '').strip()
                if re.match(r'^\d{16}$', rnm):
                    kkt_obj, created_kkt = KktData.objects.get_or_create(
                        client=client, kkt_reg_id=rnm
                    )
                    if created_kkt:
                        ClientActivity.objects.create(
                            client=client, user=request.user,
                            action=f'Добавлена ККТ\nРНМ: {rnm}\nСерийный номер: —\nНомер ФН: —'
                        )
                        rnm_saved.append(rnm)

            ClientActivity.objects.create(
                client=client, user=request.user,
                action='Клиент создан через массовый импорт'
            )

            created_list.append({
                'id': client.id,
                'pharmacy_code': pharmacy_code,
                'address': address,
                'company': ofd_company.name if ofd_company else (f'ИНН {inn} — не найден' if inn else '—'),
                'rnm_count': len(rnm_saved),
            })

        return Response({
            'created':      created_list,
            'skipped_null': skipped_null,
            'skipped_dup':  skipped_dup,
            'errors':       errors,
            'summary': {
                'total':        len(raw),
                'created':      len(created_list),
                'skipped_null': len(skipped_null),
                'skipped_dup':  len(skipped_dup),
                'errors':       len(errors),
            }
        })


# ─────────────────────────────────────────────
#  Регламентные задания
# ─────────────────────────────────────────────
