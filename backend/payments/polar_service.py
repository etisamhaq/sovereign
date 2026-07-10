"""
Polar Payment Service
Handles all Polar API interactions for subscriptions and payments
"""
import logging
from django.conf import settings
from django.utils import timezone
from decimal import Decimal
from typing import Optional, Dict, Any, List
from polar_sdk import Polar
from polar_sdk.models import SDKError

logger = logging.getLogger(__name__)


class PolarServiceError(Exception):
    """Custom exception for Polar service errors"""
    def __init__(self, message: str, is_auth_error: bool = False):
        self.message = message
        self.is_auth_error = is_auth_error
        super().__init__(self.message)


class PolarService:
    """
    Service for interacting with Polar API
    """

    @property
    def PRODUCT_IDS(self):
        return {
            'pro_monthly': settings.POLAR_PRO_MONTHLY_PRODUCT_ID,
        }

    def __init__(self):
        """Initialize Polar client"""
        self.access_token = settings.POLAR_ACCESS_TOKEN

        if not self.access_token:
            logger.warning("POLAR_ACCESS_TOKEN is not configured")

        self._client = None

    @property
    def client(self) -> Polar:
        """Get or create Polar client (lazy initialization)"""
        if self._client is None:
            if not self.access_token:
                raise PolarServiceError(
                    "Polar is not configured. Please set POLAR_ACCESS_TOKEN in environment variables.",
                    is_auth_error=True
                )
            self._client = Polar(access_token=self.access_token)
        return self._client

    def _handle_error(self, error: Exception, operation: str) -> None:
        """Handle Polar API errors with helpful messages"""
        error_str = str(error)

        if isinstance(error, SDKError):
            if '401' in error_str or 'invalid_token' in error_str:
                raise PolarServiceError(
                    "Polar API authentication failed. The access token is invalid or expired. "
                    "Please generate a new Organization Access Token from https://polar.sh/dashboard/settings",
                    is_auth_error=True
                )
            elif '403' in error_str:
                raise PolarServiceError(
                    f"Permission denied for {operation}. Please check your Polar access token has the required scopes."
                )
            elif '404' in error_str:
                raise PolarServiceError(
                    f"Resource not found during {operation}. Please verify the product/subscription ID is correct."
                )
            elif '422' in error_str:
                raise PolarServiceError(
                    f"Invalid request for {operation}. Please check the request parameters."
                )

        logger.error(f"Polar API error during {operation}: {error}")
        raise PolarServiceError(f"Polar API error: {error_str}")

    def validate_token(self) -> Dict[str, Any]:
        """Validate the Polar access token by making a simple API call"""
        try:
            # Try to list products to validate the token
            response = self.client.products.list()
            # Handle both old and new SDK response formats
            items = response.result.items if hasattr(response, 'result') else getattr(response, 'items', [])
            return {
                'valid': True,
                'products_count': len(items) if items else 0
            }
        except Exception as e:
            self._handle_error(e, "token validation")

    def list_products(self) -> List[Dict[str, Any]]:
        """List all products from Polar"""
        try:
            response = self.client.products.list()
            # Handle both old and new SDK response formats
            items = response.result.items if hasattr(response, 'result') else getattr(response, 'items', [])
            return [
                {
                    'id': p.id,
                    'name': p.name,
                    'description': p.description,
                    'is_recurring': p.is_recurring,
                    'prices': [
                        {
                            'id': price.id,
                            'amount': getattr(price, 'price_amount', None),
                            'currency': getattr(price, 'price_currency', 'usd'),
                        }
                        for price in (p.prices or [])
                    ] if p.prices else []
                }
                for p in (items or [])
            ]
        except Exception as e:
            self._handle_error(e, "listing products")

    def create_checkout_session(
        self,
        user,
        product_id: str,
        success_url: str,
        cancel_url: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Create a checkout session for subscription

        Args:
            user: Django user object
            product_id: Polar product ID
            success_url: URL to redirect after successful payment
            cancel_url: URL to redirect if user cancels (optional)

        Returns:
            Dictionary with checkout session details
        """
        try:
            # Build checkout request - minimal required fields only
            # Polar will collect customer details during checkout
            checkout_data = {
                'products': [product_id],
                'success_url': success_url,
                'metadata': {
                    'user_id': str(user.id),
                },
                'allow_discount_codes': True,
            }

            # Only add customer_email if it's a valid real email (not example.com, etc)
            if user.email and not user.email.endswith(('example.com', 'test.com', 'localhost')):
                checkout_data['customer_email'] = user.email
                # Add customer name if available
                full_name = user.get_full_name() if hasattr(user, 'get_full_name') else None
                if full_name:
                    checkout_data['customer_name'] = full_name

            logger.info(f"Creating checkout for user {user.email} with product {product_id}")

            checkout = self.client.checkouts.create(request=checkout_data)

            logger.info(f"Checkout created successfully: {checkout.id}")

            return {
                'id': checkout.id,
                'url': checkout.url,
                'client_secret': checkout.client_secret,
                'status': str(checkout.status.value) if hasattr(checkout.status, 'value') else str(checkout.status),
                'expires_at': str(checkout.expires_at) if checkout.expires_at else None,
            }

        except PolarServiceError:
            raise
        except Exception as e:
            self._handle_error(e, "creating checkout session")

    def get_checkout(self, checkout_id: str) -> Dict[str, Any]:
        """Get checkout session details"""
        try:
            checkout = self.client.checkouts.get(id=checkout_id)
            return {
                'id': checkout.id,
                'status': str(checkout.status.value) if hasattr(checkout.status, 'value') else str(checkout.status),
                'url': checkout.url,
                'customer_email': checkout.customer_email,
                'amount': checkout.amount,
                'total_amount': checkout.total_amount,
            }
        except Exception as e:
            self._handle_error(e, "getting checkout")

    def create_customer(self, user) -> Dict[str, Any]:
        """Create a Polar customer for a user"""
        try:
            customer = self.client.customers.create(
                request={
                    'email': user.email,
                    'name': user.get_full_name() or user.email,
                    'external_id': str(user.id),
                    'metadata': {
                        'user_id': str(user.id),
                    }
                }
            )

            # Save customer ID to user
            user.polar_customer_id = customer.id
            user.save(update_fields=['polar_customer_id'])

            return {
                'id': customer.id,
                'email': customer.email,
            }
        except Exception as e:
            self._handle_error(e, "creating customer")

    def get_or_create_customer(self, user):
        """Get existing Polar customer or create new one"""
        if user.polar_customer_id:
            try:
                customer = self.client.customers.get(id=user.polar_customer_id)
                return {
                    'id': customer.id,
                    'email': customer.email,
                }
            except Exception:
                logger.warning(f"Could not find customer {user.polar_customer_id}, creating new one")

        return self.create_customer(user)

    def get_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Get subscription details"""
        try:
            subscription = self.client.subscriptions.get(id=subscription_id)
            return {
                'id': subscription.id,
                'status': str(subscription.status.value) if hasattr(subscription.status, 'value') else str(subscription.status),
                'current_period_start': str(subscription.current_period_start) if subscription.current_period_start else None,
                'current_period_end': str(subscription.current_period_end) if subscription.current_period_end else None,
                'cancel_at_period_end': subscription.cancel_at_period_end,
            }
        except Exception as e:
            self._handle_error(e, "getting subscription")

    def cancel_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Cancel a subscription at the end of the billing period"""
        try:
            subscription = self.client.subscriptions.update(
                id=subscription_id,
                request={
                    'cancel_at_period_end': True
                }
            )
            return {
                'id': subscription.id,
                'status': str(subscription.status.value) if hasattr(subscription.status, 'value') else str(subscription.status),
                'cancel_at_period_end': subscription.cancel_at_period_end,
            }
        except Exception as e:
            self._handle_error(e, "canceling subscription")

    def resume_subscription(self, subscription_id: str) -> Dict[str, Any]:
        """Resume a canceled subscription"""
        try:
            subscription = self.client.subscriptions.update(
                id=subscription_id,
                request={
                    'cancel_at_period_end': False
                }
            )
            return {
                'id': subscription.id,
                'status': str(subscription.status.value) if hasattr(subscription.status, 'value') else str(subscription.status),
                'cancel_at_period_end': subscription.cancel_at_period_end,
            }
        except Exception as e:
            self._handle_error(e, "resuming subscription")

    def list_customer_subscriptions(self, user) -> List[Dict[str, Any]]:
        """List all subscriptions for a customer"""
        if not user.polar_customer_id:
            return []

        try:
            response = self.client.subscriptions.list(
                customer_id=user.polar_customer_id,
            )
            # Handle both old and new SDK response formats
            items = response.result.items if hasattr(response, 'result') else getattr(response, 'items', [])
            return [
                {
                    'id': sub.id,
                    'status': str(sub.status.value) if hasattr(sub.status, 'value') else str(sub.status),
                    'current_period_end': str(sub.current_period_end) if sub.current_period_end else None,
                    'cancel_at_period_end': sub.cancel_at_period_end,
                }
                for sub in (items or [])
            ]
        except Exception as e:
            logger.error(f"Error listing subscriptions: {e}")
            return []

    # NOTE: Webhook signature verification and event parsing are now handled
    # directly in PolarWebhookView using the official Polar SDK:
    #   from polar_sdk.webhooks import validate_event, WebhookVerificationError
    # See payments/views.py for the implementation.
