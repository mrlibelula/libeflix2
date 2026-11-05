<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Season;
use App\Models\Tvshow;
use App\Services\Tool;
use Exception;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use OpenAI\Laravel\Facades\OpenAI;


class TvshowService
{
    private static string $baseUrl = '';
    private static string $apiKey = '';

    private static function initializeProps()
    {
        self::$baseUrl = env('TMDB_BASE_URL');
        self::$apiKey = 'api_key=' . env('TMDB_API_KEY');
    }

    /**
     * Import tvshows from TMDB API
     * 
     * @return bool
     */
    private static function import(): bool
    {
        try {
            $startTime = microtime(true);
            
            echo "\033[1mStarting TV show import process...\033[0m\n";
            echo "Scanning storage folders for TV shows...\n";

            self::initializeProps();
            
            // first import tvshow data from tmdb
            $importedTvshows = [];
            $importedSeasons = [];
            $importedEpisodes = [];
            $notFoundTvshows = []; // Track TV shows not found in TMDB
            $storage = Storage::disk('tvshows');
            $storageTvshows = $storage->directories();
            
            echo "Found " . count($storageTvshows) . " TV show folders to process\n";
            
            $counter = 1;
            $totalTvshows = count($storageTvshows);
            
            foreach ($storageTvshows as $tvshowFolder) {
                echo "Processing ({$counter}/{$totalTvshows}): {$tvshowFolder}\n";
                
                // check if tvshow exists before importing
                $dbTvshow = Tvshow::where('folder_name', 'like', '%' . $tvshowFolder . '%')->first();
                if ($dbTvshow) {
                    // echo "TV show '{$tvshowFolder}' already exists in database. Skipping.\n";
                    $counter++;
                    continue;
                }
                
                echo "Reading metadata for '{$tvshowFolder}'...\n";
                $metadataJsonFile = $tvshowFolder . '/metadata.json';
                $folderMetadata = null;

                if ($storage->exists($metadataJsonFile)) {
                    $folderMetadata = json_decode($storage->get($metadataJsonFile), true);
                }

                if (!$folderMetadata) {
                    self::createJsonMetadataFileInTvshowDirectory($tvshowFolder, self::getTvshowReleaseYearFromOpenAI($tvshowFolder));
                    $folderMetadata = json_decode($storage->get($metadataJsonFile), true);
                }
                
                echo "Fetching TV show data from TMDB API for '{$folderMetadata['name']}' ({$folderMetadata['releaseYear']})...\n";
                $fetchTvshow = self::fetchTvshow($folderMetadata['name'], $folderMetadata['releaseYear']);
                
                if ($fetchTvshow) {
                    echo "Found TV show on TMDB: '{$fetchTvshow['name']}' (ID: {$fetchTvshow['id']})\n";
                    
                    // import additional tvshow data from tmdb
                    echo "Fetching additional TV show details from TMDB...\n";
                    $additionalTvshowData = self::fetchAdditionalTvshowData($fetchTvshow['id']);
                    echo "Retrieved additional data: {$additionalTvshowData['number_of_seasons']} " . ($additionalTvshowData['number_of_seasons'] === 1 ? 'season' : 'seasons') . ", {$additionalTvshowData['number_of_episodes']} " . ($additionalTvshowData['number_of_episodes'] === 1 ? 'episode' : 'episodes') . "\n";

                    // fetch tvshow cast
                    echo "Fetching TV show cast from TMDB...\n";
                    $tvshowCast = self::getTvshowCast($fetchTvshow['id']);
                    $castCount = count($tvshowCast['cast'] ?? []);
                    echo "Retrieved {$castCount} cast members for: \"{$fetchTvshow['name']}\"\n";

                    // create tvshow local model
                    echo "Creating TV show record in database...\n";
                    // verify unique slug
                    $slug = Str::slug($fetchTvshow['name']);
                    while (Tvshow::where('slug', $slug)->exists()) {
                        $slug = Str::slug($fetchTvshow['name'] . '-' . $counter);
                        $counter++;
                    }
                    $tvshow = Tvshow::create([
                        'tmdb_id' => $fetchTvshow['id'],
                        'name' => $fetchTvshow['name'],
                        'folder_name' => $tvshowFolder,
                        'slug' => $slug,
                        'original_name' => $fetchTvshow['original_name'],
                        'poster_path' => $fetchTvshow['poster_path'],
                        'backdrop_path' => $fetchTvshow['backdrop_path'],
                        'original_language' => $fetchTvshow['original_language'],
                        'overview' => $fetchTvshow['overview'],
                        'popularity' => $fetchTvshow['popularity'],
                        'first_air_date' => $fetchTvshow['first_air_date'],
                        'vote_average' => $fetchTvshow['vote_average'],
                        'vote_count' => $fetchTvshow['vote_count'],

                        'created_by' => $additionalTvshowData['created_by'],
                        'cast' => $tvshowCast['cast'],
                        'homepage' => $additionalTvshowData['homepage'],
                        'languages' => $additionalTvshowData['languages'],
                        'networks' => $additionalTvshowData['networks'],
                        'number_of_episodes' => $additionalTvshowData['number_of_episodes'],
                        'number_of_seasons' => $additionalTvshowData['number_of_seasons'],
                        'origin_country' => $additionalTvshowData['origin_country'],
                        'production_companies' => $additionalTvshowData['production_companies'],
                        'production_countries' => $additionalTvshowData['production_countries'],
                        'available_seasons' => $additionalTvshowData['seasons'],
                        'spoken_languages' => $additionalTvshowData['spoken_languages'],
                        'status' => $additionalTvshowData['status'],
                        'tagline' => $additionalTvshowData['tagline'],
                        'type' => $additionalTvshowData['type'],
                        'videos' => $additionalTvshowData['videos'],
                        'images' => $additionalTvshowData['images'],
                        'selected_logo' => $folderMetadata['selected_logo'] ?? 0,
                        'genres' => $additionalTvshowData['genres'],
                    ]);
                    $importedTvshows[] = $tvshow;
                    $lastTvshowId = $tvshow->id;
                    echo "Successfully created TV show record with ID: {$lastTvshowId}\n";

                    // import seasons from tmdb to seasons table
                    echo "Starting import of {$additionalTvshowData['number_of_seasons']} seasons...\n";
                    for ($season = 1; $season <= $additionalTvshowData['number_of_seasons']; $season++) {
                        echo "  Fetching season {$season} for '{$tvshow->name}'...\n";
                        $seasonData = self::fetchSeason($fetchTvshow['id'], $season);
                        echo "  Creating season {$season} record ({$seasonData['name']})...\n";
                        $episodeCount = count($seasonData['episodes']);
                        $importedSeason = Season::create([
                            'tmdb_id' => $seasonData['id'],
                            'tvshow_id' => $lastTvshowId,
                            'name' => $seasonData['name'],
                            'overview' => $seasonData['overview'],
                            'poster_path' => $seasonData['poster_path'],
                            'air_date' => $seasonData['air_date'],
                            'episode_count' => $episodeCount,
                            'season_number' => $seasonData['season_number'],
                            'vote_average' => $seasonData['vote_average'],
                        ]);
                        $importedSeasons[] = $importedSeason;
                        $lastSeasonId = $importedSeason->id;
                        echo "  Successfully created season record with ID: {$lastSeasonId}\n";
                        
                        // import episodes to each season from tmdb
                        echo "  Starting import of {$episodeCount} episodes for season {$season}/{$additionalTvshowData['number_of_seasons']} for '{$tvshow->name}'...\n";
                        for ($episodeNumber = 1; $episodeNumber <= $episodeCount; $episodeNumber++) {
                            echo "    Fetching S{$season}E{$episodeNumber} data for '{$tvshow->name}'...\r";
                            $episodeData = self::fetchEpisode($fetchTvshow['id'], $seasonData['season_number'], $episodeNumber);
                            $importedEpisode = Episode::create([
                                'tmdb_id' => $episodeData['id'],
                                'season_id' => $lastSeasonId,
                                'name' => $episodeData['name'],
                                'overview' => $episodeData['overview'],
                                'air_date' => $episodeData['air_date'],
                                'episode_number' => $episodeData['episode_number'],
                                'production_code' => $episodeData['production_code'],
                                'runtime' => $episodeData['runtime'],
                                'season_number' => $episodeData['season_number'],
                                'still_path' => $episodeData['still_path'],
                                'vote_average' => $episodeData['vote_average'],
                                'vote_count' => $episodeData['vote_count'],
                                'credits' => $episodeData['credits'] ?? [],
                            ]);
                            $importedEpisodes[] = $importedEpisode;
                            $lastEpisodeId = $importedEpisode->id;
                        }
                        echo "\n  Completed import of all episodes for season {$season}\n";
                    }
                    echo "Imported " . count($importedEpisodes) . " episodes for " . $tvshow->name . "\n";
                    echo "Completed processing TV show {$counter}/{$totalTvshows}: {$tvshow->name}\n";
                } else {
                    echo "\033[31mCould not find TV show '{$folderMetadata['name']}' ({$folderMetadata['releaseYear']}) on TMDB. Skipping.\033[0m\n";
                    // Add to the list of not found TV shows
                    $notFoundTvshows[] = [
                        'name' => $folderMetadata['name'],
                        'year' => $folderMetadata['releaseYear'],
                    ];
                }
                
                $counter++;
                echo "------------------------\n";
            }

            // check if all mp4 episodes + subtitles are in storage and update db
            EpisodeService::checkIfAllEpisodesAndSubtitlesAreInStorageAndUpdateDb();

            // check for additional audio files in each season's folder and store them in db
            EpisodeService::checkForAdditionalLanguageVideoFilesOnEachSeasonFolderAndStoreInDb();

            $endTime = microtime(true);
            $executionTime = $endTime - $startTime;
            
            $hours = (int)$executionTime / 3600;
            $minutes = ((int)$executionTime % 3600) / 60;
            $seconds = (int)$executionTime % 60;

            echo (int)floor($executionTime) !== 0 ? "\033[1;32mImport process completed!\033[0m\n" : "\033[1;32mAll synced. Nothing to import!\033[0m\n";

            echo "Summary: " . count($storageTvshows) . " folders found\n";
            echo "         Imported " . count($importedTvshows) . " TV " . (count($importedTvshows) === 1 ? 'show' : 'shows') . "\n";
            echo "         Imported " . count($importedSeasons) . " " . (count($importedSeasons) === 1 ? 'season' : 'seasons') . "\n";
            echo "         Imported " . count($importedEpisodes) . " " . (count($importedEpisodes) === 1 ? 'episode' : 'episodes') . "\n";
            
            // Display TV shows not found in TMDB
            if (count($notFoundTvshows) > 0) {
                echo "\033[31m         " . count($notFoundTvshows) . " TV " . (count($notFoundTvshows) === 1 ? 'show' : 'shows') . " not found in TMDB:\033[0m\n";
                foreach ($notFoundTvshows as $notFoundTvshow) {
                    echo "\033[31m         - '{$notFoundTvshow['name']}' ({$notFoundTvshow['year']})\033[0m\n";
                }
            }
            
            echo "Imported in: " . sprintf('%02d:%02d:%02d', $hours, $minutes, $seconds) . " (H:M:S)\n";
            
            return true;
        } catch (Exception $e) {
            info($e->getMessage());
            echo "\033[31mError importing TV shows: {$e->getMessage()}\033[0m\n";
            return false;
        }        
    }

