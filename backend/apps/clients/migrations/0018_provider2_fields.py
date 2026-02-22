from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0017_client_modem_iccid_client_modem_number'),
    ]

    operations = [
        migrations.AddField(
            model_name='client',
            name='provider2',
            field=models.ForeignKey(
                blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL,
                related_name='clients2', to='clients.provider', verbose_name='Провайдер 2'
            ),
        ),
        migrations.AddField(
            model_name='client',
            name='personal_account2',
            field=models.CharField(blank=True, max_length=100, verbose_name='Лицевой счёт 2'),
        ),
        migrations.AddField(
            model_name='client',
            name='contract_number2',
            field=models.CharField(blank=True, max_length=100, verbose_name='№ договора 2'),
        ),
        migrations.AddField(
            model_name='client',
            name='tariff2',
            field=models.CharField(blank=True, max_length=50, verbose_name='Тариф 2'),
        ),
        migrations.AddField(
            model_name='client',
            name='connection_type2',
            field=models.CharField(
                blank=True, max_length=50, verbose_name='Тип подключения 2',
                choices=[
                    ('fiber', 'Оптоволокно'), ('dsl', 'DSL'), ('cable', 'Кабель'),
                    ('wireless', 'Беспроводное'), ('modem', 'Модем'), ('mrnet', 'MR-Net'),
                ]
            ),
        ),
        migrations.AddField(
            model_name='client',
            name='modem_number2',
            field=models.CharField(blank=True, max_length=100, verbose_name='Номер модема/SIM 2'),
        ),
        migrations.AddField(
            model_name='client',
            name='modem_iccid2',
            field=models.CharField(blank=True, max_length=100, verbose_name='ICCID модема 2'),
        ),
        migrations.AddField(
            model_name='client',
            name='provider_settings2',
            field=models.TextField(blank=True, verbose_name='Настройки провайдера 2'),
        ),
        migrations.AddField(
            model_name='client',
            name='provider_equipment2',
            field=models.BooleanField(default=False, verbose_name='Оборудование провайдера 2'),
        ),
    ]
