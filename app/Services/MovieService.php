<?php

namespace App\Services;

use App\Models\Movie;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\User;
use App\Services\Tool;
use App\Services\WatchLaterService;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Eloquent\Collection;
use OpenAI\Laravel\Facades\OpenAI;

class MovieService
{
    /**
     * Import google_drive_file_id values from remote db to local db
     * Run only in console
     *
     * @return bool
     */
    public static function importGoogleDriveIdsFromRemoteDB(): bool
    {
        // run only in console
        if (!app()->runningInConsole()) {
            throw new Exception('This script can only be run from the command line');
        }

        echo "Importing google_drive_file_id values from remote db..." . PHP_EOL;

        $successMovies = [];
        $errorMovies = [];

        // get google_drive_file_id values from remote db (192.168.1.202 \\servero)
        $remoteMovies = DB::connection('mysql_remote')->table('movies')
            ->select('id', 'google_drive_file_id')
            ->whereNotNull('google_drive_file_id')
            ->get();

        // import google_drive_file_id values to local db
        $remoteMovies->each(function ($movie) use (&$successMovies, &$errorMovies) {
            try {
                Movie::where('id', $movie->id)->update(['google_drive_file_id' => $movie->google_drive_file_id]);
                $successMovies[] = $movie->id;
            } catch (\Throwable $th) {
                echo "Error updating movie " . $movie->id . " in local db: " . $th->getMessage() . PHP_EOL;
                $errorMovies[] = $movie->id;
            }
        });

        // verify (via db) that all movies have been updated
        $localMovies = Movie::select('id', 'google_drive_file_id')
            ->whereNotNull('google_drive_file_id')
            ->get()
            ->toArray();

        if (count($localMovies) !== count($remoteMovies)) {
            echo "Error: Not all movies have been updated" . PHP_EOL;
            return false;
        } else {
            echo "Successfully updated " . count($successMovies) . " movies out of " . count($remoteMovies) . " in local db" . PHP_EOL;
        }

        return count($errorMovies) === 0;
    }

    /**
     * Get the movies from the database that have a google_drive_file_id
     * If $columns is a string '*', grab all columns from the movies table
     * Google Drive movies will only load if the app is in production
     *
     * @param array|string $columns
     * @param string $orderBy
     * @return Collection
     */
    public static function getGoogleDriveMovies(array|string $columns = ['id', 'title', 'path', 'google_drive_file_id'], string $orderBy = 'id'): Collection
    {
        $gdriveMovies = collect([]);
        $isProduction = App::environment('production');

        if ($isProduction) {
            // if columns is a string '*', grab all columns
            if (is_string($columns) && $columns === '*') {
                $columns = Schema::getColumnListing((new Movie)->getTable());
            }

            $gdriveMovies = Movie::select($columns)
                ->whereNotNull('google_drive_file_id')
                ->orderBy($orderBy)
                ->get();
        }

        return $gdriveMovies;
    }

    /**
     * Update the free movies in the database (from remote db)
     *
     * @return bool
     */
    public static function updateFreeMoviesInDB(): bool
    {
        // run only in console
        if (!app()->runningInConsole()) {
            throw new Exception('This script can only be run from the command line');
        }

        echo "Updating free movies in the database..." . PHP_EOL;

        $freeMovieIds = [];

        // obtain free movies from remote db
        try {
            $freeMovieIds = DB::connection('mysql_remote')->table('movies')
                ->select('id')
                ->where('is_free', true)
                ->get()
                ->toArray();
        } catch (\Throwable $th) {
            echo "Error obtaining free movies from remote db: " . $th->getMessage() . PHP_EOL;
            return false;
        }

        // update free movies in local db
        if (count($freeMovieIds)) {
            try {
                $freeMovies = Movie::whereIn('id', $freeMovieIds)->get();
                $updatedMovies = 0;
                foreach ($freeMovies as $movie) {
                    $movie->is_free = true;
                    if ($movie->save()) {
                        $updatedMovies++;
                    }
                }
                echo "Updated " . $updatedMovies . " free movies in the database" . PHP_EOL;
                $freeMovies->each(function ($movie) {
                    echo "  - " . $movie->title . " (" . $movie->release_date . ")" . PHP_EOL;
                });
                return true;
            } catch (\Throwable $th) {
                echo "Error updating free movies in the database: " . $th->getMessage() . PHP_EOL;
                return false;
            }
        } else {
            echo "No free movies found in remote db" . PHP_EOL;
            return false;
        }
    }

