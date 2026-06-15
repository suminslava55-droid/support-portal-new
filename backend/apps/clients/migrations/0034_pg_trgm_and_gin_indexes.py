"""
Миграция 0034: установить расширение pg_trgm и GIN-индексы для fuzzy-поиска.

ЗАЧЕМ:
  search_utils.py использует TrigramSimilarity для нечёткого поиска клиентов
  (ClientsPage, GlobalSearchView, FaqPage, FnReplacementPage), но расширение
  pg_trgm никогда не создавалось через миграции.

  Без расширения fuzzy-поиск молча деградирует до точного совпадения:
  bare except в search_utils.py строка ~35 проглатывает ошибку без лога.

  GIN-индексы с gin_trgm_ops нужны для производительности — без них каждый
  поисковый запрос делает sequential scan по всей таблице клиентов/статей.

НА БОЕВОМ СЕРВЕРЕ ПЕРЕД ПРИМЕНЕНИЕМ:
  Если пользователь БД не суперпользователь, выполнить вручную от postgres:
    docker exec support-portal-db-1 psql -U postgres -d support_portal \
      -c "CREATE EXTENSION IF NOT EXISTS pg_trgm;"
  После этого TrigramExtension() в миграции пройдёт без ошибки (IF NOT EXISTS).
"""
from django.db import migrations
from django.contrib.postgres.operations import TrigramExtension
from django.contrib.postgres.indexes import GinIndex


class Migration(migrations.Migration):

    dependencies = [
        ('clients', '0033_faqarticlehistory'),
    ]

    operations = [
        # Создаёт: CREATE EXTENSION IF NOT EXISTS pg_trgm
        # Требует прав суперпользователя БД при первой установке.
        TrigramExtension(),

        # GIN trigram-индекс на Client.address — основное поле fuzzy-поиска
        migrations.AddIndex(
            model_name='client',
            index=GinIndex(
                fields=['address'],
                name='client_address_gin_idx',
                opclasses=['gin_trgm_ops'],
            ),
        ),

        # GIN trigram-индекс на Client.last_name — поиск по фамилии ответственного
        migrations.AddIndex(
            model_name='client',
            index=GinIndex(
                fields=['last_name'],
                name='client_lastname_gin_idx',
                opclasses=['gin_trgm_ops'],
            ),
        ),

        # GIN trigram-индекс на FaqArticle.title — поиск в базе знаний
        migrations.AddIndex(
            model_name='faqarticle',
            index=GinIndex(
                fields=['title'],
                name='faq_title_gin_idx',
                opclasses=['gin_trgm_ops'],
            ),
        ),
    ]
