<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use App\Models\SearchQueryTvshow;
use App\Services\TvshowService;
use App\Services\SeasonService;
use App\Services\Tool;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
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
    public function index(Request $request): Response
    {
        $searchQuery = $request->get('search');

        $tvshowsQuery = Tvshow::select('id', 'name', 'backdrop_path', 'poster_path', 'vote_average', 'vote_count', 'first_air_date', 'videos', 'images', 'selected_logo', 'slug')
            ->withCount('seasons')
            ->withCount('episodes');

        // Apply search filter if search query exists
        if ($searchQuery && strlen($searchQuery) >= 2) {
            $tvshowsQuery = $this->applyTvshowSearchFilters($tvshowsQuery, $searchQuery);
        } else {
            $tvshowsQuery->orderBy('name', 'asc');
        }

        $tvshows = $tvshowsQuery->get();

        return Inertia::render('tvshows', [
            'tvshows' => $tvshows,
            'searchQuery' => $searchQuery,
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
        
        // Get selected episode number for auto-play functionality
        $selectedEpisodeNumber = $request->input('episode', null);

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
            'selectedEpisodeNumber' => $selectedEpisodeNumber ? (int)$selectedEpisodeNumber : null,
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

    /**
     * Apply comprehensive search filters to TV shows query
     *
     * @param $query
     * @param string $searchQuery
     * @return mixed
     */
    private function applyTvshowSearchFilters($query, string $searchQuery)
    {
        return $query->where(function ($q) use ($searchQuery) {
            // Search in TV show fields
            $q->where('tvshows.name', 'LIKE', "%{$searchQuery}%")
              ->orWhere('tvshows.original_name', 'LIKE', "%{$searchQuery}%")
              ->orWhere('tvshows.overview', 'LIKE', "%{$searchQuery}%")
              ->orWhere('tvshows.tagline', 'LIKE', "%{$searchQuery}%")
              ->orWhere('tvshows.type', 'LIKE', "%{$searchQuery}%");
              
            // Search in networks (JSON field)
            if (config('database.default') === 'mysql') {
                $q->orWhereRaw("JSON_SEARCH(LOWER(tvshows.networks), 'one', LOWER(?)) IS NOT NULL", ["%{$searchQuery}%"]);
            } else {
                // For SQLite, search in networks as text
                $q->orWhere('tvshows.networks', 'LIKE', "%{$searchQuery}%");
            }
            
            // Search in cast (JSON field)
            if (config('database.default') === 'mysql') {
                $q->orWhereRaw("JSON_SEARCH(LOWER(tvshows.cast), 'one', LOWER(?)) IS NOT NULL", ["%{$searchQuery}%"]);
            } else {
                // For SQLite, search in cast as text
                $q->orWhere('tvshows.cast', 'LIKE', "%{$searchQuery}%");
            }
        })->orderBy('tvshows.name', 'asc');
    }

    /**
     * Search TV shows, seasons, and episodes based on multiple criteria (API endpoint).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function search(Request $request)
    {
        try {
            $query = $request->get('q', '');
            $limit = $request->get('limit', 10);
            $shouldLog = $request->get('log', 'true') !== 'false'; // Default to true, false only if explicitly set
            
            if (empty($query) || strlen($query) < 2) {
                return response()->json([
                    'success' => true,
                    'results' => []
                ]);
            }

            $user = Auth::user();
            $startTime = microtime(true);
            
            $allResults = collect();
            
            // 1. Search TV shows directly
            $tvshowsQuery = Tvshow::select('id', 'name', 'original_name', 'slug', 'poster_path', 'first_air_date', 'vote_average', 'overview', 'tagline', 'images', 'selected_logo')
                ->with(['seasons' => function($seasonQuery) {
                    $seasonQuery->select('id', 'tvshow_id', 'name', 'overview');
                }]);

            $tvshows = $this->applyTvshowSearchFilters($tvshowsQuery, $query)
                ->limit($limit)
                ->get();

            // Add TV show results
            foreach ($tvshows as $tvshow) {
                $logoUrl = null;
                if (!empty($tvshow->images) && isset($tvshow->images['logos']) && !empty($tvshow->images['logos'])) {
                    $selectedLogoIndex = $tvshow->selected_logo ?? 0;
                    if (isset($tvshow->images['logos'][$selectedLogoIndex])) {
                        $logoUrl = env('TMDB_IMAGE_BASE_URL_300') . $tvshow->images['logos'][$selectedLogoIndex]['file_path'];
                    }
                }
                
                $allResults->push([
                    'type' => 'tvshow',
                    'id' => $tvshow->id,
                    'name' => $tvshow->name,
                    'original_name' => $tvshow->original_name,
                    'slug' => $tvshow->slug,
                    'poster_path' => $tvshow->poster_path,
                    'poster_url' => $tvshow->poster_path 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $tvshow->poster_path
                        : null,
                    'first_air_date' => $tvshow->first_air_date,
                    'vote_average' => $tvshow->vote_average,
                    'overview' => $tvshow->overview,
                    'tagline' => $tvshow->tagline,
                    'logo_url' => $logoUrl,
                    'seasons_count' => $tvshow->seasons->count(),
                    'relevance_score' => 100, // TV show matches get highest score
                ]);
            }
            
            // 2. Search episodes (with season and TV show info)
            $episodeResults = $this->searchEpisodes($query, $limit);
            foreach ($episodeResults as $episode) {
                $allResults->push($episode);
            }
            
            // 3. Search seasons (with TV show info)
            $seasonResults = $this->searchSeasons($query, $limit);
            foreach ($seasonResults as $season) {
                $allResults->push($season);
            }

            // Sort by relevance score and type priority, then limit
            $sortedResults = $allResults
                ->sortByDesc(function ($item) {
                    // Primary sort by type: tvshow > episode > season
                    $typePriority = ['tvshow' => 300, 'episode' => 200, 'season' => 100];
                    return ($typePriority[$item['type']] ?? 0) + ($item['relevance_score'] ?? 0);
                })
                ->take($limit)
                ->values();

            $searchTime = round((microtime(true) - $startTime) * 1000, 2);

            // Smart logging: Only log if requested and meaningful
            if ($shouldLog && $this->shouldLogTvshowSearch($query, $user->id, $sortedResults->count())) {
                try {
                    $searchRecord = SearchQueryTvshow::create([
                        'user_id' => $user->id,
                        'query' => $query,
                        'results_count' => $sortedResults->count(),
                        'results_summary' => $sortedResults->take(5)->map(function ($result) {
                            $summary = [
                                'type' => $result['type'],
                                'id' => $result['id'],
                                'name' => $result['name'],
                            ];
                            
                            // Add type-specific information
                            if ($result['type'] === 'tvshow') {
                                $summary['slug'] = $result['slug'];
                            } else {
                                $summary['tvshow_slug'] = $result['tvshow_slug'];
                                $summary['tvshow_name'] = $result['tvshow_name'];
                                
                                if ($result['type'] === 'season') {
                                    $summary['season_number'] = $result['season_number'];
                                } elseif ($result['type'] === 'episode') {
                                    $summary['season_number'] = $result['season_number'];
                                    $summary['episode_number'] = $result['episode_number'];
                                }
                            }
                            
                            return $summary;
                        })->toArray(),
                        'has_results' => $sortedResults->count() > 0,
                        'search_type' => 'comprehensive',
                        'source_page' => $request->header('Referer') ? parse_url($request->header('Referer'), PHP_URL_PATH) : null,
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->header('User-Agent'),
                        'session_data' => [
                            'search_time_ms' => $searchTime,
                            'limit' => $limit,
                            'timestamp' => now()->toISOString(),
                            'tvshow_matches' => $tvshows->count(),
                            'episode_matches' => count($episodeResults),
                            'season_matches' => count($seasonResults),
                        ],
                    ]);

                    Log::info('Created TV show search record', [
                        'search_record_id' => $searchRecord->id,
                        'user_id' => $user->id,
                        'query' => $query,
                        'results_count' => $sortedResults->count(),
                        'search_type' => 'comprehensive',
                    ]);
                } catch (\Exception $logError) {
                    Log::warning('Failed to log TV show search query', [
                        'query' => $query,
                        'user_id' => $user->id,
                        'error' => $logError->getMessage()
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'results' => $sortedResults,
                'query' => $query,
                'total' => $sortedResults->count(),
                'breakdown' => [
                    'tvshows' => $tvshows->count(),
                    'episodes' => count($episodeResults),
                    'seasons' => count($seasonResults),
                ]
            ]);

        } catch (\Exception $e) {
            Log::error('TV show search error', [
                'query' => $request->get('q'),
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Search failed'
            ], 500);
        }
    }

    /**
     * Log a TV show search query (delayed logging endpoint).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logSearch(Request $request)
    {
        try {
            $user = Auth::user();
            $query = $request->input('query');
            $timestamp = $request->input('timestamp');

            if (empty($query) || strlen($query) < 3) {
                return response()->json(['success' => true, 'message' => 'Query too short to log']);
            }

            // Check if this search should be logged (avoid duplicates and noise)
            if (!$this->shouldLogTvshowSearch($query, $user->id, null)) {
                return response()->json(['success' => true, 'message' => 'Search not logged (duplicate or noise)']);
            }

            // Get comprehensive search results for summary (same logic as main search)
            $allResults = collect();
            
            // 1. Search TV shows
            $tvshowsQuery = Tvshow::select('id', 'name', 'original_name', 'slug', 'poster_path', 'first_air_date', 'vote_average', 'overview', 'tagline', 'images', 'selected_logo');
            $tvshows = $this->applyTvshowSearchFilters($tvshowsQuery, $query)->limit(3)->get();
            
            foreach ($tvshows as $tvshow) {
                $allResults->push([
                    'type' => 'tvshow',
                    'id' => $tvshow->id,
                    'name' => $tvshow->name,
                    'slug' => $tvshow->slug,
                    'relevance_score' => 100,
                ]);
            }
            
            // 2. Search episodes (limited for summary)
            $episodeResults = $this->searchEpisodes($query, 2);
            foreach ($episodeResults as $episode) {
                $allResults->push($episode);
            }
            
            // 3. Search seasons (limited for summary)
            $seasonResults = $this->searchSeasons($query, 2);
            foreach ($seasonResults as $season) {
                $allResults->push($season);
            }

            // Sort and limit to top 5 for summary
            $sortedResults = $allResults
                ->sortByDesc(function ($item) {
                    $typePriority = ['tvshow' => 300, 'episode' => 200, 'season' => 100];
                    return ($typePriority[$item['type']] ?? 0) + ($item['relevance_score'] ?? 0);
                })
                ->take(5)
                ->values();

            $resultsCount = $allResults->count();
            $resultsSummary = $sortedResults->map(function ($result) {
                $summary = [
                    'type' => $result['type'],
                    'id' => $result['id'],
                    'name' => $result['name'],
                ];
                
                if ($result['type'] === 'tvshow') {
                    $summary['slug'] = $result['slug'];
                } else {
                    $summary['tvshow_slug'] = $result['tvshow_slug'] ?? null;
                    $summary['tvshow_name'] = $result['tvshow_name'] ?? null;
                    
                    if ($result['type'] === 'season') {
                        $summary['season_number'] = $result['season_number'] ?? null;
                    } elseif ($result['type'] === 'episode') {
                        $summary['season_number'] = $result['season_number'] ?? null;
                        $summary['episode_number'] = $result['episode_number'] ?? null;
                    }
                }
                
                return $summary;
            })->toArray();

            SearchQueryTvshow::create([
                'user_id' => $user->id,
                'query' => $query,
                'results_count' => $resultsCount,
                'results_summary' => $resultsSummary,
                'has_results' => $resultsCount > 0,
                'search_type' => 'delayed_log',
                'source_page' => $request->header('Referer') ? parse_url($request->header('Referer'), PHP_URL_PATH) : null,
                'ip_address' => $request->ip(),
                'user_agent' => $request->header('User-Agent'),
                'session_data' => [
                    'original_timestamp' => $timestamp,
                    'logged_at' => now()->toISOString(),
                ],
            ]);

            return response()->json(['success' => true]);

        } catch (\Exception $e) {
            Log::warning('Failed to log TV show search', [
                'query' => $request->get('query'),
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to log search'
            ], 500);
        }
    }

    /**
     * Track a click on a TV show search result.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function trackSearchClick(Request $request)
    {
        try {
            $user = Auth::user();
            $query = $request->input('query');
            $resultType = $request->input('result_type'); // 'tvshow', 'season', 'episode'
            $resultData = $request->input('result_data'); // Full result object
            $searchTimestamp = $request->input('search_timestamp');

            // Log incoming request for debugging
            Log::info('TV show search click tracking request', [
                'user_id' => $user->id,
                'query' => $query,
                'result_type' => $resultType,
                'result_data_keys' => $resultData ? array_keys($resultData) : null,
                'search_timestamp' => $searchTimestamp,
            ]);

            // Parse the search timestamp
            $searchTime = \Carbon\Carbon::parse($searchTimestamp);
            $clickTimestamp = now();
            $timeToClickMs = $clickTimestamp->diffInMilliseconds($searchTime);

            // Extract data based on result type
            $clickData = [
                'clicked_result_at' => $clickTimestamp,
                'clicked_result_type' => $resultType,
                'time_to_click_ms' => $timeToClickMs,
                'clicked_result_data' => $resultData,
            ];

            // Always extract TV show information (present in all result types)
            if ($resultType === 'tvshow') {
                $clickData['clicked_tvshow_id'] = $resultData['id'];
                $clickData['clicked_tvshow_title'] = $resultData['name'];
                $clickData['clicked_tvshow_slug'] = $resultData['slug'];
            } else {
                // For episodes and seasons, TV show info is in tvshow_* fields
                $clickData['clicked_tvshow_id'] = $resultData['tvshow_id'];
                $clickData['clicked_tvshow_title'] = $resultData['tvshow_name'];
                $clickData['clicked_tvshow_slug'] = $resultData['tvshow_slug'];
            }

            // Extract season information for season and episode results
            if ($resultType === 'season' || $resultType === 'episode') {
                $clickData['clicked_season_id'] = $resultData['season_id'] ?? null;
                $clickData['clicked_season_name'] = $resultData['season_name'] ?? null;
                $clickData['clicked_season_number'] = $resultData['season_number'] ?? null;
            }

            // Extract episode information for episode results
            if ($resultType === 'episode') {
                $clickData['clicked_episode_id'] = $resultData['id'];
                $clickData['clicked_episode_name'] = $resultData['name'];
                $clickData['clicked_episode_number'] = $resultData['episode_number'];
            }

            // Expand the search window and add fallback logic
            $searchQuery = null;
            
            // First, try to find exact match with expanded time window
            $searchQuery = SearchQueryTvshow::where('user_id', $user->id)
                ->where('query', $query)
                ->whereBetween('created_at', [$searchTime->subMinutes(10), $searchTime->addMinutes(10)])
                ->orderByDesc('created_at')
                ->first();

            // If not found, try to find any recent search with the same query (last 15 minutes)
            if (!$searchQuery) {
                $searchQuery = SearchQueryTvshow::where('user_id', $user->id)
                    ->where('query', $query)
                    ->where('created_at', '>', now()->subMinutes(15))
                    ->orderByDesc('created_at')
                    ->first();
            }

            // If still not found, try to find any search record without click data
            if (!$searchQuery) {
                $searchQuery = SearchQueryTvshow::where('user_id', $user->id)
                    ->where('query', $query)
                    ->whereNull('clicked_result_at')
                    ->where('created_at', '>', now()->subHours(1))
                    ->orderByDesc('created_at')
                    ->first();
            }

            Log::info('Search query lookup result', [
                'user_id' => $user->id,
                'query' => $query,
                'result_type' => $resultType,
                'search_query_found' => $searchQuery ? true : false,
                'search_query_id' => $searchQuery ? $searchQuery->id : null,
                'search_time' => $searchTime->toISOString(),
                'time_to_click_ms' => $timeToClickMs,
            ]);

            if ($searchQuery) {
                // Update the existing search record
                $searchQuery->update($clickData);

                Log::info('Updated existing search record with click data', [
                    'search_query_id' => $searchQuery->id,
                    'user_id' => $user->id,
                    'query' => $query,
                    'result_type' => $resultType,
                    'clicked_at' => $clickTimestamp->toISOString(),
                ]);
            } else {
                // Create new search record if not found (fallback)
                $newSearchQuery = SearchQueryTvshow::create(array_merge([
                    'user_id' => $user->id,
                    'query' => $query,
                    'results_count' => 1, // We know they found at least this one
                    'results_summary' => [
                        [
                            'type' => $resultType,
                            'id' => $resultData['id'],
                            'name' => $resultData['name'],
                            'tvshow_slug' => $clickData['clicked_tvshow_slug'],
                        ]
                    ],
                    'has_results' => true,
                    'search_type' => 'click_fallback',
                    'source_page' => $request->header('Referer') ? parse_url($request->header('Referer'), PHP_URL_PATH) : null,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->header('User-Agent'),
                    'session_data' => [
                        'fallback_creation' => true,
                        'original_search_timestamp' => $searchTimestamp,
                        'click_timestamp' => $clickTimestamp->toISOString(),
                    ],
                ], $clickData));

                Log::info('Created new search record with click data (fallback)', [
                    'search_query_id' => $newSearchQuery->id,
                    'user_id' => $user->id,
                    'query' => $query,
                    'result_type' => $resultType,
                    'clicked_at' => $clickTimestamp->toISOString(),
                ]);
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('Failed to track TV show search click', [
                'query' => $request->get('query'),
                'result_type' => $request->get('result_type'),
                'user_id' => Auth::id(),
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to track click'
            ], 500);
        }
    }

    /**
     * Get popular TV show search terms
     */
    public function getPopularSearchTerms()
    {
        $terms = SearchQueryTvshow::getPopularSearchTerms(10, 30);
        return response()->json($terms);
    }

    /**
     * Get TV show searches with no results
     */
    public function getNoResultSearches()
    {
        $searches = SearchQueryTvshow::getNoResultSearches(20, 30);
        return response()->json($searches);
    }

    /**
     * Get complete TV show analytics summary
     */
    public function getAnalyticsSummary()
    {
        $summary = SearchQueryTvshow::getAnalyticsSummary(30);
        return response()->json($summary);
    }

    /**
     * Determine if a TV show search should be logged to reduce noise.
     */
    private function shouldLogTvshowSearch(string $query, int $userId, ?int $resultsCount): bool
    {
        // Skip very short queries
        if (strlen($query) <= 2) {
            return false;
        }

        // Don't log the same query multiple times in a short period for the same user
        $recentLog = SearchQueryTvshow::where('user_id', $userId)
            ->where('query', $query)
            ->where('created_at', '>', now()->subMinutes(5))
            ->exists();

        if ($recentLog) {
            return false;
        }

        // Always log if results count is explicitly provided and > 0, or if it's a substantial query
        if (($resultsCount !== null && $resultsCount > 0) || strlen($query) >= 5) {
            return true;
        }

        // For shorter queries (3-4 chars), be more selective
        if (strlen($query) >= 3) {
            // Check if this might be a progressive typing pattern
            $recentSearches = SearchQueryTvshow::where('user_id', $userId)
                ->where('created_at', '>', now()->subMinutes(2))
                ->orderByDesc('created_at')
                ->limit(3)
                ->pluck('query')
                ->toArray();

            // If this looks like progressive typing (e.g., "ga" -> "gam" -> "game"), skip intermediate ones
            foreach ($recentSearches as $recentQuery) {
                if (strlen($recentQuery) < strlen($query) && strpos($query, $recentQuery) === 0) {
                    return false; // This is likely progressive typing
                }
            }

            return true; // Probably a standalone short search
        }

        return false;
    }

    /**
     * Get the count of search results for a query (for logging purposes)
     */
    private function getTvshowSearchResultsCount(string $query): int
    {
        $tvshowsQuery = Tvshow::select('id');
        return $this->applyTvshowSearchFilters($tvshowsQuery, $query)->count();
    }

    /**
     * Search episodes with their TV show and season context
     *
     * @param string $query
     * @param int $limit
     * @return array
     */
    private function searchEpisodes(string $query, int $limit = 10): array
    {
        $results = [];
        
        try {
            // Search episodes using a more direct approach to avoid complex joins
            $episodes = DB::table('episodes')
                ->join('seasons', 'episodes.season_id', '=', 'seasons.id')
                ->join('tvshows', 'seasons.tvshow_id', '=', 'tvshows.id')
                ->select(
                    'episodes.id as episode_id',
                    'episodes.name as episode_name',
                    'episodes.overview as episode_overview',
                    'episodes.episode_number',
                    'episodes.still_path',
                    'episodes.air_date as episode_air_date',
                    'episodes.vote_average as episode_vote_average',
                    'episodes.credits as episode_credits',
                    'seasons.id as season_id',
                    'seasons.name as season_name',
                    'seasons.season_number',
                    'tvshows.id as tvshow_id',
                    'tvshows.name as tvshow_name',
                    'tvshows.slug as tvshow_slug',
                    'tvshows.poster_path as tvshow_poster_path',
                    'tvshows.images as tvshow_images',
                    'tvshows.selected_logo as tvshow_selected_logo'
                )
                ->where(function ($q) use ($query) {
                    $q->where('episodes.name', 'LIKE', "%{$query}%")
                      ->orWhere('episodes.overview', 'LIKE', "%{$query}%");
                    
                    // Search in episode credits (JSON field)
                    if (config('database.default') === 'mysql') {
                        $q->orWhereRaw("JSON_SEARCH(LOWER(episodes.credits), 'all', LOWER(?)) IS NOT NULL", ["%{$query}%"]);
                    } else {
                        // For SQLite, search in credits as text
                        $q->orWhere('episodes.credits', 'LIKE', "%{$query}%");
                    }
                })
                ->orderBy('tvshows.name')
                ->orderBy('seasons.season_number')
                ->orderBy('episodes.episode_number')
                ->limit($limit)
                ->get();

            foreach ($episodes as $episode) {
                // Calculate relevance score
                $relevanceScore = 0;
                if (stripos($episode->episode_name, $query) !== false) {
                    $relevanceScore += 50;
                }
                if (stripos($episode->episode_overview, $query) !== false) {
                    $relevanceScore += 30;
                }
                if (stripos($episode->episode_credits, $query) !== false) {
                    $relevanceScore += 20;
                }

                // Get TV show logo
                $logoUrl = null;
                $tvshowImages = json_decode($episode->tvshow_images, true);
                if (!empty($tvshowImages) && isset($tvshowImages['logos']) && !empty($tvshowImages['logos'])) {
                    $selectedLogoIndex = $episode->tvshow_selected_logo ?? 0;
                    if (isset($tvshowImages['logos'][$selectedLogoIndex])) {
                        $logoUrl = env('TMDB_IMAGE_BASE_URL_300') . $tvshowImages['logos'][$selectedLogoIndex]['file_path'];
                    }
                }

                $results[] = [
                    'type' => 'episode',
                    'id' => $episode->episode_id,
                    'name' => $episode->episode_name,
                    'overview' => $episode->episode_overview,
                    'episode_number' => $episode->episode_number,
                    'still_path' => $episode->still_path,
                    'still_url' => $episode->still_path 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $episode->still_path
                        : null,
                    'air_date' => $episode->episode_air_date,
                    'vote_average' => $episode->episode_vote_average,
                    'season_id' => $episode->season_id,
                    'season_name' => $episode->season_name,
                    'season_number' => $episode->season_number,
                    'tvshow_id' => $episode->tvshow_id,
                    'tvshow_name' => $episode->tvshow_name,
                    'tvshow_slug' => $episode->tvshow_slug,
                    'tvshow_poster_url' => $episode->tvshow_poster_path 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $episode->tvshow_poster_path
                        : null,
                    'tvshow_logo_url' => $logoUrl,
                    'relevance_score' => $relevanceScore,
                    'display_text' => "S{$episode->season_number}E{$episode->episode_number}: {$episode->episode_name}",
                    'context_text' => "from {$episode->tvshow_name}",
                ];
            }
        } catch (\Exception $e) {
            Log::error('Episode search error', [
                'query' => $query,
                'error' => $e->getMessage()
            ]);
        }

        return $results;
    }

    /**
     * Search seasons with their TV show context
     *
     * @param string $query
     * @param int $limit
     * @return array
     */
    private function searchSeasons(string $query, int $limit = 10): array
    {
        $results = [];
        
        try {
            // Search seasons
            $seasons = DB::table('seasons')
                ->join('tvshows', 'seasons.tvshow_id', '=', 'tvshows.id')
                ->select(
                    'seasons.id as season_id',
                    'seasons.name as season_name',
                    'seasons.overview as season_overview',
                    'seasons.season_number',
                    'seasons.poster_path as season_poster_path',
                    'seasons.air_date as season_air_date',
                    'seasons.vote_average as season_vote_average',
                    'seasons.episode_count',
                    'tvshows.id as tvshow_id',
                    'tvshows.name as tvshow_name',
                    'tvshows.slug as tvshow_slug',
                    'tvshows.poster_path as tvshow_poster_path',
                    'tvshows.images as tvshow_images',
                    'tvshows.selected_logo as tvshow_selected_logo'
                )
                ->where(function ($q) use ($query) {
                    $q->where('seasons.name', 'LIKE', "%{$query}%")
                      ->orWhere('seasons.overview', 'LIKE', "%{$query}%");
                })
                ->orderBy('tvshows.name')
                ->orderBy('seasons.season_number')
                ->limit($limit)
                ->get();

            foreach ($seasons as $season) {
                // Calculate relevance score
                $relevanceScore = 0;
                if (stripos($season->season_name, $query) !== false) {
                    $relevanceScore += 40;
                }
                if (stripos($season->season_overview, $query) !== false) {
                    $relevanceScore += 25;
                }

                // Get TV show logo
                $logoUrl = null;
                $tvshowImages = json_decode($season->tvshow_images, true);
                if (!empty($tvshowImages) && isset($tvshowImages['logos']) && !empty($tvshowImages['logos'])) {
                    $selectedLogoIndex = $season->tvshow_selected_logo ?? 0;
                    if (isset($tvshowImages['logos'][$selectedLogoIndex])) {
                        $logoUrl = env('TMDB_IMAGE_BASE_URL_300') . $tvshowImages['logos'][$selectedLogoIndex]['file_path'];
                    }
                }

                $results[] = [
                    'type' => 'season',
                    'id' => $season->season_id,
                    'name' => $season->season_name,
                    'overview' => $season->season_overview,
                    'season_number' => $season->season_number,
                    'poster_path' => $season->season_poster_path,
                    'poster_url' => $season->season_poster_path 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $season->season_poster_path
                        : null,
                    'air_date' => $season->season_air_date,
                    'vote_average' => $season->season_vote_average,
                    'episode_count' => $season->episode_count,
                    'tvshow_id' => $season->tvshow_id,
                    'tvshow_name' => $season->tvshow_name,
                    'tvshow_slug' => $season->tvshow_slug,
                    'tvshow_poster_url' => $season->tvshow_poster_path 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $season->tvshow_poster_path
                        : null,
                    'tvshow_logo_url' => $logoUrl,
                    'relevance_score' => $relevanceScore,
                    'display_text' => $season->season_name,
                    'context_text' => "from {$season->tvshow_name}",
                ];
            }
        } catch (\Exception $e) {
            Log::error('Season search error', [
                'query' => $query,
                'error' => $e->getMessage()
            ]);
        }

        return $results;
    }
}
