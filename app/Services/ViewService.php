<?php

namespace App\Services;

use App\Models\Play;
use App\Models\User;
use App\Models\View;
use App\Models\WatchProgress;
use Illuminate\Database\Eloquent\Model;

class ViewService
{
    /**
     * Minimum watch percentage required to count as a view (70%)
     */
    const MIN_VIEW_PERCENTAGE = 70.0;

    /**
     * Minimum watch time in seconds to count as a view (10 minutes)
     */
    const MIN_VIEW_TIME_SECONDS = 600;

    /**
     * Time threshold in seconds - content shorter than this uses time-based logic
     * Content longer uses percentage-based logic (15 minutes)
     */
    const SHORT_CONTENT_THRESHOLD = 900;

    /**
     * Minimum watch percentage required to count as a play (80%)
     */
    const MIN_PLAY_PERCENTAGE = 80.0;

    /**
     * Update watch progress for a user.
     *
     * @param Model $watchable
     * @param User $user
     * @param int $currentTime Current playback time in seconds
     * @param int|null $duration Total duration in seconds
     * @return array
     */
    public static function updateProgress(Model $watchable, User $user, int $currentTime, ?int $duration = null): array
    {
        // Get or create watch progress
        $progress = WatchProgress::updateOrCreate(
            [
                'user_id' => $user->id,
                'watchable_id' => $watchable->id,
                'watchable_type' => get_class($watchable),
            ],
            [
                'current_time' => $currentTime,
                'duration' => $duration ?? $watchable->runtime ?? null,
                'last_watched_at' => now(),
            ]
        );

        // Calculate progress percentage
        if ($progress->duration > 0) {
            $progress->progress_percentage = min(100, ($currentTime / $progress->duration) * 100);
            $progress->save();
        }

        // Check if this should count as a view
        $shouldCountAsView = self::shouldCountAsView($progress);

        if ($shouldCountAsView && !$progress->completed) {
            // Record the view
            self::recordView($watchable, $user);
            
            // Mark progress as completed
            $progress->completed = true;
            $progress->save();
        }

        return [
            'progress' => $progress,
            'view_recorded' => $shouldCountAsView && !$progress->wasRecentlyCreated,
        ];
    }

    /**
     * Determine if the watch progress should count as a view.
     *
     * Algorithm:
     * - For short content (< 15 minutes): User must watch at least 10 minutes OR 70% (whichever is reached first)
     * - For long content (>= 15 minutes): User must watch at least 70% of the content
     * 
     * @param WatchProgress $progress
     * @return bool
     */
    public static function shouldCountAsView(WatchProgress $progress): bool
    {
        // If already marked as completed, it already counted as a view
        if ($progress->completed) {
            return false;
        }

        // Need valid duration
        if (!$progress->duration || $progress->duration <= 0) {
            return false;
        }

        // For short content (less than 15 minutes)
        if ($progress->duration < self::SHORT_CONTENT_THRESHOLD) {
            // Count as view if watched at least 10 minutes OR 70% (whichever comes first)
            return $progress->current_time >= self::MIN_VIEW_TIME_SECONDS 
                || $progress->progress_percentage >= self::MIN_VIEW_PERCENTAGE;
        }

        // For longer content, require 70% completion
        return $progress->progress_percentage >= self::MIN_VIEW_PERCENTAGE;
    }

    /**
     * Record a view for a model.
     *
     * @param Model $viewable
     * @param User $user
     * @return View|null
     */
    public static function recordView(Model $viewable, User $user): ?View
    {
        // Only create if it doesn't exist (one view per user per item)
        return View::firstOrCreate(
            [
                'user_id' => $user->id,
                'viewable_id' => $viewable->id,
                'viewable_type' => get_class($viewable),
            ],
            [
                'viewed_at' => now(),
            ]
        );
    }

