from django.urls import path
from . import views

app_name = 'monitoring'

urlpatterns = [
    path('dashboard/', views.analytics_dashboard, name='dashboard'),
    path('api/<str:metric>/', views.analytics_api, name='api'),
]