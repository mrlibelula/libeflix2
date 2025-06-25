<?php

namespace App\Traits;

use App\Models\Like;
use App\Models\User;

trait Likeable
{
    /**
     * Get all the likes for this model.
     *
     * @return \Illuminate\Database\Eloquent\Relations\MorphMany
     */
    public function likes(): \Illuminate\Database\Eloquent\Relations\MorphMany
    {
        return $this->morphMany(Like::class, 'likeable');
    }

    /**
     * Get the count of likes for this model.
     *
     * @return int
     */
    public function likesCount(): int
    {
        return $this->likes()->count();
    }

    /**
     * Check if a user has liked this model.
     *
     * @param User $user
     * @return bool
     */
    public function isLikedBy(User $user): bool
    {
        return $this->likes()->where('user_id', $user->id)->exists();
    }
} 