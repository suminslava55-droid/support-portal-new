"""
Запустите этот скрипт для создания первого администратора:
docker compose exec backend python create_admin.py
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.accounts.models import User, Role

# Создаём роли
admin_role, _ = Role.objects.get_or_create(
    name='admin',
    defaults={
        'description': 'Полный доступ к системе',
        'can_view_all_clients': True,
        'can_create_client': True,
        'can_edit_client': True,
        'can_delete_client': True,
        'can_manage_users': True,
        'can_manage_roles': True,
        'can_manage_custom_fields': True,
    }
)

senior_role, _ = Role.objects.get_or_create(
    name='senior',
    defaults={
        'description': 'Просмотр и редактирование клиентов',
        'can_view_all_clients': True,
        'can_create_client': True,
        'can_edit_client': True,
        'can_delete_client': False,
        'can_manage_users': False,
        'can_manage_roles': False,
        'can_manage_custom_fields': False,
    }
)

sysadmin_role, _ = Role.objects.update_or_create(
    name='sysadmin',
    defaults={
        'description': 'Системный администратор — полный доступ кроме пользователей и настроек',
        'can_view_all_clients': True,
        'can_create_client': True,
        'can_edit_client': True,
        'can_delete_client': False,
        'can_manage_users': False,
        'can_manage_roles': False,
        'can_manage_custom_fields': False,
    }
)

communications_role, _ = Role.objects.update_or_create(
    name='communications',
    defaults={
        'description': 'Связист — полный доступ к клиентам, провайдерам и замене ФН; компании только просмотр; календарь/пользователи/настройки закрыты',
        'can_view_all_clients': True,
        'can_create_client': True,
        'can_edit_client': True,
        'can_delete_client': False,
        'can_manage_users': False,
        'can_manage_roles': False,
        'can_manage_custom_fields': False,
    }
)

# Создаём суперпользователя-администратора
email = input('Email администратора: ')
password = input('Пароль: ')
first_name = input('Имя: ')
last_name = input('Фамилия: ')

user = User.objects.create_superuser(
    email=email,
    password=password,
    first_name=first_name,
    last_name=last_name,
)
user.role = admin_role
user.save()

print(f'\n✅ Администратор создан: {user.full_name} ({user.email})')
print(f'✅ Роли созданы/обновлены: Администратор, Старший специалист, Системный администратор, Связист')
