from rest_framework import serializers
from .models import PcJob, PcJobTarget


class PcJobTargetSerializer(serializers.ModelSerializer):
    status_display = serializers.CharField(source='get_status_display', read_only=True)

    class Meta:
        model = PcJobTarget
        fields = ['id', 'client', 'client_address', 'role', 'ip', 'transport',
                  'status', 'status_display', 'exit_code', 'result_message',
                  'started_at', 'finished_at']


class PcJobListSerializer(serializers.ModelSerializer):
    job_type_display = serializers.CharField(source='get_job_type_display', read_only=True)
    target_mode_display = serializers.CharField(source='get_target_mode_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    created_by_name = serializers.SerializerMethodField()
    filename = serializers.SerializerMethodField()

    class Meta:
        model = PcJob
        fields = ['id', 'job_type', 'job_type_display', 'script_kind', 'target_mode',
                  'target_mode_display', 'dest_path', 'filename', 'status', 'status_display',
                  'progress', 'total_targets', 'done_targets', 'ok_targets', 'err_targets',
                  'created_by_name', 'created_at', 'finished_at']

    def get_created_by_name(self, obj):
        return obj.created_by.full_name if obj.created_by else ''

    def get_filename(self, obj):
        if obj.file:
            import os
            return os.path.basename(obj.file.name)
        return ''


class PcJobDetailSerializer(PcJobListSerializer):
    targets = PcJobTargetSerializer(many=True, read_only=True)

    class Meta(PcJobListSerializer.Meta):
        fields = PcJobListSerializer.Meta.fields + ['script_text', 'client_ids', 'targets']
