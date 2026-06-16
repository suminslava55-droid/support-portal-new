from django.urls import path
from . import views

urlpatterns = [
    path('projects/<str:project>/products/<str:product>/patches/<str:version>',
         views.PatchMetadataView.as_view()),
]
