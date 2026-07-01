from django.db import models


def pc_job_upload_to(instance, filename):
    """Файл каждого задания — в своей подпапке pc_jobs/<id>/, чтобы имя не искажалось."""
    return f'pc_jobs/{instance.pk or "tmp"}/{filename}'


class PcJob(models.Model):
    """Один запуск задания на ПК аптек (серверы и/или кассы)."""

    TYPE_COPY = 'copy_file'
    TYPE_SCRIPT = 'run_script'
    TYPE_CHOICES = [
        (TYPE_COPY, 'Скопировать файл'),
        (TYPE_SCRIPT, 'Выполнить скрипт'),
    ]

    KIND_PS = 'powershell'
    KIND_CMD = 'cmd'
    KIND_CHOICES = [
        (KIND_PS, 'PowerShell'),
        (KIND_CMD, 'cmd'),
    ]

    MODE_SERVER = 'server'
    MODE_KASSA = 'kassa'
    MODE_BOTH = 'both'
    MODE_CHOICES = [
        (MODE_SERVER, 'Сервер'),
        (MODE_KASSA, 'Кассы'),
        (MODE_BOTH, 'Сервер + кассы'),
    ]

    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_DONE = 'done'
    STATUS_CANCELLED = 'cancelled'
    STATUS_ERROR = 'error'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Ожидает'),
        (STATUS_RUNNING, 'Выполняется'),
        (STATUS_DONE, 'Завершено'),
        (STATUS_CANCELLED, 'Отменено'),
        (STATUS_ERROR, 'Ошибка'),
    ]

    job_type = models.CharField('Тип', max_length=20, choices=TYPE_CHOICES)
    script_kind = models.CharField('Вид скрипта', max_length=20, choices=KIND_CHOICES, blank=True)
    script_text = models.TextField('Текст скрипта', blank=True)
    file = models.FileField('Файл', upload_to=pc_job_upload_to, null=True, blank=True)
    dest_path = models.CharField('Путь назначения', max_length=500, blank=True)
    target_mode = models.CharField('Цель', max_length=10, choices=MODE_CHOICES, default=MODE_SERVER)
    client_ids = models.JSONField('Клиенты (снимок выбора)', default=list)

    status = models.CharField('Статус', max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)
    progress = models.PositiveSmallIntegerField('Прогресс, %', default=0)
    total_targets = models.PositiveIntegerField('Всего целей', default=0)
    done_targets = models.PositiveIntegerField('Обработано', default=0)
    ok_targets = models.PositiveIntegerField('Успешно', default=0)
    err_targets = models.PositiveIntegerField('Ошибок', default=0)
    cancel_requested = models.BooleanField('Запрошена отмена', default=False)

    created_by = models.ForeignKey('accounts.User', on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField('Создано', auto_now_add=True)
    finished_at = models.DateTimeField('Завершено', null=True, blank=True)
    repeat_of = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True,
                                  related_name='repeats')

    class Meta:
        verbose_name = 'Задание на ПК'
        verbose_name_plural = 'Задания на ПК'
        ordering = ['-created_at']

    def __str__(self):
        return f'#{self.id} {self.get_job_type_display()} ({self.status})'


class PcJobTarget(models.Model):
    """Результат выполнения задания на одном ПК (сервер или касса)."""

    STATUS_PENDING = 'pending'
    STATUS_RUNNING = 'running'
    STATUS_SUCCESS = 'success'
    STATUS_ERROR = 'error'
    STATUS_UNREACHABLE = 'unreachable'
    STATUS_SKIPPED = 'skipped'
    STATUS_CHOICES = [
        (STATUS_PENDING, 'Ожидает'),
        (STATUS_RUNNING, 'Выполняется'),
        (STATUS_SUCCESS, 'Успех'),
        (STATUS_ERROR, 'Ошибка'),
        (STATUS_UNREACHABLE, 'Недоступен'),
        (STATUS_SKIPPED, 'Пропущено'),
    ]

    job = models.ForeignKey(PcJob, on_delete=models.CASCADE, related_name='targets')
    client = models.ForeignKey('clients.Client', on_delete=models.SET_NULL, null=True, blank=True)
    client_address = models.CharField('Адрес аптеки', max_length=500, blank=True)
    role = models.CharField('Роль', max_length=10)  # server / kassa1..6
    ip = models.CharField('IP', max_length=45, blank=True)
    transport = models.CharField('Транспорт', max_length=10, blank=True)  # winrm / wmi / smb
    status = models.CharField('Статус', max_length=12, choices=STATUS_CHOICES, default=STATUS_PENDING)
    exit_code = models.IntegerField('Код возврата', null=True, blank=True)
    result_message = models.TextField('Результат', blank=True)
    started_at = models.DateTimeField('Начато', null=True, blank=True)
    finished_at = models.DateTimeField('Завершено', null=True, blank=True)

    class Meta:
        verbose_name = 'Цель задания'
        verbose_name_plural = 'Цели задания'
        ordering = ['id']
        indexes = [models.Index(fields=['job', 'status'])]

    def __str__(self):
        return f'{self.client_address} [{self.role}] {self.ip} ({self.status})'
