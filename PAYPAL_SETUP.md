# PayPal Integration Setup Guide

## Important: Replace PayPal Client ID

The PayPal SDK is currently using a placeholder Client ID. You need to replace it with your actual PayPal Business account Client ID.

### Steps to Get Your PayPal Client ID:

1. **Log in to PayPal Developer Dashboard**
   - Go to https://developer.paypal.com/
   - Log in with your PayPal Business account (sgctrustyourself@gmail.com)

2. **Create or Access Your App**
   - Navigate to "My Apps & Credentials"
   - Create a new app or use an existing one
   - Copy the **Client ID** (it looks like: `AXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx`)

3. **Update index.html**
   - Open `c:/Users/SG/OneDrive/WebApps/SGCoalition/index.html`
   - Find line 32: `<script src="https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID&currency=USD"></script>`
   - Replace `YOUR_PAYPAL_CLIENT_ID` with your actual Client ID

### Example:
```html
<!-- Before -->
<script src="https://www.paypal.com/sdk/js?client-id=YOUR_PAYPAL_CLIENT_ID&currency=USD"></script>

<!-- After -->
<script src="https://www.paypal.com/sdk/js?client-id=AXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXx&currency=USD"></script>
```

### Payment Flow:

1. **Customer pays** via PayPal on your site
2. **Payment goes directly** to your PayPal account (sgctrustyourself@gmail.com)
3. **You receive email notification** with:
   - Customer wallet address
   - SGCOIN amount (with 10% bonus)
   - PayPal transaction ID
4. **You send SGCOIN** to customer's wallet within 24 hours

### Testing:

For testing, you can use PayPal Sandbox:
- Use `&disable-funding=credit,card` in the SDK URL to test with PayPal accounts only
- Or get Sandbox Client ID from the Developer Dashboard

### Security Note:

The Client ID is safe to expose in the frontend. It's designed to be public. Your Secret Key should NEVER be in the frontend code.
