from rest_framework import serializers
from .models import Client, ClientNote, CustomFieldDefinition, CustomFieldValue, ClientActivity
from apps.accounts.serializers import UserSerializer


class CustomFieldDefinitionSerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomFieldDefinition
        fields = '__all__'


class CustomFieldValueSerializer(serializers.ModelSerializer):
    field_name = serializers.CharField(source='field.name', read_only=True)
    field_type = serializers.CharField(source='field.field_type', read_only=True)
    field_options = serializers.JSONField(source='field.options', read_only=True)

    class Meta:
        model = CustomFieldValue
        fields = ['id', 'field', 'field_name', 'field_type', 'field_options', 'value']


class ClientNoteSerializer(serializers.ModelSerializer):
    author_name = serializers.CharField(source='author.full_name', read_only=True)

    class Meta:
        model = ClientNote
        fields = ['id', 'text', 'author', 'author_name', 'created_at', 'updated_at']
        read_only_fields = ['author', 'created_at', 'updated_at']


class ClientActivitySerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)

    class Meta:
        model = ClientActivity
        fields = ['id', 'action', 'user_name', 'created_at']


class ClientListSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    assigned_to_name = serializers.CharField(source='assigned_to.full_name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'full_name', 'last_name', 'first_name', 'middle_name',
                  'phone', 'email', 'company', 'status', 'status_display',
                  'assigned_to', 'assigned_to_name', 'created_at']


class ClientDetailSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    assigned_to_data = UserSerializer(source='assigned_to', read_only=True)
    created_by_data = UserSerializer(source='created_by', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    custom_field_values = CustomFieldValueSerializer(many=True, read_only=True)
    notes = ClientNoteSerializer(many=True, read_only=True)
    activities = ClientActivitySerializer(many=True, read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class ClientWriteSerializer(serializers.ModelSerializer):
    custom_fields = serializers.JSONField(write_only=True, required=False)

    class Meta:
        model = Client
        exclude = ['created_by', 'created_at', 'updated_at']

    def create(self, validated_data):
        custom_fields = validated_data.pop('custom_fields', {})
        client = Client.objects.create(**validated_data)
        self._save_custom_fields(client, custom_fields)
        return client

    def update(self, instance, validated_data):
        custom_fields = validated_data.pop('custom_fields', {})
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()
        self._save_custom_fields(instance, custom_fields)
        return instance

    def _save_custom_fields(self, client, custom_fields):
        for field_id, value in custom_fields.items():
            try:
                field_def = CustomFieldDefinition.objects.get(id=field_id)
                CustomFieldValue.objects.update_or_create(
                    client=client, field=field_def,
                    defaults={'value': value}
                )
            except CustomFieldDefinition.DoesNotExist:
                pass
