<?php

namespace App\Http\Controllers;

use Laravel\Cashier\Http\Controllers\WebhookController as CashierController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class WebhookController extends CashierController
{
    /**
     * Handle customer subscription created.
     *
     * @param  array  $payload
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function handleCustomerSubscriptionCreated(array $payload)
    {
        Log::info('Subscription created', $payload);
        
        // Custom logic for when subscription is created
        // You can send welcome emails, update user roles, etc.
        
        return $this->successMethod();
    }

    /**
     * Handle customer subscription updated.
     *
     * @param  array  $payload
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function handleCustomerSubscriptionUpdated(array $payload)
    {
        Log::info('Subscription updated', $payload);
        
        // Custom logic for when subscription is updated
        // You can handle plan changes, quantity updates, etc.
        
        return $this->successMethod();
    }

    /**
     * Handle customer subscription deleted.
     *
     * @param  array  $payload
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function handleCustomerSubscriptionDeleted(array $payload)
    {
        Log::info('Subscription deleted', $payload);
        
        // Custom logic for when subscription is cancelled/deleted
        // You can send cancellation emails, update user access, etc.
        
        return $this->successMethod();
    }

    /**
     * Handle invoice payment succeeded.
     *
     * @param  array  $payload
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function handleInvoicePaymentSucceeded(array $payload)
    {
        Log::info('Invoice payment succeeded', $payload);
        
        // Custom logic for successful payments
        // You can send payment confirmation emails, update user credits, etc.
        
        return $this->successMethod();
    }

    /**
     * Handle invoice payment failed.
     *
     * @param  array  $payload
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function handleInvoicePaymentFailed(array $payload)
    {
        Log::info('Invoice payment failed', $payload);
        
        // Custom logic for failed payments
        // You can send payment failure notifications, suspend access, etc.
        
        return $this->successMethod();
    }

    /**
     * Handle customer updated.
     *
     * @param  array  $payload
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function handleCustomerUpdated(array $payload)
    {
        Log::info('Customer updated', $payload);
        
        // Custom logic for when customer details are updated
        
        return $this->successMethod();
    }

    /**
     * Handle payment method attached.
     *
     * @param  array  $payload
     * @return \Symfony\Component\HttpFoundation\Response
     */
    protected function handlePaymentMethodAttached(array $payload)
    {
        Log::info('Payment method attached', $payload);
        
        // Custom logic for when a payment method is attached
        
        return $this->successMethod();
    }
} 