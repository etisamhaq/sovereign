"""
URL configuration for core project.
"""
from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from .sitemap import SitemapIndexView, PagesSitemapView, ToolsSitemapView

_api_routes = [
    path('auth/', include('accounts.urls')),
    path('tools/', include('tools.urls')),
    path('payments/', include('payments.urls')),
    path('research/', include('research.urls')),
    path('rewards/', include('rewards.urls')),
    path('community/', include('community.urls')),
    path('agents/', include('agents.urls')),
    path('solutions/', include('solutions.urls')),
    path('', include('api.urls')),
]

urlpatterns = [
    path('admin/', admin.site.urls),

    # Versioned API (preferred). New clients MUST use /api/v1/; the unversioned
    # /api/ prefix is kept for backward compatibility and will be deprecated in
    # a future release.
    path('api/v1/', include((_api_routes, 'api-v1'))),
    path('api/', include(_api_routes)),

    path('monitoring/', include('monitoring.urls')),

    # SEO: Sitemaps
    path('api/sitemap.xml', SitemapIndexView.as_view(), name='sitemap-index'),
    path('api/sitemap-pages.xml', PagesSitemapView.as_view(), name='sitemap-pages'),
    path('api/sitemap-tools.xml', ToolsSitemapView.as_view(), name='sitemap-tools'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
    urlpatterns += static(settings.STATIC_URL, document_root=settings.STATIC_ROOT)