# LibeFlix Subscription System Setup

This document outlines how to set up and configure the complete subscription system for LibeFlix using Laravel Cashier and Stripe.

## Features Implemented

### Backend Features
- ✅ Laravel Cashier integration with Stripe
- ✅ Subscription plans management
- ✅ User billing and subscription tracking
- ✅ Webhook handling for subscription events
- ✅ Premium content access control middleware
- ✅ Invoice generation and download
- ✅ Payment method management

### Frontend Features
- ✅ Subscription plan selection page
- ✅ Secure Stripe payment forms
- ✅ Subscription management dashboard
- ✅ Premium content access notices
- ✅ Responsive design with Tailwind CSS

### Access Control
- ✅ Public access to free content (is_free = true)
- ✅ Authentication required only for premium content
- ✅ Subscription verification for premium movies/episodes
- ✅ Trial period support

## Setup Instructions

### 1. Environment Configuration

Add these variables to your `.env` file:

```env
# Stripe Configuration
STRIPE_KEY=pk_test_your_stripe_publishable_key
STRIPE_SECRET=sk_test_your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret

# Cashier Configuration
CASHIER_CURRENCY=usd
CASHIER_CURRENCY_LOCALE=en
```

### 2. Database Migration

Run the migrations to set up the database:

```bash
php artisan migrate
```

This will create:
- `subscriptions` table (Cashier)
- `subscription_items` table (Cashier)
- `subscription_plans` table (Custom)
- Add billing columns to `users` table

### 3. Stripe Dashboard Setup

#### Create Products and Prices in Stripe:

