from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, CustomFieldDefinitionViewSet

router = DefaultRouter()
router.register('custom-fields', CustomFieldDefinitionViewSet, basename='custom-fields')
router.register('', ClientViewSet, basename='client')

urlpatterns = [
    path('', include(router.urls)),
]