    /**
     * Get watch progress for a user and model.
     *
     * @param Model $watchable
     * @param User $user
     * @return WatchProgress|null
     */
    public static function getProgress(Model $watchable, User $user): ?WatchProgress
    {
        return WatchProgress::where('user_id', $user->id)
            ->where('watchable_id', $watchable->id)
            ->where('watchable_type', get_class($watchable))
            ->first();
    }

    /**
     * Check if a user has viewed a model.
     *
     * @param Model $viewable
     * @param User $user
     * @return bool
     */
    public static function hasViewed(Model $viewable, User $user): bool
    {
        return View::where('user_id', $user->id)
            ->where('viewable_id', $viewable->id)
            ->where('viewable_type', get_class($viewable))
            ->exists();
    }

    /**
     * Get views count for a model.
     *
     * @param Model $viewable
     * @return int
     */
    public static function getViewsCount(Model $viewable): int
    {
        return View::where('viewable_id', $viewable->id)
            ->where('viewable_type', get_class($viewable))
            ->count();
    }

    /**
     * Reset watch progress for a user and model.
     *
     * @param Model $watchable
     * @param User $user
     * @return bool
     */
    public static function resetProgress(Model $watchable, User $user): bool
    {
        return WatchProgress::where('user_id', $user->id)
            ->where('watchable_id', $watchable->id)
            ->where('watchable_type', get_class($watchable))
            ->delete() > 0;
    }

    /**
     * Get popular content based on views.
     *
     * @param string $modelType
     * @param int $limit
     * @param int|null $days Number of days to consider (null for all time)
     * @return \Illuminate\Support\Collection
     */
    public static function getPopularByViews(string $modelType, int $limit = 10, ?int $days = null)
    {
        $query = View::where('viewable_type', $modelType)
            ->selectRaw('viewable_id, COUNT(*) as views_count')
            ->groupBy('viewable_id')
            ->orderByDesc('views_count')
            ->limit($limit);

        if ($days !== null) {
            $query->where('viewed_at', '>=', now()->subDays($days));
        }

        return $query->get();
    }

    /**
     * Record a play for a model when video ends.
     * 
     * Unlike views (one per user), plays can be recorded multiple times
     * by the same user to track total engagement and replays.
     *
     * @param Model $playable
     * @param User|null $user
     * @param int $watchDuration How long user watched (in seconds)
     * @param int $mediaDuration Total media duration (in seconds)
     * @return Play|null
     */
    public static function recordPlay(Model $playable, ?User $user, int $watchDuration, int $mediaDuration): ?Play
    {
        // Calculate completion percentage
        $completionPercentage = $mediaDuration > 0 
            ? min(100, ($watchDuration / $mediaDuration) * 100) 
            : 0;

        // Only record if at least 80% was watched
        if ($completionPercentage < self::MIN_PLAY_PERCENTAGE) {
            return null;
        }

        // Create new play record (allows duplicates)
        return Play::create([
            'user_id' => $user?->id,
            'playable_id' => $playable->id,
            'playable_type' => get_class($playable),
            'watch_duration' => $watchDuration,
            'media_duration' => $mediaDuration,
            'completion_percentage' => $completionPercentage,
        ]);
    }

    /**
     * Get total plays count for a model.
     *
     * @param Model $playable
     * @return int
     */
    public static function getPlaysCount(Model $playable): int
    {
        return Play::where('playable_id', $playable->id)
            ->where('playable_type', get_class($playable))
            ->count();
    }

    /**
     * Get popular content based on total plays.
     *
     * @param string $modelType
     * @param int $limit
     * @param int|null $days Number of days to consider (null for all time)
     * @return \Illuminate\Support\Collection
     */
    public static function getPopularByPlays(string $modelType, int $limit = 10, ?int $days = null)
    {
        $query = Play::where('playable_type', $modelType)
            ->selectRaw('playable_id, COUNT(*) as plays_count')
            ->groupBy('playable_id')
            ->orderByDesc('plays_count')
            ->limit($limit);

        if ($days !== null) {
            $query->where('created_at', '>=', now()->subDays($days));
        }

        return $query->get();
    }
}

