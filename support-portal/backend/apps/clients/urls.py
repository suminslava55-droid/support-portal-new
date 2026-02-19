from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ClientViewSet, CustomFieldDefinitionViewSet

router = DefaultRouter()
router.register('', ClientViewSet, basename='client')
router.register('custom-fields', CustomFieldDefinitionViewSet, basename='custom-fields')

urlpatterns = [
    path('', include(router.urls)),
]
