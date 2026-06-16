from rest_framework import serializers
from .models import ProxyDevice, ProxyTelemetry, UpdatePackage, DeviceTask


class ProxyTelemetrySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProxyTelemetry
        fields = [
            'shift_status', 'shift_exceeded_24h',
            'kkt_flags_fatal', 'kkt_flags_current', 'fn_flags',
            'unsent_ofd_count', 'unsent_oism_count',
            'updated_at',
        ]


class ProxyDeviceListSerializer(serializers.ModelSerializer):
    telemetry = ProxyTelemetrySerializer(read_only=True)
    client_id = serializers.IntegerField(source='kkt_data.client_id', read_only=True, default=None)
    client_address = serializers.CharField(source='kkt_data.client.address', read_only=True, default='')
    client_company = serializers.CharField(source='kkt_data.client.company', read_only=True, default='')
    is_matched = serializers.SerializerMethodField()

    class Meta:
        model = ProxyDevice
        fields = [
            'id', 'uuid', 'registry_number', 'factory_number', 'fn_number',
            'kkt_name', 'ffd_version', 'inn', 'fiscal_address', 'ip_address',
            'comproxy_version', 'firmware_version', 'fito_version',
            'match_method', 'matched_at', 'is_matched',
            'first_seen_at', 'last_seen_at', 'cash_info_at',
            'client_id', 'client_address', 'client_company',
            'telemetry',
        ]

    def get_is_matched(self, obj):
        return obj.kkt_data_id is not None


class ProxyDeviceDetailSerializer(ProxyDeviceListSerializer):
    telemetry = ProxyTelemetrySerializer(read_only=True)

    class Meta(ProxyDeviceListSerializer.Meta):
        fields = ProxyDeviceListSerializer.Meta.fields + [
            'raw_cash_info', 'raw_registration_report', 'supported_methods',
        ]


class ProxyInlineSerializer(serializers.ModelSerializer):
    """Компактная версия для встраивания в ответ OfdKktView"""
    shift_status = serializers.CharField(source='telemetry.shift_status', read_only=True, default='')
    shift_exceeded_24h = serializers.BooleanField(source='telemetry.shift_exceeded_24h', read_only=True, default=False)
    kkt_flags_fatal = serializers.IntegerField(source='telemetry.kkt_flags_fatal', read_only=True, default=0)
    unsent_ofd_count = serializers.IntegerField(source='telemetry.unsent_ofd_count', read_only=True, default=0)

    class Meta:
        model = ProxyDevice
        fields = [
            'uuid', 'comproxy_version', 'firmware_version', 'ffd_version',
            'ip_address', 'last_seen_at',
            'shift_status', 'shift_exceeded_24h', 'kkt_flags_fatal', 'unsent_ofd_count',
        ]


class UpdatePackageSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.full_name', read_only=True, default='')
    tasks_summary = serializers.SerializerMethodField()

    class Meta:
        model = UpdatePackage
        fields = [
            'id', 'product_type', 'version', 'version_from',
            'project', 'product', 'filename', 'file_size', 'md5',
            'info', 'enabled', 'barrier',
            'uploaded_by_name', 'created_at', 'tasks_summary',
        ]

    def get_tasks_summary(self, obj):
        qs = obj.tasks.values_list('status', flat=True)
        statuses = list(qs)
        return {
            'pending': statuses.count('PENDING'),
            'sent': statuses.count('SENT'),
            'success': statuses.count('SUCCESS'),
            'error': statuses.count('ERROR'),
        }


class DeviceTaskSerializer(serializers.ModelSerializer):
    device_uuid = serializers.CharField(source='device.uuid', read_only=True)
    device_registry_number = serializers.CharField(source='device.registry_number', read_only=True, default='')
    device_kkt_name = serializers.CharField(source='device.kkt_name', read_only=True, default='')
    update_version = serializers.CharField(source='update_package.version', read_only=True, default='')
    update_product_type = serializers.CharField(source='update_package.product_type', read_only=True, default='')
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, default='')

    class Meta:
        model = DeviceTask
        fields = [
            'id', 'task_id', 'task_type', 'task_data', 'status',
            'result_message', 'sent_at', 'completed_at',
            'created_at', 'created_by_name',
            'device_uuid', 'device_registry_number', 'device_kkt_name',
            'update_version', 'update_product_type',
        ]
