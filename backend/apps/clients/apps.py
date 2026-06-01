from django.apps import AppConfig


class ClientsConfig(AppConfig):
    name = 'apps.clients'
    verbose_name = 'Клиенты'

    def ready(self):
        """Сброс зависших заданий при старте сервера."""
        try:
            from .models import ScheduledTask
            ScheduledTask.objects.filter(status='running').update(
                status='idle',
                progress=0,
                progress_text='Сброшено при перезапуске сервера',
            )
        except Exception:
            pass  # БД может быть недоступна при первом запуске
