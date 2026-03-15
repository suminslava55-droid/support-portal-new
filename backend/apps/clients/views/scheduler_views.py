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
from .kkt_views import parse_datetime, ofd_request


def _get_or_create_task(task_id):
    from ..models import ScheduledTask
    TASKS = {
        'update_rnm':        'Обновление данных по РНМ',
        'fetch_external_ip': 'Получение внешнего IP',
    }
    obj, _ = ScheduledTask.objects.get_or_create(
        task_id=task_id,
        defaults={'name': TASKS.get(task_id, task_id)}
    )
    return obj


class ScheduledTaskListView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        from ..models import ScheduledTask
        _get_or_create_task('update_rnm')
        _get_or_create_task('fetch_external_ip')
        tasks = ScheduledTask.objects.all().order_by('task_id')
        result = []
        for t in tasks:
            result.append({
                'task_id':        t.task_id,
                'name':           t.name,
                'enabled':        t.enabled,
                'schedule_time':  t.schedule_time,
                'schedule_days':  t.schedule_days,
                'status':         t.status,
                'progress':       t.progress,
                'progress_text':  t.progress_text,
                'last_run_at':    t.last_run_at.isoformat() if t.last_run_at else None,
                'last_run_result': t.last_run_result,
            })
        return Response(result)

    def patch(self, request):
        """Сохранить настройки расписания"""
        from ..models import ScheduledTask
        task_id = request.data.get('task_id')
        if not task_id:
            return Response({'error': 'task_id обязателен'}, status=400)
        t = _get_or_create_task(task_id)
        if 'enabled' in request.data:
            t.enabled = bool(request.data['enabled'])
        if 'schedule_time' in request.data:
            t.schedule_time = (request.data['schedule_time'] or '').strip()
        if 'schedule_days' in request.data:
            days = request.data['schedule_days']
            if isinstance(days, list):
                days = ','.join(str(d) for d in days)
            t.schedule_days = days
        t.save()
        return Response({'ok': True})


class ScheduledTaskRunView(APIView):
    """Ручной запуск задания — стартует поток, возвращает сразу.
    Параметр scheduled=true (от cron) включает режим only_expiring (только ФН ≤30 дней).
    Ручной запуск через интерфейс — всегда все ККТ.
    """
    permission_classes = [IsAuthenticated]

    def post(self, request):
        import threading
        from ..models import ScheduledTask
        task_id      = request.data.get('task_id', 'update_rnm')
        company_id   = request.data.get('company_id')   # None = все компании
        # scheduled=true передаётся из scheduler_run.sh (cron) — обновляем только истекающие ФН
        only_expiring = str(request.data.get('scheduled', '')).lower() == 'true'

        t = _get_or_create_task(task_id)
        if t.status == 'running':
            return Response({'error': 'Задание уже выполняется'}, status=400)

        # Стартуем в фоне
        if task_id == 'fetch_external_ip':
            thread = threading.Thread(
                target=_run_fetch_external_ip,
                args=(task_id, request.user.id),
                daemon=True,
            )
            thread.start()
            return Response({'ok': True, 'message': 'Задание запущено (внешний IP)'})
        else:
            thread = threading.Thread(
                target=_run_update_rnm,
                args=(task_id, company_id, request.user.id),
                kwargs={'only_expiring': only_expiring},
                daemon=True,
            )
            thread.start()
            mode = 'истекающие ФН (≤30 дней)' if only_expiring else 'все ККТ'
            return Response({'ok': True, 'message': f'Задание запущено ({mode})'})


class ScheduledTaskProgressView(APIView):
    """Polling прогресса — фронтенд опрашивает каждые 2 сек"""
    permission_classes = [IsAuthenticated]

    def get(self, request, task_id):
        from ..models import ScheduledTask
        try:
            t = ScheduledTask.objects.get(task_id=task_id)
        except ScheduledTask.DoesNotExist:
            return Response({'error': 'Не найдено'}, status=404)
        return Response({
            'task_id':        t.task_id,
            'status':         t.status,
            'progress':       t.progress,
            'progress_text':  t.progress_text,
            'last_run_at':    t.last_run_at.isoformat() if t.last_run_at else None,
            'last_run_result': t.last_run_result,
        })


