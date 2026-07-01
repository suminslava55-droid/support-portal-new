from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/auth/', include('apps.accounts.urls')),
    path('api/clients/', include('apps.clients.urls')),
    path('api/pcmgmt/', include('apps.pcmgmt.urls')),
    path('api/comproxy/', include('apps.comproxy.admin_urls')),
    path('printers/v1/', include('apps.comproxy.urls')),
    path('v2/', include('apps.comproxy.update_urls')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
