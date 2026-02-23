from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, CustomFieldDefinitionViewSet, ProviderViewSet, FetchExternalIPView, DashboardStatsView, DutyScheduleViewSet
from .settings_views import SystemSettingsView, TestEmailView

router = DefaultRouter()
router.register('events', DutyScheduleViewSet, basename='events')
router.register('custom-fields', CustomFieldDefinitionViewSet, basename='custom-fields')
router.register('providers', ProviderViewSet, basename='providers')
router.register('', ClientViewSet, basename='client')

urlpatterns = [
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard'),
    path('system-settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('system-settings/test-email/', TestEmailView.as_view(), name='test-email'),
    path('fetch_external_ip/', FetchExternalIPView.as_view(), name='fetch-external-ip'),
    path('', include(router.urls)),
]
