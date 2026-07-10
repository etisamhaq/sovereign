from rest_framework import generics, status, permissions
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import get_user_model
from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.db.models import Sum
from django.views.decorators.csrf import csrf_exempt
from django.utils.decorators import method_decorator
import logging
import json

from .models import Subscription, Payment, UsageQuota, Invoice
from .serializers import (
    SubscriptionSerializer, PaymentSerializer, UsageQuotaSerializer,
    InvoiceSerializer, CreateSubscriptionSerializer, CancelSubscriptionSerializer
)
from .polar_service import PolarService

User = get_user_model()
logger = logging.getLogger(__name__)


class SubscriptionView(generics.RetrieveAPIView):
    """Get current user's subscription"""
    serializer_class = SubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        try:
            return self.request.user.subscription
        except Subscription.DoesNotExist:
            from django.http import Http404
            raise Http404("No active subscription found")


class CreateSubscriptionView(generics.GenericAPIView):
    """Create a new subscription"""
    serializer_class = CreateSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user
        product_id = serializer.validated_data['product_id']

        try:
            # Create Polar checkout session
            success_url = request.build_absolute_uri('/dashboard?subscription=success')
            checkout = PolarService().create_checkout_session(
                user, product_id, success_url
            )

            # Return checkout URL for frontend redirect
            # Subscription will be created via webhook after successful payment

            return Response({
                'checkout_url': checkout['url'],
                'checkout_id': checkout['id'],
                'message': 'Checkout session created successfully'
            }, status=status.HTTP_201_CREATED)

        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class CancelSubscriptionView(generics.GenericAPIView):
    """Cancel user's subscription"""
    serializer_class = CancelSubscriptionSerializer
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)

        user = request.user

        try:
            subscription = user.subscription
            if not subscription or subscription.status != 'active':
                return Response({
                    'error': 'No active subscription found'
                }, status=status.HTTP_400_BAD_REQUEST)

            # Cancel on Polar
            polar_subscription = PolarService().cancel_subscription(
                subscription.polar_subscription_id
            )

            # Update local subscription
            subscription.status = 'cancelled'
            subscription.cancel_at_period_end = True
            subscription.save()

            # Note: User tier will be updated to 'free' at the end of billing period via webhook

            return Response({
                'message': 'Subscription cancelled successfully',
                'subscription': SubscriptionSerializer(subscription).data
            })

        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)


class PaymentMethodsView(APIView):
    """Manage payment methods"""
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        """Get active subscriptions"""
        try:
            # Polar handles payment methods internally
            # Return user's active subscriptions instead
            subscriptions = PolarService().list_customer_subscriptions(request.user)
            return Response({
                'subscriptions': subscriptions
            })
        except Exception as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)

    def post(self, request):
        """Create new checkout session"""
        # Polar doesn't support updating payment methods directly
        # Redirect to customer portal instead
        return Response({
            'message': 'Please use the customer portal to manage payment methods',
            'portal_url': settings.POLAR_CUSTOMER_PORTAL_URL if hasattr(settings, 'POLAR_CUSTOMER_PORTAL_URL') else None
        })


class UsageQuotaView(generics.RetrieveAPIView):
    """Get user's usage quota"""
    serializer_class = UsageQuotaSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_object(self):
        user = self.request.user
        quota, _ = UsageQuota.objects.get_or_create(user=user)
        # Sync quota with actual user data to keep them consistent
        quota.monthly_limit = user.get_usage_limit()
        quota.current_usage = user.monthly_usage_count
        quota.save(update_fields=['monthly_limit', 'current_usage'])
        return quota


class PaymentHistoryView(generics.ListAPIView):
    """Get user's payment history"""
    serializer_class = PaymentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Payment.objects.filter(user=self.request.user)


class InvoiceListView(generics.ListAPIView):
    """Get user's invoices"""
    serializer_class = InvoiceSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        return Invoice.objects.filter(user=self.request.user)


