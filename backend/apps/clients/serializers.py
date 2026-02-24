from rest_framework import serializers
from .models import Client, ClientNote, CustomFieldDefinition, CustomFieldValue, ClientActivity, Provider, ClientFile, DutySchedule, CustomHoliday
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


class ProviderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Provider
        fields = ['id', 'name', 'support_phones', 'created_at', 'updated_at']
        read_only_fields = ['created_at', 'updated_at']


class ClientListSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    provider_name = serializers.CharField(source='provider.name', read_only=True)
    provider_type = serializers.CharField(source='get_connection_type_display', read_only=True)
    provider_account = serializers.CharField(source='personal_account', read_only=True)
    provider_contract = serializers.CharField(source='contract_number', read_only=True)
    provider2_name = serializers.CharField(source='provider2.name', read_only=True)
    provider2_type = serializers.CharField(source='get_connection_type2_display', read_only=True)
    provider2_account = serializers.CharField(source='personal_account2', read_only=True)
    provider2_contract = serializers.CharField(source='contract_number2', read_only=True)

    class Meta:
        model = Client
        fields = ['id', 'display_name', 'address', 'inn', 'phone', 'email',
                  'company', 'status', 'status_display',
                  'provider', 'provider_name', 'provider_type', 'provider_account', 'provider_contract',
                  'provider2', 'provider2_name', 'provider2_type', 'provider2_account', 'provider2_contract',
                  'pharmacy_code', 'iccid', 'subnet', 'external_ip',
                  'created_at']


class ClientDetailSerializer(serializers.ModelSerializer):
    display_name = serializers.CharField(read_only=True)
    mikrotik_ip = serializers.CharField(read_only=True)
    server_ip = serializers.CharField(read_only=True)
    connection_type_display = serializers.CharField(source='get_connection_type_display', read_only=True)
    created_by_data = UserSerializer(source='created_by', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    notes = ClientNoteSerializer(many=True, read_only=True)
    activities = ClientActivitySerializer(many=True, read_only=True)
    provider_data = ProviderSerializer(source='provider', read_only=True)
    provider2_data = ProviderSerializer(source='provider2', read_only=True)

    class Meta:
        model = Client
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at', 'updated_at']


class ClientWriteSerializer(serializers.ModelSerializer):
    class Meta:
        model = Client
        exclude = ['created_by', 'created_at', 'updated_at']

    def validate_address(self, value):
        if not value or not value.strip():
            raise serializers.ValidationError('Адрес обязателен для заполнения.')
        return value.strip()


class ClientFileSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True)
    url = serializers.SerializerMethodField()

    class Meta:
        model = ClientFile
        fields = ['id', 'name', 'size', 'url', 'uploaded_by_name', 'created_at']
        read_only_fields = ['name', 'size', 'uploaded_by', 'created_at']

    def get_url(self, obj):
        request = self.context.get('request')
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None


class DutyScheduleSerializer(serializers.ModelSerializer):
    user_name = serializers.CharField(source='user.full_name', read_only=True)
    duty_type_display = serializers.CharField(source='get_duty_type_display', read_only=True)

    class Meta:
        model = DutySchedule
        fields = '__all__'
        read_only_fields = ['created_at', 'updated_at']


class CustomHolidaySerializer(serializers.ModelSerializer):
    class Meta:
        model = CustomHoliday
        fields = '__all__'
        read_only_fields = ['created_by', 'created_at']
