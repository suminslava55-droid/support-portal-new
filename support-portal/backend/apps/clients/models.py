from django.db import models
from apps.accounts.models import User


class CustomFieldDefinition(models.Model):
    """Определение кастомного поля (создаётся администратором)"""
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


class Client(models.Model):
    STATUS_ACTIVE = 'active'
    STATUS_INACTIVE = 'inactive'
    STATUS_CHOICES = [
        (STATUS_ACTIVE, 'Активен'),
        (STATUS_INACTIVE, 'Неактивен'),
    ]

    # Основные поля
    last_name = models.CharField('Фамилия', max_length=100)
    first_name = models.CharField('Имя', max_length=100)
    middle_name = models.CharField('Отчество', max_length=100, blank=True)
    phone = models.CharField('Телефон', max_length=30, blank=True)
    email = models.EmailField('Email', blank=True)
    company = models.CharField('Компания / организация', max_length=200, blank=True)
    address = models.TextField('Адрес', blank=True)
    status = models.CharField('Статус', max_length=20, choices=STATUS_CHOICES, default=STATUS_ACTIVE)

    # Метаданные
    assigned_to = models.ForeignKey(
        User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='assigned_clients', verbose_name='Ответственный'
    )
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
        return f'{self.last_name} {self.first_name}'

    @property
    def full_name(self):
        parts = [self.last_name, self.first_name, self.middle_name]
        return ' '.join(p for p in parts if p)


class CustomFieldValue(models.Model):
    """Значение кастомного поля для конкретного клиента"""
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='custom_field_values')
    field = models.ForeignKey(CustomFieldDefinition, on_delete=models.CASCADE)
    value = models.TextField('Значение', blank=True)

    class Meta:
        unique_together = ['client', 'field']
        verbose_name = 'Значение кастомного поля'

    def __str__(self):
        return f'{self.client} - {self.field}: {self.value}'


class ClientNote(models.Model):
    """Заметки по клиенту"""
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='notes')
    author = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='notes')
    text = models.TextField('Текст заметки')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Заметка'
        verbose_name_plural = 'Заметки'
        ordering = ['-created_at']

    def __str__(self):
        return f'Заметка для {self.client} от {self.author}'


class ClientActivity(models.Model):
    """Лог изменений карточки клиента"""
    client = models.ForeignKey(Client, on_delete=models.CASCADE, related_name='activities')
    user = models.ForeignKey(User, on_delete=models.SET_NULL, null=True)
    action = models.CharField('Действие', max_length=200)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'Активность'
        ordering = ['-created_at']
