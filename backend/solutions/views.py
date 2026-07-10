from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.throttling import AnonRateThrottle
from django.conf import settings
from django_filters.rest_framework import DjangoFilterBackend
import logging


class SolutionAnonThrottle(AnonRateThrottle):
    rate = '5/hour'

from .models import ServiceRequest, BookCallRequest
from .serializers import (
    ServiceRequestCreateSerializer,
    ServiceRequestListSerializer,
    ServiceRequestAdminSerializer,
    ServiceRequestStatusUpdateSerializer,
    CheckoutRequestSerializer,
    BookCallSerializer,
)

logger = logging.getLogger(__name__)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def solution_pricing(request):
    """Return pricing data for all solution types."""
    return Response(SOLUTION_PRICING)


SOLUTION_PRICING = {
    'automation': {'starter': 299, 'growth': 799, 'pro': 1999},
    'agents': {'starter': 499, 'growth': 1299, 'pro': 2999},
    'optimization': {'starter': 199, 'growth': 599, 'pro': 1499},
}


class CreateServiceRequestView(APIView):
    """Create a new service request (guests allowed)."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [SolutionAnonThrottle]

    def post(self, request):
        serializer = ServiceRequestCreateSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        data = serializer.validated_data
        service_type = data['service_type']
        package_tier = data['package_tier']
        amount = SOLUTION_PRICING.get(service_type, {}).get(package_tier, 0)

        sr = ServiceRequest.objects.create(
            user=request.user if request.user.is_authenticated else None,
            amount=amount,
            **data,
        )

        from .tasks import analyze_service_request
        analyze_service_request.delay(str(sr.id))

        self._send_notifications(sr)

        return Response(
            ServiceRequestListSerializer(sr).data,
            status=status.HTTP_201_CREATED,
        )

    def _send_notifications(self, sr):
        try:
            from django.core.mail import send_mail
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

            track_url = (
                f'{frontend_url}/solutions/my-requests'
                if sr.user
                else f'{frontend_url}/solutions/request-success?type={sr.service_type}&tier={sr.package_tier}'
            )

            send_mail(
                subject=f'Sovereign Solutions: Request Received - {sr.get_service_type_display()}',
                message=(
                    f'Hi {sr.name},\n\n'
                    f'We received your service request for {sr.get_service_type_display()} '
                    f'({sr.get_package_tier_display()} package).\n\n'
                    f'Our team will review your requirements and get back to you shortly.\n\n'
                    f'Track your request: {track_url}\n\n'
                    f'Best regards,\nThe Sovereign Team'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[sr.email],
                fail_silently=True,
            )

            from django.contrib.auth import get_user_model
            AdminUser = get_user_model()
            admin_emails = list(
                AdminUser.objects.filter(is_staff=True, email_notifications=True)
                .values_list('email', flat=True)[:5]
            )
            if not admin_emails:
                admin_emails = [settings.DEFAULT_FROM_EMAIL]

            send_mail(
                subject=f'[Admin] New Solution Request: {sr.get_service_type_display()} - {sr.name}',
                message=(
                    f'New service request submitted:\n\n'
                    f'Name: {sr.name}\n'
                    f'Email: {sr.email}\n'
                    f'Service: {sr.get_service_type_display()}\n'
                    f'Package: {sr.get_package_tier_display()}\n'
                    f'Budget: {sr.get_budget_display()}\n'
                    f'Timeline: {sr.get_timeline_display()}\n\n'
                    f'Requirements:\n{sr.requirements}\n'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=admin_emails,
                fail_silently=True,
            )
        except Exception as e:
            logger.warning(f"Failed to send notification emails: {e}")


class CreateSolutionCheckoutView(APIView):
    """Create a Polar checkout session for a solution package."""
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = CheckoutRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        service_type = serializer.validated_data['service_type']
        package_tier = serializer.validated_data['package_tier']
        service_request_id = serializer.validated_data.get('service_request_id')
        amount = SOLUTION_PRICING.get(service_type, {}).get(package_tier, 0)

        if amount <= 0:
            return Response(
                {'error': 'Invalid service/package combination.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        from payments.polar_service import PolarService, PolarServiceError

        try:
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
            success_url = f"{frontend_url}/solutions/request-success?type={service_type}&tier={package_tier}"

            polar_service = PolarService()

            metadata = {
                'user_id': str(request.user.id),
                'solution_service_type': service_type,
                'solution_package_tier': package_tier,
                'solution_amount': str(amount),
            }
            if service_request_id:
                metadata['service_request_id'] = str(service_request_id)

            checkout_data = {
                'amount': amount * 100,
                'currency': 'usd',
                'success_url': success_url,
                'metadata': metadata,
                'allow_discount_codes': True,
            }

            if request.user.email and not request.user.email.endswith(('example.com', 'test.com')):
                checkout_data['customer_email'] = request.user.email
                full_name = request.user.get_full_name()
                if full_name:
                    checkout_data['customer_name'] = full_name

            checkout = polar_service.client.checkouts.create(request=checkout_data)

            return Response({
                'checkout_url': checkout.url,
                'checkout_id': checkout.id,
                'amount': amount,
            })

        except PolarServiceError as e:
            logger.error(f"Polar error for solution checkout: {e.message}")
            return Response(
                {'error': 'Payment service error. Please try again.'},
                status=status.HTTP_503_SERVICE_UNAVAILABLE,
            )
        except Exception as e:
            logger.error(f"Solution checkout error: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to create checkout session.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
            )


class MyServiceRequestsView(generics.ListAPIView):
    """List current user's service requests."""
    serializer_class = ServiceRequestListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ServiceRequest.objects.filter(user=self.request.user)


