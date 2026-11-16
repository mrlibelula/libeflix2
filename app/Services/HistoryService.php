<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Play;
use App\Models\User;
use App\Models\WatchProgress;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;

class HistoryService
{
    /**
     * Progress threshold at or above which an item is considered finished
     * (excluded from Continue Watching).
     */
    public const CONTINUE_WATCHING_MAX_PERCENTAGE = 90.0;

    /** Max items shipped to the History page per section (keeps Inertia payload light). */
    public const CONTINUE_WATCHING_LIMIT = 24;

    public const MOVIES_LIMIT = 48;

    public const EPISODES_LIMIT = 48;

    public const MOST_REWATCHED_LIMIT = 24;

    public const MIN_REWATCH_PLAYS = 2;

    /**
     * Get the user's watch history grouped for the History page.
     *
     * Stats reflect full library totals; list sections are capped/recent-only
     * so large histories stay fast to load and browse.
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
        $stats = self::getStats($user);

        $continueRows = self::queryContinueWatching($user);
        $movieRows = self::queryRecentByType($user, Movie::class, self::MOVIES_LIMIT);
        $episodeRows = self::queryRecentByType($user, Episode::class, self::EPISODES_LIMIT);
        $rewatchedMeta = self::queryMostRewatchedMeta($user);

        $progressForPlays = self::loadProgressForPlayables($user, $rewatchedMeta);

        $playCountMap = self::buildPlayCountMap(
            $user->id,
            $continueRows,
            $movieRows,
            $episodeRows,
            $rewatchedMeta
        );

        // Prefetch episode relations in bulk (avoid loadMissing N+1).
        self::eagerLoadEpisodeRelations(
            $continueRows->concat($movieRows)->concat($episodeRows)->concat($progressForPlays->values())
        );

        $continueWatching = self::mapProgressRows($continueRows, $playCountMap);
        $movies = self::mapProgressRows($movieRows, $playCountMap);
        $episodes = self::mapProgressRows($episodeRows, $playCountMap);

        $mostRewatched = [];
        foreach ($rewatchedMeta as $meta) {
            $key = $meta['type'] . ':' . $meta['id'];
            $progress = $progressForPlays->get($key);

            if (!$progress instanceof WatchProgress || !$progress->watchable instanceof Model) {
                continue;
            }

            $type = self::resolveHistoryType($progress->watchable);
            if ($type === null) {
                continue;
            }

            $mostRewatched[] = self::serializeHistoryItem(
                $progress->watchable,
                $progress,
                $type,
                $meta['plays_count']
            );
        }

        return [
            'continueWatching' => $continueWatching,
            'movies' => $movies,
            'episodes' => $episodes,
            'mostRewatched' => $mostRewatched,
            'stats' => $stats,
        ];
    }

    /**
     * @return array{titles: int, movies: int, episodes: int, total_plays: int}
     */
    public static function getStats(User $user): array
    {
        $row = WatchProgress::query()
            ->where('user_id', $user->id)
            ->whereIn('watchable_type', [Movie::class, Episode::class])
            ->selectRaw(
                'COUNT(*) as titles,
                 SUM(CASE WHEN watchable_type = ? THEN 1 ELSE 0 END) as movies,
                 SUM(CASE WHEN watchable_type = ? THEN 1 ELSE 0 END) as episodes',
                [Movie::class, Episode::class]
            )
            ->first();

        $totalPlays = Play::query()
            ->where('user_id', $user->id)
            ->whereIn('playable_type', [Movie::class, Episode::class])
            ->count();

        return [
            'titles' => (int) ($row->titles ?? 0),
            'movies' => (int) ($row->movies ?? 0),
            'episodes' => (int) ($row->episodes ?? 0),
            'total_plays' => $totalPlays,
        ];
    }

    /**
     * @return EloquentCollection<int, WatchProgress>
     */
    protected static function queryContinueWatching(User $user): EloquentCollection
    {
        return WatchProgress::query()
            ->where('user_id', $user->id)
            ->whereIn('watchable_type', [Movie::class, Episode::class])
            ->where('completed', false)
            ->where('progress_percentage', '<', self::CONTINUE_WATCHING_MAX_PERCENTAGE)
            ->where(function ($query) {
                $query->where('current_time', '>', 0)
                    ->orWhere('progress_percentage', '>', 0);
            })
            ->with('watchable')
            ->orderByDesc('last_watched_at')
            ->limit(self::CONTINUE_WATCHING_LIMIT)
            ->get();
    }

