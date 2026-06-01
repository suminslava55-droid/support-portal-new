from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion
import apps.clients.models


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0030_faqcategory_faqarticle'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FaqFile',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('file', models.FileField(upload_to=apps.clients.models.faq_file_path, verbose_name='Файл')),
                ('name', models.CharField(max_length=255, verbose_name='Имя файла')),
                ('size', models.PositiveIntegerField(default=0, verbose_name='Размер')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('article', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='files',
                    to='clients.faqarticle',
                    verbose_name='Статья',
                )),
                ('uploaded_by', models.ForeignKey(
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Загружен',
                )),
            ],
            options={
                'verbose_name': 'Файл FAQ',
                'verbose_name_plural': 'Файлы FAQ',
                'ordering': ['created_at'],
            },
        ),
    ]
