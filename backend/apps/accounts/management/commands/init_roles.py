from django.core.management.base import BaseCommand
from apps.accounts.models import Role


class Command(BaseCommand):
    help = 'Создание базовых ролей'

    def handle(self, *args, **kwargs):
        roles = [
            {
                'name': Role.ADMIN,
                'display_name': 'Администратор',
                'can_view_clients': True,
                'can_create_clients': True,
                'can_edit_clients': True,
                'can_delete_clients': True,
                'can_manage_users': True,
                'can_view_all_clients': True,
            },
            {
                'name': Role.SENIOR,
                'display_name': 'Старший специалист',
                'can_view_clients': True,
                'can_create_clients': True,
                'can_edit_clients': True,
                'can_delete_clients': False,
                'can_manage_users': False,
                'can_view_all_clients': True,
            },
            {
                'name': Role.SPECIALIST,
                'display_name': 'Специалист',
                'can_view_clients': True,
                'can_create_clients': True,
                'can_edit_clients': True,
                'can_delete_clients': False,
                'can_manage_users': False,
                'can_view_all_clients': False,
            },
            {
                'name': Role.VIEWER,
                'display_name': 'Только просмотр',
                'can_view_clients': True,
                'can_create_clients': False,
                'can_edit_clients': False,
                'can_delete_clients': False,
                'can_manage_users': False,
                'can_view_all_clients': True,
            },
        ]

        for role_data in roles:
            role, created = Role.objects.update_or_create(
                name=role_data['name'],
                defaults=role_data
            )
            status = 'Создана' if created else 'Обновлена'
            self.stdout.write(f'{status}: {role.display_name}')

        self.stdout.write(self.style.SUCCESS('Роли инициализированы успешно'))
