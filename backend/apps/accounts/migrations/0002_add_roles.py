from django.db import migrations


def add_roles(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')

    # Переименовываем "Старший специалист" → "Системный администратор"
    Role.objects.filter(name='senior').update(name='sysadmin')

    # Добавляем роль "Связист" — доступ только к клиентам и провайдерам
    Role.objects.get_or_create(
        name='communications',
        defaults={
            'description': 'Доступ к разделам Клиенты и Провайдеры',
            'can_view_all_clients': True,
            'can_create_client': False,
            'can_edit_client': False,
            'can_delete_client': False,
            'can_manage_users': False,
            'can_manage_roles': False,
            'can_manage_custom_fields': False,
        }
    )


def reverse_roles(apps, schema_editor):
    Role = apps.get_model('accounts', 'Role')
    Role.objects.filter(name='sysadmin').update(name='senior')
    Role.objects.filter(name='communications').delete()


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
    ]

    operations = [
        migrations.RunPython(add_roles, reverse_roles),
    ]