def _run_update_rnm(task_id, company_id, user_id, only_expiring=False):
    """Фоновая функция обновления ККТ по РНМ для всех/одной компании.
    only_expiring=True — только ККТ с истекающим ФН (≤30 дней), используется при запуске по расписанию.
    """
    import time
    import re as re_mod
    from django.utils import timezone
    from datetime import timedelta
    from django.contrib.auth import get_user_model
    from ..models import ScheduledTask, Client, KktData, ClientActivity, OfdCompany

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except Exception:
        user = None

    def _set(**kwargs):
        ScheduledTask.objects.filter(task_id=task_id).update(**kwargs)

    # Определяем название компании если задан фильтр
    company_name = None
    if company_id:
        try:
            company_name = OfdCompany.objects.get(pk=company_id).name
        except Exception:
            company_name = f'ID={company_id}'

    if only_expiring:
        mode_label = 'истекающие ФН (≤30 дней)'
    elif company_name:
        mode_label = f'компания: {company_name}'
    else:
        mode_label = 'все клиенты'

    _set(status='running', progress=0, progress_text=f'Инициализация... ({mode_label})', last_run_at=timezone.now())
    started_at = timezone.now()

    try:
        script = '/usr/local/bin/ofd_fetch.sh'
        now = timezone.now().date()
        expiry_threshold = now + timedelta(days=30)

        # Выбираем клиентов
        qs = Client.objects.filter(is_draft=False).select_related('ofd_company')
        if company_id:
            qs = qs.filter(ofd_company_id=company_id)

        # Только клиентов у которых есть ккт и есть компания с токеном
        clients_with_kkt = []
        for c in qs:
            if not c.ofd_company:
                continue
            kkt_qs = c.kkt_data.filter(kkt_reg_id__isnull=False).exclude(kkt_reg_id='')
            if only_expiring:
                # Берём только ККТ у которых fn_end_date не задан или ≤ 30 дней
                from django.db import models as django_models
                from datetime import datetime, timezone as dt_timezone
                expiry_dt = datetime.combine(expiry_threshold, datetime.min.time()).replace(tzinfo=dt_timezone.utc)
                kkt_qs = kkt_qs.filter(
                    django_models.Q(fn_end_date__isnull=True) |
                    django_models.Q(fn_end_date__lte=expiry_dt)
                )
            kkts = list(kkt_qs)
            if kkts:
                clients_with_kkt.append((c, kkts))

        total_clients = len(clients_with_kkt)
        if total_clients == 0:
            _set(status='success', progress=100,
                 progress_text='Нет клиентов с ККТ для обновления',
                 last_run_result='Нет клиентов с ККТ для обновления')
            return

        total_kkts  = sum(len(k) for _, k in clients_with_kkt)
        done_kkts   = 0
        fetched_total = 0
        errors_total  = 0
        error_log     = []

        for ci, (client, kkts) in enumerate(clients_with_kkt):
            inn   = (client.ofd_company.inn or '').strip()
            token = (client.ofd_company.ofd_token or '').strip()
            if not inn or not token:
                done_kkts += len(kkts)
                continue

            client_pct = int((ci / total_clients) * 100)
            _set(progress=client_pct,
                 progress_text=f'Клиент {ci+1}/{total_clients}: {client.address or client.pharmacy_code}')

            for kkt_obj in kkts:
                rnm = kkt_obj.kkt_reg_id
                try:
                    result = subprocess.run(
                        [script, inn, token, rnm],
                        capture_output=True, text=True, timeout=20
                    )
                    if not result.stdout.strip():
                        errors_total += 1
                        stderr_info = result.stderr.strip()[:200] if result.stderr else ''
                        error_log.append(
                            f'РНМ {rnm} | {client.address or client.pharmacy_code}: '
                            f'пустой ответ скрипта' + (f' | stderr: {stderr_info}' if stderr_info else '')
                        )
                        done_kkts += 1
                        continue
                    detail_data = json.loads(result.stdout)
                except subprocess.TimeoutExpired:
                    errors_total += 1
                    error_log.append(f'РНМ {rnm} | {client.address or client.pharmacy_code}: таймаут (20 сек)')
                    done_kkts += 1
                    continue
                except Exception as e:
                    errors_total += 1
                    error_log.append(f'РНМ {rnm} | {client.address or client.pharmacy_code}: {str(e)}')
                    done_kkts += 1
                    continue

                if detail_data.get('Status') != 'Success':
                    errors_total += 1
                    ofd_msg = detail_data.get('Message') or detail_data.get('Error') or 'нет описания'
                    error_log.append(f'РНМ {rnm} | {client.address or client.pharmacy_code}: ОФД ошибка — {ofd_msg}')
                    done_kkts += 1
                    continue

                data_items = detail_data.get('Data', [])
                if not data_items:
                    errors_total += 1
                    error_log.append(f'РНМ {rnm} | {client.address or client.pharmacy_code}: ОФД вернул пустой Data (касса не найдена по РНМ)')
                    done_kkts += 1
                    continue

                for item in data_items:
                    old_fn     = kkt_obj.fn_number
                    old_serial = kkt_obj.serial_number
                    was_empty  = not old_serial and not old_fn
                    kkt_obj.serial_number    = item.get('SerialNumber', '')
                    kkt_obj.fn_number        = item.get('FnNumber', '')
                    kkt_obj.kkt_model        = item.get('KktModel', '')
                    kkt_obj.create_date      = parse_datetime(item.get('CreateDate'))
                    kkt_obj.contract_end_date = parse_datetime(item.get('ContractEndDate'))
                    kkt_obj.fn_end_date      = parse_datetime(item.get('FnEndDate'))
                    kkt_obj.fiscal_address   = item.get('FiscalAddress', '')
                    kkt_obj.raw_data         = item
                    kkt_obj.save()
                    fetched_total += 1
                    if user:
                        if was_empty and (kkt_obj.serial_number or kkt_obj.fn_number):
                            ClientActivity.objects.create(
                                client=client, user=user,
                                action=f'Обновлена ККТ по РНМ (регламент)\nРНМ: {rnm}\nСерийный номер: {kkt_obj.serial_number or "—"}\nНомер ФН: {kkt_obj.fn_number or "—"}'
                            )
                        elif old_fn and old_fn != kkt_obj.fn_number:
                            ClientActivity.objects.create(
                                client=client, user=user,
                                action=f'Изменён номер ФН (регламент)\nРНМ: {rnm}\nНомер ФН: «{old_fn}» → «{kkt_obj.fn_number}»'
                            )
                done_kkts += 1
                # Rate limit ОФД — 1 запрос/сек
                time.sleep(1.05)

        elapsed = timezone.now() - started_at
        elapsed_str = f'{int(elapsed.total_seconds() // 60)} мин {int(elapsed.total_seconds() % 60)} сек'

        if only_expiring:
            mode_str = 'только истекающие ФН (≤30 дней)'
        elif company_name:
            mode_str = f'компания: {company_name}'
        else:
            mode_str = 'все клиенты'

        summary = (
            f'Режим: {mode_str}. '
            f'Обновлено ККТ: {fetched_total} из {total_kkts}. '
            f'Клиентов: {total_clients}. '
            f'Ошибок: {errors_total}. '
            f'Время выполнения: {elapsed_str}.'
        )
        if error_log:
            summary += '\n\nОшибки:\n' + '\n'.join(error_log[:20])
            if len(error_log) > 20:
                summary += f'\n...и ещё {len(error_log)-20} ошибок'

        _set(status='success' if errors_total == 0 else 'error',
             progress=100,
             progress_text=f'Готово: обновлено {fetched_total} ККТ за {elapsed_str}',
             last_run_result=summary)

    except Exception as e:
        import traceback
        _set(status='error', progress=0,
             progress_text='Ошибка выполнения',
             last_run_result=f'Критическая ошибка: {str(e)}\n{traceback.format_exc()[:500]}')




