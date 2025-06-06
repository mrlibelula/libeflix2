<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Movie extends Model
{
    protected $guarded = [];

    /**
     * Get the users that have added this movie to their watch later list.
     *
     * @return \Illuminate\Database\Eloquent\Relations\BelongsToMany
     */
    public function watchLaterUsers(): \Illuminate\Database\Eloquent\Relations\BelongsToMany
    {
        return $this->belongsToMany(User::class)->withPivot('created_at')->orderBy('movie_user.created_at', 'ASC');
    }

    /**
     * Add a user to the watch later list.
     *
     * @param User $user
     * @return User
     */
    public function addWatchLater(User $user): User
    {
        return $this->watchLaterUsers()->save($user);
    }

    /**
     * Remove a user from the watch later list.
     *
     * @param User $user
     * @return bool
     */
    public function removeWatchLater(User $user): bool
    {
        return $this->watchLaterUsers()->detach($user);
    }
}
