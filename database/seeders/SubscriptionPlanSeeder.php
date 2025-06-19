<?php

namespace Database\Seeders;

use App\Models\SubscriptionPlan;
use Illuminate\Database\Seeder;

class SubscriptionPlanSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $plans = [
            [
                'name' => 'Basic Plan',
                'slug' => 'basic',
                'description' => 'Access to all premium movies and TV shows with standard definition streaming.',
                'price' => 9.99,
                'currency' => 'USD',
                'interval' => 'month',
                'interval_count' => 1,
                'stripe_price_id' => 'price_basic_monthly', // Replace with actual Stripe price ID
                'stripe_product_id' => 'prod_basic', // Replace with actual Stripe product ID
                'trial_days' => 7,
                'is_active' => true,
                'sort_order' => 1,
                'features' => [
                    'Access to all premium content',
                    'Standard definition streaming',
                    'Watch on 1 device at a time',
                    'Mobile and desktop access',
                ],
            ],
            [
                'name' => 'Standard Plan',
                'slug' => 'standard',
                'description' => 'Access to all premium content with high definition streaming and multiple devices.',
                'price' => 15.99,
                'currency' => 'USD',
                'interval' => 'month',
                'interval_count' => 1,
                'stripe_price_id' => 'price_standard_monthly', // Replace with actual Stripe price ID
                'stripe_product_id' => 'prod_standard', // Replace with actual Stripe product ID
                'trial_days' => 7,
                'is_active' => true,
                'sort_order' => 2,
                'features' => [
                    'Access to all premium content',
                    'High definition streaming',
                    'Watch on 2 devices at the same time',
                    'Mobile, desktop, and TV access',
                    'Download content for offline viewing',
                ],
            ],
            [
                'name' => 'Premium Plan',
                'slug' => 'premium',
                'description' => 'Ultimate streaming experience with 4K Ultra HD and support for multiple devices.',
                'price' => 19.99,
                'currency' => 'USD',
                'interval' => 'month',
                'interval_count' => 1,
                'stripe_price_id' => 'price_premium_monthly', // Replace with actual Stripe price ID
                'stripe_product_id' => 'prod_premium', // Replace with actual Stripe product ID
                'trial_days' => 7,
                'is_active' => true,
                'sort_order' => 3,
                'features' => [
                    'Access to all premium content',
                    '4K Ultra HD streaming',
                    'Watch on 4 devices at the same time',
                    'Mobile, desktop, TV, and tablet access',
                    'Download content for offline viewing',
                    'Early access to new releases',
                    'Priority customer support',
                ],
            ],
            [
                'name' => 'Annual Basic',
                'slug' => 'basic-yearly',
                'description' => 'Basic plan billed annually with 2 months free!',
                'price' => 99.99,
                'currency' => 'USD',
                'interval' => 'year',
                'interval_count' => 1,
                'stripe_price_id' => 'price_basic_yearly', // Replace with actual Stripe price ID
                'stripe_product_id' => 'prod_basic', // Same product as monthly basic
                'trial_days' => 7,
                'is_active' => true,
                'sort_order' => 4,
                'features' => [
                    'Access to all premium content',
                    'Standard definition streaming',
                    'Watch on 1 device at a time',
                    'Mobile and desktop access',
                    'Save $19.89 compared to monthly billing',
                ],
            ],
            [
                'name' => 'Annual Standard',
                'slug' => 'standard-yearly',
                'description' => 'Standard plan billed annually with 2 months free!',
                'price' => 159.99,
                'currency' => 'USD',
                'interval' => 'year',
                'interval_count' => 1,
                'stripe_price_id' => 'price_standard_yearly', // Replace with actual Stripe price ID
                'stripe_product_id' => 'prod_standard', // Same product as monthly standard
                'trial_days' => 7,
                'is_active' => true,
                'sort_order' => 5,
                'features' => [
                    'Access to all premium content',
                    'High definition streaming',
                    'Watch on 2 devices at the same time',
                    'Mobile, desktop, and TV access',
                    'Download content for offline viewing',
                    'Save $31.89 compared to monthly billing',
                ],
            ],
            [
                'name' => 'Annual Premium',
                'slug' => 'premium-yearly',
                'description' => 'Premium plan billed annually with 2 months free!',
                'price' => 199.99,
                'currency' => 'USD',
                'interval' => 'year',
                'interval_count' => 1,
                'stripe_price_id' => 'price_premium_yearly', // Replace with actual Stripe price ID
                'stripe_product_id' => 'prod_premium', // Same product as monthly premium
                'trial_days' => 7,
                'is_active' => true,
                'sort_order' => 6,
                'features' => [
                    'Access to all premium content',
                    '4K Ultra HD streaming',
                    'Watch on 4 devices at the same time',
                    'Mobile, desktop, TV, and tablet access',
                    'Download content for offline viewing',
                    'Early access to new releases',
                    'Priority customer support',
                    'Save $39.89 compared to monthly billing',
                ],
            ],
        ];

        foreach ($plans as $plan) {
            SubscriptionPlan::updateOrCreate(
                ['slug' => $plan['slug']],
                $plan
            );
        }
    }
} 