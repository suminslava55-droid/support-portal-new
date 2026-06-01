from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0027_scheduledtask'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemsettings',
            name='timezone_offset',
            field=models.IntegerField(
                default=0,
                help_text='Например: +3 для Москвы, +6 для Омска, 0 для UTC',
                verbose_name='Часовой пояс (смещение от UTC)',
            ),
        ),
    ]