    /**
     * Sync a tvshow with TMDB API
     * 
     * @param Tvshow $tvshow
     * @return bool
     */
    public static function syncTvshow(Tvshow $tvshow): bool
    {
        $tvshow->delete(); // cascade deletes all seasons and episodes
        return self::import();
    }

    /**
     * Add a tvshow/s to the database
     * 
     * @param string $folderName
     * @param int $releaseYear
     * @param int $selectedLogo
     * @return bool
     */
    public static function addTvshow(string $folderName, int $releaseYear = 0, int $selectedLogo = 0): bool
    {
        // check if folder exists
        $tvshowsDisk = Storage::disk('tvshows');
        if ($tvshowsDisk->exists($folderName)) {
            throw new \Exception('TV show folder "' . $folderName . '" already exists');
        }

        $tvshowsDisk->makeDirectory($folderName);

        // get release year from OpenAI if not provided
        if ($releaseYear === 0) {
            $releaseYear = self::getTvshowReleaseYearFromOpenAI($folderName);
        }

        // create metadata.json file
        self::createJsonMetadataFileInTvshowDirectory($folderName, $releaseYear, $selectedLogo);

        // import tvshow/s from tmdb API
        return self::import();
    }

    /**
     * Add multiple/all tvshows at once to the database
     * If no folder names are provided, all tvshows in the storage folder will be processed
     * 
     * @param array $folderNames
     * @return bool
     */
    public static function addTvshows(array $folderNames = []): bool
    {
        if (!count($folderNames)) {
            return self::import();
        } else {
            foreach ($folderNames as $folderName) {
                self::addTvshow($folderName);
            }
            return true;
        }
    }

