<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Season;
use App\Models\Tvshow;
use App\Services\Tool;
use Exception;
use GuzzleHttp\Client;
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

                    // create tvshow local model
                    echo "Creating TV show record in database...\n";
                    // verify unique slug
                    $slug = Str::slug($fetchTvshow['name']);
                    $counter = 1;
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

                        'created_by' => json_encode($additionalTvshowData['created_by']),
                        'homepage' => $additionalTvshowData['homepage'],
                        'languages' => json_encode($additionalTvshowData['languages']),
                        'networks' => json_encode($additionalTvshowData['networks']),
                        'number_of_episodes' => $additionalTvshowData['number_of_episodes'],
                        'number_of_seasons' => $additionalTvshowData['number_of_seasons'],
                        'origin_country' => json_encode($additionalTvshowData['origin_country']),
                        'production_companies' => json_encode($additionalTvshowData['production_companies']),
                        'production_countries' => json_encode($additionalTvshowData['production_countries']),
                        'available_seasons' => json_encode($additionalTvshowData['seasons']),
                        'spoken_languages' => json_encode($additionalTvshowData['spoken_languages']),
                        'status' => $additionalTvshowData['status'],
                        'tagline' => $additionalTvshowData['tagline'],
                        'type' => $additionalTvshowData['type'],
                        'videos' => json_encode($additionalTvshowData['videos']),
                        'images' => json_encode($additionalTvshowData['images']),
                        'selected_logo' => $folderMetadata['selected_logo'] ?? 0,
                        'genres' => json_encode($additionalTvshowData['genres']),
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
                        echo "  Starting import of {$episodeCount} episodes for season {$season} for '{$tvshow->name}'...\n";
                        for ($episodeNumber = 1; $episodeNumber <= $episodeCount; $episodeNumber++) {
                            echo "    Fetching S{$season}E{$episodeNumber} data for '{$tvshow->name}'...\r";
                            $episodeData = self::fetchEpisode($fetchTvshow['id'], $seasonData['season_number'], $episodeNumber);
                            $importedEpisode = Episode::create([
                                'tmdb_id' => $episodeData['id'],
                                'season_id' => $lastSeasonId,
                                'name' => $episodeData['name'],
                                'overview' => $episodeData['overview'],
                                'air_date' => $episodeData['air_date'],
                                'crew' => json_encode($episodeData['crew']),
                                'guest_stars' => json_encode($episodeData['guest_stars']),
                                'episode_number' => $episodeData['episode_number'],
                                'production_code' => $episodeData['production_code'],
                                'runtime' => $episodeData['runtime'],
                                'season_number' => $episodeData['season_number'],
                                'still_path' => $episodeData['still_path'],
                                'vote_average' => $episodeData['vote_average'],
                                'vote_count' => $episodeData['vote_count'],
                                'credits' => json_encode($episodeData['credits']),
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
                }
                
                $counter++;
                echo "------------------------\n";
            }

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

        // create folder
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
        $prompt = env('OPENAI_RELEASE_YEAR_PROMPT');
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
            $json = json_decode($content, true);
            echo "OpenAI responded with release year: {$json['releaseYear']}\n";
            return (int)$json['releaseYear'];
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
     * Folders and files in storage are not deleted
     * 
     * @param Tvshow $tvshow
     * @return bool
     */
    public static function removeTvshow(Tvshow $tvshow): bool
    {
        $tvshow->delete(); // cascade deletes all seasons and episodes
        echo "\033[32mFolders and files in \"" . $tvshow->folder_name . "\" were kept\033[0m\n";
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
        $client = new Client();
        $response = $client->request('GET', self::$baseUrl . '/tv/' . $tvshowId . '/season/' . $seasonNumber . '/episode/' . $episodeNumber . '?' . self::$apiKey . '&append_to_response=credits');
        return json_decode($response->getBody(), true);
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
        $client = new Client();
        $response = $client->request('GET', self::$baseUrl . '/tv/' . $tvshowId . '/season/' . $seasonNumber . '?' . self::$apiKey);
        return json_decode($response->getBody(), true);
    }

    /**
     * Fetch additional tvshow data from TMDB API
     * 
     * @param int $tvshowId
     * @return array
     */
    private static function fetchAdditionalTvshowData(int $tvshowId): array
    {
        $client = new Client();
        $response = $client->request('GET', self::$baseUrl . '/tv/' . $tvshowId . '?' . self::$apiKey . '&append_to_response=cast,videos,images');
        return json_decode($response->getBody(), true);
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
        $client = new Client();
        $response = $client->request('GET', self::$baseUrl . '/search/tv?' . self::$apiKey . '&query=' . $name);
        $results = json_decode($response->getBody(), true);
        $res = $results['results'];
        foreach ($res as $result) {
            if (substr($result['first_air_date'], 0, 4) === (string)$releaseYear) {
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
        return json_decode($tvshow->images, true)[$category];
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
}
