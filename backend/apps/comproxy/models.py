import uuid

from django.conf import settings
from django.db import models
from apps.clients.models import KktData


class ProxyDevice(models.Model):
    """Устройство ComProxy (один AgentService), идентифицируется по UUID"""

    MATCH_CHOICES = [
        ('auto', 'Автоматически'),
        ('manual', 'Вручную'),
    ]

    uuid = models.CharField('UUID устройства', max_length=36, unique=True, db_index=True)
    kkt_data = models.ForeignKey(
        KktData, on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='proxy_devices',
        verbose_name='Привязанная ККТ',
    )

    # Из cash_info_report
    registry_number = models.CharField('РНМ', max_length=50, blank=True, db_index=True)
    factory_number = models.CharField('Заводской номер', max_length=50, blank=True)
    fn_number = models.CharField('Номер ФН', max_length=50, blank=True)
    kkt_name = models.CharField('Модель ККТ', max_length=200, blank=True)
    ffd_version = models.CharField('Версия ФФД', max_length=10, blank=True)
    inn = models.CharField('ИНН', max_length=12, blank=True)
    fiscal_address = models.TextField('Адрес установки', blank=True)
    ip_address = models.CharField('IP устройства', max_length=45, blank=True)

    # Версии ПО
    comproxy_version = models.CharField('Версия ComProxy', max_length=50, blank=True)
    firmware_version = models.CharField('Версия прошивки', max_length=50, blank=True)
    fito_version = models.CharField('Версия FITO', max_length=50, blank=True)

    # Полные данные (задел на будущее)
    raw_cash_info = models.JSONField('Полный cash_info_report', default=dict, blank=True)
    raw_registration_report = models.JSONField('Полный registration_report', default=dict, blank=True)
    supported_methods = models.JSONField('Методы из handshake', default=dict, blank=True)

    # Привязка
    match_method = models.CharField('Способ привязки', max_length=20, blank=True, choices=MATCH_CHOICES)
    matched_at = models.DateTimeField('Дата привязки', null=True, blank=True)

    # Временные метки
    first_seen_at = models.DateTimeField('Первое появление', auto_now_add=True)
    last_seen_at = models.DateTimeField('Последний отклик', auto_now=True)
    cash_info_at = models.DateTimeField('Последний cash_info_report', null=True, blank=True)

    class Meta:
        verbose_name = 'Устройство ComProxy'
        verbose_name_plural = 'Устройства ComProxy'
        ordering = ['-last_seen_at']

    def __str__(self):
        label = self.registry_number or self.uuid[:8]
        return f'ComProxy {label}'


class ProxyTelemetry(models.Model):
    """Текущее состояние устройства (только последнее значение counters_report)"""

    device = models.OneToOneField(
        ProxyDevice, on_delete=models.CASCADE,
        related_name='telemetry',
        verbose_name='Устройство',
    )

    # Смена
    shift_status = models.CharField('Статус смены', max_length=10, blank=True)
    shift_exceeded_24h = models.BooleanField('Смена > 24ч', default=False)

    # Флаги
    kkt_flags_fatal = models.IntegerField('Фатальные флаги', default=0)
    kkt_flags_current = models.IntegerField('Текущие флаги', default=0)
    fn_flags = models.IntegerField('Флаги ФН', default=0)

    # Неотправленные документы
    unsent_ofd_count = models.IntegerField('Неотправленных в ОФД', default=0)
    unsent_oism_count = models.IntegerField('Неотправленных в ОИСМ', default=0)

    # Полные данные
    raw_counters = models.JSONField('Полный counters_report', default=dict, blank=True)

    updated_at = models.DateTimeField('Обновлено', auto_now=True)

    class Meta:
        verbose_name = 'Телеметрия ComProxy'
        verbose_name_plural = 'Телеметрия ComProxy'

    def __str__(self):
        return f'Телеметрия {self.device}'


class UpdatePackage(models.Model):
    """Пакет обновления ПО (ComProxy JAR или прошивка ККТ)"""

    PRODUCT_TYPE_CHOICES = [
        ('COMPROXY', 'ComProxy'),
        ('FIRMWARE', 'Прошивка ККТ'),
    ]

    product_type = models.CharField('Тип', max_length=20, choices=PRODUCT_TYPE_CHOICES)
    version = models.CharField('Версия', max_length=50)
    version_from = models.CharField('Совместимо с версии', max_length=50, blank=True)
    project = models.CharField('Проект', max_length=50, default='CSI')
    product = models.CharField('Продукт', max_length=50, default='ComProxy')

    file = models.FileField('Файл', upload_to='comproxy/updates/')
    filename = models.CharField('Имя файла', max_length=255)
    file_size = models.PositiveIntegerField('Размер (байт)', default=0)
    md5 = models.CharField('MD5', max_length=32, blank=True)

    info = models.TextField('Описание', blank=True)
    enabled = models.BooleanField('Активен', default=True)
    barrier = models.BooleanField('Барьерное обновление', default=False)

    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Загрузил',
    )
    created_at = models.DateTimeField('Дата загрузки', auto_now_add=True)

    class Meta:
        verbose_name = 'Пакет обновления'
        verbose_name_plural = 'Пакеты обновлений'
        ordering = ['-created_at']
        unique_together = [('product_type', 'project', 'product', 'version')]

    def __str__(self):
        return f'{self.get_product_type_display()} {self.version}'


class DeviceTask(models.Model):
    """Задача для устройства (отправляется через poll)"""

    STATUS_CHOICES = [
        ('PENDING', 'Ожидает'),
        ('SENT', 'Отправлена'),
        ('SUCCESS', 'Успешно'),
        ('ERROR', 'Ошибка'),
        ('CANCELLED', 'Отменена'),
    ]

    task_id = models.UUIDField('ID задачи', default=uuid.uuid4, unique=True, db_index=True)
    device = models.ForeignKey(
        ProxyDevice, on_delete=models.CASCADE,
        related_name='tasks', verbose_name='Устройство',
    )
    update_package = models.ForeignKey(
        UpdatePackage, on_delete=models.SET_NULL,
        null=True, blank=True, related_name='tasks',
        verbose_name='Пакет обновления',
    )
    task_type = models.CharField('Тип задачи', max_length=50, default='update_software')
    task_data = models.JSONField('Payload', default=dict)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default='PENDING')
    result_message = models.TextField('Результат', blank=True)

    sent_at = models.DateTimeField('Отправлена', null=True, blank=True)
    completed_at = models.DateTimeField('Завершена', null=True, blank=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL,
        null=True, blank=True, verbose_name='Инициатор',
    )
    created_at = models.DateTimeField('Создана', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлена', auto_now=True)

    class Meta:
        verbose_name = 'Задача устройства'
        verbose_name_plural = 'Задачи устройств'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['device', 'status']),
        ]

    def __str__(self):
        return f'{self.task_type} → {self.device} [{self.status}]'
