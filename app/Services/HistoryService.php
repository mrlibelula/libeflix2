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

    /** @var array<string, list<string>> */
    public const SORT_FIELDS = [
        'continue' => ['watched', 'name', 'progress'],
        'movies' => ['watched', 'name', 'year', 'rating'],
        'episodes' => ['watched', 'name', 'season', 'episode'],
        'rewatched' => ['plays', 'watched', 'name'],
    ];

    /** @var array<string, string> */
    public const DEFAULT_SORT = [
        'continue' => 'watched',
        'movies' => 'watched',
        'episodes' => 'watched',
        'rewatched' => 'plays',
    ];

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
     *     last_page: int,
     *     sort: string,
     *     direction: string
     * }
     */
    public static function paginateSection(
        User $user,
        string $section,
        int $page = 1,
        int $perPage = self::PAGE_SIZE,
        ?string $sort = null,
        ?string $direction = null
    ): array {
        if (! in_array($section, self::SECTIONS, true)) {
            throw new InvalidArgumentException("Invalid history section: {$section}");
        }

        [$sort, $direction] = self::normalizeSort($section, $sort, $direction);

        $page = max(1, $page);
        $perPage = max(1, min(48, $perPage));

        if ($section === 'rewatched') {
            return self::paginateRewatched($user, $page, $perPage, $sort, $direction);
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

        $ordered = clone $query;
        self::applyProgressSort($ordered, $section, $sort, $direction);

        /** @var EloquentCollection<int, WatchProgress> $rows */
        $rows = $ordered
            ->with('watchable')
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
            'sort' => $sort,
            'direction' => $direction,
        ];
    }

    /**
     * @return array{0: string, 1: string}
     */
    public static function normalizeSort(string $section, ?string $sort, ?string $direction): array
    {
        $allowed = self::SORT_FIELDS[$section] ?? ['watched'];
        $default = self::DEFAULT_SORT[$section] ?? $allowed[0];
        $sort = in_array($sort, $allowed, true) ? $sort : $default;

        if ($direction === null) {
            $direction = in_array($sort, ['name', 'season', 'episode'], true) ? 'asc' : 'desc';
        } else {
            $direction = strtolower($direction) === 'asc' ? 'asc' : 'desc';
        }

        return [$sort, $direction];
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
            ->where('watch_progress.user_id', $user->id)
            ->whereIn('watch_progress.watchable_type', [Movie::class, Episode::class])
            ->where('watch_progress.completed', false)
            ->where('watch_progress.progress_percentage', '<', self::CONTINUE_WATCHING_MAX_PERCENTAGE)
            ->where(function ($query) {
                $query->where('watch_progress.current_time', '>', 0)
                    ->orWhere('watch_progress.progress_percentage', '>', 0);
            });
    }

    protected static function progressByTypeQuery(User $user, string $type): Builder
    {
        return WatchProgress::query()
            ->where('watch_progress.user_id', $user->id)
            ->where('watch_progress.watchable_type', $type);
    }

    /**
     * Apply ORDER BY (and joins when needed) for progress-backed sections.
     */
    protected static function applyProgressSort(Builder $query, string $section, string $sort, string $direction): void
    {
        $dir = $direction === 'asc' ? 'asc' : 'desc';

        if ($sort === 'watched') {
            $query->orderBy('watch_progress.last_watched_at', $dir)
                ->orderBy('watch_progress.id', $dir);

            return;
        }

        if ($sort === 'progress') {
            $query->orderBy('watch_progress.progress_percentage', $dir)
                ->orderByDesc('watch_progress.last_watched_at');

            return;
        }

        if ($section === 'movies') {
            $query->leftJoin('movies', function ($join) {
                $join->on('watch_progress.watchable_id', '=', 'movies.id')
                    ->where('watch_progress.watchable_type', '=', Movie::class);
            })->select('watch_progress.*');

            match ($sort) {
                'name' => $query->orderBy('movies.title', $dir),
                'year' => $query->orderBy('movies.release_date', $dir),
                'rating' => $query->orderBy('movies.vote_average', $dir),
                default => $query->orderBy('watch_progress.last_watched_at', 'desc'),
            };

            $query->orderByDesc('watch_progress.last_watched_at');

            return;
        }

        if ($section === 'episodes') {
            $query->leftJoin('episodes', function ($join) {
                $join->on('watch_progress.watchable_id', '=', 'episodes.id')
                    ->where('watch_progress.watchable_type', '=', Episode::class);
            })->select('watch_progress.*');

            match ($sort) {
                'name' => $query->orderBy('episodes.name', $dir),
                'season' => $query->orderBy('episodes.season_number', $dir)
                    ->orderBy('episodes.episode_number', $dir),
                'episode' => $query->orderBy('episodes.episode_number', $dir)
                    ->orderBy('episodes.season_number', $dir),
                default => $query->orderBy('watch_progress.last_watched_at', 'desc'),
            };

            $query->orderByDesc('watch_progress.last_watched_at');

            return;
        }

        // Continue Watching — mixed movie + episode titles
        $query->leftJoin('movies', function ($join) {
            $join->on('watch_progress.watchable_id', '=', 'movies.id')
                ->where('watch_progress.watchable_type', '=', Movie::class);
        })->leftJoin('episodes', function ($join) {
            $join->on('watch_progress.watchable_id', '=', 'episodes.id')
                ->where('watch_progress.watchable_type', '=', Episode::class);
        })->select('watch_progress.*');

        if ($sort === 'name') {
            $query->orderByRaw('COALESCE(movies.title, episodes.name) '.$dir);
        } else {
            $query->orderBy('watch_progress.last_watched_at', 'desc');
        }

        $query->orderByDesc('watch_progress.last_watched_at');
    }

    /**
     * @return array{
     *     items: array<int, array<string, mixed>>,
     *     total: int,
     *     page: int,
     *     per_page: int,
     *     last_page: int,
     *     sort: string,
     *     direction: string
     * }
     */
    protected static function paginateRewatched(
        User $user,
        int $page,
        int $perPage,
        string $sort = 'plays',
        string $direction = 'desc'
    ): array {
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

        $dir = $direction === 'asc' ? 'asc' : 'desc';

        $metaQuery = Play::query()
            ->where('plays.user_id', $user->id)
            ->whereIn('plays.playable_type', [Movie::class, Episode::class])
            ->selectRaw('plays.playable_type, plays.playable_id, COUNT(*) as plays_count')
            ->groupBy('plays.playable_type', 'plays.playable_id')
            ->havingRaw('COUNT(*) >= ?', [self::MIN_REWATCH_PLAYS]);

        if ($sort === 'name') {
            $metaQuery
                ->leftJoin('movies', function ($join) {
                    $join->on('plays.playable_id', '=', 'movies.id')
                        ->where('plays.playable_type', '=', Movie::class);
                })
                ->leftJoin('episodes', function ($join) {
                    $join->on('plays.playable_id', '=', 'episodes.id')
                        ->where('plays.playable_type', '=', Episode::class);
                })
                ->orderByRaw('COALESCE(MAX(movies.title), MAX(episodes.name)) '.$dir)
                ->orderByDesc('plays_count');
        } elseif ($sort === 'watched') {
            $metaQuery
                ->leftJoin('watch_progress', function ($join) use ($user) {
                    $join->on('plays.playable_id', '=', 'watch_progress.watchable_id')
                        ->on('plays.playable_type', '=', 'watch_progress.watchable_type')
                        ->where('watch_progress.user_id', '=', $user->id);
                })
                ->orderByRaw('MAX(watch_progress.last_watched_at) '.$dir)
                ->orderByDesc('plays_count');
        } else {
            $metaQuery->orderBy('plays_count', $dir);
        }

        $meta = $metaQuery
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
            $key = $entry['type'].':'.$entry['id'];
            $progress = $progressMap->get($key);

            if (! $progress instanceof WatchProgress || ! $progress->watchable instanceof Model) {
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
            'sort' => $sort,
            'direction' => $direction,
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
                if (! empty($movieIds)) {
                    $q->orWhere(function ($inner) use ($movieIds) {
                        $inner->where('watchable_type', Movie::class)
                            ->whereIn('watchable_id', $movieIds);
                    });
                }
                if (! empty($episodeIds)) {
                    $q->orWhere(function ($inner) use ($episodeIds) {
                        $inner->where('watchable_type', Episode::class)
                            ->whereIn('watchable_id', $episodeIds);
                    });
                }
            });

        return $query->get()->keyBy(function (WatchProgress $progress) {
            $type = $progress->watchable_type === Movie::class ? 'movie' : 'episode';

            return $type.':'.$progress->watchable_id;
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
            $map[$type.':'.$row->playable_id] = (int) $row->plays_count;
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

            if (! $watchable instanceof Model) {
                continue;
            }

            $type = self::resolveHistoryType($watchable);
            if ($type === null) {
                continue;
            }

            $playsCount = (int) ($playCountMap[$type.':'.$watchable->id] ?? 0);
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
