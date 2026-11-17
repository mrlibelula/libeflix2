<?php

namespace App\Http\Controllers;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Season;
use App\Models\Tvshow;
use App\Services\Subtitles\OpenSubtitlesClient;
use App\Services\Subtitles\OpenSubtitlesHash;
use App\Services\Subtitles\OpenSubtitlesQuotaException;
use App\Services\Subtitles\SubtitleConverter;
use App\Services\Subtitles\SubtitleDownloadLogger;
use App\Services\Subtitles\SubtitleLanguages;
use App\Services\Subtitles\SubtitleLibrary;
use App\Services\Subtitles\SubtitleTargetResolver;
use App\Services\Tool;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

class AdminSubtitleController extends Controller
{
    public function __construct(
        private readonly SubtitleTargetResolver $resolver,
        private readonly SubtitleConverter $converter,
        private readonly SubtitleLibrary $library,
        private readonly OpenSubtitlesClient $client,
        private readonly SubtitleDownloadLogger $downloadLogger,
    ) {}

    public function index(): Response
    {
        return Inertia::render('admin/subtitles');
    }

    public function languages(): JsonResponse
    {
        return response()->json([
            'languages' => SubtitleLanguages::options(),
        ]);
    }

    public function quota(): JsonResponse
    {
        $history = $this->downloadLogger->recent();

        try {
            return response()->json([
                'quota' => $this->client->quota(),
                'history' => $history,
            ]);
        } catch (RuntimeException $exception) {
            return response()->json([
                'quota' => null,
                'history' => $history,
                'message' => $exception->getMessage(),
            ]);
        }
    }

    public function titles(Request $request): JsonResponse
    {
        $type = $request->string('type')->toString() ?: 'movie';
        $query = trim($request->string('q')->toString());

        if ($type === 'tvshow') {
            // Titles only: do not eager-load seasons/episodes here.
            // Nested whereHas(seasons.episodes) is expensive; a single EXISTS join is enough.
            $shows = Tvshow::query()
                ->whereExists(function ($builder) {
                    $builder->selectRaw('1')
                        ->from('episodes')
                        ->join('seasons', 'seasons.id', '=', 'episodes.season_id')
                        ->whereColumn('seasons.tvshow_id', 'tvshows.id')
                        ->where('episodes.is_in_storage', '!=', '');
                })
                ->when($query !== '', function ($builder) use ($query) {
                    $builder->where('name', 'like', '%'.$query.'%');
                })
                ->orderBy('name')
                ->limit(40)
                ->get(['id', 'name', 'tmdb_id', 'first_air_date']);

            return response()->json([
                'titles' => $shows->map(fn (Tvshow $show) => [
                    'id' => $show->id,
                    'title' => $show->name,
                    'tmdb_id' => $show->tmdb_id,
                    'year' => $show->first_air_date ? substr((string) $show->first_air_date, 0, 4) : null,
                ])->values(),
            ]);
        }

        $movies = Movie::query()
            ->where('path', '!=', '')
            ->when($query !== '', function ($builder) use ($query) {
                $builder->where('title', 'like', '%'.$query.'%');
            })
            ->orderBy('title')
            ->limit(40)
            ->get(['id', 'title', 'path', 'disk', 'subtitles', 'release_date']);

        return response()->json([
            'titles' => $movies->map(function (Movie $movie) {
                // List view trusts the DB path flag; disk existence is checked when opening a title.
                return [
                    'id' => $movie->id,
                    'title' => $movie->title,
                    'tmdb_id' => $movie->id,
                    'year' => $movie->release_date ? substr((string) $movie->release_date, 0, 4) : null,
                    'languages' => $this->resolver->languageCodesFromMovie($movie),
                    'has_video' => $movie->path !== '',
                ];
            })->values(),
        ]);
    }

