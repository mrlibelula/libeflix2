<?php

namespace App\Traits;

use App\Models\User;
use App\Models\View;
use App\Models\WatchProgress;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait Viewable
{
    /**
     * Get all the views for this model.
     *
     * @return \Illuminate\Database\Eloquent\Relations\MorphMany
     */
    public function views(): MorphMany
    {
        return $this->morphMany(View::class, 'viewable');
    }

    /**
     * Get all watch progress entries for this model.
     *
     * @return \Illuminate\Database\Eloquent\Relations\MorphMany
     */
    public function watchProgresses(): MorphMany
    {
        return $this->morphMany(WatchProgress::class, 'watchable');
    }

    /**
     * Get the count of views for this model.
     *
     * @return int
     */
    public function viewsCount(): int
    {
        return $this->views()->count();
    }

    /**
     * Get the count of unique users who viewed this model.
     *
     * @return int
     */
    public function uniqueViewersCount(): int
    {
        return $this->views()->distinct('user_id')->count('user_id');
    }

    /**
     * Check if a user has viewed this model.
     *
     * @param User|null $user
     * @return bool
     */
    public function isViewedBy(?User $user): bool
    {
        if (!$user) {
            return false;
        }

        return $this->views()
            ->where('user_id', $user->id)
            ->exists();
    }

    /**
     * Record a view for this model by a user.
     *
     * @param User|null $user
     * @return View|null
     */
    public function recordView(?User $user): ?View
    {
        if (!$user) {
            return null;
        }

        return $this->views()->firstOrCreate(
            ['user_id' => $user->id],
            ['viewed_at' => now()]
        );
    }

    /**
     * Get or create watch progress for a user.
     *
     * @param User $user
     * @return WatchProgress
     */
    public function getOrCreateProgress(User $user): WatchProgress
    {
        return $this->watchProgresses()->firstOrCreate(
            ['user_id' => $user->id],
            [
                'current_time' => 0,
                'progress_percentage' => 0,
                'last_watched_at' => now(),
            ]
        );
    }

    /**
     * Get watch progress for a specific user.
     *
     * @param User $user
     * @return WatchProgress|null
     */
    public function getProgressForUser(User $user): ?WatchProgress
    {
        return $this->watchProgresses()
            ->where('user_id', $user->id)
            ->first();
    }
}

