from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0018_provider2_fields'),
    ]

    operations = [
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_host',
            field=models.CharField(blank=True, max_length=200, verbose_name='SMTP сервер'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_port',
            field=models.PositiveIntegerField(default=465, verbose_name='SMTP порт'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_user',
            field=models.CharField(blank=True, max_length=200, verbose_name='SMTP пользователь'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_password_encrypted',
            field=models.TextField(blank=True, verbose_name='SMTP пароль (зашифрован)'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_from_email',
            field=models.CharField(blank=True, max_length=200, verbose_name='Отправитель (From)'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_from_name',
            field=models.CharField(blank=True, max_length=200, verbose_name='Имя отправителя'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_use_ssl',
            field=models.BooleanField(default=True, verbose_name='Использовать SSL'),
        ),
        migrations.AddField(
            model_name='systemsettings',
            name='smtp_use_tls',
            field=models.BooleanField(default=False, verbose_name='Использовать TLS (STARTTLS)'),
        ),
    ]
