from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, CustomFieldDefinitionViewSet, ProviderViewSet, FetchExternalIPView
from .settings_views import SystemSettingsView

router = DefaultRouter()
router.register('custom-fields', CustomFieldDefinitionViewSet, basename='custom-fields')
router.register('providers', ProviderViewSet, basename='providers')
router.register('', ClientViewSet, basename='client')

urlpatterns = [
    path('system-settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('fetch_external_ip/', FetchExternalIPView.as_view(), name='fetch-external-ip'),
    path('', include(router.urls)),
]
