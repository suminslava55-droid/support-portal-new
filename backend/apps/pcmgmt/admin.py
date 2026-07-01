from django.contrib import admin
from .models import PcJob, PcJobTarget


class PcJobTargetInline(admin.TabularInline):
    model = PcJobTarget
    extra = 0
    readonly_fields = ['client_address', 'role', 'ip', 'transport', 'status',
                       'exit_code', 'started_at', 'finished_at']
    can_delete = False


@admin.register(PcJob)
class PcJobAdmin(admin.ModelAdmin):
    list_display = ['id', 'job_type', 'target_mode', 'status', 'progress',
                    'total_targets', 'ok_targets', 'err_targets', 'created_by', 'created_at']
    list_filter = ['job_type', 'target_mode', 'status']
    readonly_fields = ['created_at', 'finished_at']
    inlines = [PcJobTargetInline]