    /**
     * Get TV show release year from OpenAI
     * 
     * @param string $folderName
     * @return int
     */
    private static function getTvshowReleaseYearFromOpenAI(string $folderName): int
    {
        // system user role prompt
        $prompt = env('OPENAI_TVSHOW_RELEASE_YEAR_PROMPT');
        $prompt = str_replace('**tvshowName**', $folderName, $prompt);

        echo "\033[36mAsking \"" . env('OPENAI_MODEL') . "\" for the release year of \"{$folderName}\" TV show...\033[0m\n";

        // get release year from chatgpt
        try {
            $response = OpenAI::chat()->create([
                'model' => env('OPENAI_MODEL'), 
                'messages' => [
                    ['role' => 'user', 'content' => $prompt],
                ], 
            ]);
            $content = $response->choices[0]->message->content;
            
            // Strip markdown code block wrapper if present (GPT-4o-mini often wraps JSON in ```json ... ```)
            $content = trim($content);
            // Match ```json or ``` at start, capture everything until closing ```
            if (preg_match('/^```(?:json)?\s*\n?(.*?)\n?```\s*$/s', $content, $matches)) {
                $content = trim($matches[1]);
            }
            
            // Decode JSON with error handling
            $json = @json_decode($content, true);
            $jsonError = json_last_error();
            
            if ($jsonError !== JSON_ERROR_NONE) {
                echo "\033[33mWarning: JSON decode error: " . json_last_error_msg() . "\033[0m\n";
                info("JSON decode error: " . json_last_error_msg());
                info("Failed content: " . $content);
                return 0;
            }
            
            if (is_array($json) && isset($json['releaseYear']) && $json['releaseYear'] > 0) {
                echo "OpenAI responded with release year: {$json['releaseYear']}\n";
                return (int)$json['releaseYear'];
            } else {
                echo "\033[33mWarning: Could not extract release year from OpenAI response\033[0m\n";
                info("Failed to extract releaseYear from parsed JSON");
                return 0;
            }
        } catch (\OpenAI\Exceptions\ErrorException $ee) {
            echo "\033[31mError getting release year from OpenAI: {$ee->getMessage()}\033[0m\n";
            info($ee->getMessage());
        } catch (\OpenAI\Exceptions\TransporterException $te) {
            echo "\033[31mTransport error getting release year from OpenAI: {$te->getMessage()}\033[0m\n";
            info($te->getMessage());
        }

        return 0;
        
    }

    /**
     * Remove a tvshow and all its associated seasons and episodes from db
     * Folders and files in storage are not deleted (might contain mp4 files)
     * 
     * @param Tvshow $tvshow
     * @return bool
     */
    public static function removeTvshow(Tvshow $tvshow): bool
    {
        // cascade deletes all seasons and episodes
        $tvshow->delete();
        // check if the tvshow folder exists in storage
        $tvshowsDisk = Storage::disk('tvshows');
        if ($tvshowsDisk->exists($tvshow->folder_name)) {
            echo "\033[32mTvshow folder \"" . $tvshow->folder_name . "\" was kept\033[0m\n";
        } else {
            echo "\033[32mTvshow folder was not found in storage\033[0m\n";
        }
        
        return true;
    }

    /**
     * Fetch an episode from TMDB API
     * 
     * @param int $tvshowId
     * @param int $seasonNumber
     * @param int $episodeNumber
     * @return array
     */
    private static function fetchEpisode(int $tvshowId, int $seasonNumber, int $episodeNumber): array
    {
        self::initializeProps();
        $response = Http::get(
            self::$baseUrl . '/tv/' . $tvshowId . '/season/' . $seasonNumber . '/episode/' . $episodeNumber . '?' . self::$apiKey . '&append_to_response=credits'
        );

        return $response->json() ?? [];
    }

    /**
     * Fetch a season from TMDB API
     *
     * @param int $tvshowId
     * @param int $seasonNumber
     * @return array
     */
    private static function fetchSeason(int $tvshowId, int $seasonNumber): array
    {
        self::initializeProps();
        $response = Http::get(
            self::$baseUrl . '/tv/' . $tvshowId . '/season/' . $seasonNumber . '?' . self::$apiKey
        );

        return $response->json() ?? [];
    }

