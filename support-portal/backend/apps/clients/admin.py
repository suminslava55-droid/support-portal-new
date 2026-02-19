from django.contrib import admin
from .models import Client, ClientNote, CustomFieldDefinition, CustomFieldValue

@admin.register(CustomFieldDefinition)
class CustomFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ['name', 'field_type', 'is_required', 'is_active', 'order']
    list_editable = ['order', 'is_active']

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['full_name', 'phone', 'email', 'company', 'status', 'assigned_to']
    list_filter = ['status', 'assigned_to']
    search_fields = ['last_name', 'first_name', 'email', 'phone', 'company']