class PaymentDashboardView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        user = request.user
        quota, _ = UsageQuota.objects.get_or_create(user=user)
        limit = user.get_usage_limit()
        remaining = max(0, limit - user.monthly_usage_count)

        payments = Payment.objects.filter(user=user)
        completed_total = payments.filter(status='completed').aggregate(total=Sum('amount')).get('total') or 0
        refunded_total = payments.filter(status='refunded').aggregate(total=Sum('amount')).get('total') or 0

        marketplace_spend = payments.filter(
            metadata__has_key='agent_marketplace_purchase_id',
            status='completed',
        ).aggregate(total=Sum('amount')).get('total') or 0

        payload = {
            'subscription_tier': user.subscription_tier,
            'is_pro': user.is_pro,
            'monthly_usage_count': user.monthly_usage_count,
            'rate_limit_monthly': limit,
            'rate_limit_remaining': remaining,
            'bonus_credits': quota.bonus_credits,
            'total_spend_usd': float(completed_total),
            'total_refunds_usd': float(refunded_total),
            'marketplace_spend_usd': float(marketplace_spend),
        }
        return Response(payload)


@api_view(['POST'])
@permission_classes([permissions.IsAuthenticated])
def create_checkout_session(request):
    """Create a checkout session for subscription"""
    from .polar_service import PolarService, PolarServiceError

    try:
        product_id = request.data.get('product_id')
        if not product_id:
            return Response({
                'error': 'Product ID is required'
            }, status=status.HTTP_400_BAD_REQUEST)

        logger.info(f"Creating checkout for user {request.user.email} with product {product_id}")

        # Use FRONTEND_URL for the success redirect (not backend URL)
        frontend_url = getattr(settings, 'FRONTEND_URL', 'http://localhost:3000').rstrip('/')
        success_url = f"{frontend_url}/dashboard?subscription=success"

        polar_service = PolarService()
        checkout = polar_service.create_checkout_session(
            request.user, product_id, success_url
        )

        logger.info(f"Checkout created successfully: {checkout}")

        return Response({
            'checkout_url': checkout['url'],
            'checkout_id': checkout['id']
        })
    except PolarServiceError as e:
        logger.error(f"Polar service error: {e.message}", exc_info=True)
        if e.is_auth_error:
            return Response({
                'error': 'Payment service configuration error. Please contact support.',
                'detail': e.message
            }, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        return Response({
            'error': e.message,
            'detail': 'Failed to create checkout session.'
        }, status=status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to create checkout: {str(e)}", exc_info=True)
        return Response({
            'error': str(e),
            'detail': 'Failed to create checkout session. Please try again.'
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.AllowAny])
def list_products(request):
    """List available products from Polar"""
    from .polar_service import PolarService, PolarServiceError

    try:
        polar_service = PolarService()
        products = polar_service.list_products()
        return Response({
            'products': products
        })
    except PolarServiceError as e:
        logger.error(f"Polar service error: {e.message}")
        return Response({
            'error': e.message,
            'products': []
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE if e.is_auth_error else status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        logger.error(f"Failed to list products: {str(e)}")
        return Response({
            'error': str(e),
            'products': []
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
@permission_classes([permissions.IsAdminUser])
def validate_polar_config(request):
    """Validate Polar configuration (admin only)"""
    from .polar_service import PolarService, PolarServiceError

    try:
        polar_service = PolarService()
        result = polar_service.validate_token()
        return Response({
            'status': 'ok',
            'message': 'Polar configuration is valid',
            **result
        })
    except PolarServiceError as e:
        return Response({
            'status': 'error',
            'message': e.message,
            'is_auth_error': e.is_auth_error
        }, status=status.HTTP_503_SERVICE_UNAVAILABLE if e.is_auth_error else status.HTTP_400_BAD_REQUEST)
    except Exception as e:
        return Response({
            'status': 'error',
            'message': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@method_decorator(csrf_exempt, name='dispatch')
class PolarWebhookView(APIView):
    """
    Handle Polar webhooks.

    Polar uses the Standard Webhooks specification:
    - Headers: webhook-id, webhook-timestamp, webhook-signature
    - Verification via polar_sdk.webhooks.validate_event()
    - Returns typed Pydantic models with .data attribute
    """
    permission_classes = []
    authentication_classes = []

    def post(self, request):
        logger.info("=== Polar Webhook Received ===")

        # Get raw body for signature verification
        raw_body = request.body

        # Build headers dict for Standard Webhooks verification
        headers = {
            'webhook-id': request.headers.get('webhook-id', ''),
            'webhook-timestamp': request.headers.get('webhook-timestamp', ''),
            'webhook-signature': request.headers.get('webhook-signature', ''),
        }

        webhook_secret = getattr(settings, 'POLAR_WEBHOOK_SECRET', '')
        if not webhook_secret:
            logger.error("POLAR_WEBHOOK_SECRET not configured — cannot verify webhook")
            return HttpResponse(status=500)

        # Use the official Polar SDK to validate and parse the event
        try:
            from polar_sdk.webhooks import validate_event, WebhookVerificationError
            event = validate_event(raw_body, headers, webhook_secret)
        except WebhookVerificationError as e:
            logger.warning(f"Webhook signature verification failed: {e}")
            return HttpResponse(status=403)
        except Exception as e:
            logger.error(f"Failed to validate/parse webhook event: {e}", exc_info=True)
            return HttpResponse(status=400)

        # event is a typed Pydantic model (e.g. WebhookSubscriptionCreatedPayload)
        # with .TYPE (event type string) and .data (typed model)
        event_type = getattr(event, 'TYPE', '')
        logger.info(f"Webhook event type: {event_type}")

        try:
            # ── Checkout events ──
            if event_type == 'checkout.created':
                self._handle_checkout_created(event)
            elif event_type == 'checkout.updated':
                self._handle_checkout_updated(event)

            # ── Order events ──
            elif event_type == 'order.created':
                self._handle_order_created(event)

            # ── Subscription events ──
            elif event_type == 'subscription.created':
                self._handle_subscription_created(event)
            elif event_type == 'subscription.updated':
                self._handle_subscription_updated(event)
            elif event_type == 'subscription.active':
                self._handle_subscription_active(event)
            elif event_type == 'subscription.canceled':
                self._handle_subscription_canceled(event)
            elif event_type == 'subscription.revoked':
                self._handle_subscription_revoked(event)

            # ── Customer events ──
            elif event_type == 'customer.created':
                self._handle_customer_created(event)
            elif event_type == 'customer.updated':
                self._handle_customer_updated(event)

            else:
                logger.info(f"Unhandled webhook event type: {event_type}")

        except Exception as e:
            logger.error(f"Error handling webhook event {event_type}: {e}", exc_info=True)
            # Return 200 so Polar doesn't retry for handler logic errors
            return HttpResponse(status=200)

        return HttpResponse(status=200)

    # ─── Checkout Handlers ──────────────────────────────────

    def _handle_checkout_created(self, event):
        """Log checkout creation"""
        checkout = event.data  # Polar SDK Checkout model (typed)
        metadata = checkout.metadata or {}
        user_id = metadata.get('user_id')
        logger.info(f"Checkout created: {checkout.id}, user_id={user_id}, status={checkout.status}")

    def _handle_checkout_updated(self, event):
        """
        Handle checkout status changes.
        When a checkout becomes 'succeeded', record the payment.
        The subscription.created event handles the actual Pro upgrade.
        """
        checkout = event.data  # Polar SDK Checkout model (typed)
        metadata = checkout.metadata or {}
        user_id = metadata.get('user_id')
        checkout_status = str(checkout.status.value) if hasattr(checkout.status, 'value') else str(checkout.status)

        logger.info(f"Checkout updated: {checkout.id}, status={checkout_status}, user_id={user_id}")

        if checkout_status == 'succeeded' and metadata.get('solution_service_type'):
            logger.info(f"Solution checkout succeeded: {checkout.id}")
            return

        if checkout_status == 'succeeded' and user_id:
            try:
                user = User.objects.get(id=user_id)
                if checkout.customer_id and not user.polar_customer_id:
                    user.polar_customer_id = checkout.customer_id
                    user.save(update_fields=['polar_customer_id'])
                    logger.info(f"Saved polar_customer_id={checkout.customer_id} for user {user.email}")

                # Record payment
                Payment.objects.update_or_create(
                    polar_checkout_id=checkout.id,
                    defaults={
                        'user': user,
                        'polar_transaction_id': checkout.id,
                        'amount': (checkout.total_amount or 0) / 100,  # Polar amounts are in cents
                        'currency': checkout.currency or 'USD',
                        'status': 'completed',
                        'description': f'Polar checkout {checkout.id}',
                        'metadata': {'checkout_status': checkout_status},
                    }
                )
                logger.info(f"Payment recorded for checkout {checkout.id}")

            except User.DoesNotExist:
                logger.error(f"User not found for checkout {checkout.id}, user_id={user_id}")
            except Exception as e:
                logger.error(f"Error processing checkout.updated: {e}", exc_info=True)

    # ─── Order Handlers ─────────────────────────────────────

    def _handle_order_created(self, event):
        """Handle order creation — check for solution purchases."""
        order = event.data
        metadata = order.metadata or {}
        logger.info(f"Order created: {order.id}, product_id={order.product_id}")

        if metadata.get('solution_service_type'):
            self._handle_solution_order(order, metadata)

    def _handle_solution_order(self, order, metadata):
        """Update existing ServiceRequest or create new one when a solution checkout succeeds."""
        from solutions.models import ServiceRequest
        from solutions.tasks import analyze_service_request

        user_id = metadata.get('user_id')
        service_type = metadata.get('solution_service_type')
        package_tier = metadata.get('solution_package_tier', 'starter')
        amount = metadata.get('solution_amount', '0')
        service_request_id = metadata.get('service_request_id')

        user = None
        if user_id:
            try:
                user = User.objects.get(id=user_id)
            except User.DoesNotExist:
                logger.warning(f"User {user_id} not found for solution order {order.id}")

        sr = None
        if service_request_id:
            try:
                sr = ServiceRequest.objects.get(id=service_request_id)
                sr.polar_checkout_id = str(order.id)
                sr.polar_transaction_id = str(order.id)
                sr.status = 'paid'
                sr.payment_status = 'paid'
                sr.amount = amount
                if user and not sr.user:
                    sr.user = user
                sr.save(update_fields=[
                    'polar_checkout_id', 'polar_transaction_id',
                    'status', 'payment_status', 'amount', 'user', 'updated_at',
                ])
                logger.info(f"Solution ServiceRequest updated from form: {sr.id}")
            except ServiceRequest.DoesNotExist:
                logger.warning(f"ServiceRequest {service_request_id} not found, creating new")
                sr = None

        if not sr:
            sr = ServiceRequest.objects.create(
                user=user,
                service_type=service_type,
                package_tier=package_tier,
                name=user.get_full_name() if user else '',
                email=user.email if user else '',
                business_type='Not specified',
                requirements='Submitted via checkout — details to follow.',
                budget='under_500',
                timeline='standard',
                amount=amount,
                polar_checkout_id=str(order.id),
                polar_transaction_id=str(order.id),
                status='paid',
                payment_status='paid',
            )
            logger.info(f"Solution ServiceRequest created from webhook: {sr.id}")

        analyze_service_request.delay(str(sr.id))

    # ─── Subscription Handlers ──────────────────────────────

    def _handle_subscription_created(self, event):
        """
        Handle subscription.created — the KEY event for Pro upgrades.
        Fired when a customer successfully subscribes.
        """
        sub = event.data  # Polar SDK Subscription model (typed)
        metadata = sub.metadata or {}
        user_id = metadata.get('user_id')

        # Also check customer metadata
        if not user_id and hasattr(sub, 'customer') and sub.customer:
            customer_metadata = getattr(sub.customer, 'metadata', {}) or {}
            user_id = customer_metadata.get('user_id')

        logger.info(f"Subscription created: {sub.id}, user_id={user_id}, status={sub.status}")

        if not user_id:
            # Try to find user by polar_customer_id
            if sub.customer_id:
                try:
                    user = User.objects.get(polar_customer_id=sub.customer_id)
                    user_id = str(user.id)
                    logger.info(f"Found user by polar_customer_id: {user.email}")
                except User.DoesNotExist:
                    logger.error(f"Cannot find user for subscription {sub.id} — no user_id in metadata and no matching customer_id")
                    return
            else:
                logger.error(f"No user_id found for subscription {sub.id}")
                return

        try:
            user = User.objects.get(id=user_id)

            sub_status = str(sub.status.value) if hasattr(sub.status, 'value') else str(sub.status)

            # Create or update local subscription record
            local_sub, created = Subscription.objects.update_or_create(
                user=user,
                defaults={
                    'polar_subscription_id': sub.id,
                    'polar_customer_id': sub.customer_id,
                    'polar_product_id': sub.product_id,
                    'status': 'active' if sub_status == 'active' else sub_status,
                    'current_period_start': sub.current_period_start or timezone.now(),
                    'current_period_end': sub.current_period_end or (timezone.now() + timezone.timedelta(days=30)),
                    'cancel_at_period_end': sub.cancel_at_period_end,
                }
            )

            # Upgrade user to Pro
            user.subscription_tier = 'pro'
            user.subscription_end_date = local_sub.current_period_end
            user.polar_subscription_id = sub.id
            if sub.customer_id:
                user.polar_customer_id = sub.customer_id
            user.save(update_fields=['subscription_tier', 'subscription_end_date', 'polar_subscription_id', 'polar_customer_id'])

            # Update usage quota to Pro limits
            usage_quota, _ = UsageQuota.objects.get_or_create(user=user)
            usage_quota.monthly_limit = getattr(settings, 'USAGE_LIMIT_PRO', 2000)
            usage_quota.save(update_fields=['monthly_limit'])

            logger.info(f"✅ User {user.email} upgraded to Pro! subscription={sub.id}")

        except User.DoesNotExist:
            logger.error(f"User {user_id} not found for subscription {sub.id}")

    def _handle_subscription_active(self, event):
        """Handle subscription becoming active (e.g., after trial or renewal)"""
        sub = event.data
        logger.info(f"Subscription active: {sub.id}")

        try:
            local_sub = Subscription.objects.get(polar_subscription_id=sub.id)
            user = local_sub.user

            local_sub.status = 'active'
            local_sub.current_period_start = sub.current_period_start or local_sub.current_period_start
            local_sub.current_period_end = sub.current_period_end or local_sub.current_period_end
            local_sub.cancel_at_period_end = sub.cancel_at_period_end
            local_sub.save()

            # Ensure user is Pro
            user.subscription_tier = 'pro'
            user.subscription_end_date = local_sub.current_period_end
            user.save(update_fields=['subscription_tier', 'subscription_end_date'])

            usage_quota, _ = UsageQuota.objects.get_or_create(user=user)
            usage_quota.monthly_limit = getattr(settings, 'USAGE_LIMIT_PRO', 2000)
            usage_quota.save(update_fields=['monthly_limit'])

            logger.info(f"✅ Subscription active for user {user.email}")

        except Subscription.DoesNotExist:
            logger.warning(f"Subscription {sub.id} not found locally, treating as new")
            self._handle_subscription_created(event)

    def _handle_subscription_updated(self, event):
        """Handle subscription updates (renewal, billing changes, etc.)"""
        sub = event.data

        logger.info(f"Subscription updated: {sub.id}")

        try:
            local_sub = Subscription.objects.get(polar_subscription_id=sub.id)
            user = local_sub.user

            sub_status = str(sub.status.value) if hasattr(sub.status, 'value') else str(sub.status)

            # Update subscription
            local_sub.status = sub_status
            if sub.current_period_end:
                local_sub.current_period_end = sub.current_period_end
            if sub.current_period_start:
                local_sub.current_period_start = sub.current_period_start
            local_sub.cancel_at_period_end = sub.cancel_at_period_end
            local_sub.save()

            # Update user based on status
            if sub_status == 'active':
                user.subscription_tier = 'pro'
                user.subscription_end_date = local_sub.current_period_end
                user.save(update_fields=['subscription_tier', 'subscription_end_date'])
            else:
                # Only downgrade to free if the paid period has ended
                period_ended = (
                    local_sub.current_period_end
                    and local_sub.current_period_end <= timezone.now()
                )
                if period_ended:
                    user.subscription_tier = 'free'
                    user.subscription_end_date = None
                    user.save(update_fields=['subscription_tier', 'subscription_end_date'])

                    try:
                        usage_quota = user.usage_quota
                        usage_quota.monthly_limit = getattr(settings, 'USAGE_LIMIT_FREE', 50)
                        usage_quota.save(update_fields=['monthly_limit'])
                    except UsageQuota.DoesNotExist:
                        pass

                    logger.info(f"User {user.email} downgraded to free (period ended)")
                else:
                    user.subscription_end_date = local_sub.current_period_end
                    user.save(update_fields=['subscription_end_date'])
                    logger.info(f"Subscription updated for {user.email}, Pro until {local_sub.current_period_end}")

        except Subscription.DoesNotExist:
            logger.warning(f"Subscription {sub.id} not found locally during update")

    def _handle_subscription_canceled(self, event):
        """Handle subscription cancellation"""
        sub = event.data

        logger.info(f"Subscription canceled: {sub.id}")

        try:
            local_sub = Subscription.objects.get(polar_subscription_id=sub.id)
            user = local_sub.user

            local_sub.status = 'cancelled'
            local_sub.cancel_at_period_end = True
            local_sub.save()

            # Check if the billing period has ended
            ends_at = sub.ends_at or sub.current_period_end
            if ends_at and ends_at <= timezone.now():
                user.subscription_tier = 'free'
                user.subscription_end_date = None
                user.save(update_fields=['subscription_tier', 'subscription_end_date'])

                try:
                    usage_quota = user.usage_quota
                    usage_quota.monthly_limit = getattr(settings, 'USAGE_LIMIT_FREE', 50)
                    usage_quota.save(update_fields=['monthly_limit'])
                except UsageQuota.DoesNotExist:
                    pass

                logger.info(f"User {user.email} downgraded to free (period ended)")
            else:
                user.subscription_end_date = ends_at
                user.save(update_fields=['subscription_end_date'])
                logger.info(f"User {user.email} cancelled but Pro until {ends_at}")

        except Subscription.DoesNotExist:
            logger.warning(f"Subscription {sub.id} not found locally during cancellation")

    def _handle_subscription_revoked(self, event):
        """Handle subscription revoked — immediate access removal"""
        sub = event.data

        logger.info(f"Subscription revoked: {sub.id}")

        try:
            local_sub = Subscription.objects.get(polar_subscription_id=sub.id)
            user = local_sub.user

            local_sub.status = 'cancelled'
            local_sub.save()

            user.subscription_tier = 'free'
            user.subscription_end_date = None
            user.save(update_fields=['subscription_tier', 'subscription_end_date'])

            try:
                usage_quota = user.usage_quota
                usage_quota.monthly_limit = getattr(settings, 'USAGE_LIMIT_FREE', 50)
                usage_quota.save(update_fields=['monthly_limit'])
            except UsageQuota.DoesNotExist:
                pass

            logger.info(f"User {user.email} downgraded to free (subscription revoked)")

        except Subscription.DoesNotExist:
            logger.warning(f"Subscription {sub.id} not found locally during revocation")

    # ─── Customer Handlers ──────────────────────────────────

    def _handle_customer_created(self, event):
        """Handle customer creation on Polar — link to local user"""
        customer = event.data
        metadata = customer.metadata or {}
        user_id = metadata.get('user_id')

        logger.info(f"Customer created: {customer.id}, email={customer.email}, user_id={user_id}")

        if user_id:
            try:
                user = User.objects.get(id=user_id)
                user.polar_customer_id = customer.id
                user.save(update_fields=['polar_customer_id'])
                logger.info(f"Linked Polar customer {customer.id} to user {user.email}")
            except User.DoesNotExist:
                logger.warning(f"User {user_id} not found for customer {customer.id}")
        elif customer.email:
            try:
                user = User.objects.get(email=customer.email)
                user.polar_customer_id = customer.id
                user.save(update_fields=['polar_customer_id'])
                logger.info(f"Linked Polar customer {customer.id} to user {user.email} (matched by email)")
            except User.DoesNotExist:
                logger.info(f"No user found for customer email {customer.email}")

    def _handle_customer_updated(self, event):
        """Handle customer update on Polar"""
        customer = event.data
        logger.info(f"Customer updated: {customer.id}, email={customer.email}")