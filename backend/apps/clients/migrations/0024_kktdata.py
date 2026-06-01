from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0023_customholiday'),
    ]

    operations = [
        migrations.CreateModel(
            name='KktData',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('kkt_reg_id', models.CharField(blank=True, max_length=50, verbose_name='РНМ (рег. номер ККТ)')),
                ('serial_number', models.CharField(blank=True, max_length=50, verbose_name='Серийный номер ККТ')),
                ('fn_number', models.CharField(blank=True, max_length=50, verbose_name='Номер ФН')),
                ('kkt_model', models.CharField(blank=True, max_length=100, verbose_name='Модель ККТ')),
                ('create_date', models.DateTimeField(blank=True, null=True, verbose_name='Дата создания')),
                ('check_date', models.DateTimeField(blank=True, null=True, verbose_name='Дата проверки')),
                ('activation_date', models.DateTimeField(blank=True, null=True, verbose_name='Дата активации')),
                ('first_document_date', models.DateTimeField(blank=True, null=True, verbose_name='Дата первого документа')),
                ('contract_start_date', models.DateTimeField(blank=True, null=True, verbose_name='Начало договора ОФД')),
                ('contract_end_date', models.DateTimeField(blank=True, null=True, verbose_name='Конец договора ОФД')),
                ('fn_end_date', models.DateTimeField(blank=True, null=True, verbose_name='Конец ФН')),
                ('last_doc_on_kkt', models.DateTimeField(blank=True, null=True, verbose_name='Последний документ на ККТ')),
                ('last_doc_on_ofd', models.DateTimeField(blank=True, null=True, verbose_name='Последний документ в ОФД')),
                ('fiscal_address', models.TextField(blank=True, verbose_name='Адрес установки')),
                ('raw_data', models.JSONField(blank=True, default=dict, verbose_name='Исходные данные ОФД')),
                ('fetched_at', models.DateTimeField(auto_now=True, verbose_name='Дата обновления')),
                ('client', models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name='kkt_data', to='clients.client', verbose_name='Клиент')),
            ],
            options={
                'verbose_name': 'Данные ККТ',
                'verbose_name_plural': 'Данные ККТ',
                'ordering': ['kkt_reg_id'],
            },
        ),
    ]