    /**
     * @return EloquentCollection<int, WatchProgress>
     */
    protected static function queryRecentByType(User $user, string $type, int $limit): EloquentCollection
    {
        return WatchProgress::query()
            ->where('user_id', $user->id)
            ->where('watchable_type', $type)
            ->with('watchable')
            ->orderByDesc('last_watched_at')
            ->limit($limit)
            ->get();
    }

    /**
     * Top rewatched titles by play count (does not require loading all plays into PHP).
     *
     * @return Collection<int, array{type: string, id: int, plays_count: int, playable_type: string}>
     */
    protected static function queryMostRewatchedMeta(User $user): Collection
    {
        return Play::query()
            ->where('user_id', $user->id)
            ->whereIn('playable_type', [Movie::class, Episode::class])
            ->selectRaw('playable_type, playable_id, COUNT(*) as plays_count')
            ->groupBy('playable_type', 'playable_id')
            ->havingRaw('COUNT(*) >= ?', [self::MIN_REWATCH_PLAYS])
            ->orderByDesc('plays_count')
            ->limit(self::MOST_REWATCHED_LIMIT)
            ->get()
            ->map(fn ($row) => [
                'type' => $row->playable_type === Movie::class ? 'movie' : 'episode',
                'id' => (int) $row->playable_id,
                'plays_count' => (int) $row->plays_count,
                'playable_type' => $row->playable_type,
            ]);
    }

    /**
     * @param  Collection<int, array{type: string, id: int, plays_count: int, playable_type: string}>  $rewatchedMeta
     * @return Collection<string, WatchProgress>
     */
    protected static function loadProgressForPlayables(User $user, Collection $rewatchedMeta): Collection
    {
        if ($rewatchedMeta->isEmpty()) {
            return collect();
        }

        $movieIds = $rewatchedMeta->where('type', 'movie')->pluck('id')->all();
        $episodeIds = $rewatchedMeta->where('type', 'episode')->pluck('id')->all();

        $query = WatchProgress::query()
            ->where('user_id', $user->id)
            ->with('watchable')
            ->where(function ($q) use ($movieIds, $episodeIds) {
                if (!empty($movieIds)) {
                    $q->orWhere(function ($inner) use ($movieIds) {
                        $inner->where('watchable_type', Movie::class)
                            ->whereIn('watchable_id', $movieIds);
                    });
                }
                if (!empty($episodeIds)) {
                    $q->orWhere(function ($inner) use ($episodeIds) {
                        $inner->where('watchable_type', Episode::class)
                            ->whereIn('watchable_id', $episodeIds);
                    });
                }
            });

        return $query->get()->keyBy(function (WatchProgress $progress) {
            $type = $progress->watchable_type === Movie::class ? 'movie' : 'episode';

            return $type . ':' . $progress->watchable_id;
        });
    }

    /**
     * @param  Collection<int, array{type: string, id: int, plays_count: int, playable_type: string}>  $rewatchedMeta
     * @return array<string, int>
     */
    protected static function buildPlayCountMap(
        int $userId,
        EloquentCollection $continueRows,
        EloquentCollection $movieRows,
        EloquentCollection $episodeRows,
        Collection $rewatchedMeta
    ): array {
        $map = [];

        foreach ($rewatchedMeta as $meta) {
            $map[$meta['type'] . ':' . $meta['id']] = $meta['plays_count'];
        }

        $missingMovieIds = [];
        $missingEpisodeIds = [];

        foreach ([$continueRows, $movieRows, $episodeRows] as $rows) {
            foreach ($rows as $progress) {
                $type = $progress->watchable_type === Movie::class ? 'movie' : 'episode';
                $key = $type . ':' . $progress->watchable_id;
                if (array_key_exists($key, $map)) {
                    continue;
                }
                if ($type === 'movie') {
                    $missingMovieIds[] = $progress->watchable_id;
                } else {
                    $missingEpisodeIds[] = $progress->watchable_id;
                }
            }
        }

        $missingMovieIds = array_values(array_unique($missingMovieIds));
        $missingEpisodeIds = array_values(array_unique($missingEpisodeIds));

        if ($missingMovieIds === [] && $missingEpisodeIds === []) {
            return $map;
        }

        $extra = Play::query()
            ->where('user_id', $userId)
            ->where(function ($q) use ($missingMovieIds, $missingEpisodeIds) {
                if ($missingMovieIds !== []) {
                    $q->orWhere(function ($inner) use ($missingMovieIds) {
                        $inner->where('playable_type', Movie::class)
                            ->whereIn('playable_id', $missingMovieIds);
                    });
                }
                if ($missingEpisodeIds !== []) {
                    $q->orWhere(function ($inner) use ($missingEpisodeIds) {
                        $inner->where('playable_type', Episode::class)
                            ->whereIn('playable_id', $missingEpisodeIds);
                    });
                }
            })
            ->selectRaw('playable_type, playable_id, COUNT(*) as plays_count')
            ->groupBy('playable_type', 'playable_id')
            ->get();

        foreach ($extra as $row) {
            $type = $row->playable_type === Movie::class ? 'movie' : 'episode';
            $map[$type . ':' . $row->playable_id] = (int) $row->plays_count;
        }

        return $map;
    }