    /**
     * Obtain free movies from local database
     *
     * @param array|string $columns
     * @param string $orderBy
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public static function getFreeMovies(array|string $columns = ['id', 'title'], string $orderBy = 'id'): \Illuminate\Database\Eloquent\Collection
    {
        // if columns is a string '*', grab all columns
        if (is_string($columns) && $columns === '*') {
            $columns = Schema::getColumnListing((new Movie)->getTable());
        }

        return Movie::select($columns)
            ->where('is_free', true)
            ->orderBy($orderBy)
            ->get();
    }

    /**
     * Get the recommendations of a movie
     *
     * @param Movie $movie
     * @return array
     */
    public static function getMovieRecommendations(Movie $movie): array
    {
        $baseUrl = env('TMDB_BASE_URL') . '/movie/' . $movie->id . '/recommendations?api_key=' . env('TMDB_API_KEY');
        $response = Http::get($baseUrl);
        $responseArrayData = $response->json();
        return $responseArrayData['results'] ?? [];
    }

    /**
     * Get similar movies to a given movie
     *
     * @param Movie $movie
     * @return array
     */
    public static function getSimilarMovies(Movie $movie): array
    {
        $baseUrl = env('TMDB_BASE_URL') . '/movie/' . $movie->id . '/similar?api_key=' . env('TMDB_API_KEY');
        $response = Http::get($baseUrl);
        $responseArrayData = $response->json();
        return $responseArrayData['results'] ?? [];
    }

    /**
     * Get the Movie trailers from the database
     *
     * @param int $movieId
     * @return array
     */
    public static function getMovieTrailers(int $movieId): array
    {
        $movie = Movie::find($movieId);
        return json_decode($movie->trailers, true) ?? [];
    }

    /**
     * Get movie trailers from TMDB API (for external movies)
     *
     * @param int $movieId
     * @return array
     */
    public static function getTrailersFromTMDB(int $movieId): array
    {
        $baseUrl = env('TMDB_BASE_URL') . '/movie/' . $movieId . '/videos?api_key=' . env('TMDB_API_KEY');
        $response = Http::get($baseUrl);
        $responseArrayData = $response->json();
        return $responseArrayData['results'] ?? [];
    }

    /**
     * Get movie certification from TMDB API
     *
     * @param Movie $movie
     * @return array
     */
    public static function getMovieCertification(Movie $movie): array
    {
        $baseUrl = env('TMDB_BASE_URL') . '/movie/' . $movie->id . '/release_dates?api_key=' . env('TMDB_API_KEY');
        $response = Http::get($baseUrl);
        $responseArrayData = $response->json();
        $results = $responseArrayData['results'] ?? [];
        
        // Find US certification
        foreach ($results as $country) {
            if (isset($country['iso_3166_1']) && $country['iso_3166_1'] === 'US') {
                if (isset($country['release_dates']) && !empty($country['release_dates'])) {
                    foreach ($country['release_dates'] as $releaseDate) {
                        if (isset($releaseDate['certification']) && !empty($releaseDate['certification'])) {
                            return [
                                'certification' => $releaseDate['certification'],
                                'note' => $releaseDate['note'] ?? null,
                                'release_date' => $releaseDate['release_date'] ?? null,
                                'type' => $releaseDate['type'] ?? null,
                            ];
                        }
                    }
                }
            }
        }
        
        return []; // Return empty if no US certification found
    }

