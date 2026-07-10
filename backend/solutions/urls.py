from django.urls import path
from . import views

urlpatterns = [
    path('pricing/', views.solution_pricing, name='solution_pricing'),
    path('request/', views.CreateServiceRequestView.as_view(), name='solution_request'),
    path('checkout/', views.CreateSolutionCheckoutView.as_view(), name='solution_checkout'),
    path('my-requests/', views.MyServiceRequestsView.as_view(), name='my_service_requests'),
    path('my-requests/<uuid:pk>/', views.MyServiceRequestDetailView.as_view(), name='my_service_request_detail'),
    path('admin/requests/', views.AdminServiceRequestsView.as_view(), name='admin_service_requests'),
    path('admin/requests/<uuid:pk>/', views.AdminServiceRequestDetailView.as_view(), name='admin_service_request_detail'),
    path('book-call/', views.BookCallView.as_view(), name='book_call'),
]
