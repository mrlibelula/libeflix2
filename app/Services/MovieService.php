<?php

namespace App\Services;

use App\Models\Movie;
use Exception;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use App\Models\User;
use App\Services\Tool;

class MovieService
{
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
        $movie->addWatchLater($user);
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
        $movie->removeWatchLater($user);
        return $movie;
    }

    /**
     * Check if a movie is in the User's watch later list.
     *
     * @param Movie $movie
     * @param User $user
     * @return bool
     */
    public static function isWatchLater(Movie $movie, User $user): bool
    {
        return $user->watchLaterMovies()->where('movies.id', $movie->id)->exists();
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
}
