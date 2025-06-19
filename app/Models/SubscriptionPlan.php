<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SubscriptionPlan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'description',
        'price',
        'currency',
        'interval',
        'interval_count',
        'stripe_price_id',
        'stripe_product_id',
        'trial_days',
        'is_active',
        'sort_order',
        'features',
    ];

    protected $casts = [
        'price' => 'decimal:2',
        'trial_days' => 'integer',
        'interval_count' => 'integer',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'features' => 'array',
    ];

    /**
     * Get active subscription plans ordered by sort_order.
     *
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function scopeActive($query)
    {
        return $query->where('is_active', true)->orderBy('sort_order');
    }

    /**
     * Get the formatted price for display.
     *
     * @return string
     */
    public function getFormattedPriceAttribute(): string
    {
        return '$' . number_format($this->price, 2);
    }

    /**
     * Get the interval display text.
     *
     * @return string
     */
    public function getIntervalDisplayAttribute(): string
    {
        $interval = $this->interval;
        
        if ($this->interval_count > 1) {
            $interval = $this->interval_count . ' ' . \Illuminate\Support\Str::plural($interval);
        }
        
        return $interval;
    }

    /**
     * Get the full display name with interval.
     *
     * @return string
     */
    public function getFullNameAttribute(): string
    {
        return $this->name . ' (' . $this->formatted_price . '/' . $this->interval_display . ')';
    }
} 