    public function episodes(int $tvshowId): JsonResponse
    {
        $show = Tvshow::query()->findOrFail($tvshowId);
        // On-demand: only seasons that have at least one stored episode, and only those episodes.
        $seasons = Season::query()
            ->where('tvshow_id', $show->id)
            ->whereHas('episodes', fn ($query) => $query->where('is_in_storage', '!=', ''))
            ->with(['episodes' => function ($query) {
                $query->where('is_in_storage', '!=', '')
                    ->orderBy('episode_number')
                    ->select(['id', 'season_id', 'name', 'episode_number', 'is_in_storage', 'subtitles']);
            }])
            ->orderBy('season_number')
            ->get(['id', 'tvshow_id', 'season_number', 'name']);

        return response()->json([
            'tvshow' => [
                'id' => $show->id,
                'name' => $show->name,
                'tmdb_id' => $show->tmdb_id,
            ],
            'seasons' => $seasons->map(function (Season $season) {
                $episodes = $season->episodes->map(function (Episode $episode) {
                    $languages = [];
                    foreach ($episode->subtitles ?? [] as $subtitle) {
                        if (is_array($subtitle) && ! empty($subtitle['language_code'])) {
                            $languages[] = strtoupper((string) $subtitle['language_code']);
                        }
                    }

                    return [
                        'id' => $episode->id,
                        'name' => $episode->name,
                        'episode_number' => $episode->episode_number,
                        'in_storage' => true,
                        'languages' => array_values(array_unique($languages)),
                    ];
                })->values();

                $coverage = [];
                $total = $episodes->count();
                foreach (SubtitleLanguages::codes() as $code) {
                    $count = $episodes->filter(fn (array $episode) => in_array($code, $episode['languages'], true))->count();
                    if ($count > 0) {
                        $coverage[] = [
                            'language' => $code,
                            'count' => $count,
                            'total' => $total,
                        ];
                    }
                }

                return [
                    'id' => $season->id,
                    'season_number' => $season->season_number,
                    'name' => $season->name,
                    'coverage' => $coverage,
                    'episodes' => $episodes,
                ];
            })->values(),
        ]);
    }