def _run_fetch_external_ip(task_id, user_id):
    """Фоновая функция получения внешнего IP по всем клиентам через SSH на Микротик"""
    import paramiko
    from django.utils import timezone
    from django.contrib.auth import get_user_model
    from ..models import ScheduledTask, Client, ClientActivity, SystemSettings

    User = get_user_model()
    try:
        user = User.objects.get(pk=user_id)
    except Exception:
        user = None

    def _set(**kwargs):
        ScheduledTask.objects.filter(task_id=task_id).update(**kwargs)

    _set(status='running', progress=0, progress_text='Инициализация...', last_run_at=timezone.now())
    started_at = timezone.now()

    try:
        settings_obj = SystemSettings.get()
        if not settings_obj.ssh_user or not settings_obj.ssh_password_encrypted:
            _set(status='error', progress=0,
                 progress_text='Ошибка: SSH не настроен',
                 last_run_result='SSH пользователь или пароль не заданы в настройках системы')
            return

        ssh_user     = settings_obj.ssh_user
        ssh_password = settings_obj.ssh_password

        # Клиенты у которых есть subnet (из него вычисляется mikrotik_ip)
        clients = [c for c in Client.objects.filter(is_draft=False, subnet__isnull=False).exclude(subnet='') if c.mikrotik_ip]
        total = len(clients)

        if total == 0:
            _set(status='success', progress=100,
                 progress_text='Нет клиентов с Микротиком',
                 last_run_result='Нет клиентов с заполненным полем Subnet для определения IP Микротика')
            return

        updated   = 0
        changed   = 0
        errors    = 0
        error_log = []
        cmd = ':put ([/tool fetch url="https://api.ipify.org" http-method=get output=user as-value]->"data")'

        for i, client in enumerate(clients):
            mikrotik_ip = client.mikrotik_ip
            pct = int((i / total) * 100)
            _set(progress=pct,
                 progress_text=f'Клиент {i+1}/{total}: {client.address or client.pharmacy_code} ({mikrotik_ip})')
            try:
                ssh = paramiko.SSHClient()
                ssh.set_missing_host_key_policy(paramiko.AutoAddPolicy())
                ssh.connect(mikrotik_ip, username=ssh_user, password=ssh_password, timeout=10, port=22)
                stdin, stdout, stderr = ssh.exec_command(cmd, timeout=15)
                new_ip = stdout.read().decode().strip()
                ssh.close()

                if not new_ip:
                    errors += 1
                    error_log.append(f'{client.address or client.pharmacy_code} ({mikrotik_ip}): пустой ответ')
                    continue

                old_ip = client.external_ip or ''
                if new_ip != old_ip:
                    changed += 1
                    client.external_ip = new_ip
                    client.save(update_fields=['external_ip'])
                    if user:
                        ClientActivity.objects.create(
                            client=client, user=user,
                            action=f'Обновлён внешний IP (регламент)\n«{old_ip or "не задан"}» → «{new_ip}»'
                        )
                updated += 1

            except paramiko.AuthenticationException:
                errors += 1
                error_log.append(f'{client.address or client.pharmacy_code} ({mikrotik_ip}): ошибка аутентификации SSH')
            except Exception as e:
                errors += 1
                err_str = str(e)
                if 'timed out' in err_str.lower() or 'timeout' in err_str.lower():
                    error_log.append(f'{client.address or client.pharmacy_code} ({mikrotik_ip}): таймаут подключения')
                else:
                    error_log.append(f'{client.address or client.pharmacy_code} ({mikrotik_ip}): {err_str[:120]}')

        elapsed = timezone.now() - started_at
        elapsed_str = f'{int(elapsed.total_seconds() // 60)} мин {int(elapsed.total_seconds() % 60)} сек'

        summary = (
            f'Всего клиентов: {total}. '
            f'Опрошено: {updated}. '
            f'Изменился IP: {changed}. '
            f'Ошибок: {errors}. '
            f'Время выполнения: {elapsed_str}.'
        )
        if error_log:
            summary += '\n\nОшибки:\n' + '\n'.join(error_log[:30])
            if len(error_log) > 30:
                summary += f'\n...и ещё {len(error_log)-30}'

        _set(status='success' if errors == 0 else 'error',
             progress=100,
             progress_text=f'Готово: опрошено {updated} из {total}, изменился IP: {changed}. Время: {elapsed_str}',
             last_run_result=summary)

    except Exception as e:
        import traceback
        _set(status='error', progress=0,
             progress_text='Ошибка выполнения',
             last_run_result=f'Критическая ошибка: {str(e)}\n{traceback.format_exc()[:500]}')