    /**
     * Fetch additional tvshow data from TMDB API
     *
     * @param int $tvshowId
     * @return array
     */
    private static function fetchAdditionalTvshowData(int $tvshowId): array
    {
        self::initializeProps();
        $response = Http::get(
            self::$baseUrl . '/tv/' . $tvshowId . '?' . self::$apiKey . '&append_to_response=cast,videos,images'
        );

        return $response->json() ?? [];
    }

    /**
     * Fetch a tvshow cast from TMDB API
     *
     * @param int $tmdbTvshowId
     * @return array
     */
    private static function getTvshowCast(int $tmdbTvshowId): array
    {
        self::initializeProps();
        $response = Http::get(
            self::$baseUrl . '/tv/' . $tmdbTvshowId . '/credits?' . self::$apiKey
        );

        return $response->json() ?? [];
    }

    /**
     * Fetch a tvshow from TMDB API
     *
     * @param string $name
     * @param int $releaseYear
     * @return array
     */
    private static function fetchTvshow(string $name, int $releaseYear): array
    {
        self::initializeProps();
        $response = Http::get(
            self::$baseUrl . '/search/tv?' . self::$apiKey . '&query=' . urlencode($name)
        );
        $results = $response->json() ?? [];
        $res = $results['results'] ?? [];
        foreach ($res as $result) {
            if (substr($result['first_air_date'] ?? '', 0, 4) === (string) $releaseYear) {
                return $result;
            }
        }

        return [];
    }

    /**
     * Create a json metadata file in a tvshow root directory
     * 
     * @param string $directory
     * @param int $releaseYear
     * @param int $selectedLogo
     * @return bool
     */
    public static function createJsonMetadataFileInTvshowDirectory(string $directory, int $releaseYear = 0, int $selectedLogo = 0): bool
    {
        Storage::disk('tvshows')->put($directory . '/metadata.json', json_encode([
            'name' => $directory,
            'releaseYear' => $releaseYear,
            'selected_logo' => $selectedLogo,
        ]));
        return true;
    }

    /**
     * Update a json metadata file in a tvshow root directory
     * 
     * @param string $directory
     * @param int $releaseYear
     * @param int $selectedLogo
     * @return bool
     */
    public static function updateJsonMetadataTvshowFile(string $directory, int $releaseYear = 0, int $selectedLogo = 0): bool
    {
        // check if metadata.json file exists
        if (!Storage::disk('tvshows')->exists($directory . '/metadata.json')) {
            return false;
        }

        // update metadata.json file
        $tvshowsDisk = Storage::disk('tvshows');
        $metadata = json_decode($tvshowsDisk->get($directory . '/metadata.json'), true);
        $metadata['releaseYear'] = $releaseYear;
        $metadata['selected_logo'] = $selectedLogo;
        $tvshowsDisk->put($directory . '/metadata.json', json_encode($metadata));
        return true;
    }

    /**
     * Get a tvshow by name
     * 
     * @param string $name
     * @return Tvshow|null
     */
    public static function getTvshowByName(string $name): Tvshow|null
    {
        return Tvshow::where('name', 'like', '%' . $name . '%')->first();
    }

    /**
     * Get all images from a tvshow.
     * Category can be 'logos', 'posters' or 'backdrops'.
     * 
     * @param Tvshow $tvshow
     * @param string $category
     * @return array
     */
    public static function getTvshowImages(Tvshow $tvshow, string $category = 'logos'): array
    {
        // check if $category is 'logos', 'posters' or 'backdrops' only
        if ($category !== 'logos' && $category !== 'posters' && $category !== 'backdrops') {
            throw new \Exception('Invalid category of images. It can be only "logos", "posters" or "backdrops"');
        }
        
        if (empty($tvshow->images)) {
            return [];
        }
        return $tvshow->images[$category];
    }

    /**
     * Get a random backdrop URL from a tvshow.
     * Collection can be 'logos', 'posters' or 'backdrops'.
     * Resolution can be '92', '185', '300', '500', '780' or 'ORIGINAL'.
     * 
     * @param Tvshow $tvshow
     * @param string $collection
     * @param string $resolution
     * @param string $placeholder
     * @return string
     */
    public static function getRandomTvshowImages(Tvshow $tvshow, string $collection = 'backdrops', string $resolution = 'ORIGINAL', string $placeholder = 'https://images4.alphacoders.com/594/thumb-1920-594600.jpg'): string
    {
        $item = Tool::getRandomItem(self::getTvshowImages($tvshow, $collection));
        if (!$item) {
            return $placeholder;
        }
        return env('TMDB_IMAGE_BASE_URL_' . $resolution) . $item['file_path'];
    }

    /**
     * Change the selected logo of a tvshow up
     * 
     * @param Tvshow $tvshow
     * @return bool
     */
    public static function changeSelectedLogoUp(Tvshow $tvshow): bool
    {
        $tvshow->selected_logo++;
        $tvshow->save();
        return true;
    }

    /**
     * Change the selected logo of a tvshow down
     * 
     * @param Tvshow $tvshow
     * @return bool
     */
    public static function changeSelectedLogoDown(Tvshow $tvshow): bool
    {
        $tvshow->selected_logo--;
        $tvshow->save();
        return true;
    }

    /**
     * Returns all genres with appended slugs
     * 
     * @param Tvshow $tvshow
     * @return array
     */
    public static function genresWithSlugs(Tvshow $tvshow): array
    {
        $tvshow->genres = array_map(function ($genre) {
            $genre['slug'] = Str::slug($genre['name']);
            return $genre;
        }, $tvshow->genres);
        return $tvshow->genres;
    }

