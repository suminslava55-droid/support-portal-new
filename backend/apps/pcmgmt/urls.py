from django.urls import path
from .views import (
    PcClientsView, PcJobListCreateView, PcJobDetailView, PcJobCancelView,
    PcJobRepeatView,
)

urlpatterns = [
    path('clients/', PcClientsView.as_view(), name='pc-clients'),
    path('jobs/', PcJobListCreateView.as_view(), name='pc-jobs'),
    path('jobs/<int:pk>/', PcJobDetailView.as_view(), name='pc-job-detail'),
    path('jobs/<int:pk>/cancel/', PcJobCancelView.as_view(), name='pc-job-cancel'),
    path('jobs/<int:pk>/repeat/', PcJobRepeatView.as_view(), name='pc-job-repeat'),
]