class ScheduledTaskCronView(APIView):
    """Применить расписание — управляет crontab через cron_manager.sh на хосте"""
    permission_classes = [IsAuthenticated]

    CRON_MANAGER = '/usr/local/bin/cron_manager.sh'
    SCHEDULER_SCRIPT = '/opt/support-portal/scheduler_run.sh'

    def _call(self, *args):
        """Вызвать cron_manager.sh с аргументами, вернуть (stdout, stderr, returncode)"""
        result = subprocess.run(
            [self.CRON_MANAGER] + list(args),
            capture_output=True, text=True, timeout=10
        )
        return result.stdout.strip(), result.stderr.strip(), result.returncode

    def post(self, request):
        from apps.accounts.permissions import IsAdmin
        if not IsAdmin().has_permission(request, self):
            return Response({'error': 'Только для администраторов'}, status=403)

        task_id       = request.data.get('task_id', 'update_rnm')
        enabled       = request.data.get('enabled', False)
        schedule_time = (request.data.get('schedule_time') or '').strip()
        schedule_days = request.data.get('schedule_days', '0,1,2,3,4')

        MARKER = f'{self.SCHEDULER_SCRIPT} {task_id}'

        if enabled:
            # Валидация времени
            if not schedule_time or ':' not in schedule_time:
                return Response({'error': 'Укажите время в формате ЧЧ:ММ'}, status=400)
            try:
                hh, mm = schedule_time.split(':')
                hh, mm = int(hh), int(mm)
                if not (0 <= hh <= 23 and 0 <= mm <= 59):
                    raise ValueError
            except ValueError:
                return Response({'error': 'Некорректное время'}, status=400)

            # Конвертируем местное время → UTC с учётом timezone_offset из настроек
            from ..models import SystemSettings
            settings_obj = SystemSettings.get()
            tz_offset = settings_obj.timezone_offset  # например +6 для Омска
            total_minutes = hh * 60 + mm - tz_offset * 60
            # Нормализуем в 0..1439
            total_minutes = total_minutes % (24 * 60)
            utc_hh = total_minutes // 60
            utc_mm = total_minutes % 60

            # Если смещение сдвигает за полночь — корректируем дни
            day_shift = (hh * 60 + mm - tz_offset * 60) // (24 * 60)

            # Конвертируем дни: у нас 0=пн..6=вс → cron 1=пн..7=вс (0=вс тоже работает)
            if isinstance(schedule_days, list):
                days_list = [int(d) for d in schedule_days]
            else:
                days_list = [int(d) for d in str(schedule_days).split(',') if d.strip()]

            # Применяем сдвиг дня если время переехало за полночь
            if day_shift != 0:
                days_list = [((d + day_shift) % 7) for d in days_list]

            cron_days = [(d + 1) % 7 for d in days_list]
            cron_days_str = ','.join(str(d) for d in sorted(set(cron_days)))

            cron_line = f'{utc_mm} {utc_hh} * * {cron_days_str} {self.SCHEDULER_SCRIPT} {task_id}'

            stdout, stderr, rc = self._call('set', MARKER, cron_line)
            if rc != 0 or stdout != 'OK':
                return Response({'error': f'Ошибка записи в crontab: {stderr or stdout}'}, status=500)

            utc_str = f'{utc_hh:02d}:{utc_mm:02d} UTC'
            tz_label = f'UTC+{tz_offset}' if tz_offset >= 0 else f'UTC{tz_offset}'
            action = f'Расписание включено: {schedule_time} ({tz_label}) = {utc_str}, дни {cron_days_str} (cron)'
        else:
            cron_line = None
            stdout, stderr, rc = self._call('remove', MARKER)
            if rc != 0:
                return Response({'error': f'Ошибка удаления из crontab: {stderr or stdout}'}, status=500)
            action = 'Расписание выключено'

        # Сохраняем настройки в БД
        t = _get_or_create_task(task_id)
        t.enabled = bool(enabled)
        if schedule_time:
            t.schedule_time = schedule_time
        if schedule_days:
            t.schedule_days = ','.join(str(d) for d in days_list) if isinstance(schedule_days, list) else str(schedule_days)
        t.save()

        return Response({'ok': True, 'message': action, 'cron_line': cron_line or 'удалено'})

    def get(self, request):
        """Показать текущую crontab-строку для задания"""
        task_id = request.query_params.get('task_id', 'update_rnm')
        MARKER  = f'{self.SCHEDULER_SCRIPT} {task_id}'
        stdout, stderr, rc = self._call('list', MARKER)
        if rc != 0:
            return Response({'error': stderr or 'Ошибка чтения crontab'}, status=500)
        return Response({'cron_line': stdout or None})

