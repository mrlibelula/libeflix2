<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use App\Services\TvshowService;
use App\Services\SeasonService;
use App\Services\Tool;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class TvshowController extends Controller
{
    /**
     * Shows all available tv shows on Storage
     *
     * @return Response
     */
    public function index(): Response
    {
        $tvshows = Tvshow::select('id', 'name', 'backdrop_path', 'poster_path', 'vote_average', 'vote_count', 'first_air_date', 'videos', 'images', 'selected_logo', 'slug')
            ->orderBy('name', 'asc')
            ->withCount('seasons')
            ->withCount('episodes')
            ->get();

        return Inertia::render('tvshows', [
            'tvshows' => $tvshows,
        ]);
    }

    public function show(Request $request, string $slug): Response
    {
        $tvshow = Tvshow::where('slug', $slug)
            ->with('seasons')
            ->with('seasons.episodes')
            ->first();
        
        if (!$tvshow) {
            abort(404, 'TV Show not found');
        }

        // Get selected season number from request or use 0 (which will default to first season in React)
        $selectedSeasonNumber = $request->input('season', 0);

        // Append the season poster URL to the season's posterPathUrl property and check if seasonExists in storage, as a folder
        // and string limit each episode's overview
        $tvshow->seasons = $tvshow->seasons->map(function ($season) use ($tvshow) {
            $season->posterPathUrl = $season->poster_path 
                ? env('TMDB_IMAGE_BASE_URL_300') . $season->poster_path 
                : env('DEFAULT_POSTER_IMAGE_URL');
            // Check if season folder exists in storage
            $season->seasonFolderExists = SeasonService::isThereSeasonFolder($season->season_number, $tvshow);
            // Add still image URL and append vote avarage to stars method to each episode
            $season->episodes->each(function ($episode) {
                $episode->stillUrl = $episode->still_path 
                    ? env('TMDB_IMAGE_BASE_URL_300') . $episode->still_path 
                    : env('DEFAULT_EPISODE_STILL_IMAGE_URL');
                $episode->voteAverageStars = Tool::voteAvarageToStars($episode->vote_average, $episode->vote_count);
                
                // Pre-encode the file path if it's a string (means it's a valid file path)
                if (is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) {
                    $episode->encFilePath = Tool::encode($episode->is_in_storage);
                }
            });
            return $season;
        });

        // Append the genre slug to the genres list
        $tvshow->genres = TvshowService::genresWithSlugs($tvshow);

        // Append the creator profile path to the creator list
        $tvshow->created_by = array_map(function ($creator) {
            $creator['profile_path'] = $creator['profile_path'] ? env('TMDB_IMAGE_BASE_URL_300') . $creator['profile_path'] : env('DEFAULT_CREDIT_IMAGE_URL');
            return $creator;
        }, $tvshow->created_by);

        // Append network's logo path to the network list
        $tvshow->networks = array_map(function ($network) {
            $network['logoPathUrl'] = $network['logo_path'] ? env('TMDB_IMAGE_BASE_URL_300') . $network['logo_path'] : null;
            return $network;
        }, $tvshow->networks);

        // Append voteAvarageStars to the TV show
        $tvshow->voteAverageStars = Tool::voteAvarageToStars($tvshow->vote_average, $tvshow->vote_count);

        // Append credits to the TV show
        $tvshow->credits = TvshowService::getTvshowCredits($tvshow, withCrew: true);

        // Encode episodes file paths via is_in_storage and use prop encFilePath as final prop
        $tvshow->episodes = $tvshow->episodes->map(function ($episode) {
            // If is_in_storage contains the file path (fallbacks as a boolean (truthy or falsy)), encode it
            $episode->encFilePath = (is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) 
                ? Tool::encode($episode->is_in_storage) 
                : null;
            
            // Check for subtitles in database or on disk
            if (!empty($episode->subtitles)) {
                // Parse the subtitles JSON string if needed
                $subtitlesData = is_string($episode->subtitles) 
                    ? json_decode($episode->subtitles, true)
                    : $episode->subtitles;
                
                $mappedSubtitles = collect($subtitlesData)->map(function ($subtitle) {
                    // Handle both new and old subtitle formats
                    $languageCode = null;
                    $filePath = null;
                    
                    // Check which format this subtitle uses
                    if (isset($subtitle['language_code'])) {
                        $languageCode = $subtitle['language_code'];
                    } elseif (isset($subtitle['lang'])) {
                        $languageCode = $subtitle['lang'];
                    } else {
                        $languageCode = 'EN'; // Default
                    }
                    
                    // Check which file path format this subtitle uses
                    if (isset($subtitle['file_path'])) {
                        $filePath = $subtitle['file_path'];
                    } elseif (isset($subtitle['subtFilePath'])) {
                        $filePath = $subtitle['subtFilePath'];
                    } else {
                        return null; // Skip this subtitle if no valid file path
                    }
                    
                    return [
                        'language_code' => $languageCode,
                        'language_name' => Tool::getLanguageForSubtitleLabel($languageCode),
                        'encFilePath' => Tool::encode($filePath),
                    ];
                })->filter()->toArray(); // Remove any null values
                
                $episode->subtitles = $mappedSubtitles;
            } else {
                // If no subtitles in database but we have a valid episode file, check the disk for subtitle files
                if (is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) {
                    // Get potential subtitles
                    $diskSubtitles = $this->findSubtitlesForEpisode($episode->is_in_storage);
                    $episode->subtitles = $diskSubtitles;
                } else {
                    $episode->subtitles = [];
                }
            }
            
            return $episode;
        });

        return Inertia::render('tvshow', [
            'tvshow' => $tvshow,
            'backdropUrl' => TvshowService::getRandomTvshowImages($tvshow, 'backdrops'),
            'selectedSeasonNumber' => (int)$selectedSeasonNumber,
        ]);
    }

    /**
     * Find subtitle files for an episode directly from disk
     *
     * @param string $videoFilePath
     * @return array
     */
    private function findSubtitlesForEpisode(string $videoFilePath): array
    {
        $result = [];
        $storage = Storage::disk('tvshows');
        
        // Extract path info from the video file path
        $videoPathInfo = pathinfo($videoFilePath);
        $searchPath = dirname($videoFilePath); // Get directory
        $basenameNoExt = pathinfo(basename($videoFilePath), PATHINFO_FILENAME);
        
        try {
            // Check if directory exists first
            if (!$storage->exists($searchPath)) {
                return [];
            }
            
            // Get all files in the directory
            $files = $storage->files($searchPath);
            
            foreach ($files as $file) {
                // Skip if not a subtitle file (VTT format)
                if (!str_ends_with(strtolower($file), '.vtt')) {
                    continue;
                }
                
                $subtitleFilename = basename($file);
                
                // Match the pattern: same filename + _LANG.vtt (e.g. "video_EN.vtt")
                if (preg_match('/^' . preg_quote($basenameNoExt, '/') . '_([A-Z]{2})\.vtt$/i', $subtitleFilename, $matches)) {
                    $langCode = strtoupper($matches[1]);
                    $result[] = [
                        'language_code' => $langCode,
                        'language_name' => Tool::getLanguageForSubtitleLabel($langCode),
                        'encFilePath' => Tool::encode($file)
                    ];
                }
            }
        } catch (\Exception $e) {
            // Silent failure - just return empty array
            Log::error("Error finding subtitles: " . $e->getMessage());
        }
        
        return $result;
    }
}
