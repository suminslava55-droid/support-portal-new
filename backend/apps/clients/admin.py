from django.contrib import admin
from .models import Client, ClientNote, CustomFieldDefinition, CustomFieldValue, Provider

@admin.register(Provider)
class ProviderAdmin(admin.ModelAdmin):
    list_display = ['name', 'connection_type']
    search_fields = ['name']

@admin.register(CustomFieldDefinition)
class CustomFieldDefinitionAdmin(admin.ModelAdmin):
    list_display = ['name', 'field_type', 'is_required', 'is_active', 'order']
    list_editable = ['order', 'is_active']

@admin.register(Client)
class ClientAdmin(admin.ModelAdmin):
    list_display = ['company', 'address', 'inn', 'phone', 'provider', 'status']
    list_filter = ['status', 'provider']
    search_fields = ['company', 'address', 'email', 'phone', 'inn']