    /**
     * Get movie reviews from TMDB API
     *
     * @param Movie $movie
     * @return array
     */
    public static function getMovieReviews(Movie $movie): array
    {
        $baseUrl = env('TMDB_BASE_URL') . '/movie/' . $movie->id . '/reviews?api_key=' . env('TMDB_API_KEY');
        $response = Http::get($baseUrl);
        $responseArrayData = $response->json();
        return $responseArrayData['results'] ?? [];
    }

    /**
     * Get the subtitles of a movie in json format
     * 
     * @param Movie $movie
     * @return string
     */
    public static function getMovieSubtitles(Movie $movie): string
    {
        $storage = Storage::disk('movies');
        $moviePath = $movie->path;
        $movieDir = dirname($moviePath);
        // search for *.vtt files in the movie directory
        $subtitles = collect($storage->files($movieDir));
        $vttFiles = $subtitles->filter(function ($file) {
            return Str::endsWith($file, '.vtt');
        });

        $vttSubtitles = [];

        if ($vttFiles->count()) {
            $vttSubtitles = $vttFiles->map(function ($vttFile) use ($movie) {
                $language = Str::afterLast($vttFile, '_');
                $language = Str::before($language, '.vtt');
                return [
                    'movieId' => $movie->id,
                    'languageCode' => strtoupper($language),
                    'languageName' => self::getLangName($language),
                    'path' => $vttFile,
                    'encPath' => Tool::encode($vttFile),
                ];
            })->values()->toArray(); // Add values() to ensure indexed array
        }

        // Ensure we always return a JSON array, not object
        return json_encode(array_values($vttSubtitles));
    }

    public static function getLangName(string $langCode): string
    {
        return [
            'en' => 'English',
            'es' => 'Español',
            'fr' => 'French',
            'de' => 'German',
            'it' => 'Italian',
            'br' => 'Portuguese (Br)',
            'cn' => 'Chinesse',
            'jp' => 'Japanesse',
            'se' => 'Swedish',
            'kr' => 'Korean',
            'nl' => 'Dutch',
        ][strtolower($langCode)] ?? strtoupper($langCode);
    }

    /**
     * Add a movie to the watch later list.
     *
     * @param Movie $movie
     * @param User $user
     * @return Movie
     */
    public static function addWatchLater(Movie $movie, User $user): Movie
    {
        WatchLaterService::addWatchLater($movie, $user);
        return $movie;
    }

    /**
     * Remove a movie from the watch later list.
     *
     * @param Movie $movie
     * @param User $user
     * @return Movie
     */
    public static function removeWatchLater(Movie $movie, User $user): Movie
    {
        WatchLaterService::removeWatchLater($movie, $user);
        return $movie;
    }

    /**
     * Check if a movie is in the User's watch later list.
     *
     * @param Movie $movie
     * @param User|null $user
     * @return bool
     */
    public static function isWatchLater(Movie $movie, ?User $user): bool
    {
        return WatchLaterService::isWatchLater($movie, $user);
    }

    private static function metadataPath(string $folder): string
    {
        return $folder . '/metadata.json';
    }

    public static function folderHasMetadata(string $folder, string $disk = 'movies'): bool
    {
        return Storage::disk($disk)->exists(self::metadataPath($folder));
    }

    public static function folderHasVideo(string $folder, string $disk = 'movies'): bool
    {
        return self::getFirstMp4InFolder($folder, $disk) !== null;
    }

    public static function isFolderImported(string $folder): bool
    {
        return Movie::where('path', 'like', $folder . '/%')->exists();
    }

    public static function getFirstMp4InFolder(string $folder, string $disk = 'movies'): ?string
    {
        $files = Storage::disk($disk)->files($folder . '/');
        $mp4 = collect($files)->first(fn (string $file) => str_contains($file, '.mp4'));

        return $mp4 ?: null;
    }

