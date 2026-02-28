from rest_framework import serializers
from rest_framework_simplejwt.serializers import TokenObtainPairSerializer
from .models import User, Role


class RoleSerializer(serializers.ModelSerializer):
    name_display = serializers.CharField(source='get_name_display', read_only=True)

    class Meta:
        model = Role
        fields = '__all__'


class UserSerializer(serializers.ModelSerializer):
    role_data = RoleSerializer(source='role', read_only=True)
    full_name = serializers.CharField(read_only=True)
    password = serializers.CharField(write_only=True, required=False)

    class Meta:
        model = User
        fields = ['id', 'email', 'first_name', 'last_name', 'middle_name',
                  'full_name', 'role', 'role_data', 'is_active', 'date_joined', 'password', 'birthday']
        read_only_fields = ['date_joined']

    def create(self, validated_data):
        password = validated_data.pop('password', None)
        user = User(**validated_data)
        if password:
            user.set_password(password)
        user.save()
        return user

    def update(self, instance, validated_data):
        password = validated_data.pop('password', None)
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        if password:
            instance.set_password(password)
        instance.save()
        return instance


class CustomTokenObtainPairSerializer(TokenObtainPairSerializer):
    def validate(self, attrs):
        data = super().validate(attrs)
        user = self.user
        role_data = None
        if user.role:
            role_data = {
                'name': user.role.name,
                'display': user.role.get_name_display(),
            }
        data['user'] = {
            'id': user.id,
            'email': user.email,
            'full_name': user.full_name,
            'is_superuser': user.is_superuser,
            'role': user.role.name if user.role else None,
            'role_display': user.role.get_name_display() if user.role else None,
            'role_data': role_data,
            'permissions': {
                'can_view_all_clients': user.has_perm_flag('can_view_all_clients'),
                'can_create_client': user.has_perm_flag('can_create_client'),
                'can_edit_client': user.has_perm_flag('can_edit_client'),
                'can_delete_client': user.has_perm_flag('can_delete_client'),
                'can_manage_users': user.has_perm_flag('can_manage_users'),
                'can_manage_roles': user.has_perm_flag('can_manage_roles'),
                'can_manage_custom_fields': user.has_perm_flag('can_manage_custom_fields'),
            } if user.role else {}
        }
        return data
