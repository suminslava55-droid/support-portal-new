from rest_framework.permissions import BasePermission


class IsAdmin(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_perm_flag('can_manage_users')


class CanManageCustomFields(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_perm_flag('can_manage_custom_fields')


class CanEditClient(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if request.method in ('GET', 'HEAD', 'OPTIONS'):
            return True
        return request.user.has_perm_flag('can_edit_client')


class CanDeleteClient(BasePermission):
    def has_permission(self, request, view):
        return request.user.is_authenticated and request.user.has_perm_flag('can_delete_client')