class MyServiceRequestDetailView(generics.RetrieveAPIView):
    """Get detail of a single service request owned by the current user."""
    serializer_class = ServiceRequestListSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return ServiceRequest.objects.filter(user=self.request.user)


class AdminServiceRequestsView(generics.ListAPIView):
    """List all service requests (admin only)."""
    serializer_class = ServiceRequestAdminSerializer
    permission_classes = [permissions.IsAdminUser]
    filter_backends = [DjangoFilterBackend]
    filterset_fields = ['status', 'service_type', 'payment_status', 'package_tier']

    def get_queryset(self):
        return ServiceRequest.objects.select_related('user').all()


class AdminServiceRequestDetailView(generics.RetrieveUpdateAPIView):
    """View/update a single service request (admin only)."""
    permission_classes = [permissions.IsAdminUser]

    def get_queryset(self):
        return ServiceRequest.objects.select_related('user').all()

    def get_serializer_class(self):
        if self.request.method == 'PATCH':
            return ServiceRequestStatusUpdateSerializer
        return ServiceRequestAdminSerializer

    def perform_update(self, serializer):
        sr = self.get_object()
        data = serializer.validated_data

        updated_fields = []
        old_status = sr.status

        for field in ('status', 'payment_status', 'admin_notes', 'delivered_url'):
            if field in data:
                setattr(sr, field, data[field])
                updated_fields.append(field)

        if updated_fields:
            sr.save(update_fields=updated_fields + ['updated_at'])

        if 'status' in data and data['status'] != old_status:
            self._notify_status_change(sr)

    def _notify_status_change(self, sr):
        try:
            from django.core.mail import send_mail
            frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000')

            send_mail(
                subject=f'Sovereign Solutions: Your request status updated to {sr.get_status_display()}',
                message=(
                    f'Hi {sr.name},\n\n'
                    f'Your {sr.get_service_type_display()} service request has been updated.\n\n'
                    f'New Status: {sr.get_status_display()}\n'
                    f'{f"Delivery Link: {sr.delivered_url}" if sr.delivered_url else ""}\n\n'
                    f'Track your request: {frontend_url}/solutions/my-requests\n\n'
                    f'Best regards,\nThe Sovereign Team'
                ),
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[sr.email],
                fail_silently=True,
            )
        except Exception as e:
            logger.warning(f"Failed to send status update email: {e}")

    def update(self, request, *args, **kwargs):
        partial = kwargs.pop('partial', True)
        instance = self.get_object()
        serializer = self.get_serializer(data=request.data, partial=partial)
        serializer.is_valid(raise_exception=True)
        self.perform_update(serializer)
        return Response(ServiceRequestAdminSerializer(instance).data)


class BookCallView(APIView):
    """Record a book-a-call request."""
    permission_classes = [permissions.AllowAny]
    throttle_classes = [SolutionAnonThrottle]

    def post(self, request):
        serializer = BookCallSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        BookCallRequest.objects.create(
            user=request.user if request.user.is_authenticated else None,
            **serializer.validated_data,
        )
        return Response(
            {'message': 'Your call request has been received. We will be in touch shortly.'},
            status=status.HTTP_201_CREATED,
        )
