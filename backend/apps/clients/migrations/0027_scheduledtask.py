from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0026_warehouse_code'),
    ]

    operations = [
        migrations.CreateModel(
            name='ScheduledTask',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('task_id', models.CharField(max_length=50, unique=True, verbose_name='Идентификатор задания')),
                ('name', models.CharField(max_length=200, verbose_name='Название')),
                ('schedule_time', models.CharField(blank=True, max_length=10, verbose_name='Время запуска (ЧЧ:ММ)')),
                ('schedule_days', models.CharField(blank=True, default='0,1,2,3,4', max_length=20, verbose_name='Дни недели')),
                ('enabled', models.BooleanField(default=False, verbose_name='Включено')),
                ('status', models.CharField(choices=[('idle', 'Ожидает'), ('running', 'Выполняется'), ('success', 'Успешно'), ('error', 'Ошибка')], default='idle', max_length=20, verbose_name='Статус')),
                ('last_run_at', models.DateTimeField(blank=True, null=True, verbose_name='Последний запуск')),
                ('last_run_result', models.TextField(blank=True, verbose_name='Результат последнего запуска')),
                ('progress', models.IntegerField(default=0, verbose_name='Прогресс (%)')),
                ('progress_text', models.CharField(blank=True, max_length=500, verbose_name='Текст прогресса')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
            ],
            options={
                'verbose_name': 'Регламентное задание',
                'verbose_name_plural': 'Регламентные задания',
            },
        ),
    ]
