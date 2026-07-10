from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    ResearchProjectViewSet, StartResearchView, 
    ResearchStatusView, ResearchSummaryView
)

router = DefaultRouter()
router.register('projects', ResearchProjectViewSet, basename='research-project')

urlpatterns = [
    path('', include(router.urls)),
    path('start/', StartResearchView.as_view(), name='start-research'),
    path('status/<uuid:project_id>/', ResearchStatusView.as_view(), name='research-status'),
    path('summary/<uuid:project_id>/', ResearchSummaryView.as_view(), name='research-summary'),
]