    public function show(string $type, int $id): JsonResponse
    {
        try {
            $target = $this->resolver->resolve($type, $id);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $this->resolver->refresh($target);
        $target = $this->resolver->resolve($type, $id);

        return response()->json($this->targetPayload($target));
    }

    public function video(string $type, int $id, StorageController $storage): BinaryFileResponse|JsonResponse
    {
        try {
            $target = $this->resolver->resolve($type, $id);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return $storage->fileServe(Tool::encode($target['video_path']), $target['disk']);
    }

    public function online(Request $request, string $type, int $id): JsonResponse
    {
        $languages = $this->languageList($request->string('languages')->toString());
        if ($languages === []) {
            return response()->json(['message' => 'Choose at least one language.'], 422);
        }

        try {
            $target = $this->resolver->resolve($type, $id);
            $hash = OpenSubtitlesHash::fromDisk($target['disk'], $target['video_path']);
            $results = $type === 'movie'
                ? $this->client->searchMovie((int) $target['model']->id, $languages, $hash, basename($target['video_path']), (string) $target['model']->title)
                : $this->searchEpisodeTarget($target, $languages, $hash);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $groups = [];
        foreach ($languages as $language) {
            $matches = array_values(array_filter($results, fn (array $row) => $row['language'] === $language));
            $groups[] = [
                'language' => $language,
                'language_name' => SubtitleLanguages::name($language),
                'results' => array_slice($matches, 0, 15),
            ];
        }

        return response()->json([
            'hash' => $hash,
            'groups' => $groups,
        ]);
    }

    public function download(Request $request, string $type, int $id): JsonResponse
    {
        $validated = $request->validate([
            'files' => ['required', 'array', 'min:1', 'max:12'],
            'files.*.file_id' => ['required', 'integer'],
            'files.*.language' => ['required', 'string'],
        ]);

        try {
            $target = $this->resolver->resolve($type, $id);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        $items = [];
        $quota = null;
        $quotaExceeded = null;
        $user = Auth::user();

        foreach ($validated['files'] as $file) {
            $language = SubtitleLanguages::normalize($file['language']);
            if ($language === null) {
                return response()->json(['message' => 'Unknown language '.$file['language'].'.'], 422);
            }

            try {
                $download = $this->client->download((int) $file['file_id']);
            } catch (OpenSubtitlesQuotaException $exception) {
                $quotaExceeded = [
                    'message' => $exception->getMessage(),
                    'reset_time_utc' => $exception->resetTimeUtc,
                    'remaining' => $exception->remaining,
                ];
                break;
            } catch (RuntimeException $exception) {
                return response()->json([
                    'message' => $exception->getMessage(),
                    'items' => $items,
                    'quota' => $quota,
                    'history' => $this->downloadLogger->recent(),
                ], $items === [] ? 422 : 200);
            }

            $this->downloadLogger->log(
                $user instanceof \App\Models\User ? $user : null,
                [
                    'type' => $target['type'],
                    'id' => $target['id'],
                    'title' => $target['title'],
                ],
                $language,
                (int) $file['file_id'],
                is_string($download['file_name'] ?? null) ? $download['file_name'] : null,
                (bool) $download['cached'],
                $download['cached'] ? null : (is_numeric($download['remaining'] ?? null) ? (int) $download['remaining'] : null),
            );

            if (! $download['cached']) {
                $quota = $this->client->quota() ?? [
                    'remaining' => $download['remaining'],
                    'allowed' => $download['allowed'],
                    'used' => null,
                    'downloads_count' => null,
                    'level' => null,
                    'vip' => false,
                    'reset_time' => null,
                    'reset_time_utc' => $download['reset_time_utc'],
                ];
            }
            $converted = $this->converter->convert($download['content']);
            $items[] = [
                'file_id' => (int) $file['file_id'],
                'cached' => $download['cached'],
                'language' => $language,
                'language_name' => SubtitleLanguages::name($language),
                'file_name' => $download['file_name'],
                'source' => $download['content'],
                'cues' => $converted['cues'],
                'warnings' => $converted['warnings'],
                'vtt' => $converted['vtt'],
                'encoding' => $converted['encoding'],
            ];
        }

        return response()->json([
            'items' => $items,
            'quota' => $quota ?? $this->safeQuota(),
            'history' => $this->downloadLogger->recent(),
            'quota_exceeded' => $quotaExceeded,
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    private function safeQuota(): ?array
    {
        try {
            return $this->client->quota();
        } catch (RuntimeException) {
            return null;
        }
    }

    public function preview(Request $request): JsonResponse
    {
        $request->validate([
            'files' => ['nullable', 'array', 'max:12'],
            'files.*' => ['file', 'max:2048'],
            'sources' => ['nullable', 'array', 'max:12'],
            'sources.*.source' => ['required', 'string', 'max:2000000'],
            'sources.*.filename' => ['nullable', 'string', 'max:255'],
            'sources.*.language' => ['nullable', 'string', 'max:16'],
            'sources.*.offset_ms' => ['nullable', 'integer', 'between:-600000,600000'],
        ]);

        if (! $request->hasFile('files') && ! $request->filled('sources')) {
            return response()->json(['message' => 'Upload a subtitle file or paste subtitle text.'], 422);
        }

        $items = [];

        foreach ($request->file('files', []) as $file) {
            $extension = strtolower($file->getClientOriginalExtension());
            if (! in_array($extension, ['srt', 'vtt'], true)) {
                return response()->json(['message' => $file->getClientOriginalName().' must be an .srt or .vtt file.'], 422);
            }

            $raw = file_get_contents($file->getRealPath());
            $converted = $this->converter->convert(is_string($raw) ? $raw : '');
            $guess = SubtitleLanguages::guessFromFilename($file->getClientOriginalName());
            $items[] = [
                'filename' => $file->getClientOriginalName(),
                'language' => $guess,
                'language_name' => $guess ? SubtitleLanguages::name($guess) : null,
                'source' => is_string($raw) ? $raw : '',
                'cues' => $converted['cues'],
                'warnings' => $converted['warnings'],
                'vtt' => $converted['vtt'],
                'encoding' => $converted['encoding'],
                'format' => $converted['format'],
            ];
        }

        foreach ($request->input('sources', []) as $source) {
            $offset = (int) ($source['offset_ms'] ?? 0);
            $converted = $this->converter->convert((string) $source['source'], $offset);
            $guess = SubtitleLanguages::normalize($source['language'] ?? null)
                ?? SubtitleLanguages::guessFromFilename((string) ($source['filename'] ?? ''));
            $items[] = [
                'filename' => $source['filename'] ?? null,
                'language' => $guess,
                'language_name' => $guess ? SubtitleLanguages::name($guess) : null,
                'source' => (string) $source['source'],
                'cues' => $converted['cues'],
                'warnings' => $converted['warnings'],
                'vtt' => $converted['vtt'],
                'encoding' => $converted['encoding'],
                'format' => $converted['format'],
                'offset_ms' => $offset,
            ];
        }

        return response()->json(['items' => $items]);
    }

    public function store(Request $request, string $type, int $id): JsonResponse
    {
        $validated = $request->validate([
            'tracks' => ['required', 'array', 'min:1', 'max:12'],
            'tracks.*.language' => ['required', 'string'],
            'tracks.*.source' => ['required', 'string', 'max:2000000'],
            'tracks.*.offset_ms' => ['nullable', 'integer', 'between:-600000,600000'],
            'tracks.*.overwrite' => ['nullable', 'boolean'],
        ]);

        try {
            $target = $this->resolver->resolve($type, $id);
            $result = $this->library->saveTracks($target, $validated['tracks']);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json($result);
    }

    public function destroy(string $type, int $id, string $lang): JsonResponse
    {
        try {
            $target = $this->resolver->resolve($type, $id);
            $result = $this->library->deleteTrack($target, $lang);
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        return response()->json($result);
    }

    public function autofill(Request $request, int $tvshowId, int $seasonId): JsonResponse
    {
        $validated = $request->validate([
            'languages' => ['required', 'array', 'min:1', 'max:8'],
            'languages.*' => ['required', 'string'],
            'dry_run' => ['nullable', 'boolean'],
        ]);

        $show = Tvshow::query()->findOrFail($tvshowId);
        $season = Season::query()->findOrFail($seasonId);

        try {
            $result = $this->library->autofillSeason(
                $show,
                $season,
                $validated['languages'],
                (bool) ($validated['dry_run'] ?? false),
            );
        } catch (RuntimeException $exception) {
            return response()->json(['message' => $exception->getMessage()], 422);
        }

        if (! ($result['dry_run'] ?? false)) {
            $result['quota'] = $this->safeQuota() ?? ($result['quota'] ?? null);
            $result['history'] = $this->downloadLogger->recent();
        }

        return response()->json($result);
    }

    /**
     * @param  array{type: string, id: int, disk: string, video_path: string, title: string, subtitle: ?string}  $target
     * @return array<string, mixed>
     */
    private function targetPayload(array $target): array
    {
        $routeName = $target['type'] === 'movie' ? 'movie.subtitles.serve' : 'tvshow.subtitles.serve';
        $tracks = array_map(function (array $track) use ($target, $routeName) {
            $track['subtitle_url'] = route($routeName, [
                'encFilePath' => Tool::encode($track['path']),
                'disk' => $target['disk'],
            ]);
            unset($track['path']);

            return $track;
        }, $this->resolver->existingTracks($target));

        return [
            'type' => $target['type'],
            'id' => $target['id'],
            'title' => $target['title'],
            'subtitle' => $target['subtitle'],
            'video_file_name' => basename($target['video_path']),
            'video_path' => $target['video_path'],
            'video_url' => route('admin.api.subtitles.video', ['type' => $target['type'], 'id' => $target['id']]),
            'tracks' => $tracks,
            'languages' => array_column($tracks, 'language'),
        ];
    }

    /**
     * @return array<int, string>
     */
    private function languageList(string $raw): array
    {
        $codes = [];
        foreach (preg_split('/[,\s]+/', $raw) ?: [] as $token) {
            $code = SubtitleLanguages::normalize($token);
            if ($code !== null) {
                $codes[$code] = $code;
            }
        }

        return array_values($codes);
    }

    /**
     * @param  array{model: mixed}  $target
     * @param  array<int, string>  $languages
     * @return array<int, array<string, mixed>>
     */
    private function searchEpisodeTarget(array $target, array $languages, ?string $hash): array
    {
        $episode = $target['model'];
        if (! $episode instanceof Episode) {
            throw new RuntimeException('Episode not found.');
        }

        $show = $episode->season?->tvshow;
        if (! $show) {
            throw new RuntimeException('This episode is not attached to a TV show.');
        }

        return $this->client->searchEpisode(
            (int) $show->tmdb_id,
            (int) ($episode->season_number ?? $episode->season?->season_number),
            (int) $episode->episode_number,
            $languages,
            $hash,
            basename($target['video_path']),
            (string) $show->name,
        );
    }
}
