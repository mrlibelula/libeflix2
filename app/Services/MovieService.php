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
        // Check if user is running this from command line
        if (!app()->runningInConsole()) {
            throw new Exception('This script can only be run from the command line');
        }

        $startTime = microtime(true);
        ini_set('memory_limit', '-1');  // Temporary fix for memory limit
        echo "Importing movies..." . PHP_EOL;

        $storage = Storage::disk($disk);

        $baseFetchApiUrl = env('TMDB_BASE_URL') . '/search/movie?api_key=' . env('TMDB_API_KEY') . '&query=';
        $movies = collect([]);
        $movieDirs = collect($storage->directories());
        $moviesJsonData = collect([]);
        $errorMovies = collect([]);
        $notFoundMoviesInTMDB = collect([]);
        $notPersistedMovies = collect([]);
        $persistedMovies = collect([]);
        $alreadyPersistedMovies = collect([]);

        $foundMoviesInStorageCount = 0;
        $foundMoviesCount = 0;
        $notFoundMoviesInTMDBCount = 0;
        $notPersistedMoviesCount = 0;
        $totalPersistedMoviesCount = 0;
        $alreadyPersistedMoviesCount = 0;

        // Get metadata.json from movies folders
        $movieDirs->each(function (string $movieDir) use ($storage, $moviesJsonData, &$foundMoviesInStorageCount) {
            $files = collect($storage->files($movieDir));
            $files->filter(function (string $file) {
                return str_contains($file, '.json');
            })->each(function (string $jsonFile) use ($storage, $moviesJsonData, $movieDir, &$foundMoviesInStorageCount) {
                $jsonContent = json_decode($storage->get($jsonFile), true);
                if (isset($jsonContent['api_id'])) unset($jsonContent['api_id']);
                $jsonContent['dir'] = $movieDir;
                $moviesJsonData->push($jsonContent);
                $foundMoviesInStorageCount++;
                // update metadata.json
                $storage->put($jsonFile, json_encode($jsonContent, JSON_PRETTY_PRINT));
            });
        });

        // Search for movies in TMDB
        $moviesJsonData->each(function ($movieData) use ($baseFetchApiUrl, &$movies, &$errorMovies, &$notFoundMoviesInTMDB, &$foundMoviesCount, &$notFoundMoviesInTMDBCount, $disk, &$alreadyPersistedMovies, &$alreadyPersistedMoviesCount) {
            if ($dbMovie = Movie::where('id', $movieData['id'])->first()) {
                $alreadyPersistedMovies->push($dbMovie);
                // updates subtitles
                $dbMovie->subtitles = self::getMovieSubtitles($dbMovie);
                $dbMovie->save();
                $alreadyPersistedMoviesCount++;
                return;
            }

            echo "Searching for movie: \"" . $movieData['name'] . "\" (" . $movieData['release_year'] . ")..." . PHP_EOL;
            $apiUrl = $baseFetchApiUrl . urlencode(strtolower(trim($movieData['name'])));
            $response = Http::get($apiUrl);
            $responseArrayDataResults = collect($response->json()['results']);

            $foundMovie = $responseArrayDataResults->first(function ($responseMovieData) use ($movieData, &$errorMovies) {
                if (isset($responseMovieData['id'])) {
                    $found = (int)$responseMovieData['id'] === (int)$movieData['id'];
                    if ($found) {
                        echo "   - Found movie: \"" . $responseMovieData['title'] . "\" (" . $responseMovieData['release_date'] . ")" . PHP_EOL;
                    }
                    return $found;
                } else {
                    $errorMovies->push($movieData);
                    return null;
                }
            });

            // Grab additional movie data from TMDB
            if ($foundMovie) {
                $foundMoviesCount++;
                echo "   - Grabbing additional movie data with id: " . $foundMovie['id'] . "..." . PHP_EOL;
                $baseUrlMovieData = env('TMDB_BASE_URL') . '/movie/' . $foundMovie['id'] . '?api_key=' . env('TMDB_API_KEY') . '&append_to_response=credits,videos,images';
                $baseUrlMovieAlternativeTitles = env('TMDB_BASE_URL') . '/movie/' . $foundMovie['id'] . '/alternative_titles?api_key=' . env('TMDB_API_KEY');
                $baseUrlMovieKeywords = env('TMDB_BASE_URL') . '/movie/' . $foundMovie['id'] . '/keywords?api_key=' . env('TMDB_API_KEY');

                $responseMovieData = Http::get($baseUrlMovieData);
                $responseArrayData = collect($responseMovieData->json());
                $responseMovieAlternativeTitles = Http::get($baseUrlMovieAlternativeTitles);
                $responseArrayDataAlternativeTitles = collect($responseMovieAlternativeTitles->json());
                $responseMovieKeywords = Http::get($baseUrlMovieKeywords);
                $responseArrayDataKeywords = collect($responseMovieKeywords->json());

                $foundMovie['alternative_titles'] = $responseArrayDataAlternativeTitles['titles'];
                $foundMovie['keywords'] = $responseArrayDataKeywords['keywords'];
                $foundMovie['original_name'] = $foundMovie['original_title'];
                $foundMovie['disk'] = $disk;
                $foundMovie['path'] = self::moviePath($movieData['dir'], $disk);
                $foundMovie['trailers'] = $responseArrayData['videos']['results'];
                $foundMovie['backdrop_path'] = $responseArrayData['backdrop_path'];
                $foundMovie['genres'] = $responseArrayData['genres'];
                $foundMovie['credits'] = $responseArrayData['credits'];
                $foundMovie['images'] = $responseArrayData['images'];
                $foundMovie['runtime'] = $responseArrayData['runtime'];
                $foundMovie['tagline'] = $responseArrayData['tagline'];
                $foundMovie['is_free'] = false;

                unset($foundMovie['original_title']);
                unset($foundMovie['genre_ids']);
                unset($foundMovie['adult']);
                unset($foundMovie['video']);

                $movies->push($foundMovie);
            } else {
                $notFoundMoviesInTMDBCount++;
                $notFoundMoviesInTMDB->push($movieData);
            }
            echo PHP_EOL;
        });

        // Persist movies to database
        $movies->each(function ($movie) use (&$notPersistedMovies, &$notPersistedMoviesCount, &$totalPersistedMoviesCount, &$persistedMovies) {
            try {
                echo "- Persisting movie: " . $movie['title'] . "..." . PHP_EOL;
                if ($movie) {
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
                    // updates subtitles
                    $createdMovie->subtitles = self::getMovieSubtitles($createdMovie);
                    $createdMovie->save();
                    $totalPersistedMoviesCount++;
                    $persistedMovies->push($createdMovie);
                } else {
                    $notPersistedMoviesCount++;
                    $notPersistedMovies->push($movie);
                }
            } catch (Exception $e) {
                echo "\033[31m  * Error: " . $movie['title'] . "... Check log.\033[0m" . PHP_EOL;
                info(['notPersistedMovies' => [
                    'movie' => '- ID: ' . $movie['id'] . ' - ' . $movie['title'] . ' (' . $movie['release_date'] . ')',
                    'error' => $e->getMessage(),
                ]]);
                $notPersistedMoviesCount++;
                $notPersistedMovies->push($movie);
            }
        });

        // Reports

        if ($errorMovies->count()) {
            echo "\033[31m*Error movies have been logged\033[0m" . PHP_EOL;
            info(['errorMovies' => $errorMovies->toArray()]);
        }

        if ($notFoundMoviesInTMDB->count()) {
            echo "\033[35m*'Not found movies' in TMDB have been logged...\033[0m" . PHP_EOL;
            info(['notFoundMoviesInTMDB' => $notFoundMoviesInTMDB->toArray()]);
            $notFoundMoviesInTMDB->each(function ($movie) {
                echo "\033[35m  - " . json_encode($movie) . PHP_EOL;
            });
        }

        if ($notPersistedMovies->count()) {
            echo "\033[33m* Not persisted movies have been logged...\033[0m" . PHP_EOL;
            info(['notPersistedMovies' => $notPersistedMovies->pluck('title')->toArray()]);
            $notPersistedMovies->each(function ($movie) {
                if ($movie) {
                    echo "\033[33m  - " . json_encode([$movie['id'], $movie['title'], $movie['release_date']]) . "\033[0m" . PHP_EOL;
                } else {
                    echo "\033[33m  - NULL movie could not be persisted\033[0m" . PHP_EOL;
                }
            });
        }

        if ($alreadyPersistedMovies->count()) {
            echo "\033[33m* Already persisted movies have been logged...\033[0m" . PHP_EOL;
            info(['alreadyPersistedMovies' => $alreadyPersistedMovies->pluck('title', 'id')->toArray()]);
            $alreadyPersistedMovies->each(function ($movie) {
                echo "\033[33m  - ID: " . $movie->id . " - " . $movie->title . " (" . $movie->release_date . ")" . "\033[0m" . PHP_EOL;
            });
        }

        if ($persistedMovies->count()) {
            echo "\033[32m* Persisted movies have been logged...\033[0m" . PHP_EOL;
            info(['persistedMovies' => $persistedMovies->pluck('title', 'id')->toArray()]);
            $persistedMovies->each(function ($movie) {
                echo "\033[32m  - ID: " . $movie->id . " - " . $movie->title . " (" . $movie->release_date . ")" . "\033[0m" . PHP_EOL;
            });
        }

        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;

        // store a report file with all the import information
        $storage->put('import_report_' . date('Y_m_d_H_i_s') . '.json', json_encode([
            'Error movies' => $errorMovies->toArray(),
            'Movies not found in TMDB API' => $notFoundMoviesInTMDB->toArray(),
            'Movies not imported' => $notPersistedMovies->pluck('title')->toArray(),
            'Movies imported' => $persistedMovies->pluck('title', 'id')->toArray(),
            'Final Report' => [
                'Date' => date('Y-m-d H:i:s'),
                'Movies found in storage' => $foundMoviesInStorageCount,
                'Movies found in TMDB' => $foundMoviesCount,
                'Movies not found in TMDB' => $notFoundMoviesInTMDBCount,
                'Movies not imported' => $notPersistedMoviesCount,
                'Movies already imported' => $alreadyPersistedMoviesCount,
                'Total imported movies' => $totalPersistedMoviesCount,
                'Execution time' => round($executionTime / 60, 2) . " minutes",
            ],
        ], JSON_PRETTY_PRINT));

        // update free movies in the database
        self::updateFreeMoviesInDB();

        echo PHP_EOL;
        echo '---------------------------------------------' . PHP_EOL;
        echo "\033[32m* Movies found in storage: " . $foundMoviesInStorageCount . "\033[0m" . PHP_EOL;
        echo "\033[32m* Movies found in TMDB: " . $foundMoviesCount . "\033[0m" . PHP_EOL;
        echo "\033[32m* 'Not found' movies in TMDB: " . $notFoundMoviesInTMDBCount . "\033[0m" . PHP_EOL;
        echo "\033[32m* 'Not persisted' movies: " . $notPersistedMoviesCount . "\033[0m" . PHP_EOL;
        echo "\033[32m* 'Already persisted' movies: " . $alreadyPersistedMoviesCount . "\033[0m" . PHP_EOL;
        echo "\033[32m* Total persisted movies: " . $totalPersistedMoviesCount . "\033[0m" . PHP_EOL;
        echo '---------------------------------------------' . PHP_EOL;

        echo "\n\033[32mExecution time: " . round($executionTime / 60, 2) . " minutes\033[0m" . PHP_EOL;

        echo "\n\033[36mReport file: " . $storage->path('import-report.json') . "\033[0m" . PHP_EOL;
        echo "Check log for more details." . PHP_EOL;

        return true;
    }

    /**
     * Get the path of the first mp4 file in the movie directory
     * This is used to set the movie path in the database
     *
     * @param string $dir
     * @param string $disk
     * @return string
     */
    private static function moviePath(string $dir, string $disk): string
    {
        $files = Storage::disk($disk)->files($dir . '/');
        $mp4Files = collect($files)->filter(function (string $file) {
            return str_contains($file, '.mp4');
        });
        return $mp4Files->first();
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
