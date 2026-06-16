from django.contrib import admin
from .models import ProxyDevice, ProxyTelemetry, UpdatePackage, DeviceTask


@admin.register(ProxyDevice)
class ProxyDeviceAdmin(admin.ModelAdmin):
    list_display = ('uuid', 'registry_number', 'kkt_name', 'comproxy_version',
                    'firmware_version', 'ffd_version', 'match_method', 'last_seen_at')
    list_filter = ('match_method', 'ffd_version')
    search_fields = ('uuid', 'registry_number', 'inn', 'fiscal_address')
    readonly_fields = ('first_seen_at', 'last_seen_at', 'cash_info_at')


@admin.register(ProxyTelemetry)
class ProxyTelemetryAdmin(admin.ModelAdmin):
    list_display = ('device', 'shift_status', 'shift_exceeded_24h',
                    'kkt_flags_fatal', 'unsent_ofd_count', 'updated_at')
    list_filter = ('shift_status', 'shift_exceeded_24h')


@admin.register(UpdatePackage)
class UpdatePackageAdmin(admin.ModelAdmin):
    list_display = ('product_type', 'version', 'version_from', 'project', 'product',
                    'enabled', 'file_size', 'created_at')
    list_filter = ('product_type', 'enabled')
    search_fields = ('version', 'info')


@admin.register(DeviceTask)
class DeviceTaskAdmin(admin.ModelAdmin):
    list_display = ('task_id', 'device', 'task_type', 'status', 'created_at', 'completed_at')
    list_filter = ('status', 'task_type')
    search_fields = ('task_id', 'device__uuid', 'device__registry_number')
    readonly_fields = ('task_id', 'created_at', 'updated_at')
