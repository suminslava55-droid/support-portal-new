# Re-export всех классов для обратной совместимости с urls.py
# urls.py импортирует из apps.clients.views — ничего менять не нужно

from .client_views import (
    ClientViewSet,
    CustomFieldDefinitionViewSet,
)

from .misc_views import (
    FetchExternalIPView,
    OfdCompanyViewSet,
    ProviderViewSet,
    DashboardStatsView,
)

from .calendar_views import (
    DutyScheduleViewSet,
)

from .kkt_views import (
    OfdKktView,
    KktListView,
    KktExportView,
)

from .bulk_views import (
    BulkImportClientsView,
)

from .scheduler_views import (
    ScheduledTaskListView,
    ScheduledTaskRunView,
    ScheduledTaskProgressView,
    ScheduledTaskCronView,
    RnmSyncView,
    BackupListView,
    BackupRestoreView,
)

from .search_views import GlobalSearchView