    /**
     * @param  EloquentCollection<int, WatchProgress>|Collection<int, WatchProgress>  $rows
     */
    protected static function eagerLoadEpisodeRelations($rows): void
    {
        $episodeIds = collect($rows)
            ->map(fn (WatchProgress $progress) => $progress->watchable)
            ->filter(fn ($watchable) => $watchable instanceof Episode)
            ->map(fn (Episode $episode) => $episode->id)
            ->unique()
            ->values()
            ->all();

        if ($episodeIds === []) {
            return;
        }

        // Load relations onto already-resolved Episode model instances
        $loaded = Episode::query()
            ->with(['tvshow', 'season'])
            ->whereIn('id', $episodeIds)
            ->get()
            ->keyBy('id');

        foreach ($rows as $progress) {
            if ($progress->watchable instanceof Episode && $loaded->has($progress->watchable->id)) {
                $fresh = $loaded->get($progress->watchable->id);
                $progress->setRelation('watchable', $fresh);
            }
        }
    }

    /**
     * @param  EloquentCollection<int, WatchProgress>  $rows
     * @param  array<string, int>  $playCountMap
     * @return array<int, array<string, mixed>>
     */
    protected static function mapProgressRows(EloquentCollection $rows, array $playCountMap): array
    {
        $items = [];

        foreach ($rows as $progress) {
            $watchable = $progress->watchable;

            if (!$watchable instanceof Model) {
                continue;
            }

            $type = self::resolveHistoryType($watchable);
            if ($type === null) {
                continue;
            }

            $playsCount = (int) ($playCountMap[$type . ':' . $watchable->id] ?? 0);
            $items[] = self::serializeHistoryItem($watchable, $progress, $type, $playsCount);
        }

        return $items;
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
     * Slim card payload — avoids dumping credits/subtitles/large JSON onto the page.
     *
     * @return array<string, mixed>
     */
    protected static function serializeHistoryItem(
        Model $watchable,
        WatchProgress $progress,
        string $type,
        int $playsCount
    ): array {
        $payload = [
            'id' => $watchable->id,
            'history_type' => $type,
            'is_local' => true,
            'progress_percentage' => (float) $progress->progress_percentage,
            'current_time' => (int) $progress->current_time,
            'duration' => $progress->duration !== null ? (int) $progress->duration : null,
            'completed' => (bool) $progress->completed,
            'last_watched_at' => $progress->last_watched_at?->toIso8601String(),
            'plays_count' => $playsCount,
        ];

        if ($watchable instanceof Movie) {
            $payload['slug'] = $watchable->slug;
            $payload['title'] = $watchable->title;
            $payload['poster_path'] = $watchable->poster_path;
            $payload['backdrop_path'] = $watchable->backdrop_path;
            $payload['release_date'] = $watchable->release_date;
            $payload['vote_average'] = $watchable->vote_average;
            $payload['google_drive_file_id'] = $watchable->google_drive_file_id;
            $payload['is_free'] = (bool) ($watchable->is_free ?? false);
        }

        if ($watchable instanceof Episode) {
            $payload['name'] = $watchable->name;
            $payload['still_path'] = $watchable->still_path;
            $payload['runtime'] = $watchable->runtime;
            $payload['episode_number'] = $watchable->episode_number;
            $payload['season_number'] = $watchable->season_number
                ?? $watchable->season?->season_number;

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
