from django.db import migrations, models


class Migration(migrations.Migration):
    """
    Добавить поле allowed_email_domains в SystemSettings.
    Используется для ограничения доменов получателей при экспорте по email.
    Пустое значение = ограничений нет (обратная совместимость).
    """

    dependencies = [
        ('clients', '0034_pg_trgm_and_gin_indexes'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemsettings',
            name='allowed_email_domains',
            field=models.TextField(
                verbose_name='Разрешённые домены для отправки (через запятую)',
                blank=True,
                default='',
                help_text='Оставьте пустым чтобы разрешить любые домены. Пример: company.ru,company2.ru',
            ),
        ),
    ]
