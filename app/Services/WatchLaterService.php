<?php

namespace App\Services;

use App\Models\User;
use App\Models\Watchlist;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\DB;

class WatchLaterService
{
    /**
     * Add an item to the user's watch later list.
     *
     * @param Model $item
     * @param User $user
     * @return bool
     */
    public static function addWatchLater(Model $item, User $user): bool
    {
        return $item->addWatchLater($user);
    }

    /**
     * Remove an item from the user's watch later list.
     *
     * @param Model $item
     * @param User $user
     * @return bool
     */
    public static function removeWatchLater(Model $item, User $user): bool
    {
        return $item->removeWatchLater($user) > 0;
    }

    /**
     * Check if an item is in the user's watch later list.
     *
     * @param Model $item
     * @param User|null $user
     * @return bool
     */
    public static function isWatchLater(Model $item, ?User $user): bool
    {
        if (!$user) {
            return false;
        }
        
        return $item->isWatchLater($user);
    }

    /**
     * Toggle watch later status for an item.
     *
     * @param Model $item
     * @param User $user
     * @return bool Returns the new status (true if added, false if removed)
     */
    public static function toggleWatchLater(Model $item, User $user): bool
    {
        $isWatchLater = self::isWatchLater($item, $user);
        
        if ($isWatchLater) {
            self::removeWatchLater($item, $user);
            return false;
        } else {
            self::addWatchLater($item, $user);
            return true;
        }
    }

    /**
     * Get all watch later items for a user, grouped by type.
     *
     * @param User $user
     * @return array
     */
    public static function getWatchLaterItems(User $user): array
    {
        // Get watchlist items ordered by creation date (most recent first)
        $watchlistItems = $user->watchlists()
            ->with('watchable')
            ->orderBy('created_at', 'desc')
            ->get();
        
        $grouped = [
            'movies' => [],
            'tvshows' => [],
            'seasons' => [],
            'episodes' => [],
        ];

        foreach ($watchlistItems as $item) {
            $watchable = $item->watchable;
            
            if (!$watchable) {
                continue; // Skip if the watchable item no longer exists
            }
            
            switch (get_class($watchable)) {
                case 'App\Models\Movie':
                    $grouped['movies'][] = $watchable;
                    break;
                case 'App\Models\Tvshow':
                    $grouped['tvshows'][] = $watchable;
                    break;
                case 'App\Models\Season':
                    $grouped['seasons'][] = $watchable;
                    break;
                case 'App\Models\Episode':
                    $grouped['episodes'][] = $watchable;
                    break;
            }
        }

        // Load necessary relationships for seasons and episodes
        if (!empty($grouped['seasons'])) {
            foreach ($grouped['seasons'] as $season) {
                $season->load('tvshow');
            }
        }
        
        if (!empty($grouped['episodes'])) {
            foreach ($grouped['episodes'] as $episode) {
                $episode->load(['tvshow', 'season']);
            }
        }

        return $grouped;
    }

    /**
     * Get user's watch later movie IDs (for backward compatibility).
     *
     * @param User $user
     * @return array
     */
    public static function getUserWatchLaterMovieIds(User $user): array
    {
        return DB::table('watchlists')
            ->where('user_id', $user->id)
            ->where('watchable_type', 'App\\Models\\Movie')
            ->pluck('watchable_id')
            ->toArray();
    }

    /**
     * Get user's watch later IDs for a specific model type.
     *
     * @param User $user
     * @param string $modelClass
     * @return array
     */
    public static function getUserWatchLaterIds(User $user, string $modelClass): array
    {
        return DB::table('watchlists')
            ->where('user_id', $user->id)
            ->where('watchable_type', $modelClass)
            ->pluck('watchable_id')
            ->toArray();
    }

    /**
     * Bulk check if items are in user's watch later list.
     *
     * @param array $items
     * @param User|null $user
     * @param string $modelClass
     * @return array
     */
    public static function bulkCheckWatchLater(array $items, ?User $user, string $modelClass): array
    {
        if (!$user) {
            return array_fill_keys(array_column($items, 'id'), false);
        }

        $watchLaterIds = self::getUserWatchLaterIds($user, $modelClass);
        
        $result = [];
        foreach ($items as $item) {
            $result[$item['id']] = in_array($item['id'], $watchLaterIds);
        }
        
        return $result;
    }
} 