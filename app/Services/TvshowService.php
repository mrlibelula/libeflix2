<?php

namespace App\Services;

use App\Models\Tvshow;
use GuzzleHttp\Client;
use Illuminate\Support\Facades\Storage;


class TvshowService
{
    // public static function createJsonMetadataFilesInTvshowDirectories(): bool
    // {
    //     $storageTvshows = Storage::disk('tvshows')->directories();
    //     foreach ($storageTvshows as $tvshowFolder) {
    //         Storage::disk('tvshows')->put($tvshowFolder . '/metadata.json', json_encode([
    //             'name' => $tvshowFolder,
    //             'releaseYear' => 0,
    //         ]));
    //     }
    //     echo "Created " . count($storageTvshows) . " metadata files in the tvshow directories\n";
    //     return true;
    // }

    /**
     * Import all tvshows from the storage folder via TMDB API
     * 
     * @return array
     */
    public static function importAll()
    {
        $importedTvshows = [];
        $storage = Storage::disk('tvshows');
        $storageTvshows = $storage->directories();
        foreach ($storageTvshows as $tvshowFolder) {
            // check if tvshow exists before importing
            $dbTvshow = Tvshow::where('folder_name', 'like', '%' . $tvshowFolder . '%')->first();
            if ($dbTvshow) {
                continue;
            }
            $folderMetadata = json_decode($storage->get($tvshowFolder . '/metadata.json'), true);
            $fetchTvshow = self::fetchTvshow($folderMetadata['name'], $folderMetadata['releaseYear']);
            if ($fetchTvshow) {
                $importedTvshows[] = Tvshow::create([
                    'tmdb_id' => $fetchTvshow['id'],
                    'name' => $fetchTvshow['name'],
                    'folder_name' => $tvshowFolder,
                    'original_name' => $fetchTvshow['original_name'],
                    'genre_ids' => json_encode($fetchTvshow['genre_ids']),
                    'poster_path' => $fetchTvshow['poster_path'],
                    'backdrop_path' => $fetchTvshow['backdrop_path'],
                    'original_language' => $fetchTvshow['original_language'],
                    'overview' => $fetchTvshow['overview'],
                    'popularity' => $fetchTvshow['popularity'],
                    'first_air_date' => $fetchTvshow['first_air_date'],
                    'vote_average' => $fetchTvshow['vote_average'],
                    'vote_count' => $fetchTvshow['vote_count'],
                ]);
            }
        }
        echo "Imported " . count($importedTvshows) . " tvshows\n";
        return $importedTvshows;
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
        $response = $client->request('GET', 'https://api.themoviedb.org/3/search/tv?api_key=' . env('TMDB_API_KEY') . '&query=' . $name);
        $results = json_decode($response->getBody(), true);
        $res = $results['results'];
        foreach ($res as $result) {
            if (substr($result['first_air_date'], 0, 4) === (string)$releaseYear) {
                return $result;
            }
        }
        return [];
    }
}
