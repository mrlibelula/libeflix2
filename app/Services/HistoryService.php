<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Play;
use App\Models\User;
use App\Models\WatchProgress;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection as EloquentCollection;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use InvalidArgumentException;

class HistoryService
{
    /**
     * Progress threshold at or above which an item is considered finished
     * (excluded from Continue Watching).
     */
    public const CONTINUE_WATCHING_MAX_PERCENTAGE = 90.0;

    /** Default page size for history carousels (lazy-loaded). */
    public const PAGE_SIZE = 12;

    public const MIN_REWATCH_PLAYS = 2;

    public const SECTIONS = ['continue', 'movies', 'episodes', 'rewatched'];

    /**
     * Initial History page payload: stats + first page of each section.
     *
     * @return array{
     *     continueWatching: array<string, mixed>,
     *     movies: array<string, mixed>,
     *     episodes: array<string, mixed>,
     *     mostRewatched: array<string, mixed>,
     *     stats: array{titles: int, movies: int, episodes: int, total_plays: int}
     * }
     */
    public static function getHistory(User $user, int $perPage = self::PAGE_SIZE): array
    {
        return [
            'continueWatching' => self::paginateSection($user, 'continue', 1, $perPage),
            'movies' => self::paginateSection($user, 'movies', 1, $perPage),
            'episodes' => self::paginateSection($user, 'episodes', 1, $perPage),
            'mostRewatched' => self::paginateSection($user, 'rewatched', 1, $perPage),
            'stats' => self::getStats($user),
        ];
    }

    /**
     * Paginate one history section (used by page load + lazy API).
     *
     * @return array{
     *     items: array<int, array<string, mixed>>,
     *     total: int,
     *     page: int,
     *     per_page: int,
     *     last_page: int
     * }
     */
    public static function paginateSection(
        User $user,
        string $section,
        int $page = 1,
        int $perPage = self::PAGE_SIZE
    ): array {
        if (!in_array($section, self::SECTIONS, true)) {
            throw new InvalidArgumentException("Invalid history section: {$section}");
        }

        $page = max(1, $page);
        $perPage = max(1, min(48, $perPage));

        if ($section === 'rewatched') {
            return self::paginateRewatched($user, $page, $perPage);
        }

        $query = match ($section) {
            'continue' => self::continueWatchingQuery($user),
            'movies' => self::progressByTypeQuery($user, Movie::class),
            'episodes' => self::progressByTypeQuery($user, Episode::class),
            default => throw new InvalidArgumentException("Invalid history section: {$section}"),
        };

        $total = (clone $query)->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);

        /** @var EloquentCollection<int, WatchProgress> $rows */
        $rows = (clone $query)
            ->with('watchable')
            ->orderByDesc('last_watched_at')
            ->forPage($page, $perPage)
            ->get();

        self::eagerLoadEpisodeRelations($rows);
        $playCountMap = self::playCountsForProgressRows($user->id, $rows);
        $items = self::mapProgressRows($rows, $playCountMap);

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => $lastPage,
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

    protected static function continueWatchingQuery(User $user): Builder
    {
        return WatchProgress::query()
            ->where('user_id', $user->id)
            ->whereIn('watchable_type', [Movie::class, Episode::class])
            ->where('completed', false)
            ->where('progress_percentage', '<', self::CONTINUE_WATCHING_MAX_PERCENTAGE)
            ->where(function ($query) {
                $query->where('current_time', '>', 0)
                    ->orWhere('progress_percentage', '>', 0);
            });
    }

    protected static function progressByTypeQuery(User $user, string $type): Builder
    {
        return WatchProgress::query()
            ->where('user_id', $user->id)
            ->where('watchable_type', $type);
    }

    /**
     * @return array{
     *     items: array<int, array<string, mixed>>,
     *     total: int,
     *     page: int,
     *     per_page: int,
     *     last_page: int
     * }
     */
    protected static function paginateRewatched(User $user, int $page, int $perPage): array
    {
        $grouped = Play::query()
            ->where('user_id', $user->id)
            ->whereIn('playable_type', [Movie::class, Episode::class])
            ->selectRaw('playable_type, playable_id, COUNT(*) as plays_count')
            ->groupBy('playable_type', 'playable_id')
            ->havingRaw('COUNT(*) >= ?', [self::MIN_REWATCH_PLAYS]);

        $total = DB::query()
            ->fromSub($grouped, 'rewatched_groups')
            ->count();

        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min(max(1, $page), $lastPage);

        $meta = Play::query()
            ->where('user_id', $user->id)
            ->whereIn('playable_type', [Movie::class, Episode::class])
            ->selectRaw('playable_type, playable_id, COUNT(*) as plays_count')
            ->groupBy('playable_type', 'playable_id')
            ->havingRaw('COUNT(*) >= ?', [self::MIN_REWATCH_PLAYS])
            ->orderByDesc('plays_count')
            ->forPage($page, $perPage)
            ->get()
            ->map(fn ($row) => [
                'type' => $row->playable_type === Movie::class ? 'movie' : 'episode',
                'id' => (int) $row->playable_id,
                'plays_count' => (int) $row->plays_count,
                'playable_type' => $row->playable_type,
            ]);

        $progressMap = self::loadProgressForPlayables($user, $meta);
        self::eagerLoadEpisodeRelations($progressMap->values());

        $items = [];
        foreach ($meta as $entry) {
            $key = $entry['type'] . ':' . $entry['id'];
            $progress = $progressMap->get($key);

            if (!$progress instanceof WatchProgress || !$progress->watchable instanceof Model) {
                continue;
            }

            $type = self::resolveHistoryType($progress->watchable);
            if ($type === null) {
                continue;
            }

            $items[] = self::serializeHistoryItem(
                $progress->watchable,
                $progress,
                $type,
                $entry['plays_count']
            );
        }

        return [
            'items' => $items,
            'total' => $total,
            'page' => $page,
            'per_page' => $perPage,
            'last_page' => $lastPage,
        ];
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
     * @param  EloquentCollection<int, WatchProgress>  $rows
     * @return array<string, int>
     */
    protected static function playCountsForProgressRows(int $userId, EloquentCollection $rows): array
    {
        $movieIds = [];
        $episodeIds = [];

        foreach ($rows as $progress) {
            if ($progress->watchable_type === Movie::class) {
                $movieIds[] = $progress->watchable_id;
            } else {
                $episodeIds[] = $progress->watchable_id;
            }
        }

        $movieIds = array_values(array_unique($movieIds));
        $episodeIds = array_values(array_unique($episodeIds));

        if ($movieIds === [] && $episodeIds === []) {
            return [];
        }

        $map = [];
        $extra = Play::query()
            ->where('user_id', $userId)
            ->where(function ($q) use ($movieIds, $episodeIds) {
                if ($movieIds !== []) {
                    $q->orWhere(function ($inner) use ($movieIds) {
                        $inner->where('playable_type', Movie::class)
                            ->whereIn('playable_id', $movieIds);
                    });
                }
                if ($episodeIds !== []) {
                    $q->orWhere(function ($inner) use ($episodeIds) {
                        $inner->where('playable_type', Episode::class)
                            ->whereIn('playable_id', $episodeIds);
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

        $loaded = Episode::query()
            ->with(['tvshow', 'season'])
            ->whereIn('id', $episodeIds)
            ->get()
            ->keyBy('id');

        foreach ($rows as $progress) {
            if ($progress->watchable instanceof Episode && $loaded->has($progress->watchable->id)) {
                $progress->setRelation('watchable', $loaded->get($progress->watchable->id));
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
