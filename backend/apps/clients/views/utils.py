import subprocess

FIELD_LABELS = {
    'last_name': 'Фамилия',
    'first_name': 'Имя',
    'middle_name': 'Отчество',
    'phone': 'Телефон',
    'iccid': 'ICCID',
    'email': 'Email',
    'pharmacy_code': 'Код аптеки (UT)',
    'warehouse_code': 'Код склада',
    'ofd_company_id': 'Компания ОФД',
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

        if field == 'ofd_company_id':
            new_val = str(new_data.get('ofd_company', '') or '')
            if str(old_val) == new_val:
                continue
            from apps.clients.models import OfdCompany
            try:
                old_name = OfdCompany.objects.get(pk=old_val).name if old_val else '—'
            except Exception:
                old_name = f'#{old_val}' if old_val else '—'
            try:
                new_name = OfdCompany.objects.get(pk=new_val).name if new_val else '—'
            except Exception:
                new_name = f'#{new_val}' if new_val else '—'
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
