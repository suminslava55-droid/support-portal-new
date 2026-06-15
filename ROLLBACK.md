# Откат к предыдущей версии

## Быстрый откат (только код)

```bash
# Откатить последний коммит (сохранить изменения)
git revert HEAD --no-edit
git push

# Применить на сервере
./update.sh
```

## Откат с миграциями

Если новая версия содержала миграции БД:

```bash
# 1. Узнать имя предыдущей миграции:
docker exec support-portal-backend-1 python manage.py showmigrations clients

# 2. Откатить до нужной:
docker exec support-portal-backend-1 python manage.py migrate clients 0033_previous_migration

# 3. Откатить код:
git revert HEAD --no-edit && git push && ./update.sh
```

## Откат до конкретного коммита

```bash
# 1. Найти нужный коммит:
git log --oneline -20

# 2. Создать revert-коммит (безопасно, не переписывает историю):
git revert <bad_commit_hash> --no-edit
git push

# 3. На сервере:
./update.sh
```

## Восстановление БД из бэкапа

```bash
# Список бэкапов:
ls /opt/support-portal/backups/

# Восстановить через веб-интерфейс: Настройки → Регламентные задания → Бэкапы
# Или через API (требует токен администратора):
curl -X POST http://localhost/api/clients/backups/restore/ \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"filename": "backup_2026-06-14_03-00-00"}'
```
