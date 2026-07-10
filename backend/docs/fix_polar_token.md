# Fix Polar Token Issue

## The Problem
Your Polar access token is returning a 401 Unauthorized error, which means:
1. The token is expired or invalid
2. The token doesn't have the required permissions
3. You might be using a sandbox token in production or vice versa

## Solution Steps

### 1. Generate a New Polar Access Token

1. Go to [Polar Dashboard](https://dashboard.polar.sh)
2. Navigate to **Settings** → **Access Tokens**
3. Click **"Create Token"**
4. Give it a name like "Sovereign Production"
5. Select these scopes/permissions:
   - `products:read`
   - `checkouts:write`
   - `customers:write`
   - `customers:read`
   - `subscriptions:write`
   - `subscriptions:read`
   - `webhooks:write` (if using webhooks)

6. Click **Create**
7. **Copy the token immediately** (you won't see it again)

### 2. Update Your .env File

Replace the old token in `/backend/.env`:
```
POLAR_ACCESS_TOKEN=your-new-token-here
```

### 3. Verify Your Product ID

Make sure the product ID in `polar_service.py` matches your actual Polar product:
```python
PRODUCT_IDS = {
    'pro_monthly': '7a620e51-4f87-4a0a-a28f-f4bb3de333b7',  # Verify this ID
}
```

To find your product ID:
1. Go to [Polar Dashboard](https://dashboard.polar.sh)
2. Navigate to **Products**
3. Click on your Pro Monthly product
4. Copy the Product ID from the URL or details

### 4. Restart Your Backend

After updating the token:
```bash
# If using Docker
docker-compose restart backend

# If running locally
# Stop the server and start again
python manage.py runserver
```

### 5. Test the Integration

Try clicking "Upgrade to Pro" again. If it still doesn't work:

1. Check Django logs for more details
2. Verify you're using the correct Polar environment (production vs sandbox)
3. Make sure your product is published and active in Polar

## Alternative: Quick Test

You can test your new token directly:
```bash
curl -X GET "https://api.polar.sh/v1/products" \
  -H "Authorization: Bearer YOUR_NEW_TOKEN" \
  -H "Accept: application/json"
```

This should return a 200 status with your products list.