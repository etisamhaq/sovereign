# Polar.sh Payment Integration Guide

This guide explains how to set up and use the Polar.sh payment integration for the AI Writing Platform.

## Overview

We've migrated from Stripe to Polar.sh for payment processing. Polar.sh is an open-source Merchant of Record that handles:
- Payment processing
- Tax calculation and remittance
- Subscription management
- International payments

## Setup Instructions

### 1. Create a Polar Account

1. Go to [polar.sh](https://polar.sh) and sign up
2. Create an organization for your platform
3. Navigate to your organization settings

### 2. Create Products

In your Polar dashboard:

1. Go to "Products" section
2. Create a product for the Pro subscription:
   - Name: "AI Writing Platform Pro"
   - Price: $3/month
   - Type: Recurring subscription
   - Note the Product ID (e.g., `prod_xxxxx`)

### 3. Configure Environment Variables

Add these to your backend `.env` file:

```env
# Polar Configuration
POLAR_ACCESS_TOKEN=your-polar-access-token
POLAR_WEBHOOK_SECRET=your-polar-webhook-secret
POLAR_CUSTOMER_PORTAL_URL=https://polar.sh/portal
```

### 4. Set Up Webhooks

In your Polar dashboard:

1. Go to "Webhooks" section
2. Add a new webhook endpoint:
   - URL: `https://your-domain.com/api/payments/webhook/polar/`
   - Events to subscribe:
     - `checkout.created`
     - `subscription.created`
     - `subscription.updated`
     - `subscription.canceled`

### 5. Update Product IDs

Update the product ID in the code:

1. In `backend/payments/polar_service.py`:
   ```python
   PRODUCT_IDS = {
       'pro_monthly': 'your-actual-polar-product-id',
   }
   ```

2. In `frontend/src/pages/PricingPage.tsx`:
   ```typescript
   productId: 'your-actual-polar-product-id',
   ```

## Testing the Integration

### 1. Run Migrations

```bash
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate
```

### 2. Test Polar Service

```bash
docker compose -f docker-compose.dev.yml exec backend python test_polar_integration.py
```

### 3. Test Checkout Flow

1. Start the development servers
2. Navigate to `/pricing`
3. Click "Upgrade to Pro"
4. You should be redirected to Polar's checkout page
5. Complete the test payment
6. Verify the subscription is created in your dashboard

## API Changes

### Frontend

The checkout flow has changed from embedded Stripe elements to Polar's hosted checkout:

```javascript
// Old (Stripe)
const { error, paymentMethod } = await stripe.createPaymentMethod({...});

// New (Polar)
const response = await apiClient.post('/payments/checkout-session/', {
  product_id: plan.productId,
});
window.location.href = response.data.checkout_url;
```

### Backend

Key changes:
- `stripe_customer_id` → `polar_customer_id`
- `stripe_subscription_id` → `polar_subscription_id`
- New webhook handling for Polar events
- Simplified checkout flow (no payment intents)

## Webhook Events

Polar sends these key events:

1. **checkout.created**: When a checkout session is created
2. **subscription.created**: When a subscription is successfully created
3. **subscription.updated**: When a subscription is modified
4. **subscription.canceled**: When a subscription is canceled

## Troubleshooting

### Common Issues

1. **"POLAR_ACCESS_TOKEN not set"**
   - Ensure the token is in your `.env` file
   - Restart the backend container

2. **"Product not found"**
   - Verify the product ID matches one in your Polar dashboard
   - Check that the product is active

3. **Webhook signature verification fails**
   - Ensure `POLAR_WEBHOOK_SECRET` matches the one in Polar dashboard
   - Check that the webhook URL is correct

### Debug Mode

Enable debug logging in Django settings:
```python
LOGGING = {
    'loggers': {
        'payments': {
            'level': 'DEBUG',
        },
    },
}
```

## Support

- Polar Documentation: [docs.polar.sh](https://docs.polar.sh)
- Polar Support: support@polar.sh
- API Reference: [docs.polar.sh/api](https://docs.polar.sh/api)