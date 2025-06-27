<?php

namespace App\Traits;

use App\Models\User;
use App\Models\Watchlist;
use Illuminate\Database\Eloquent\Relations\MorphMany;

/**
 * Trait for "watch later" functionality
 */
trait Watchable
{
    /**
     * Get all watchlist entries for this model.
     */
    public function watchlists(): MorphMany
    {
        return $this->morphMany(Watchlist::class, 'watchable');
    }

    /**
     * Get the users that have added this item to their watch later list.
     */
    public function watchLaterUsers()
    {
        return $this->morphToMany(User::class, 'watchable', 'watchlists')
                    ->withPivot('created_at')
                    ->orderByPivot('created_at', 'desc');
    }

    /**
     * Add a user to the watch later list.
     *
     * @param User $user
     * @return bool
     */
    public function addWatchLater(User $user): bool
    {
        // Use firstOrCreate to avoid duplicates
        $this->watchlists()->firstOrCreate([
            'user_id' => $user->id,
        ]);
        
        return true;
    }

    /**
     * Remove a user from the watch later list.
     *
     * @param User $user
     * @return int
     */
    public function removeWatchLater(User $user): int
    {
        return $this->watchlists()
                    ->where('user_id', $user->id)
                    ->delete();
    }

    /**
     * Check if a user has added this item to their watch later list.
     *
     * @param User|null $user
     * @return bool
     */
    public function isWatchLater(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        return $this->watchlists()
                    ->where('user_id', $user->id)
                    ->exists();
    }
} 