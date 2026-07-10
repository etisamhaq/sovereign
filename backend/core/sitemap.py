"""
Dynamic XML sitemap and sitemap index for Sovereign.
Endpoints:
  /api/sitemap.xml       → Sitemap index
  /api/sitemap-tools.xml → All tool landing pages
  /api/sitemap-pages.xml → Static pages
"""
from datetime import datetime, timezone
from django.http import HttpResponse
from django.views import View
from tools.models import Tool


from django.conf import settings as django_settings

SITE_URL = getattr(django_settings, 'SITE_URL', 'https://sovereign.com')

# Static pages with their change frequency and priority
STATIC_PAGES = [
    {'loc': '/', 'changefreq': 'daily', 'priority': '1.0'},
    {'loc': '/pricing', 'changefreq': 'weekly', 'priority': '0.9'},
    {'loc': '/features', 'changefreq': 'weekly', 'priority': '0.8'},
    {'loc': '/about', 'changefreq': 'monthly', 'priority': '0.6'},
    {'loc': '/contact', 'changefreq': 'monthly', 'priority': '0.5'},
    {'loc': '/blog', 'changefreq': 'weekly', 'priority': '0.8'},
    {'loc': '/try-tools', 'changefreq': 'weekly', 'priority': '0.9'},
    {'loc': '/workflows', 'changefreq': 'monthly', 'priority': '0.6'},
    {'loc': '/community', 'changefreq': 'daily', 'priority': '0.7'},
    {'loc': '/privacy', 'changefreq': 'yearly', 'priority': '0.3'},
    {'loc': '/terms', 'changefreq': 'yearly', 'priority': '0.3'},
    # Persona discovery pages
    {'loc': '/for/student', 'changefreq': 'weekly', 'priority': '0.9'},
    {'loc': '/for/creator', 'changefreq': 'weekly', 'priority': '0.9'},
    {'loc': '/for/professional', 'changefreq': 'weekly', 'priority': '0.9'},
    {'loc': '/for/researcher', 'changefreq': 'weekly', 'priority': '0.9'},
    {'loc': '/for/developer', 'changefreq': 'weekly', 'priority': '0.9'},
]


class SitemapIndexView(View):
    """Generate sitemap index pointing to sub-sitemaps."""

    def get(self, request):
        now = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%S+00:00')
        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>{SITE_URL}/api/sitemap-pages.xml</loc>
    <lastmod>{now}</lastmod>
  </sitemap>
  <sitemap>
    <loc>{SITE_URL}/api/sitemap-tools.xml</loc>
    <lastmod>{now}</lastmod>
  </sitemap>
</sitemapindex>'''
        return HttpResponse(xml, content_type='application/xml')


class PagesSitemapView(View):
    """Sitemap for static pages."""

    def get(self, request):
        urls = []
        for page in STATIC_PAGES:
            urls.append(
                f'''  <url>
    <loc>{SITE_URL}{page["loc"]}</loc>
    <changefreq>{page["changefreq"]}</changefreq>
    <priority>{page["priority"]}</priority>
  </url>'''
            )

        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{"".join(urls)}
</urlset>'''
        return HttpResponse(xml, content_type='application/xml')


class ToolsSitemapView(View):
    """Sitemap for all tool landing pages."""

    def get(self, request):
        tools = Tool.objects.filter(is_active=True).order_by('name')
        urls = []
        for tool in tools:
            lastmod = tool.updated_at.strftime('%Y-%m-%dT%H:%M:%S+00:00') if tool.updated_at else ''
            priority = '0.9' if not tool.is_premium else '0.8'
            urls.append(
                f'''  <url>
    <loc>{SITE_URL}/tool/{tool.slug}</loc>
    <lastmod>{lastmod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>{priority}</priority>
  </url>'''
            )

        xml = f'''<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
{"".join(urls)}
</urlset>'''
        return HttpResponse(xml, content_type='application/xml')
