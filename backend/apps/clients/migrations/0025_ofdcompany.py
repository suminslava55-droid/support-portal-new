from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0024_kktdata'),
    ]

    operations = [
        # 1. Создаём модель OfdCompany
        migrations.CreateModel(
            name='OfdCompany',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Название компании')),
                ('inn', models.CharField(max_length=12, verbose_name='ИНН')),
                ('ofd_token_encrypted', models.TextField(blank=True, verbose_name='Токен ОФД (зашифрован)')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Компания ОФД',
                'verbose_name_plural': 'Компании ОФД',
                'ordering': ['name'],
            },
        ),
        # 2. Добавляем FK ofd_company в Client (nullable)
        migrations.AddField(
            model_name='client',
            name='ofd_company',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='clients',
                to='clients.ofdcompany',
                verbose_name='Компания',
            ),
        ),
        # 3. Убираем старые поля inn и company
        migrations.RemoveField(
            model_name='client',
            name='inn',
        ),
        migrations.RemoveField(
            model_name='client',
            name='company',
        ),
    ]
