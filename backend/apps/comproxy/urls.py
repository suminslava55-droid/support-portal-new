from django.urls import path
from . import views

urlpatterns = [
    path('handshake/v2', views.HandshakeView.as_view()),
    path('poll/v3', views.PollView.as_view()),
    path('counters_report/v2', views.CountersReportView.as_view()),
    path('cash_info_report/v2', views.CashInfoReportView.as_view()),
    path('registration_report/v1', views.RegistrationReportView.as_view()),
]
