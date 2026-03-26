from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0029_alter_scheduledtask_schedule_days'),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        migrations.CreateModel(
            name='FaqCategory',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=200, verbose_name='Название')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='Порядок')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
            ],
            options={
                'verbose_name': 'Категория FAQ',
                'verbose_name_plural': 'Категории FAQ',
                'ordering': ['order', 'name'],
            },
        ),
        migrations.CreateModel(
            name='FaqArticle',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('title', models.CharField(max_length=500, verbose_name='Заголовок')),
                ('content', models.TextField(blank=True, verbose_name='Содержимое (Markdown)')),
                ('order', models.PositiveIntegerField(default=0, verbose_name='Порядок')),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('updated_at', models.DateTimeField(auto_now=True)),
                ('category', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='articles',
                    to='clients.faqcategory',
                    verbose_name='Категория',
                )),
                ('author', models.ForeignKey(
                    blank=True,
                    null=True,
                    on_delete=django.db.models.deletion.SET_NULL,
                    related_name='faq_articles',
                    to=settings.AUTH_USER_MODEL,
                    verbose_name='Автор',
                )),
            ],
            options={
                'verbose_name': 'Статья FAQ',
                'verbose_name_plural': 'Статьи FAQ',
                'ordering': ['order', 'created_at'],
            },
        ),
    ]
