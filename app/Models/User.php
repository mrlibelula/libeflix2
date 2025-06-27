<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Cashier\Billable;
use Spatie\Permission\Traits\HasRoles;

class User extends Authenticatable
{
    /** @use HasFactory<\Database\Factories\UserFactory> */
    use HasFactory, Notifiable, Billable, HasRoles;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
    ];

    /**
     * Get all watchlist entries for this user.
     */
    public function watchlists()
    {
        return $this->hasMany(Watchlist::class);
    }

    /**
     * Get the movies that the user has added to their watch later list.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function watchLaterMovies(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->morphedByMany(Movie::class, 'watchable', 'watchlists')
                    ->withPivot('created_at')
                    ->orderByPivot('created_at', 'desc');
    }

    /**
     * Get the tvshows that the user has added to their watch later list.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function watchLaterTvshows(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->morphedByMany(Tvshow::class, 'watchable', 'watchlists')
                    ->withPivot('created_at')
                    ->orderByPivot('created_at', 'desc');
    }

    /**
     * Get the seasons that the user has added to their watch later list.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function watchLaterSeasons(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->morphedByMany(Season::class, 'watchable', 'watchlists')
                    ->withPivot('created_at')
                    ->orderByPivot('created_at', 'desc');
    }

    /**
     * Get the episodes that the user has added to their watch later list.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function watchLaterEpisodes(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->morphedByMany(Episode::class, 'watchable', 'watchlists')
                    ->withPivot('created_at')
                    ->orderByPivot('created_at', 'desc');
    }

    /**
     * Get all watch later items for this user (all types).
     */
    public function watchLaterItems()
    {
        return $this->watchlists()->with('watchable');
    }

    /**
     * Get all the likes that the user has made.
     *
     * @return \Illuminate\Database\Eloquent\Relations\HasMany
     */
    public function likes(): \Illuminate\Database\Eloquent\Relations\HasMany
    {
        return $this->hasMany(Like::class);
    }

    /**
     * Check if the user has liked a specific model.
     *
     * @param Model $model
     * @return bool
     */
    public function hasLiked(Model $model): bool
    {
        return $this->likes()
            ->where('likeable_type', get_class($model))
            ->where('likeable_id', $model->id)
            ->exists();
    }

    /**
     * Like a specific model.
     *
     * @param Model $model
     * @return Like
     */
    public function like(Model $model): Like
    {
        return $this->likes()->firstOrCreate([
            'likeable_type' => get_class($model),
            'likeable_id' => $model->id,
        ]);
    }

    /**
     * Unlike a specific model.
     *
     * @param Model $model
     * @return bool
     */
    public function unlike(Model $model): bool
    {
        return $this->likes()
            ->where('likeable_type', get_class($model))
            ->where('likeable_id', $model->id)
            ->delete() > 0;
    }

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
        ];
    }

    /**
     * Check if user has access to premium content.
     *
     * @return bool
     */
    public function hasActivePremiumSubscription(): bool
    {
        return $this->subscribed('default');
    }

    /**
     * Check if user can access premium content (including trial period).
     *
     * @return bool
     */
    public function canAccessPremiumContent(): bool
    {
        // Admin users can access all premium content without restrictions
        if ($this->isAdmin()) {
            return true;
        }
        
        return $this->hasActivePremiumSubscription() || $this->onTrial('default');
    }

    /**
     * Get the user's subscription plan details.
     *
     * @return array|null
     */
    public function getSubscriptionPlanDetails(): ?array
    {
        $subscription = $this->subscription('default');
        
        if (!$subscription) {
            return null;
        }

        return [
            'status' => $subscription->stripe_status,
            'ends_at' => $subscription->ends_at,
            'trial_ends_at' => $subscription->trial_ends_at,
            'on_trial' => $subscription->onTrial(),
            'active' => $subscription->active(),
            'canceled' => $subscription->canceled(),
        ];
    }

    /**
     * Check if user is an admin.
     *
     * @return bool
     */
    public function isAdmin(): bool
    {
        return $this->hasRole('admin');
    }

    /**
     * Check if user is an editor.
     *
     * @return bool
     */
    public function isEditor(): bool
    {
        return $this->hasRole('editor');
    }

    /**
     * Check if user is a premium user.
     *
     * @return bool
     */
    public function isPremiumUser(): bool
    {
        return $this->hasRole('premium_user');
    }

    /**
     * Check if user can manage movies.
     *
     * @return bool
     */
    public function canManageMovies(): bool
    {
        return $this->hasPermissionTo('manage movies');
    }

    /**
     * Check if user can manage TV shows.
     *
     * @return bool
     */
    public function canManageTvShows(): bool
    {
        return $this->hasPermissionTo('manage tvshows');
    }

    /**
     * Check if user can access admin dashboard.
     *
     * @return bool
     */
    public function canAccessAdminDashboard(): bool
    {
        return $this->hasPermissionTo('view admin dashboard');
    }
}