    /**
     * Get all tvshow credits (unique cast, crew and guest stars)
     * 
     * @param Tvshow $tvshow
     * @param bool $withCast
     * @param bool $withCrew
     * @param bool $withGuestStars
     * @return array
     */
    public static function getTvshowCredits(Tvshow $tvshow, bool $withCast = true, bool $withCrew = false, bool $withGuestStars = true): array
    {
        // make unique cast, crew and guest stars lists for tvshow
        $episodes = collect($tvshow->episodes);
        $cast = $withCast ? collect($episodes->pluck('credits.cast')->flatten(1))->unique('id')->toArray() : [];
        $crew = $withCrew ? collect($episodes->pluck('credits.crew')->flatten(1))->unique('id')->toArray() : [];
        $guestStars = $withGuestStars ? collect($episodes->pluck('credits.guest_stars')->flatten(1))->unique('id')->toArray() : [];
        
        // Filter out null values
        $cast = array_filter($cast, function($item) { return !is_null($item); });
        $crew = array_filter($crew, function($item) { return !is_null($item); });
        $guestStars = array_filter($guestStars, function($item) { return !is_null($item); });
        
        // append profilePathUrl to each credit or fallback to default image
        if ($withCast) {
            $cast = array_map(function ($credit) {
                if (!is_null($credit)) {
                    $credit['profilePathUrl'] = isset($credit['profile_path']) && $credit['profile_path'] 
                        ? env('TMDB_IMAGE_BASE_URL_92') . $credit['profile_path'] 
                        : env('DEFAULT_CREDIT_IMAGE_URL');
                }
                return $credit;
            }, $cast);
        }
        if ($withCrew) {
            $crew = array_map(function ($credit) {
                if (!is_null($credit)) {
                    $credit['profilePathUrl'] = isset($credit['profile_path']) && $credit['profile_path'] 
                        ? env('TMDB_IMAGE_BASE_URL_92') . $credit['profile_path'] 
                        : env('DEFAULT_CREDIT_IMAGE_URL');
                }
                return $credit;
            }, $crew);
        }
        if ($withGuestStars) {
            $guestStars = array_map(function ($credit) {
                if (!is_null($credit)) {
                    $credit['profilePathUrl'] = isset($credit['profile_path']) && $credit['profile_path'] 
                        ? env('TMDB_IMAGE_BASE_URL_92') . $credit['profile_path'] 
                        : env('DEFAULT_CREDIT_IMAGE_URL');
                }
                return $credit;
            }, $guestStars);
        }

        // order $crew list placing "production" department at the top of the list
        $crew = array_filter($crew, function ($credit) {
            return !is_null($credit) && isset($credit['department']) && strtolower($credit['department']) === 'production';
        });
        $crew = array_merge($crew, array_filter($crew, function ($credit) {
            return !is_null($credit) && isset($credit['department']) && strtolower($credit['department']) !== 'production';
        }));

        return [
            'cast' => $cast,
            'crew' => $crew,
            'guestStars' => $guestStars,
        ];
    }

    public static function metadataPath(string $folder): string
    {
        return $folder . '/metadata.json';
    }

    public static function hasNumericEpisodePrefix(string $basename): bool
    {
        $parts = explode('.', $basename);

        return count($parts) > 1 && is_numeric($parts[0]);
    }

