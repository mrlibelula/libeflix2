<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Season;
use App\Models\Tvshow;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Storage;


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
     * Import all tvshows from the storage folder via TMDB API
     * Must be executed only in terminal
     * 
     * @return bool
     */
    public static function importAll(): bool
    {
        // check if user is executing script in terminal only
        if (php_sapi_name() !== 'cli') {
            echo "This script must be executed in the terminal\n";
            return false;
        }
        
        $startTime = microtime(true);
        
        echo "Starting TV show import process...\n";
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
                echo "TV show '{$tvshowFolder}' already exists in database. Skipping.\n";
                $counter++;
                continue;
            }
            
            echo "Reading metadata for '{$tvshowFolder}'...\n";
            $folderMetadata = json_decode($storage->get($tvshowFolder . '/metadata.json'), true);
            
            echo "Fetching TV show data from TMDB API for '{$folderMetadata['name']}' ({$folderMetadata['releaseYear']})...\n";
            $fetchTvshow = self::fetchTvshow($folderMetadata['name'], $folderMetadata['releaseYear']);
            
            if ($fetchTvshow) {
                echo "Found TV show on TMDB: '{$fetchTvshow['name']}' (ID: {$fetchTvshow['id']})\n";
                
                // import additional tvshow data from tmdb
                echo "Fetching additional TV show details from TMDB...\n";
                $additionalTvshowData = self::fetchAdditionalTvshowData($fetchTvshow['id']);
                echo "Retrieved additional data: {$additionalTvshowData['number_of_seasons']} seasons, {$additionalTvshowData['number_of_episodes']} episodes\n";

                // create tvshow local model
                echo "Creating TV show record in database...\n";
                $tvshow = Tvshow::create([
                    'tmdb_id' => $fetchTvshow['id'],
                    'name' => $fetchTvshow['name'],
                    'folder_name' => $tvshowFolder,
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
                    'availableSeasons' => json_encode($additionalTvshowData['seasons']),
                    'spoken_languages' => json_encode($additionalTvshowData['spoken_languages']),
                    'status' => $additionalTvshowData['status'],
                    'tagline' => $additionalTvshowData['tagline'],
                    'type' => $additionalTvshowData['type'],
                    'videos' => json_encode($additionalTvshowData['videos']),
                    'images' => json_encode($additionalTvshowData['images']),
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
                echo "Could not find TV show '{$folderMetadata['name']}' ({$folderMetadata['releaseYear']}) on TMDB. Skipping.\n";
            }
            
            $counter++;
            echo "------------------------\n";
        }

        $endTime = microtime(true);
        $executionTime = $endTime - $startTime;
        
        $hours = floor($executionTime / 3600);
        $minutes = floor(($executionTime % 3600) / 60);
        $seconds = $executionTime % 60;
        
        echo "Import process completed!\n";
        echo "Summary: Imported " . count($importedTvshows) . "/" . count($storageTvshows) . " TV shows\n";
        echo "         Created " . count($importedSeasons) . " seasons\n";
        echo "         Created " . count($importedEpisodes) . " episodes\n";
        echo "Execution time: " . sprintf('%02d:%02d:%02d', $hours, $minutes, round($seconds)) . " (H:M:S)\n";
        
        return true;
    }

    /**
     * Fetch a episode from TMDB API
     * 
     * @param int $tvshowId
     * @param int $seasonNumber
     * @param int $episodeNumber
     * @return array
     */
    public static function fetchEpisode(int $tvshowId, int $seasonNumber, int $episodeNumber): array
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
    public static function fetchSeason(int $tvshowId, int $seasonNumber): array
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
    public static function fetchAdditionalTvshowData(int $tvshowId): array
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
    public static function fetchTvshow(string $name, int $releaseYear): array
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
     * Create a json metadata file in each tvshow directory
     * Run in terminal only
     * 
     * @return bool
     */
    public static function createJsonMetadataFilesInTvshowDirectories(): bool
    {
        return true;    // already created all metadata.json files

        // check if user is in terminal only
        if (php_sapi_name() !== 'cli') {
            echo "This script must be executed in the terminal\n";
            return false;
        }
        $storageTvshows = Storage::disk('tvshows')->directories();
        foreach ($storageTvshows as $tvshowFolder) {
            Storage::disk('tvshows')->put($tvshowFolder . '/metadata.json', json_encode([
                'name' => $tvshowFolder,
                'releaseYear' => 0,
            ]));
        }
        echo "Created " . count($storageTvshows) . " metadata files in the tvshow directories\n";
        return true;
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
}