    public static function parseReleaseYearFromFolderName(string $folder): ?int
    {
        if (preg_match('/\((\d{4})\)\s*$/', $folder, $matches)) {
            return (int) $matches[1];
        }

        if (preg_match('/\b(19|20)\d{2}\b/', $folder, $matches)) {
            return (int) $matches[0];
        }

        return null;
    }

    public static function parseTitleFromFolderName(string $folder): string
    {
        $title = preg_replace('/\s*\(\d{4}\)\s*$/', '', $folder);

        return trim($title ?: $folder);
    }

    public static function getMovieReleaseYearFromOpenAI(string $movieName): int
    {
        $prompt = env('OPENAI_MOVIE_RELEASE_YEAR_PROMPT');
        if (!$prompt) {
            return 0;
        }

        $prompt = str_replace('**movieName**', $movieName, $prompt);

        try {
            $response = OpenAI::chat()->create([
                'model' => env('OPENAI_MODEL'),
                'messages' => [
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);

            $content = trim($response->choices[0]->message->content);

            if (preg_match('/^```(?:json)?\s*\n?(.*?)\n?```\s*$/s', $content, $matches)) {
                $content = trim($matches[1]);
            }

            $json = @json_decode($content, true);

            if (json_last_error() === JSON_ERROR_NONE && is_array($json) && !empty($json['releaseYear'])) {
                return (int) $json['releaseYear'];
            }
        } catch (\Throwable $e) {
            info('OpenAI movie release year error: ' . $e->getMessage());
        }

        return 0;
    }

    public static function suggestReleaseYear(string $folderName, bool $useOpenAi = false): array
    {
        $parsed = self::parseReleaseYearFromFolderName($folderName);
        $openai = null;

        if ($useOpenAi) {
            $year = self::getMovieReleaseYearFromOpenAI(self::parseTitleFromFolderName($folderName));
            $openai = $year > 0 ? $year : null;
        }

        return [
            'parsed' => $parsed,
            'openai' => $openai,
            'suggested' => $parsed ?? $openai,
        ];
    }

    public static function searchTmdbMovies(string $name, ?int $year = null): array
    {
        $url = env('TMDB_BASE_URL') . '/search/movie?api_key=' . env('TMDB_API_KEY') . '&query=' . urlencode(strtolower(trim($name)));
        if ($year) {
            $url .= '&year=' . $year;
        }

        $response = Http::get($url);
        $results = $response->json()['results'] ?? [];

        return collect($results)->values()->map(function ($result, int $index) {
            return [
                'pick' => $index,
                'id' => $result['id'],
                'title' => $result['title'],
                'original_title' => $result['original_title'] ?? null,
                'release_date' => $result['release_date'] ?? null,
                'overview' => Str::limit($result['overview'] ?? '', 200),
                'poster_url' => !empty($result['poster_path'])
                    ? env('TMDB_IMAGE_BASE_URL_300') . $result['poster_path']
                    : null,
                'vote_average' => $result['vote_average'] ?? null,
            ];
        })->all();
    }

    public static function createMetadataJson(string $folder, array $data, string $disk = 'movies'): void
    {
        $metadata = [
            'name' => $data['name'],
            'release_year' => (int) $data['release_year'],
            'pick' => (int) ($data['pick'] ?? 0),
            'dir' => $folder,
            'id' => (int) $data['id'],
        ];

        Storage::disk($disk)->put(
            self::metadataPath($folder),
            json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    public static function readMetadataJson(string $folder, string $disk = 'movies'): ?array
    {
        $path = self::metadataPath($folder);
        if (!Storage::disk($disk)->exists($path)) {
            return null;
        }

        $metadata = json_decode(Storage::disk($disk)->get($path), true);

        return is_array($metadata) ? $metadata : null;
    }

    public static function scanPendingMovieFolders(string $disk = 'movies'): array
    {
        $storage = Storage::disk($disk);
        $pending = [];
        $ready = [];

        foreach ($storage->directories() as $folder) {
            if (!self::folderHasVideo($folder, $disk)) {
                continue;
            }

            $videoFile = basename(self::getFirstMp4InFolder($folder, $disk) ?? '');

            if (self::isFolderImported($folder)) {
                continue;
            }

            if (!self::folderHasMetadata($folder, $disk)) {
                $pending[] = [
                    'folder' => $folder,
                    'video_file' => $videoFile,
                    'suggested_title' => self::parseTitleFromFolderName($folder),
                    'parsed_release_year' => self::parseReleaseYearFromFolderName($folder),
                ];
                continue;
            }

            $metadata = self::readMetadataJson($folder, $disk);
            if (!$metadata || empty($metadata['id'])) {
                $pending[] = [
                    'folder' => $folder,
                    'video_file' => $videoFile,
                    'suggested_title' => self::parseTitleFromFolderName($folder),
                    'parsed_release_year' => self::parseReleaseYearFromFolderName($folder),
                ];
                continue;
            }

            if (Movie::where('id', $metadata['id'])->exists()) {
                continue;
            }

            $ready[] = [
                'folder' => $folder,
                'video_file' => $videoFile,
                'metadata' => $metadata,
            ];
        }

        return [
            'pending' => $pending,
            'ready' => $ready,
            'stats' => [
                'pending' => count($pending),
                'ready' => count($ready),
            ],
        ];
    }

    private static function resolveTmdbMovieFromMetadata(array $movieData): ?array
    {
        $year = !empty($movieData['release_year']) ? (int) $movieData['release_year'] : null;
        $results = self::searchTmdbMoviesRaw($movieData['name'], $year);

        if (!empty($movieData['id'])) {
            $byId = collect($results)->first(fn ($result) => (int) $result['id'] === (int) $movieData['id']);
            if ($byId) {
                return $byId;
            }
        }

        $pool = self::filterTmdbResultsByYear(collect($results), $year);

        return $pool->get($movieData['pick'] ?? 0);
    }

    private static function searchTmdbMoviesRaw(string $name, ?int $year = null): array
    {
        $url = env('TMDB_BASE_URL') . '/search/movie?api_key=' . env('TMDB_API_KEY') . '&query=' . urlencode(strtolower(trim($name)));
        if ($year) {
            $url .= '&year=' . $year;
        }

        $response = Http::get($url);

        return $response->json()['results'] ?? [];
    }

    private static function filterTmdbResultsByYear(\Illuminate\Support\Collection $results, ?int $year): \Illuminate\Support\Collection
    {
        if (!$year) {
            return $results->values();
        }

        $filtered = $results->filter(fn ($result) => str_starts_with($result['release_date'] ?? '', (string) $year));

        return $filtered->isNotEmpty() ? $filtered->values() : $results->values();
    }

    private static function fetchFullTmdbMovieData(int $tmdbId, string $folder, string $disk): array
    {
        $baseUrlMovieData = env('TMDB_BASE_URL') . '/movie/' . $tmdbId . '?api_key=' . env('TMDB_API_KEY') . '&append_to_response=credits,videos,images';
        $baseUrlMovieAlternativeTitles = env('TMDB_BASE_URL') . '/movie/' . $tmdbId . '/alternative_titles?api_key=' . env('TMDB_API_KEY');
        $baseUrlMovieKeywords = env('TMDB_BASE_URL') . '/movie/' . $tmdbId . '/keywords?api_key=' . env('TMDB_API_KEY');

        $responseMovieData = Http::get($baseUrlMovieData);
        $responseArrayData = collect($responseMovieData->json());
        $responseMovieAlternativeTitles = Http::get($baseUrlMovieAlternativeTitles);
        $responseArrayDataAlternativeTitles = collect($responseMovieAlternativeTitles->json());
        $responseMovieKeywords = Http::get($baseUrlMovieKeywords);
        $responseArrayDataKeywords = collect($responseMovieKeywords->json());

        $videoPath = self::moviePath($folder, $disk);
        if (!$videoPath) {
            throw new Exception("No .mp4 file found in folder: {$folder}");
        }

        return [
            'id' => $tmdbId,
            'title' => $responseArrayData['title'],
            'original_name' => $responseArrayData['original_title'] ?? $responseArrayData['title'],
            'alternative_titles' => $responseArrayDataAlternativeTitles['titles'] ?? [],
            'keywords' => $responseArrayDataKeywords['keywords'] ?? [],
            'disk' => $disk,
            'path' => $videoPath,
            'trailers' => $responseArrayData['videos']['results'] ?? [],
            'poster_path' => $responseArrayData['poster_path'],
            'backdrop_path' => $responseArrayData['backdrop_path'],
            'genres' => $responseArrayData['genres'] ?? [],
            'credits' => $responseArrayData['credits'] ?? [],
            'images' => $responseArrayData['images'] ?? [],
            'runtime' => $responseArrayData['runtime'],
            'tagline' => $responseArrayData['tagline'],
            'vote_average' => $responseArrayData['vote_average'],
            'release_date' => $responseArrayData['release_date'],
            'overview' => $responseArrayData['overview'],
            'is_free' => false,
        ];
    }

    private static function persistMovieRecord(array $movie): Movie
    {
        $createdMovie = Movie::create([
            'id' => $movie['id'],
            'slug' => self::movieUniqueSlug($movie['title']),
            'original_name' => $movie['original_name'],
            'title' => $movie['title'],
            'alternative_titles' => json_encode($movie['alternative_titles']),
            'keywords' => json_encode($movie['keywords']),
            'disk' => $movie['disk'],
            'path' => $movie['path'],
            'trailers' => json_encode($movie['trailers']),
            'poster_path' => $movie['poster_path'],
            'backdrop_path' => $movie['backdrop_path'],
            'genres' => json_encode($movie['genres']),
            'credits' => json_encode($movie['credits']),
            'images' => json_encode($movie['images']),
            'vote_average' => $movie['vote_average'],
            'runtime' => $movie['runtime'],
            'release_date' => $movie['release_date'],
            'tagline' => $movie['tagline'],
            'overview' => $movie['overview'],
            'is_free' => $movie['is_free'],
        ]);

        $createdMovie->subtitles = self::getMovieSubtitles($createdMovie);
        $createdMovie->save();

        return $createdMovie;
    }

    public static function importMovieFolder(string $folder, string $disk = 'movies'): Movie
    {
        $metadata = self::readMetadataJson($folder, $disk);

        if (!$metadata) {
            $legacyMetadata = self::readLegacyJsonMetadata($folder, $disk);
            if (!$legacyMetadata) {
                throw new Exception("metadata.json not found in folder: {$folder}");
            }
            $metadata = $legacyMetadata;
        }

        if (isset($metadata['api_id'])) {
            unset($metadata['api_id']);
        }

        $metadata['dir'] = $folder;

        Storage::disk($disk)->put(
            self::metadataPath($folder),
            json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        if ($dbMovie = Movie::where('id', $metadata['id'])->first()) {
            $dbMovie->subtitles = self::getMovieSubtitles($dbMovie);
            $dbMovie->save();

            return $dbMovie;
        }

        $foundMovie = self::resolveTmdbMovieFromMetadata($metadata);
        if (!$foundMovie) {
            throw new Exception('Movie not found in TMDB: ' . ($metadata['name'] ?? $folder));
        }

        $enriched = self::fetchFullTmdbMovieData((int) $foundMovie['id'], $folder, $disk);

        return self::persistMovieRecord($enriched);
    }

    public static function importMovieFolders(array $folders, string $disk = 'movies'): array
    {
        $results = [];

        foreach ($folders as $folder) {
            try {
                $movie = self::importMovieFolder($folder, $disk);
                $results[] = [
                    'folder' => $folder,
                    'success' => true,
                    'movie_id' => $movie->id,
                    'slug' => $movie->slug,
                    'title' => $movie->title,
                ];
            } catch (\Throwable $e) {
                $results[] = [
                    'folder' => $folder,
                    'success' => false,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    private static function readLegacyJsonMetadata(string $folder, string $disk): ?array
    {
        $files = collect(Storage::disk($disk)->files($folder));
        $jsonFile = $files->first(fn (string $file) => str_contains($file, '.json'));

        if (!$jsonFile) {
            return null;
        }

        $metadata = json_decode(Storage::disk($disk)->get($jsonFile), true);

        return is_array($metadata) ? $metadata : null;
    }

    /**
     * CONSOLE SCRIPT
     * Import movies from the movies disk
     * Each movie folder must contain "metadata.json" in order to be indexed
     * Use "playground - movie importer" app to generate metadata.json to movies folders
     *
     * @param string $disk
     * @return bool
     */
    public static function importMovies(string $disk = 'movies'): bool
    {
        if (!app()->runningInConsole()) {
            throw new Exception('This script can only be run from the command line');
        }

        $startTime = microtime(true);
        ini_set('memory_limit', '-1');
        echo "Importing movies..." . PHP_EOL;

        $storage = Storage::disk($disk);
        $persistedMovies = collect([]);
        $failedMovies = collect([]);
        $alreadyPersistedMovies = collect([]);

        $foldersWithMetadata = collect($storage->directories())->filter(function (string $folder) use ($disk) {
            return self::folderHasMetadata($folder, $disk) || self::readLegacyJsonMetadata($folder, $disk) !== null;
        });

        foreach ($foldersWithMetadata as $folder) {
            $metadata = self::readMetadataJson($folder, $disk) ?? self::readLegacyJsonMetadata($folder, $disk);
            echo "Processing folder: {$folder}..." . PHP_EOL;

            if ($metadata && Movie::where('id', $metadata['id'] ?? 0)->exists()) {
                try {
                    $movie = self::importMovieFolder($folder, $disk);
                    $alreadyPersistedMovies->push($movie);
                    echo "  - Already imported: {$movie->title}" . PHP_EOL;
                } catch (\Throwable $e) {
                    $failedMovies->push(['folder' => $folder, 'error' => $e->getMessage()]);
                    echo "  - Error: {$e->getMessage()}" . PHP_EOL;
                }
                continue;
            }

            try {
                $movie = self::importMovieFolder($folder, $disk);
                $persistedMovies->push($movie);
                echo "  - Imported: {$movie->title} ({$movie->release_date})" . PHP_EOL;
            } catch (\Throwable $e) {
                $failedMovies->push(['folder' => $folder, 'error' => $e->getMessage()]);
                echo "  - Failed: {$e->getMessage()}" . PHP_EOL;
            }
        }

        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;

        $storage->put('import_report_' . date('Y_m_d_H_i_s') . '.json', json_encode([
            'Movies imported' => $persistedMovies->pluck('title', 'id')->toArray(),
            'Movies already imported' => $alreadyPersistedMovies->pluck('title', 'id')->toArray(),
            'Movies failed' => $failedMovies->toArray(),
            'Final Report' => [
                'Date' => date('Y-m-d H:i:s'),
                'Folders processed' => $foldersWithMetadata->count(),
                'Movies imported' => $persistedMovies->count(),
                'Movies already imported' => $alreadyPersistedMovies->count(),
                'Movies failed' => $failedMovies->count(),
                'Execution time' => round($executionTime / 60, 2) . ' minutes',
            ],
        ], JSON_PRETTY_PRINT));

        if (app()->runningInConsole()) {
            self::updateFreeMoviesInDB();
        }

        echo PHP_EOL . '---------------------------------------------' . PHP_EOL;
        echo "Movies imported: " . $persistedMovies->count() . PHP_EOL;
        echo "Movies already imported: " . $alreadyPersistedMovies->count() . PHP_EOL;
        echo "Movies failed: " . $failedMovies->count() . PHP_EOL;
        echo 'Execution time: ' . round($executionTime / 60, 2) . ' minutes' . PHP_EOL;

        return $failedMovies->isEmpty();
    }

    /**
     * Get the path of the first mp4 file in the movie directory
     * This is used to set the movie path in the database
     *
     * @param string $dir
     * @param string $disk
     * @return string
     */
    private static function moviePath(string $dir, string $disk): ?string
    {
        return self::getFirstMp4InFolder($dir, $disk);
    }

    /**
     * Generate a unique slug for a movie
     * 
     * @param string $movieTitle
     * @return string
     */
    private static function movieUniqueSlug(string $movieTitle): string
    {
        $baseSlug = Str::slug($movieTitle);
        $slug = $baseSlug;
        $counter = 1;

        while (Movie::where('slug', $slug)->exists()) {
            $slug = $baseSlug . '-' . $counter;
            $counter++;
        }

        return $slug;
    }

    /**
     * Returns all genres with appended slugs
     * 
     * @param Movie $movie
     * @return array
     */
    public static function genresWithSlugs(Movie $movie): array
    {
        $genres = is_array($movie->genres) ? $movie->genres : (json_decode($movie->genres, true) ?: []);

        return array_map(function ($genre) {
            $genre['slug'] = Str::slug($genre['name']);
            return $genre;
        }, $genres);
    }

    /**
     * Returns all certifications
     * 
     * @return array
     */
    public static function certifications(): array
    {
        return [
            [
                "certification" => "R",
                "meaning" => "Under 17 requires accompanying parent or adult guardian 21 or older. The parent/guardian is required to stay with the child under 17 through the entire movie, even if the parent gives the child/teenager permission to see the film alone. These films may contain strong profanity, graphic sexuality, nudity, strong violence, horror, gore, and strong drug use. A movie rated R for profanity often has more severe or frequent language than the PG-13 rating would permit. An R-rated movie may have more blood, gore, drug use, nudity, or graphic sexuality than a PG-13 movie would admit.",
                "order" => 4
            ],
            [
                "certification" => "PG",
                "meaning" => "Some material may not be suitable for children under 10. These films may contain some mild language, crude/suggestive humor, scary moments and/or violence. No drug content is present. There are a few exceptions to this rule. A few racial insults may also be heard.",
                "order" => 2
            ],
            [
                "certification" => "NC-17",
                "meaning" => "These films contain excessive graphic violence, intense or explicit sex, depraved, abhorrent behavior, explicit drug abuse, strong language, explicit nudity, or any other elements which, at present, most parents would consider too strong and therefore off-limits for viewing by their children and teens. NC-17 does not necessarily mean obscene or pornographic in the oft-accepted or legal meaning of those words.",
                "order" => 5
            ],
            [
                "certification" => "G",
                "meaning" => "All ages admitted. There is no content that would be objectionable to most parents. This is one of only two ratings dating back to 1968 that still exists today.",
                "order" => 1
            ],
            [
                "certification" => "NR",
                "meaning" => "No rating information.",
                "order" => 0
            ],
            [
                "certification" => "PG-13",
                "meaning" => "Some material may be inappropriate for children under 13. Films given this rating may contain sexual content, brief or partial nudity, some strong language and innuendo, humor, mature themes, political themes, terror and/or intense action violence. However, bloodshed is rarely present. This is the minimum rating at which drug content is present.",
                "order" => 3
            ]
        ];
    }

    /**
     * Get certification description by certification code
     * 
     * @param string $certificationCode
     * @return array|null
     */
    public static function getCertificationDescription(string $certificationCode): ?array
    {   
        foreach (self::certifications() as $certification) {
            if ($certification['certification'] === $certificationCode) {
                return $certification;
            }
        }
        
        return null;
    }
}