    /**
     * Parse an episode number from a video filename.
     * Prefers SxxEyy / NxNN / bare Exx patterns; returns null when unresolved.
     */
    public static function parseEpisodeNumberFromFilename(string $basename, ?int $seasonNumber = null): ?int
    {
        if (self::hasNumericEpisodePrefix($basename)) {
            return (int) explode('.', $basename)[0];
        }

        if (preg_match('/S(\d{1,2})E(\d{1,3})/i', $basename, $matches)) {
            if ($seasonNumber === null || (int) $matches[1] === $seasonNumber) {
                return (int) $matches[2];
            }
        }

        if (preg_match('/(?:^|[^\d])(\d{1,2})x(\d{1,3})(?:[^\d]|$)/i', $basename, $matches)) {
            if ($seasonNumber === null || (int) $matches[1] === $seasonNumber) {
                return (int) $matches[2];
            }
        }

        if ($seasonNumber !== null && preg_match('/(?:^|[^A-Za-z0-9])E(\d{1,3})(?:[^A-Za-z0-9]|$)/i', $basename, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    /**
     * Rename episode files under a show folder to `{episodeNumber}.{originalBasename}`.
     *
     * @return array<int, array{from: string, to: string}>
     */
    public static function normalizeEpisodeFilenames(string $folder, string $disk = 'tvshows'): array
    {
        $storage = Storage::disk($disk);
        $renames = [];

        if (!$storage->exists($folder)) {
            return $renames;
        }

        foreach ($storage->directories($folder) as $seasonPath) {
            $seasonName = basename($seasonPath);
            if (!is_numeric($seasonName)) {
                continue;
            }

            $seasonNumber = (int) $seasonName;
            $files = array_values(array_filter(
                $storage->files($seasonPath),
                fn (string $file) => (bool) preg_match('/\.(mp4|ogg|webm)$/i', $file)
            ));
            natsort($files);
            $files = array_values($files);

            $assignments = [];
            $usedNumbers = [];

            foreach ($files as $file) {
                $basename = basename($file);
                if (self::hasNumericEpisodePrefix($basename)) {
                    $num = (int) explode('.', $basename)[0];
                    $assignments[$file] = $num;
                    $usedNumbers[$num] = true;
                    continue;
                }

                $parsed = self::parseEpisodeNumberFromFilename($basename, $seasonNumber);
                if ($parsed !== null) {
                    $assignments[$file] = $parsed;
                    $usedNumbers[$parsed] = true;
                }
            }

            $next = 1;
            foreach ($files as $file) {
                if (isset($assignments[$file])) {
                    continue;
                }
                while (isset($usedNumbers[$next])) {
                    $next++;
                }
                $assignments[$file] = $next;
                $usedNumbers[$next] = true;
                $next++;
            }

            foreach ($assignments as $file => $episodeNumber) {
                $basename = basename($file);
                if (self::hasNumericEpisodePrefix($basename)) {
                    continue;
                }

                $newPath = $seasonPath . '/' . $episodeNumber . '.' . $basename;
                if ($file === $newPath || $storage->exists($newPath)) {
                    continue;
                }

                $storage->move($file, $newPath);
                $renames[] = ['from' => $file, 'to' => $newPath];
            }
        }

        return $renames;
    }

    public static function parseTitleFromFolderName(string $folder): string
    {
        $title = preg_replace('/\s*\(\d{4}\)\s*$/', '', $folder);

        return trim($title ?: $folder);
    }

    public static function parseReleaseYearFromFolderName(string $folder): ?int
    {
        if (preg_match('/\((\d{4})\)\s*$/', $folder, $matches)) {
            return (int) $matches[1];
        }

        return null;
    }

    public static function suggestReleaseYear(string $folderName, bool $useOpenAi = false): array
    {
        $parsed = self::parseReleaseYearFromFolderName($folderName);
        $openai = null;

        if ($useOpenAi) {
            $year = self::getTvshowReleaseYearFromOpenAI(self::parseTitleFromFolderName($folderName));
            $openai = $year > 0 ? $year : null;
        }

        return [
            'parsed' => $parsed,
            'openai' => $openai,
            'suggested' => $parsed ?? $openai,
        ];
    }

    public static function searchTmdbTvshows(string $name, ?int $year = null): array
    {
        self::initializeProps();
        $url = self::$baseUrl . '/search/tv?' . self::$apiKey . '&query=' . urlencode(strtolower(trim($name)));
        if ($year) {
            $url .= '&first_air_date_year=' . $year;
        }

        $response = Http::get($url);
        $results = $response->json()['results'] ?? [];

        return collect($results)->values()->map(function ($result, int $index) {
            return [
                'pick' => $index,
                'id' => $result['id'],
                'title' => $result['name'] ?? $result['original_name'] ?? '',
                'original_title' => $result['original_name'] ?? null,
                'release_date' => $result['first_air_date'] ?? null,
                'overview' => Str::limit($result['overview'] ?? '', 200),
                'poster_url' => !empty($result['poster_path'])
                    ? env('TMDB_IMAGE_BASE_URL_300') . $result['poster_path']
                    : null,
                'vote_average' => $result['vote_average'] ?? null,
            ];
        })->all();
    }

    public static function createMetadataJson(string $folder, array $data, string $disk = 'tvshows'): void
    {
        $metadata = [
            'name' => $data['name'],
            'release_year' => (int) $data['release_year'],
            'releaseYear' => (int) $data['release_year'],
            'pick' => (int) ($data['pick'] ?? 0),
            'dir' => $folder,
            'id' => (int) $data['id'],
            'selected_logo' => (int) ($data['selected_logo'] ?? 0),
        ];

        Storage::disk($disk)->put(
            self::metadataPath($folder),
            json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );
    }

    public static function readMetadataJson(string $folder, string $disk = 'tvshows'): ?array
    {
        $path = self::metadataPath($folder);
        if (!Storage::disk($disk)->exists($path)) {
            return null;
        }

        $metadata = json_decode(Storage::disk($disk)->get($path), true);
        if (!is_array($metadata)) {
            return null;
        }

        if (!isset($metadata['release_year']) && isset($metadata['releaseYear'])) {
            $metadata['release_year'] = (int) $metadata['releaseYear'];
        }

        return $metadata;
    }

    public static function folderHasSeasonVideos(string $folder, string $disk = 'tvshows'): bool
    {
        $storage = Storage::disk($disk);

        foreach ($storage->directories($folder) as $seasonPath) {
            if (!is_numeric(basename($seasonPath))) {
                continue;
            }

            foreach ($storage->files($seasonPath) as $file) {
                if (preg_match('/\.(mp4|ogg|webm)$/i', $file)) {
                    return true;
                }
            }
        }

        return false;
    }

    /**
     * @return array{season_count: int, episode_file_count: int, needs_numbering: bool, sample_episode: string|null}
     */
    public static function summarizeShowFolder(string $folder, string $disk = 'tvshows'): array
    {
        $storage = Storage::disk($disk);
        $seasonCount = 0;
        $episodeFileCount = 0;
        $needsNumbering = false;
        $sampleEpisode = null;

        foreach ($storage->directories($folder) as $seasonPath) {
            if (!is_numeric(basename($seasonPath))) {
                continue;
            }

            $seasonCount++;
            foreach ($storage->files($seasonPath) as $file) {
                if (!preg_match('/\.(mp4|ogg|webm)$/i', $file)) {
                    continue;
                }

                $episodeFileCount++;
                $basename = basename($file);
                if ($sampleEpisode === null) {
                    $sampleEpisode = $basename;
                }
                if (!self::hasNumericEpisodePrefix($basename)) {
                    $needsNumbering = true;
                }
            }
        }

        return [
            'season_count' => $seasonCount,
            'episode_file_count' => $episodeFileCount,
            'needs_numbering' => $needsNumbering,
            'sample_episode' => $sampleEpisode,
        ];
    }

    public static function isFolderImported(string $folder): bool
    {
        return Tvshow::where('folder_name', $folder)->exists();
    }

    public static function scanPendingTvshowFolders(string $disk = 'tvshows'): array
    {
        $storage = Storage::disk($disk);
        $pending = [];
        $ready = [];

        foreach ($storage->directories() as $folder) {
            if (!self::folderHasSeasonVideos($folder, $disk)) {
                continue;
            }

            if (self::isFolderImported($folder)) {
                continue;
            }

            $summary = self::summarizeShowFolder($folder, $disk);
            $base = [
                'folder' => $folder,
                'suggested_title' => self::parseTitleFromFolderName($folder),
                'parsed_release_year' => self::parseReleaseYearFromFolderName($folder),
                'season_count' => $summary['season_count'],
                'episode_file_count' => $summary['episode_file_count'],
                'needs_numbering' => $summary['needs_numbering'],
                'sample_episode' => $summary['sample_episode'],
            ];

            $metadata = self::readMetadataJson($folder, $disk);
            if (!$metadata || empty($metadata['id'])) {
                $pending[] = $base;
                continue;
            }

            if (Tvshow::where('tmdb_id', $metadata['id'])->exists()) {
                continue;
            }

            $ready[] = array_merge($base, ['metadata' => $metadata]);
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

    /**
     * Import a single TV show folder: normalize episode filenames, create full TMDB catalog, link storage.
     */
    public static function importTvshowFolder(string $folder, string $disk = 'tvshows'): Tvshow
    {
        self::initializeProps();

        $metadata = self::readMetadataJson($folder, $disk);
        if (!$metadata) {
            throw new Exception("metadata.json not found in folder: {$folder}");
        }

        $metadata['dir'] = $folder;
        if (!isset($metadata['release_year']) && isset($metadata['releaseYear'])) {
            $metadata['release_year'] = (int) $metadata['releaseYear'];
        }

        Storage::disk($disk)->put(
            self::metadataPath($folder),
            json_encode($metadata, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE)
        );

        self::normalizeEpisodeFilenames($folder, $disk);

        if ($existing = Tvshow::where('folder_name', $folder)->first()) {
            EpisodeService::checkIfAllEpisodesAndSubtitlesAreInStorageAndUpdateDb($disk, $existing->id);
            EpisodeService::checkForAdditionalLanguageVideoFilesOnEachSeasonFolderAndStoreInDb($disk, $existing->id);

            return $existing->fresh();
        }

        $tmdbId = !empty($metadata['id']) ? (int) $metadata['id'] : null;
        if (!$tmdbId) {
            $releaseYear = (int) ($metadata['release_year'] ?? $metadata['releaseYear'] ?? 0);
            $found = self::fetchTvshow($metadata['name'] ?? $folder, $releaseYear);
            if (empty($found['id'])) {
                throw new Exception('TV show not found in TMDB: ' . ($metadata['name'] ?? $folder));
            }
            $tmdbId = (int) $found['id'];
        }

        if ($existingByTmdb = Tvshow::where('tmdb_id', $tmdbId)->first()) {
            $existingByTmdb->folder_name = $folder;
            $existingByTmdb->save();
            EpisodeService::checkIfAllEpisodesAndSubtitlesAreInStorageAndUpdateDb($disk, $existingByTmdb->id);
            EpisodeService::checkForAdditionalLanguageVideoFilesOnEachSeasonFolderAndStoreInDb($disk, $existingByTmdb->id);

            return $existingByTmdb->fresh();
        }

        $additionalTvshowData = self::fetchAdditionalTvshowData($tmdbId);
        if (empty($additionalTvshowData['id'])) {
            throw new Exception('TV show not found in TMDB for id: ' . $tmdbId);
        }

        $tvshowCast = self::getTvshowCast($tmdbId);

        $slug = Str::slug($additionalTvshowData['name']);
        $slugCounter = 1;
        while (Tvshow::where('slug', $slug)->exists()) {
            $slug = Str::slug($additionalTvshowData['name'] . '-' . $slugCounter);
            $slugCounter++;
        }

        $tvshow = Tvshow::create([
            'tmdb_id' => $additionalTvshowData['id'],
            'name' => $additionalTvshowData['name'],
            'folder_name' => $folder,
            'slug' => $slug,
            'original_name' => $additionalTvshowData['original_name'] ?? $additionalTvshowData['name'],
            'poster_path' => $additionalTvshowData['poster_path'] ?? null,
            'backdrop_path' => $additionalTvshowData['backdrop_path'] ?? null,
            'original_language' => $additionalTvshowData['original_language'] ?? null,
            'overview' => $additionalTvshowData['overview'] ?? null,
            'popularity' => $additionalTvshowData['popularity'] ?? null,
            'first_air_date' => $additionalTvshowData['first_air_date'] ?? null,
            'vote_average' => $additionalTvshowData['vote_average'] ?? null,
            'vote_count' => $additionalTvshowData['vote_count'] ?? null,
            'created_by' => $additionalTvshowData['created_by'] ?? [],
            'cast' => $tvshowCast['cast'] ?? [],
            'homepage' => $additionalTvshowData['homepage'] ?? null,
            'languages' => $additionalTvshowData['languages'] ?? [],
            'networks' => $additionalTvshowData['networks'] ?? [],
            'number_of_episodes' => $additionalTvshowData['number_of_episodes'] ?? 0,
            'number_of_seasons' => $additionalTvshowData['number_of_seasons'] ?? 0,
            'origin_country' => $additionalTvshowData['origin_country'] ?? [],
            'production_companies' => $additionalTvshowData['production_companies'] ?? [],
            'production_countries' => $additionalTvshowData['production_countries'] ?? [],
            'available_seasons' => $additionalTvshowData['seasons'] ?? [],
            'spoken_languages' => $additionalTvshowData['spoken_languages'] ?? [],
            'status' => $additionalTvshowData['status'] ?? null,
            'tagline' => $additionalTvshowData['tagline'] ?? null,
            'type' => $additionalTvshowData['type'] ?? null,
            'videos' => $additionalTvshowData['videos'] ?? [],
            'images' => $additionalTvshowData['images'] ?? [],
            'selected_logo' => $metadata['selected_logo'] ?? 0,
            'genres' => $additionalTvshowData['genres'] ?? [],
        ]);

        $numberOfSeasons = (int) ($additionalTvshowData['number_of_seasons'] ?? 0);
        for ($season = 1; $season <= $numberOfSeasons; $season++) {
            $seasonData = self::fetchSeason($tmdbId, $season);
            if (empty($seasonData['id'])) {
                continue;
            }

            $episodeCount = count($seasonData['episodes'] ?? []);
            $importedSeason = Season::create([
                'tmdb_id' => $seasonData['id'],
                'tvshow_id' => $tvshow->id,
                'name' => $seasonData['name'] ?? ('Season ' . $season),
                'overview' => $seasonData['overview'] ?? null,
                'poster_path' => $seasonData['poster_path'] ?? null,
                'air_date' => $seasonData['air_date'] ?? null,
                'episode_count' => $episodeCount,
                'season_number' => $seasonData['season_number'] ?? $season,
                'vote_average' => $seasonData['vote_average'] ?? null,
            ]);

            $seasonNumber = (int) ($seasonData['season_number'] ?? $season);
            for ($episodeNumber = 1; $episodeNumber <= $episodeCount; $episodeNumber++) {
                $episodeData = self::fetchEpisode($tmdbId, $seasonNumber, $episodeNumber);
                if (empty($episodeData['id'])) {
                    continue;
                }

                Episode::create([
                    'tmdb_id' => $episodeData['id'],
                    'season_id' => $importedSeason->id,
                    'name' => $episodeData['name'] ?? ('Episode ' . $episodeNumber),
                    'overview' => $episodeData['overview'] ?? null,
                    'air_date' => $episodeData['air_date'] ?? null,
                    'episode_number' => $episodeData['episode_number'] ?? $episodeNumber,
                    'production_code' => $episodeData['production_code'] ?? null,
                    'runtime' => $episodeData['runtime'] ?? null,
                    'season_number' => $episodeData['season_number'] ?? $seasonNumber,
                    'still_path' => $episodeData['still_path'] ?? null,
                    'vote_average' => $episodeData['vote_average'] ?? null,
                    'vote_count' => $episodeData['vote_count'] ?? null,
                    'credits' => $episodeData['credits'] ?? [],
                ]);
            }
        }

        EpisodeService::checkIfAllEpisodesAndSubtitlesAreInStorageAndUpdateDb($disk, $tvshow->id);
        EpisodeService::checkForAdditionalLanguageVideoFilesOnEachSeasonFolderAndStoreInDb($disk, $tvshow->id);

        return $tvshow->fresh();
    }

    public static function importTvshowFolders(array $folders, string $disk = 'tvshows'): array
    {
        $results = [];

        foreach ($folders as $folder) {
            try {
                $tvshow = self::importTvshowFolder($folder, $disk);
                $results[] = [
                    'folder' => $folder,
                    'success' => true,
                    'tvshow_id' => $tvshow->id,
                    'slug' => $tvshow->slug,
                    'title' => $tvshow->name,
                ];
            } catch (\Throwable $e) {
                info('TV show import failed for ' . $folder . ': ' . $e->getMessage());
                $results[] = [
                    'folder' => $folder,
                    'success' => false,
                    'error' => $e->getMessage(),
                ];
            }
        }

        return $results;
    }

    /**
     * Set the episode number in the file name of a tvshow episode
     * according to naming convention: "episodeNumber.fileName.mp4".
     * Finds all episodes in all extra season folders (like EN, ES, etc.) 
     * and renames them according to the naming convention.
     * 
     * @param Tvshow $tvshow
     * @param string $disk
     * @return bool
     */
    public static function setEpisodeNumberInStorageFilePaths(Tvshow $tvshow, string $disk = 'tvshows'): bool
    {
        $tvshowDisk = Storage::disk($disk);
        $seasons = $tvshowDisk->directories($tvshow->folder_name);
        $filesToRename = []; // Track both source and destination paths
        
        // enter each season folder and search for additional folders named ES, EN, or similar
        foreach ($seasons as $season) {
            $extraFolders = $tvshowDisk->directories($season);
            if (count($extraFolders)) {
                // found extra audio folders (like EN, ES, etc.) for other languages in season's episodes
                foreach ($extraFolders as $extraFolder) {
                    $counter = 1;
                    $episodes = $tvshowDisk->files($extraFolder);
                    natsort($episodes);
                    foreach ($episodes as $episode) {
                        $newEpisodePath = preg_replace_callback(
                            '/\/([^\/]+)\.mp4$/i',
                            function ($matches) use ($counter) {
                                // Check if filename already starts with "<number>."
                                if (preg_match('/^\d+\./', $matches[1])) {
                                    return '/' . $matches[1] . '.mp4'; // No change
                                }
                    
                                return '/' . $counter . '.' . $matches[1] . '.mp4'; // Rename
                            },
                            $episode
                        );
                        
                        if ($episode !== $newEpisodePath) {
                            $filesToRename[] = [
                                'source' => $episode,
                                'destination' => $newEpisodePath
                            ];
                        }
                        $counter++;
                    }
                }
            }
        }
        
        // rename episodes
        $renamedCount = 0;
        foreach ($filesToRename as $file) {
            try {
                $tvshowDisk->move($file['source'], $file['destination']);
                $renamedCount++;
            } catch (\Exception $e) {
                echo "Error renaming file {$file['source']} to {$file['destination']}: {$e->getMessage()}\n";
            }
        }

        // report and list changes
        echo "Updated {$renamedCount} episodes\n";
        foreach ($filesToRename as $file) {
            echo "Renamed: {$file['source']} → {$file['destination']}\n";
        }

        return true;
    }
}
