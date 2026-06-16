from django.urls import path
from . import admin_views

urlpatterns = [
    path('devices/', admin_views.ProxyDeviceListView.as_view()),
    path('devices/<str:uuid>/', admin_views.ProxyDeviceDetailView.as_view()),
    path('devices/<str:uuid>/match/', admin_views.ProxyDeviceMatchView.as_view()),
    path('devices/<str:uuid>/unmatch/', admin_views.ProxyDeviceUnmatchView.as_view()),
    path('stats/', admin_views.ProxyStatsView.as_view()),

    # Обновления
    path('updates/', admin_views.UpdatePackageListCreateView.as_view()),
    path('updates/<int:pk>/', admin_views.UpdatePackageDetailView.as_view()),
    path('updates/<int:pk>/deploy/', admin_views.CreateUpdateTaskView.as_view()),

    # Задачи
    path('tasks/', admin_views.DeviceTaskListView.as_view()),
    path('tasks/<uuid:task_id>/cancel/', admin_views.DeviceTaskCancelView.as_view()),
]
