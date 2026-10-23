from django.contrib import admin
from .models import GameScore


@admin.register(GameScore)
class GameScoreAdmin(admin.ModelAdmin):
    list_display = ['id', 'game', 'user', 'score', 'created_at']
    list_filter = ['game']
    search_fields = ['user__last_name', 'user__first_name', 'user__email']
    readonly_fields = ['created_at']
