<?php

namespace App\Models;

use App\Traits\Commentable;
use App\Traits\Likeable;
use Illuminate\Database\Eloquent\Model;

class Movie extends Model
{
    use Likeable, Commentable;
    
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
     * @return bool
     */
    public function addWatchLater(User $user): bool
    {
        // Use attach() to avoid potential issues with save()
        // syncWithoutDetaching() ensures we don't add duplicates
        $this->watchLaterUsers()->syncWithoutDetaching([$user->id]);
        return true;
    }

    /**
     * Remove a user from the watch later list.
     *
     * @param User $user
     * @return bool
     */
    public function removeWatchLater(User $user): bool
    {
        return $this->watchLaterUsers()->detach($user->id) > 0;
    }

    /**
     * Get the route key for the model.
     *
     * @return string
     */
    public function getRouteKeyName()
    {
        return 'slug';
    }


}
