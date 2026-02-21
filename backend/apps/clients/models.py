from django.db import models
from apps.accounts.models import User


class CustomFieldDefinition(models.Model):
    TYPE_TEXT = 'text'
    TYPE_SELECT = 'select'
    TYPE_CHOICES = [
        (TYPE_TEXT, 'Текст'),
        (TYPE_SELECT, 'Список выбора'),
    ]
    name = models.CharField('Название', max_length=100)
    field_type = models.CharField('Тип', max_length=20, choices=TYPE_CHOICES, default=TYPE_SELECT)
    options = models.JSONField('Варианты (для списка)', default=list, blank=True)
    is_required = models.BooleanField('Обязательное', default=False)
    order = models.PositiveIntegerField('Порядок', default=0)
    is_active = models.BooleanField('Активно', default=True)

    class Meta:
        verbose_name = 'Кастомное поле'
        verbose_name_plural = 'Кастомные поля'
        ordering = ['order', 'name']

    def __str__(self):
        return self.name


class Provider(models.Model):
    name = models.CharField('Название провайдера', max_length=200)
    support_phones = models.TextField('Телефоны техподдержки', blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Провайдер'
        verbose_name_plural = 'Провайдеры'
        ordering = ['name']

    def __str__(self):
        return self.name


class Client(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Активен'),
        (STATUS_INACTIVE, 'Неактивен'),
    ]

    last_name = models.CharField('Фамилия', max_length=100, blank=True, default='')
    first_name = models.CharField('Имя', max_length=100, blank=True, default='')
    middle_name = models.CharField('Отчество', max_length=100, blank=True, default='')
    inn = models.CharField('ИНН', max_length=12, blank=True)
    phone = models.CharField('Телефон', max_length=30, blank=True)
    iccid = models.CharField('ICCID', max_length=30, blank=True)
    email = models.EmailField('Email', blank=True)
    pharmacy_code = models.CharField('Код аптеки', max_length=50, blank=True)
    company = models.CharField('Компания / организация', max_length=200, blank=True)
    address = models.TextField('Адрес', blank=True)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)
    provider = models.ForeignKey(
        Provider, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='clients', verbose_name='Провайдер'
    )
    personal_account = models.CharField('Лицевой счёт', max_length=100, blank=True)
    contract_number = models.CharField('№ договора', max_length=100, blank=True)
    tariff = models.CharField('Тариф', max_length=50, blank=True)
    connection_type = models.CharField('Тип подключения', max_length=50, blank=True, choices=[
        ('fiber', 'Оптоволокно'),
        ('dsl', 'DSL'),
        ('cable', 'Кабель'),
        ('wireless', 'Беспроводное'),
        ('modem', 'Модем'),
        ('mrnet', 'MR-Net'),
    ])
    provider_settings = models.TextField('Настройки провайдера', blank=True)
    subnet = models.CharField('Подсеть аптеки', max_length=50, blank=True)
    external_ip = models.CharField('Внешний IP', max_length=50, blank=True)
    provider_equipment = models.BooleanField('Оборудование провайдера', default=False)
    is_draft = models.BooleanField('Черновик', default=False)
    created_by = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True,
        related_name='created_clients', verbose_name='Создал'
    )
    created_at = models.DateTimeField('Создан', auto_now_add=True)
    updated_at = models.DateTimeField('Обновлён', auto_now=True)

    class Meta:
        verbose_name = 'Клиент'
        verbose_name_plural = 'Клиенты'
        ordering = ['-created_at']

    def __str__(self):
        return self.company or self.address or f'Клиент #{self.id}'

    @property
    def display_name(self):
        return self.company or self.address or f'Клиент #{self.id}'

    @property
    def mikrotik_ip(self):
        if not self.subnet:
            return ''
        try:
            network = self.subnet.split('/')[0]
            parts = network.split('.')
            if len(parts) == 4:
                parts[3] = '1'
                return '.'.join(parts)
        except Exception:
            pass
        return ''

    @property
    def server_ip(self):
        if not self.subnet:
            return ''
        try:
            network = self.subnet.split('/')[0]
            parts = network.split('.')
            if len(parts) == 4:
                parts[3] = '2'
                return '.'.join(parts)
        except Exception:
            pass
        return ''


class CustomFieldValue(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='custom_field_values')
    field = models.ForeignKey(CustomFieldDefinition, on_delete=models.CASCADE)
    value = models.TextField('Значение', blank=True)

    class Meta:
        unique_together = ['client', 'field']
        verbose_name = 'Значение кастомного поля'


class ClientNote(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='notes')
    text = models.TextField('Текст заметки')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Заметка'
        verbose_name_plural = 'Заметки'
        ordering = ['-created_at']


class ClientActivity(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='activities')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField('Действие', max_length=500)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Активность'
        ordering = ['-created_at']


def client_file_path(instance, filename):
    return f'clients/{instance.client.id}/{filename}'


class ClientFile(models.Model):
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='files')
    file = models.FileField('Файл', upload_to=client_file_path)
    name = models.CharField('Имя файла', max_length=255)
    size = models.PositiveIntegerField('Размер', default=0)
    uploaded_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Файл'
        verbose_name_plural = 'Файлы'
        ordering = ['-created_at']

    def __str__(self):
        return self.name


def encrypt_value(value):
    if not value:
        return ''
    from cryptography.fernet import Fernet
    from django.conf import settings as django_settings
    f = Fernet(django_settings.ENCRYPTION_KEY.encode())
    return f.encrypt(value.encode()).decode()


def decrypt_value(value):
    if not value:
        return ''
    try:
        from cryptography.fernet import Fernet
        from django.conf import settings as django_settings
        f = Fernet(django_settings.ENCRYPTION_KEY.encode())
        return f.decrypt(value.encode()).decode()
    except Exception:
        return ''


class SystemSettings(models.Model):
    ssh_user = models.CharField('SSH пользователь', max_length=100, blank=True)
    ssh_password_encrypted = models.TextField('SSH пароль (зашифрован)', blank=True)
    updated_at = models.DateTimeField('Обновлено', auto_now=True)

    class Meta:
        verbose_name = 'Настройки системы'
        verbose_name_plural = 'Настройки системы'

    @property
    def ssh_password(self):
        return decrypt_value(self.ssh_password_encrypted)

    def set_ssh_password(self, value):
        self.ssh_password_encrypted = encrypt_value(value)

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)

    @classmethod
    def get(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
