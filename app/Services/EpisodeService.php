<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Tvshow;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Log;

class EpisodeService
{
    /**
     * Check if all episodes are in storage
     * 
     * @param Tvshow $tvshow
     * @param string $fileExtensionToCheck
     * @param string $disk
     */
    public static function checkIfAllEpisodesAreInStorageAndUpdateDb(string $fileExtensionToCheck = 'mp4', string $disk = 'tvshows'): bool
    {
        // Start timing the execution
        $startTime = microtime(true);

        echo "Starting to check all episodes in storage...\n";
        
        // Load all required relationships with their proper columns
        $episodes = Episode::select('episodes.id', 'season_id', 'episode_number', 'is_in_storage')
            ->with(['season:id,season_number,tvshow_id', 'season.tvshow:id,folder_name'])
            ->get();
            
        echo "Found " . $episodes->count() . " episodes to check.\n";
        $foundCount = 0;
        $notFoundCount = 0;

        try {
            foreach ($episodes as $index => $episode) {
                echo "Processing episode " . ($index + 1) . "/" . $episodes->count() . " (ID: " . $episode->id . "): ";
                
                // Access tvshow through season relation
                if (!$episode->season) {
                    echo "SKIPPED - Season relation missing\n";
                    $notFoundCount++;
                    continue;
                }
                
                $tvshow = $episode->season->tvshow;
                if (!$tvshow) {
                    echo "SKIPPED - Tvshow relation missing for season ID " . $episode->season_id . "\n";
                    $notFoundCount++;
                    continue;
                }
                
                // Check if season number is valid
                if (!isset($episode->season->season_number) || is_null($episode->season->season_number) || $episode->season->season_number === '') {
                    // Check for the escaped quotes issue in the data
                    $seasonData = $episode->season->toArray();
                    if (isset($seasonData['"number"'])) {
                        $rawSeasonNumber = $seasonData['"number"'];
                        
                        // Check if the value is the string "number" and handle it properly
                        if ($rawSeasonNumber === "number") {
                            // Use the episode's numeric designation or a default
                            if (preg_match('/^S(\d+)E\d+$/', $episode->episode_number, $matches)) {
                                $seasonNumber = $matches[1]; // Extract the season number from episode number format S01E01
                                echo "S" . $seasonNumber . "E" . $episode->episode_number . " of \"" . $tvshow->folder_name . "\": ";
                            } else {
                                $seasonNumber = 1; // Default to season 1 if we can't determine it
                                echo "S" . $seasonNumber . "E" . $episode->episode_number . " of \"" . $tvshow->folder_name . "\" (default season): ";
                            }
                        } else {
                            // Try to convert to number if it's not "number"
                            $seasonNumber = is_numeric($rawSeasonNumber) ? intval($rawSeasonNumber) : 1;
                            echo "S" . $seasonNumber . "E" . $episode->episode_number . " of \"" . $tvshow->folder_name . "\": ";
                        }
                    } else {
                        echo "SKIPPED - Season number is null or empty\n";
                        $notFoundCount++;
                        continue;
                    }
                } else {
                    $seasonNumber = $episode->season->season_number;
                    echo "S" . $seasonNumber . "E" . $episode->episode_number . " of \"" . $tvshow->folder_name . "\": ";
                }
                
                // Call the check function with needed data, don't set properties on the model
                $result = self::checkEpisodeInStorage(
                    $episode->id,
                    $episode->episode_number,
                    $seasonNumber,
                    $tvshow->folder_name,
                    $disk
                );
                
                if (!empty($result)) {
                    echo "FOUND at " . $result . "\n";
                    $foundCount++;
                } else {
                    echo "NOT FOUND\n";
                    $notFoundCount++;
                }
            }
            
            // Calculate execution time
            $endTime = microtime(true);
            $executionTime = $endTime - $startTime;
            $formattedTime = number_format($executionTime, 2);
            
            echo "\nCheck complete. Summary:\n";
            echo "- Episodes found in storage: " . $foundCount . "\n";
            echo "- Episodes not found: " . $notFoundCount . "\n";
            echo "- Total execution time: " . $formattedTime . " seconds\n";
            
        } catch (\Throwable $th) {
            info($th->getMessage());
            echo "\nERROR: " . $th->getMessage() . "\n";
            echo "Stack trace:\n" . $th->getTraceAsString() . "\n";
            
            // Even if there's an error, report the execution time
            $endTime = microtime(true);
            $executionTime = $endTime - $startTime;
            $formattedTime = number_format($executionTime, 2);
            echo "- Execution time until error: " . $formattedTime . " seconds\n";
            
            return false;
        }

        echo "All episodes checked successfully.\n";
        return true;
    }
    
    /**
     * Check if an episode exists in storage and update its record
     * This is a helper for checkIfAllEpisodesAreInStorageAndUpdateDb
     * 
     * @param int $episodeId
     * @param string $episodeNumber
     * @param int $seasonNumber
     * @param string $folderName
     * @param string $disk
     * @param string $prioritizeVideoLanguage
     */
    private static function checkEpisodeInStorage(
        int $episodeId,
        string $episodeNumber,
        int $seasonNumber,
        string $folderName,
        string $disk = 'tvshows',
        string $prioritizeVideoLanguage = 'ENG'
    ): string {
        $storage = Storage::disk($disk);
        $searchPath = $folderName . '/' . $seasonNumber;
        
        try {
            if (!$storage->exists($searchPath)) {
                return '';
            }
            
            $files = $storage->files($searchPath);
            
            // Pattern to match episode files with optional language code before .mp4
            $pattern = '#^' . preg_quote($folderName . '/' . $seasonNumber . '/' . $episodeNumber . '.', '#') . '.*\.mp4$#';
            
            $matchingFiles = [];
            foreach ($files as $file) {
                if (preg_match($pattern, $file)) {
                    // Double check that the file actually exists
                    if ($storage->exists($file)) {
                        $matchingFiles[] = $file;
                    }
                }
            }
            
            if (empty($matchingFiles)) {
                Episode::where('id', $episodeId)->update(['is_in_storage' => '']);
                return '';
            }
            
            // If we have multiple mp4 files per episode, prioritize English version
            if (count($matchingFiles) > 1) {
                foreach ($matchingFiles as $file) {
                    if (preg_match('/\.' . strtoupper($prioritizeVideoLanguage) . '\.mp4$/', $file)) {
                        Episode::where('id', $episodeId)->update(['is_in_storage' => $file]);
                        return $file;
                    }
                }
            }
            
            // If no English version found or only one file exists, use the first matching file
            $selectedFile = $matchingFiles[0];
            Episode::where('id', $episodeId)->update(['is_in_storage' => $selectedFile]);
            return $selectedFile;
            
        } catch (\Throwable $th) {
            return '';
        }
    }
}