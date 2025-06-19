<?php

namespace App\Http\Controllers;

use App\Models\SubscriptionPlan;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Illuminate\Http\RedirectResponse;
use Stripe\Stripe;
use Stripe\Exception\CardException;
use Stripe\Exception\InvalidRequestException;

class SubscriptionController extends Controller
{
    public function __construct()
    {
        Stripe::setApiKey(config('cashier.secret'));
    }

    /**
     * Display subscription plans
     */
    public function plans()
    {
        $plans = SubscriptionPlan::active()
            ->orderBy('sort_order')
            ->get();

        $user = auth()->user();
        $currentSubscription = $user ? $user->getSubscriptionPlanDetails() : null;

        return Inertia::render('subscription/plans', [
            'plans' => $plans,
            'currentSubscription' => $currentSubscription,
            'stripeKey' => config('cashier.key'),
        ]);
    }

    /**
     * Display subscription management page
     */
    public function manage()
    {
        $user = auth()->user();
        
        if (!$user) {
            return redirect()->route('login');
        }

        $subscription = $user->subscription('default');
        $subscriptionDetails = $user->getSubscriptionPlanDetails();
        $plans = SubscriptionPlan::active()->get();

        // Check if this is being accessed from settings
        $isSettingsRoute = request()->routeIs('settings.subscription');
        $template = $isSettingsRoute ? 'settings/subscription' : 'subscription/manage';

        return Inertia::render($template, [
            'subscription' => $subscriptionDetails,
            'plans' => $plans,
            'invoices' => $user->invoices(),
            'paymentMethods' => $user->paymentMethods(),
        ]);
    }

    /**
     * Create a subscription
     */
    public function subscribe(Request $request): RedirectResponse
    {
        $request->validate([
            'plan' => 'required|exists:subscription_plans,slug',
            'payment_method' => 'required|string',
        ]);

        $user = auth()->user();
        $plan = SubscriptionPlan::where('slug', $request->plan)->firstOrFail();

        try {
            // Create or update the customer in Stripe
            if (!$user->hasStripeId()) {
                $user->createAsStripeCustomer();
            }

            // Add payment method
            $user->addPaymentMethod($request->payment_method);
            $user->updateDefaultPaymentMethod($request->payment_method);

            // Create subscription
            $subscription = $user->newSubscription('default', $plan->stripe_price_id);

            // Add trial if specified
            if ($plan->trial_days > 0) {
                $subscription->trialDays($plan->trial_days);
            }

            $subscription->create($request->payment_method);

            return redirect()->route('subscription.manage')
                ->with('success', 'Subscription created successfully!');

        } catch (CardException $e) {
            return back()->withErrors(['payment_method' => $e->getMessage()]);
        } catch (InvalidRequestException $e) {
            return back()->withErrors(['general' => 'There was an error processing your payment. Please try again.']);
        } catch (\Exception $e) {
            return back()->withErrors(['general' => 'An unexpected error occurred. Please try again.']);
        }
    }

    /**
     * Cancel subscription
     */
    public function cancel(Request $request): RedirectResponse
    {
        $user = auth()->user();
        $subscription = $user->subscription('default');

        if (!$subscription) {
            return back()->withErrors(['general' => 'No active subscription found.']);
        }

        $subscription->cancel();

        return back()->with('success', 'Subscription cancelled successfully. You will continue to have access until the end of your billing period.');
    }

    /**
     * Resume cancelled subscription
     */
    public function resume(Request $request): RedirectResponse
    {
        $user = auth()->user();
        $subscription = $user->subscription('default');

        if (!$subscription || !$subscription->canceled()) {
            return back()->withErrors(['general' => 'No cancelled subscription found.']);
        }

        $subscription->resume();

        return back()->with('success', 'Subscription resumed successfully!');
    }

    /**
     * Update subscription plan
     */
    public function updatePlan(Request $request): RedirectResponse
    {
        $request->validate([
            'plan' => 'required|exists:subscription_plans,slug',
        ]);

        $user = auth()->user();
        $plan = SubscriptionPlan::where('slug', $request->plan)->firstOrFail();
        $subscription = $user->subscription('default');

        if (!$subscription) {
            return back()->withErrors(['general' => 'No active subscription found.']);
        }

        try {
            $subscription->swap($plan->stripe_price_id);

            return back()->with('success', 'Subscription plan updated successfully!');
        } catch (\Exception $e) {
            return back()->withErrors(['general' => 'Error updating subscription plan. Please try again.']);
        }
    }

    /**
     * Update payment method
     */
    public function updatePaymentMethod(Request $request): RedirectResponse
    {
        $request->validate([
            'payment_method' => 'required|string',
        ]);

        $user = auth()->user();

        try {
            $user->updateDefaultPaymentMethod($request->payment_method);

            return back()->with('success', 'Payment method updated successfully!');
        } catch (\Exception $e) {
            return back()->withErrors(['general' => 'Error updating payment method. Please try again.']);
        }
    }

    /**
     * Download invoice
     */
    public function downloadInvoice(Request $request, string $invoiceId)
    {
        $user = auth()->user();
        
        return $user->downloadInvoice($invoiceId, [
            'vendor' => config('app.name'),
            'product' => 'Premium Subscription',
        ]);
    }
}