1. Go to [Stripe Dashboard](https://dashboard.stripe.com)
2. Navigate to Products → Add Product
3. Create products for each subscription tier:
   - Basic Plan (Monthly & Yearly)
   - Standard Plan (Monthly & Yearly)
   - Premium Plan (Monthly & Yearly)

4. Note the Price IDs from Stripe (e.g., `price_1234567890`)

#### Set up Webhooks:

1. Go to Developers → Webhooks → Add endpoint
2. Set endpoint URL: `https://yourdomain.com/stripe/webhook`
3. Select events to listen for:
   - `customer.subscription.created`
   - `customer.subscription.updated` 
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
   - `customer.updated`
   - `payment_method.attached`

### 4. Seed Subscription Plans

Update the `SubscriptionPlanSeeder` with your actual Stripe Price IDs:

```php
// database/seeders/SubscriptionPlanSeeder.php
'stripe_price_id' => 'price_actual_stripe_price_id_here',
'stripe_product_id' => 'prod_actual_stripe_product_id_here',
```

Then run the seeder:

```bash
php artisan db:seed --class=SubscriptionPlanSeeder
```

### 5. Install Frontend Dependencies

```bash
npm install @stripe/stripe-js @stripe/react-stripe-js
```

### 6. Content Management

#### Mark Content as Free or Premium:

For movies:
```php
// Set as free content
Movie::where('id', 1)->update(['is_free' => true]);

// Set as premium content  
Movie::where('id', 2)->update(['is_free' => false]);
```

For episodes:
```php
// Set episode as free
Episode::where('id', 1)->update(['is_free' => true]);

// Set episode as premium
Episode::where('id', 2)->update(['is_free' => false]);
```

## Usage

### Routes Available

#### Public Routes (No Authentication Required)
- `GET /` - Homepage
- `GET /movies` - Movies listing
- `GET /tvshows` - TV shows listing
- `GET /movie/{slug}` - Movie details
- `GET /tvshow/{slug}` - TV show details
- `GET /subscription/plans` - View subscription plans

#### Premium Content Routes (Subscription Required for Non-Free Content)
- `GET /movie/stream/{encFilePath}` - Stream movie
- `GET /tvshow/stream/{encFilePath}` - Stream episode
- `GET /movie/subtitles/{encFilePath}` - Movie subtitles
- `GET /tvshow/subtitles/{encFilePath}` - Episode subtitles

#### Authenticated Routes
- `GET /dashboard` - User dashboard
- `GET /watch-later` - Watch later list
- `GET /subscription/manage` - Manage subscription
- `POST /subscription/subscribe` - Create subscription
- `POST /subscription/cancel` - Cancel subscription
- `POST /subscription/resume` - Resume subscription

#### Webhook Route
- `POST /stripe/webhook` - Stripe webhook handler

### Frontend Components

#### Subscription Plans Page
```tsx
// Usage in React component
import SubscriptionPlans from '@/pages/subscription/plans';

// Rendered at /subscription/plans
```

#### Subscription Management
```tsx
// Usage in React component  
import ManageSubscription from '@/pages/subscription/manage';

// Rendered at /subscription/manage
```

#### Premium Content Notice
```tsx
// Usage in any component
import PremiumContentNotice, { InlinePremiumNotice } from '@/components/premium-content-notice';

// Full notice component
<PremiumContentNotice 
    title="Premium Movie"
    description="Subscribe to watch this movie in HD"
    showPreview={true}
/>

// Inline notice
<InlinePremiumNotice />
```

### Checking User Subscription Status

#### In PHP (Backend)
```php
// Check if user has active subscription
$user = auth()->user();
if ($user && $user->canAccessPremiumContent()) {
    // User has access to premium content
}

// Check specific subscription details
$subscriptionDetails = $user->getSubscriptionPlanDetails();
```

#### In JavaScript (Frontend)
```tsx
// Using Inertia shared props
import { usePage } from '@inertiajs/react';

function MyComponent() {
    const { auth } = usePage().props as any;
    
    if (auth.canAccessPremium) {
        // User has premium access
    }
    
    if (auth.subscription) {
        // Access subscription details
        console.log(auth.subscription.status);
    }
}
```

## Security Considerations

1. **PCI Compliance**: Payment forms use Stripe Elements (no card data touches your servers)
2. **CSRF Protection**: All forms include CSRF tokens
3. **Webhook Verification**: Stripe webhooks are verified using the webhook secret
4. **Access Control**: Premium content is protected by middleware
5. **Authentication**: Secure session-based authentication

## Customization

### Adding New Subscription Plans

1. Create the product/price in Stripe Dashboard
2. Add the plan to `SubscriptionPlanSeeder`
3. Run the seeder: `php artisan db:seed --class=SubscriptionPlanSeeder`

### Customizing Premium Content Logic

Edit `app/Http/Middleware/CheckPremiumContent.php` to modify how premium content access is determined.

### Styling Customization

All components use Tailwind CSS classes and can be customized by editing the component files in `resources/js/`.

## Testing

### Test with Stripe Test Mode

Use Stripe's test card numbers:
- Successful payment: `4242 4242 4242 4242`  
- Declined payment: `4000 0000 0000 0002`
- Requires authentication: `4000 0025 0000 3155`

### Local Testing with Stripe CLI

```bash
# Install Stripe CLI
stripe listen --forward-to localhost:8000/stripe/webhook

# Test webhook
stripe trigger customer.subscription.created
```

## Troubleshooting

### Common Issues

1. **Webhook not working**: Check webhook secret in `.env` and Stripe dashboard
2. **Payment failed**: Verify Stripe keys are correct and not mixed (test/live)
3. **Subscription not active**: Check webhook events are being processed
4. **Premium content accessible**: Verify `is_free` column values in database

### Debugging

Enable logging in `config/cashier.php`:
```php
'logger' => 'daily',
```

Check logs in `storage/logs/` for Stripe-related errors.

## Production Deployment

1. Replace test Stripe keys with live keys
2. Update webhook endpoint URL to production domain
3. Test all payment flows in production environment
4. Monitor webhook delivery in Stripe Dashboard
5. Set up proper error logging and monitoring

## Support

For issues related to:
- Stripe integration: Check [Stripe Documentation](https://stripe.com/docs)
- Laravel Cashier: Check [Cashier Documentation](https://laravel.com/docs/billing)
- LibeFlix specific issues: Check application logs and debug accordingly 