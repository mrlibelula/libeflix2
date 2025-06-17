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
            ->with('seasons') // Only load seasons, not episodes
            ->first();
        
        if (!$tvshow) {
            abort(404, 'TV Show not found');
        }

        // Get selected season number from request or use 0 (which will default to first season in React)
        $selectedSeasonNumber = $request->input('season', 0);

        // Append the season poster URL to the season's posterPathUrl property and check if seasonExists in storage, as a folder
        $tvshow->seasons = $tvshow->seasons->map(function ($season) use ($tvshow) {
            $season->posterPathUrl = $season->poster_path 
                ? env('TMDB_IMAGE_BASE_URL_300') . $season->poster_path 
                : env('DEFAULT_POSTER_IMAGE_URL');
            // Check if season folder exists in storage
            $season->seasonFolderExists = SeasonService::isThereSeasonFolder($season->season_number, $tvshow);
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

        // For credits, we need to load episodes on demand, so we'll use the API endpoint
        // For now, let's load credits from the cast stored in the tvshow table
        $tvshow->credits = [
            'cast' => array_map(function ($cast) {
                $cast['profilePathUrl'] = isset($cast['profile_path']) && $cast['profile_path'] 
                    ? env('TMDB_IMAGE_BASE_URL_92') . $cast['profile_path'] 
                    : env('DEFAULT_CREDIT_IMAGE_URL');
                return $cast;
            }, $tvshow->cast ?? []),
            'crew' => [],
            'guestStars' => [],
        ];

        return Inertia::render('tvshow', [
            'tvshow' => $tvshow,
            'backdropUrl' => TvshowService::getRandomTvshowImages($tvshow, 'backdrops'),
            'selectedSeasonNumber' => (int)$selectedSeasonNumber,
        ]);
    }

    /**
     * Get episodes for a specific season (API endpoint for lazy loading)
     *
     * @param Request $request
     * @param string $slug
     * @param int $seasonNumber
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSeasonEpisodes(Request $request, string $slug, int $seasonNumber)
    {
        $tvshow = Tvshow::where('slug', $slug)->first();
        
        if (!$tvshow) {
            return response()->json(['error' => 'TV Show not found'], 404);
        }

        $season = $tvshow->seasons()
            ->where('season_number', $seasonNumber)
            ->with('episodes')
            ->first();

        if (!$season) {
            return response()->json(['error' => 'Season not found'], 404);
        }

        // Process episodes with the same logic as before
        $season->episodes->each(function ($episode) {
            $episode->stillUrl = $episode->still_path 
                ? env('TMDB_IMAGE_BASE_URL_300') . $episode->still_path 
                : env('DEFAULT_EPISODE_STILL_IMAGE_URL');
            $episode->voteAverageStars = Tool::voteAvarageToStars($episode->vote_average, $episode->vote_count);
            
            // Pre-encode the file path if it's a string (means it's a valid file path)
            if (is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) {
                $episode->encFilePath = Tool::encode($episode->is_in_storage);
            }

            // Handle subtitles
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
        });

        return response()->json([
            'season' => $season,
            'episodes' => $season->episodes
        ]);
    }

    /**
     * Get credits for a specific season (API endpoint for lazy loading)
     *
     * @param Request $request
     * @param string $slug
     * @param int $seasonNumber
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSeasonCredits(Request $request, string $slug, int $seasonNumber)
    {
        $tvshow = Tvshow::where('slug', $slug)->first();
        
        if (!$tvshow) {
            return response()->json(['error' => 'TV Show not found'], 404);
        }

        $season = $tvshow->seasons()
            ->where('season_number', $seasonNumber)
            ->with('episodes')
            ->first();

        if (!$season) {
            return response()->json(['error' => 'Season not found'], 404);
        }

        // Get season-specific credits - load ALL credits without any limits
        $episodes = collect($season->episodes);
        
        // Debug info
        $debugInfo = [
            'total_episodes' => $episodes->count(),
            'episodes_with_credits' => 0,
            'episodes_with_guest_stars' => 0,
            'total_guest_star_entries' => 0,
        ];
        
        // Collect all credits from all episodes first
        $allCast = [];
        $allCrew = [];
        $allGuestStars = [];
        
        foreach ($episodes as $episode) {
            if (isset($episode->credits) && is_array($episode->credits)) {
                $debugInfo['episodes_with_credits']++;
                
                // Cast
                if (isset($episode->credits['cast']) && is_array($episode->credits['cast'])) {
                    foreach ($episode->credits['cast'] as $cast) {
                        if (is_array($cast) && isset($cast['name'])) {
                            $key = $cast['id'] ?? $cast['name'] . '_' . ($cast['character'] ?? '');
                            $allCast[$key] = $cast;
                        }
                    }
                }
                
                // Crew
                if (isset($episode->credits['crew']) && is_array($episode->credits['crew'])) {
                    foreach ($episode->credits['crew'] as $crew) {
                        if (is_array($crew) && isset($crew['name'])) {
                            $key = $crew['id'] ?? $crew['name'] . '_' . ($crew['job'] ?? '');
                            $allCrew[$key] = $crew;
                        }
                    }
                }
                
                // Guest Stars
                if (isset($episode->credits['guest_stars']) && is_array($episode->credits['guest_stars'])) {
                    $debugInfo['episodes_with_guest_stars']++;
                    $debugInfo['total_guest_star_entries'] += count($episode->credits['guest_stars']);
                    
                    foreach ($episode->credits['guest_stars'] as $guestStar) {
                        if (is_array($guestStar) && isset($guestStar['name'])) {
                            $key = $guestStar['id'] ?? $guestStar['name'] . '_' . ($guestStar['character'] ?? '');
                            $allGuestStars[$key] = $guestStar;
                        }
                    }
                }
            }
        }
        
        // Convert back to arrays
        $cast = array_values($allCast);
        $crew = array_values($allCrew);
        $guestStars = array_values($allGuestStars);
        
        // Append profilePathUrl to each credit or fallback to default image
        $cast = array_map(function ($credit) {
            $credit['profilePathUrl'] = isset($credit['profile_path']) && $credit['profile_path'] 
                ? env('TMDB_IMAGE_BASE_URL_92') . $credit['profile_path'] 
                : env('DEFAULT_CREDIT_IMAGE_URL');
            return $credit;
        }, $cast);
        
        $crew = array_map(function ($credit) {
            $credit['profilePathUrl'] = isset($credit['profile_path']) && $credit['profile_path'] 
                ? env('TMDB_IMAGE_BASE_URL_92') . $credit['profile_path'] 
                : env('DEFAULT_CREDIT_IMAGE_URL');
            return $credit;
        }, $crew);
        
        $guestStars = array_map(function ($credit) {
            $credit['profilePathUrl'] = isset($credit['profile_path']) && $credit['profile_path'] 
                ? env('TMDB_IMAGE_BASE_URL_92') . $credit['profile_path'] 
                : env('DEFAULT_CREDIT_IMAGE_URL');
            return $credit;
        }, $guestStars);

        // Apply the same crew sorting as in the original TvshowService
        // Order crew list placing "production" department at the top of the list
        $productionCrew = array_filter($crew, function ($credit) {
            return isset($credit['department']) && strtolower($credit['department']) === 'production';
        });
        
        $otherCrew = array_filter($crew, function ($credit) {
            return !isset($credit['department']) || strtolower($credit['department']) !== 'production';
        });
        
        $crew = array_merge($productionCrew, $otherCrew);

        return response()->json([
            'cast' => array_values($cast), // Re-index arrays to ensure proper JSON encoding
            'crew' => array_values($crew),
            'guestStars' => array_values($guestStars),
            'debug' => $debugInfo, // Temporary debug info
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
