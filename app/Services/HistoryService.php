<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Play;
use App\Models\User;
use App\Models\WatchProgress;
use Illuminate\Database\Eloquent\Model;

class HistoryService
{
    /**
     * Progress threshold at or above which an item is considered finished
     * (excluded from Continue Watching).
     */
    public const CONTINUE_WATCHING_MAX_PERCENTAGE = 90.0;

    /**
     * Get the user's watch history grouped for the History page.
     *
     * @return array{
     *     continueWatching: array<int, array<string, mixed>>,
     *     movies: array<int, array<string, mixed>>,
     *     episodes: array<int, array<string, mixed>>,
     *     mostRewatched: array<int, array<string, mixed>>,
     *     stats: array{titles: int, movies: int, episodes: int, total_plays: int}
     * }
     */
    public static function getHistory(User $user): array
    {
        $progressRows = $user->watchProgresses()
            ->with('watchable')
            ->orderByDesc('last_watched_at')
            ->get();

        $playCounts = self::getPlayCountsForUser($user);

        $movies = [];
        $episodes = [];
        $continueWatching = [];
        $allItems = [];

        foreach ($progressRows as $progress) {
            $watchable = $progress->watchable;

            if (!$watchable instanceof Model) {
                continue;
            }

            $type = self::resolveHistoryType($watchable);

            if ($type === null) {
                continue;
            }

            if ($watchable instanceof Episode) {
                $watchable->loadMissing(['tvshow', 'season']);
            }

            $playsKey = $type . ':' . $watchable->id;
            $playsCount = (int) ($playCounts[$playsKey] ?? 0);

            $item = self::serializeHistoryItem($watchable, $progress, $type, $playsCount, $user);

            $allItems[] = $item;

            if ($type === 'movie') {
                $movies[] = $item;
            } else {
                $episodes[] = $item;
            }

            if (self::isContinueWatching($progress)) {
                $continueWatching[] = $item;
            }
        }

        $mostRewatched = collect($allItems)
            ->filter(fn (array $item) => ($item['plays_count'] ?? 0) >= 2)
            ->sortByDesc('plays_count')
            ->values()
            ->all();

        $totalPlays = (int) array_sum($playCounts);

        return [
            'continueWatching' => $continueWatching,
            'movies' => $movies,
            'episodes' => $episodes,
            'mostRewatched' => $mostRewatched,
            'stats' => [
                'titles' => count($allItems),
                'movies' => count($movies),
                'episodes' => count($episodes),
                'total_plays' => $totalPlays,
            ],
        ];
    }

    /**
     * Bulk play counts for the user, keyed as "{movie|episode}:{id}".
     *
     * @return array<string, int>
     */
    public static function getPlayCountsForUser(User $user): array
    {
        $rows = Play::query()
            ->where('user_id', $user->id)
            ->whereIn('playable_type', [Movie::class, Episode::class])
            ->selectRaw('playable_type, playable_id, COUNT(*) as plays_count')
            ->groupBy('playable_type', 'playable_id')
            ->get();

        $counts = [];

        foreach ($rows as $row) {
            $type = $row->playable_type === Movie::class ? 'movie' : 'episode';
            $counts[$type . ':' . $row->playable_id] = (int) $row->plays_count;
        }

        return $counts;
    }

    public static function isContinueWatching(WatchProgress $progress): bool
    {
        if ($progress->completed) {
            return false;
        }

        $percentage = (float) $progress->progress_percentage;

        if ($percentage >= self::CONTINUE_WATCHING_MAX_PERCENTAGE) {
            return false;
        }

        return $progress->current_time > 0 || $percentage > 0;
    }

    /**
     * @return 'movie'|'episode'|null
     */
    protected static function resolveHistoryType(Model $watchable): ?string
    {
        if ($watchable instanceof Movie) {
            return 'movie';
        }

        if ($watchable instanceof Episode) {
            return 'episode';
        }

        return null;
    }

    /**
     * @return array<string, mixed>
     */
    protected static function serializeHistoryItem(
        Model $watchable,
        WatchProgress $progress,
        string $type,
        int $playsCount,
        User $user
    ): array {
        $payload = $watchable->toArray();

        $payload['history_type'] = $type;
        $payload['is_local'] = true;
        $payload['progress_percentage'] = (float) $progress->progress_percentage;
        $payload['current_time'] = (int) $progress->current_time;
        $payload['duration'] = $progress->duration !== null ? (int) $progress->duration : null;
        $payload['completed'] = (bool) $progress->completed;
        $payload['last_watched_at'] = $progress->last_watched_at?->toIso8601String();
        $payload['plays_count'] = $playsCount;
        $payload['is_watch_later'] = method_exists($watchable, 'isWatchLater')
            ? (bool) $watchable->isWatchLater($user)
            : false;
        $payload['is_liked'] = method_exists($watchable, 'isLikedBy')
            ? (bool) $watchable->isLikedBy($user)
            : false;
        $payload['likes_count'] = method_exists($watchable, 'likesCount')
            ? (int) $watchable->likesCount()
            : 0;

        if ($watchable instanceof Movie) {
            $subtitles = $watchable->subtitles ?? [];
            if (is_string($subtitles)) {
                $subtitles = json_decode($subtitles, true) ?: [];
            }
            if (!is_array($subtitles)) {
                $subtitles = [];
            }
            if (isset($subtitles['path'])) {
                unset($subtitles['path']);
            }
            if (isset($subtitles['encPath'])) {
                unset($subtitles['encPath']);
            }
            $payload['subtitles'] = $subtitles;

            $trailers = $watchable->trailers ?? [];
            if (is_string($trailers)) {
                $trailers = json_decode($trailers, true) ?: [];
            }
            $payload['trailer_count'] = is_array($trailers) ? count($trailers) : 0;
        }

        if ($watchable instanceof Episode) {
            if (!isset($payload['season_number']) && $watchable->season) {
                $payload['season_number'] = $watchable->season->season_number;
            }

            if ($watchable->tvshow) {
                $payload['tvshow'] = [
                    'id' => $watchable->tvshow->id,
                    'name' => $watchable->tvshow->name,
                    'slug' => $watchable->tvshow->slug,
                ];
            }
        }

        return $payload;
    }
}
