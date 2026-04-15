from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, CustomFieldDefinitionViewSet, ProviderViewSet, FetchExternalIPView, DashboardStatsView, DutyScheduleViewSet, OfdCompanyViewSet, OfdKktView, KktListView, KktExportView, BulkImportClientsView, ScheduledTaskListView, ScheduledTaskRunView, ScheduledTaskProgressView, ScheduledTaskCronView, GlobalSearchView, RnmSyncView, BackupListView, BackupRestoreView, FaqCategoryViewSet, FaqArticleViewSet, FaqFileView, FaqFileDeleteView, FaqImageUploadView, FaqImportView, FaqExportView, FaqHistoryView
from .settings_views import SystemSettingsView, TestEmailView, CheckPackagesView

router = DefaultRouter()
router.register('faq-categories', FaqCategoryViewSet, basename='faq-categories')
router.register('faq-articles', FaqArticleViewSet, basename='faq-articles')
router.register('events', DutyScheduleViewSet, basename='events')
router.register('custom-fields', CustomFieldDefinitionViewSet, basename='custom-fields')
router.register('providers', ProviderViewSet, basename='providers')
router.register('ofd-companies', OfdCompanyViewSet, basename='ofd-companies')
router.register('', ClientViewSet, basename='client')

urlpatterns = [
    path('rnm-sync/', RnmSyncView.as_view(), name='rnm-sync'),
    path('search/', GlobalSearchView.as_view(), name='global-search'),
    path('dashboard/', DashboardStatsView.as_view(), name='dashboard'),
    path('system-settings/', SystemSettingsView.as_view(), name='system-settings'),
    path('system-settings/test-email/', TestEmailView.as_view(), name='test-email'),
    path('system-settings/check-packages/', CheckPackagesView.as_view(), name='check-packages'),
    path('fetch_external_ip/', FetchExternalIPView.as_view(), name='fetch-external-ip'),
    path('kkt-list/', KktListView.as_view(), name='kkt-list'),
    path('kkt-export/', KktExportView.as_view(), name='kkt-export'),
    path('bulk-import/', BulkImportClientsView.as_view(), name='bulk-import'),
    path('scheduled-tasks/', ScheduledTaskListView.as_view(), name='scheduled-tasks'),
    path('scheduled-tasks/run/', ScheduledTaskRunView.as_view(), name='scheduled-tasks-run'),
    path('scheduled-tasks/cron/', ScheduledTaskCronView.as_view(), name='scheduled-tasks-cron'),
    path('scheduled-tasks/<str:task_id>/progress/', ScheduledTaskProgressView.as_view(), name='scheduled-tasks-progress'),
    path('backups/', BackupListView.as_view(), name='backup-list'),
    path('backups/restore/', BackupRestoreView.as_view(), name='backup-restore'),
    path('faq-articles/<int:article_id>/files/', FaqFileView.as_view(), name='faq-files'),
    path('faq-articles/<int:article_id>/images/', FaqImageUploadView.as_view(), name='faq-image-upload'),
    path('faq-articles/<int:article_id>/import/', FaqImportView.as_view(), name='faq-import'),
    path('faq-articles/<int:article_id>/export/', FaqExportView.as_view(), name='faq-export'),
    path('faq-articles/<int:article_id>/history/', FaqHistoryView.as_view(), name='faq-history'),
    path('faq-files/<int:file_id>/', FaqFileDeleteView.as_view(), name='faq-file-delete'),
    path('<int:pk>/ofd_kkt/', OfdKktView.as_view(), name='ofd-kkt'),
    path('<int:pk>/ofd_kkt/<int:kkt_id>/', OfdKktView.as_view(), name='ofd-kkt-detail'),
    path('', include(router.urls)),
]
