<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use App\Models\SearchQueryTvshow;
use App\Services\TvshowService;
use App\Services\SeasonService;
use App\Services\Tool;
use App\Services\WatchLaterService;
use App\Traits\HandlesLikes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Database\Eloquent\Model;
use App\Models\Episode;

class TvshowController extends Controller
{
    use HandlesLikes;
    /**
     * Shows all available tv shows on Storage
     *
     * @return Response
     */
    public function index(Request $request): Response
    {
        $searchQuery = $request->get('search');
        $user = $request->user();

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

        // Add likes and watch later information to each TV show
        $tvshows->each(function ($tvshow) use ($user) {
            $tvshow->likes_count = $tvshow->likesCount();
            $tvshow->is_liked = $user ? $tvshow->isLikedBy($user) : false;
            $tvshow->is_watch_later = $user ? WatchLaterService::isWatchLater($tvshow, $user) : false;
        });

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

        // Add likes information
        $user = $request->user();
        $tvshow->likes_count = $tvshow->likesCount();
        $tvshow->is_liked = $user ? $tvshow->isLikedBy($user) : false;
        
        // Add watch later information
        $tvshow->is_watch_later = $user ? WatchLaterService::isWatchLater($tvshow, $user) : false;
        
        // Add watch later status to seasons
        $tvshow->seasons->each(function ($season) use ($user) {
            $season->is_watch_later = $user ? WatchLaterService::isWatchLater($season, $user) : false;
        });

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

        // Get user for watch later status
        $user = $request->user();
        
        // Add watch later status to season
        $season->is_watch_later = $user ? WatchLaterService::isWatchLater($season, $user) : false;
        
        // Process episodes with the same logic as before
        $season->episodes->each(function ($episode) use ($user, $tvshow) {
            $episode->stillUrl = $episode->still_path 
                ? env('TMDB_IMAGE_BASE_URL_300') . $episode->still_path 
                : env('DEFAULT_EPISODE_STILL_IMAGE_URL');
            $episode->voteAverageStars = Tool::voteAvarageToStars($episode->vote_average, $episode->vote_count);
            
            // Add watch later status to episode
            $episode->is_watch_later = $user ? WatchLaterService::isWatchLater($episode, $user) : false;
            
            // Add views and plays counts
            $episode->views_count = $episode->viewsCount();
            $episode->plays_count = $episode->playsCount();
            
            // Include parent TV show's free status - episodes inherit TV show's free status
            $episode->tvshow_is_free = $tvshow->is_free;
            
            // Pre-encode the file path if it's a string (means it's a valid file path)
            if (is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) {
                $episode->encFilePath = Tool::encode($episode->is_in_storage);
            }

            // Handle subtitles - check if we need to find subtitle files from disk
            // The Episode model accessor already handles subtitle formatting
            if (empty($episode->subtitles) && is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) {
                // If no subtitles in database but we have a valid episode file, check the disk for subtitle files
                $diskSubtitles = $this->findSubtitlesForEpisode($episode->is_in_storage);
                $episode->subtitles = $diskSubtitles;
            }
            
            // Encode language video files paths for secure transmission
            if (!empty($episode->language_video_files) && is_array($episode->language_video_files)) {
                $episode->encodedLanguageVideoFiles = array_map(function ($langFile) {
                    // Support both old and new field name formats
                    $langCode = $langFile['language_code'] ?? $langFile['langCode'] ?? '';
                    $langName = $langFile['language_name'] ?? $langFile['langName'] ?? '';
                    $filePath = $langFile['file_path'] ?? '';
                    $encFilePath = $langFile['encFilePath'] ?? '';
                    
                    // If we don't have encFilePath but have file_path, encode it
                    if (empty($encFilePath) && !empty($filePath)) {
                        $encFilePath = Tool::encode($filePath);
                    }
                    
                    return [
                        'language_code' => $langCode,
                        'language_name' => $langName ?: $this->getLanguageName($langCode),
                        'encFilePath' => $encFilePath
                    ];
                }, $episode->language_video_files);
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
            
            // 1. Search TV shows directly - Remove limit to get all relevant shows
            $tvshowsQuery = Tvshow::select('id', 'name', 'original_name', 'slug', 'poster_path', 'first_air_date', 'vote_average', 'overview', 'tagline', 'images', 'selected_logo')
                ->with(['seasons' => function($seasonQuery) {
                    $seasonQuery->select('id', 'tvshow_id', 'name', 'overview');
                }]);

            $tvshows = $this->applyTvshowSearchFilters($tvshowsQuery, $query)
                ->get(); // Removed limit to get all matching TV shows

            // Parse query for better TV show relevance scoring
            $parsedQuery = $this->parseCompoundQuery($query);
            
            // Add TV show results with enhanced relevance scoring
            foreach ($tvshows as $tvshow) {
                $logoUrl = null;
                if (!empty($tvshow->images) && isset($tvshow->images['logos']) && !empty($tvshow->images['logos'])) {
                    $selectedLogoIndex = $tvshow->selected_logo ?? 0;
                    if (isset($tvshow->images['logos'][$selectedLogoIndex])) {
                        $logoUrl = env('TMDB_IMAGE_BASE_URL_300') . $tvshow->images['logos'][$selectedLogoIndex]['file_path'];
                    }
                }
                
                // Calculate enhanced relevance score for TV shows
                $relevanceScore = $this->calculateTvshowRelevance($tvshow, $parsedQuery['search_terms'], $query);
                
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
                    'relevance_score' => $relevanceScore,
                ]);
            }
            
            // 2. Search episodes (with season and TV show info) - Remove limit to get all episodes
            $episodeResults = $this->searchEpisodes($query);
            foreach ($episodeResults as $episode) {
                $allResults->push($episode);
            }
            
            // 3. Search seasons (with TV show info) - Remove limit to get all seasons
            $seasonResults = $this->searchSeasons($query);
            foreach ($seasonResults as $season) {
                $allResults->push($season);
            }

            // Sort by relevance score and type priority - Remove limit to return all results
            $sortedResults = $allResults
                ->sortByDesc(function ($item) {
                    // Primary sort by type: tvshow > episode > season
                    $typePriority = ['tvshow' => 300, 'episode' => 200, 'season' => 100];
                    return ($typePriority[$item['type']] ?? 0) + ($item['relevance_score'] ?? 0);
                })
                ->values(); // Removed take($limit) to return all results

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
            $tvshows = $this->applyTvshowSearchFilters($tvshowsQuery, $query)->get(); // Removed limit
            
            foreach ($tvshows as $tvshow) {
                $allResults->push([
                    'type' => 'tvshow',
                    'id' => $tvshow->id,
                    'name' => $tvshow->name,
                    'slug' => $tvshow->slug,
                    'relevance_score' => 100,
                ]);
            }
            
            // 2. Search episodes - Get all episodes
            $episodeResults = $this->searchEpisodes($query);
            foreach ($episodeResults as $episode) {
                $allResults->push($episode);
            }
            
            // 3. Search seasons - Get all seasons  
            $seasonResults = $this->searchSeasons($query);
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
            if (!$user) {
                Log::warning('❌ Unauthorized user attempted click tracking');
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            // Validate required fields
            try {
                $request->validate([
                    'query' => 'required|string|max:500',
                    'result_type' => 'required|in:tvshow,episode,season',
                    'result_data' => 'required|array',
                    'search_timestamp' => 'required|string'
                ]);
            } catch (\Illuminate\Validation\ValidationException $e) {
                Log::error('❌ Request validation failed', [
                    'errors' => $e->errors(),
                    'input' => $request->all()
                ]);
                throw $e;
            }

            $query = $request->input('query');
            $resultType = $request->input('result_type'); // 'tvshow', 'season', 'episode'
            $resultData = $request->input('result_data'); // Full result object
            $searchTimestamp = $request->input('search_timestamp');

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
                // For seasons, the 'id' field IS the season_id
                if ($resultType === 'season') {
                    $clickData['clicked_season_id'] = $resultData['id'];
                } else {
                    // For episodes, check for season_id field
                    $clickData['clicked_season_id'] = $resultData['season_id'] ?? null;
                }
                $clickData['clicked_season_name'] = $resultData['season_name'] ?? null;
                $clickData['clicked_season_number'] = $resultData['season_number'] ?? null;
            }

            // Extract episode information for episode results  
            if ($resultType === 'episode') {
                // Episodes have 'id' field in the search results, which is the episode_id
                $clickData['clicked_episode_id'] = $resultData['id'];
                $clickData['clicked_episode_name'] = $resultData['name'];
                $clickData['clicked_episode_number'] = $resultData['episode_number'];
            }

            // Expand the search window and add fallback logic
            $searchQuery = null;
            
            // First, try to find exact match with expanded time window
            // Create separate date objects to avoid modifying the original
            $startTime = \Carbon\Carbon::parse($searchTimestamp)->subMinutes(10);
            $endTime = \Carbon\Carbon::parse($searchTimestamp)->addMinutes(10);
            
            $searchQuery = SearchQueryTvshow::where('user_id', $user->id)
                ->where('query', $query)
                ->whereBetween('created_at', [$startTime, $endTime])
                ->whereNull('clicked_result_at') // Only match unclicked searches
                ->orderByDesc('created_at')
                ->first();

            // If not found, try to find any recent search with the same query (last 15 minutes)
            if (!$searchQuery) {
                $searchQuery = SearchQueryTvshow::where('user_id', $user->id)
                    ->where('query', $query)
                    ->where('created_at', '>', now()->subMinutes(15))
                    ->whereNull('clicked_result_at') // Only match unclicked searches
                    ->orderByDesc('created_at')
                    ->first();
            }

            // If still not found, try to find any search record without click data (last hour)
            if (!$searchQuery) {
                $searchQuery = SearchQueryTvshow::where('user_id', $user->id)
                    ->where('query', $query)
                    ->whereNull('clicked_result_at')
                    ->where('created_at', '>', now()->subHours(1))
                    ->orderByDesc('created_at')
                    ->first();
            }



            if ($searchQuery) {
                // Update the existing search record
                $updated = $searchQuery->update($clickData);
                
                if (!$updated) {
                    Log::error('❌ Failed to update TV show search record', [
                        'search_id' => $searchQuery->id,
                        'click_data' => $clickData
                    ]);
                } else {
                    // Reload the model to verify the update
                    $searchQuery->refresh();
                }

            } else {
                // No matching search record found - log this for debugging
                Log::warning('No TV show search record found for click tracking', [
                    'user_id' => $user->id,
                    'query' => $query,
                    'result_type' => $resultType,
                    'search_timestamp' => $searchTimestamp,
                    'searched_time_ranges' => [
                        'exact_window' => [$startTime->toISOString(), $endTime->toISOString()],
                        'recent_15min' => now()->subMinutes(15)->toISOString(),
                        'last_hour' => now()->subHours(1)->toISOString()
                    ]
                ]);
                
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
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::error('❌ Failed to track TV show search click', [
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
     * Parse query to extract show names and search terms with enhanced article-aware matching
     *
     * @param string $query
     * @return array
     */
    private function parseCompoundQuery(string $query): array
    {
        $words = explode(' ', trim(strtolower($query)));
        
        if (count($words) < 2) {
            return [
                'show_context' => [],
                'search_terms' => [$query],
                'original_query' => $query
            ];
        }

        // Try to identify TV show names in the query
        $showMatches = [];
        $searchTerms = [];
        
        // Get potential show names from database for matching
        $allShows = Cache::remember('tvshow_names_for_search', 3600, function () {
            return DB::table('tvshows')
                ->select('id', 'name', 'slug')
                ->get()
                ->mapWithKeys(function ($show) {
                    return [
                        strtolower($show->name) => [
                            'id' => $show->id,
                            'name' => $show->name,
                            'slug' => $show->slug
                        ]
                    ];
                });
        });

        // Helper function to strip common articles
        $stripArticles = function($name) {
            $articles = ['the', 'a', 'an'];
            $words = explode(' ', trim($name));
            if (count($words) > 1 && in_array($words[0], $articles)) {
                return implode(' ', array_slice($words, 1));
            }
            return $name;
        };

        $wordCount = count($words);
        
        // First pass: try exact matches
        for ($length = min($wordCount, 4); $length >= 2; $length--) {
            for ($start = 0; $start <= $wordCount - $length; $start++) {
                $possibleShowName = implode(' ', array_slice($words, $start, $length));
                
                // Check for exact match
                if (isset($allShows[$possibleShowName])) {
                    $showMatches[] = $allShows[$possibleShowName];
                    $remainingWords = array_merge(
                        array_slice($words, 0, $start),
                        array_slice($words, $start + $length)
                    );
                    $searchTerms = array_merge($searchTerms, $remainingWords);
                    break 2; // Found a match, break both loops
                }
            }
        }
        
        // Second pass: try article-aware matching if no exact match found
        if (empty($showMatches)) {
            foreach ($allShows as $showNameLower => $showData) {
                $showWords = explode(' ', $showNameLower);
                $showWordCount = count($showWords);
                
                // Method 1: Check if the show name appears at the beginning of the query
                if ($showWordCount <= $wordCount) {
                    $queryPrefix = implode(' ', array_slice($words, 0, $showWordCount));
                    if ($queryPrefix === $showNameLower) {
                        $showMatches[] = $showData;
                        $searchTerms = array_slice($words, $showWordCount);
                        break; // Found a match, stop looking
                    }
                }
                
                // Method 2: Article-aware matching - check if query starts with show name (without articles)
                $showNameNoArticle = $stripArticles($showNameLower);
                
                // Try to match "simpsons casino" with "the simpsons"
                if (str_starts_with(implode(' ', $words), $showNameNoArticle . ' ')) {
                    $showMatches[] = $showData;
                    // Extract search terms by removing the show name part
                    $searchTermsPart = substr(implode(' ', $words), strlen($showNameNoArticle . ' '));
                    $searchTerms = explode(' ', trim($searchTermsPart));
                    break; // Found a match, stop looking
                }
                
                // Method 3: Check if query exactly matches show name without article
                if (implode(' ', $words) === $showNameNoArticle) {
                    $showMatches[] = $showData;
                    $searchTerms = []; // No additional search terms
                    break; // Found a match, stop looking
                }
            }
        }
        
        // Third pass: position-flexible matching (show name anywhere in query)
        if (empty($showMatches)) {
            foreach ($allShows as $showNameLower => $showData) {
                $showWords = explode(' ', $showNameLower);
                $showWordCount = count($showWords);
                
                // Try to find show name at any position in the query
                for ($start = 0; $start <= $wordCount - $showWordCount; $start++) {
                    $possibleMatch = implode(' ', array_slice($words, $start, $showWordCount));
                    
                    if ($possibleMatch === $showNameLower) {
                        $showMatches[] = $showData;
                        // Extract search terms from both before and after the show name
                        $beforeWords = array_slice($words, 0, $start);
                        $afterWords = array_slice($words, $start + $showWordCount);
                        $searchTerms = array_merge($beforeWords, $afterWords);
                        break 2; // Found exact match, break both loops
                    }
                }
                
                // Also try article-aware matching at any position
                $showNameNoArticle = $stripArticles($showNameLower);
                $showNoArticleWords = explode(' ', $showNameNoArticle);
                $showNoArticleWordCount = count($showNoArticleWords);
                
                if ($showNoArticleWordCount < $wordCount) { // Only if there's room for search terms
                    for ($start = 0; $start <= $wordCount - $showNoArticleWordCount; $start++) {
                        $possibleMatch = implode(' ', array_slice($words, $start, $showNoArticleWordCount));
                        
                        if ($possibleMatch === $showNameNoArticle) {
                            $showMatches[] = $showData;
                            // Extract search terms from both before and after the show name
                            $beforeWords = array_slice($words, 0, $start);
                            $afterWords = array_slice($words, $start + $showNoArticleWordCount);
                            $searchTerms = array_merge($beforeWords, $afterWords);
                            break 2; // Found match, break both loops
                        }
                    }
                }
            }
        }
        
        // Fourth pass: fuzzy partial matching if still no match found
        if (empty($showMatches)) {
            foreach ($allShows as $showNameLower => $showData) {
                $showNameNoArticle = $stripArticles($showNameLower);
                $showNameWords = explode(' ', $showNameNoArticle);
                
                // Check if all words of the show name (without articles) appear in query
                $queryStr = implode(' ', $words);
                $allWordsMatch = true;
                foreach ($showNameWords as $showWord) {
                    if (stripos($queryStr, $showWord) === false) {
                        $allWordsMatch = false;
                        break;
                    }
                }
                
                if ($allWordsMatch && count($showNameWords) >= 2) { // Only match multi-word shows
                    $showMatches[] = $showData;
                    // Remove show name words from search terms
                    $searchTerms = array_filter($words, function($word) use ($showNameWords) {
                        return !in_array($word, $showNameWords);
                    });
                    break; // Found a match, stop looking
                }
            }
        }
        
        // If no show context found, treat entire query as search terms
        if (empty($showMatches)) {
            $searchTerms = $words;
        }
        
        return [
            'show_context' => $showMatches,
            'search_terms' => array_filter($searchTerms), // Remove empty values
            'original_query' => $query
        ];
    }

    /**
     * Enhanced search episodes with compound query support and better context awareness
     *
     * @param string $query
     * @return array
     */
    private function searchEpisodes(string $query): array
    {
        $results = [];
        
        try {
            // Parse the query to understand context
            $parsedQuery = $this->parseCompoundQuery($query);
            $showContext = $parsedQuery['show_context'];
            $searchTerms = $parsedQuery['search_terms'];
            $originalQuery = $parsedQuery['original_query'];
            
            // Build the base query
            $episodesQuery = DB::table('episodes')
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
                );

            // If we have show context, prioritize episodes from those shows
            if (!empty($showContext)) {
                $showIds = collect($showContext)->pluck('id')->toArray();
                
                // First, get episodes from the identified shows
                $contextEpisodes = (clone $episodesQuery)
                    ->whereIn('tvshows.id', $showIds)
                    ->where(function ($q) use ($searchTerms, $originalQuery) {
                        // If we have search terms, use them; otherwise fall back to original query
                        if (!empty($searchTerms)) {
                            $first = true;
                            
                            // Search in episode content with the remaining terms
                            foreach ($searchTerms as $term) {
                                if ($first) {
                                    $q->where('episodes.name', 'LIKE', "%{$term}%")
                                      ->orWhere('episodes.overview', 'LIKE', "%{$term}%");
                                    $first = false;
                                } else {
                                    $q->orWhere('episodes.name', 'LIKE', "%{$term}%")
                                      ->orWhere('episodes.overview', 'LIKE', "%{$term}%");
                                }
                                
                                // Search in episode credits (JSON field)
                                if (config('database.default') === 'mysql') {
                                    $q->orWhereRaw("JSON_SEARCH(LOWER(episodes.credits), 'all', LOWER(?)) IS NOT NULL", ["%{$term}%"]);
                                } else {
                                    $q->orWhere('episodes.credits', 'LIKE', "%{$term}%");
                                }
                            }
                        } else {
                            // No search terms, use original query
                            $q->where('episodes.name', 'LIKE', "%{$originalQuery}%")
                              ->orWhere('episodes.overview', 'LIKE', "%{$originalQuery}%");
                        }
                    })
                    // Add database-level ordering to prioritize name matches
                    ->orderByRaw(
                        config('database.default') === 'mysql' 
                            ? "CASE 
                                WHEN episodes.name LIKE ? THEN 1 
                                WHEN episodes.overview LIKE ? THEN 2 
                                ELSE 3 
                              END, episodes.name"
                            : "CASE 
                                WHEN episodes.name LIKE ? THEN 1 
                                WHEN episodes.overview LIKE ? THEN 2 
                                ELSE 3 
                              END, episodes.name",
                        ["%{$originalQuery}%", "%{$originalQuery}%"]
                    )
                    ->get(); // Removed limit to get all context episodes
                
                // Process context episodes with higher relevance
                foreach ($contextEpisodes as $episode) {
                    $relevanceScore = $this->calculateEpisodeRelevance($episode, $searchTerms, $originalQuery, true);
                    $results[] = $this->formatEpisodeResult($episode, $relevanceScore);
                }
                
                // Search more broadly in non-context shows
                $broadEpisodes = (clone $episodesQuery)
                    ->whereNotIn('tvshows.id', $showIds) // Exclude already searched shows
                    ->where(function ($q) use ($searchTerms, $originalQuery) {
                        // If we have search terms, use them; otherwise fall back to original query
                        if (!empty($searchTerms)) {
                            $first = true;
                            
                            foreach ($searchTerms as $term) {
                                if ($first) {
                                    $q->where('episodes.name', 'LIKE', "%{$term}%")
                                      ->orWhere('episodes.overview', 'LIKE', "%{$term}%");
                                    $first = false;
                                } else {
                                    $q->orWhere('episodes.name', 'LIKE', "%{$term}%")
                                      ->orWhere('episodes.overview', 'LIKE', "%{$term}%");
                                }
                                
                                if (config('database.default') === 'mysql') {
                                    $q->orWhereRaw("JSON_SEARCH(LOWER(episodes.credits), 'all', LOWER(?)) IS NOT NULL", ["%{$term}%"]);
                                } else {
                                    $q->orWhere('episodes.credits', 'LIKE', "%{$term}%");
                                }
                            }
                        } else {
                            // No search terms, use original query
                            $q->where('episodes.name', 'LIKE', "%{$originalQuery}%")
                              ->orWhere('episodes.overview', 'LIKE', "%{$originalQuery}%");
                        }
                    })
                    // Add database-level ordering to prioritize name matches
                    ->orderByRaw(
                        config('database.default') === 'mysql' 
                            ? "CASE 
                                WHEN episodes.name LIKE ? THEN 1 
                                WHEN episodes.overview LIKE ? THEN 2 
                                ELSE 3 
                              END, episodes.name"
                            : "CASE 
                                WHEN episodes.name LIKE ? THEN 1 
                                WHEN episodes.overview LIKE ? THEN 2 
                                ELSE 3 
                              END, episodes.name",
                        ["%{$originalQuery}%", "%{$originalQuery}%"]
                    )
                    ->get(); // Removed limit to get all broad search episodes
                
                foreach ($broadEpisodes as $episode) {
                    $relevanceScore = $this->calculateEpisodeRelevance($episode, $searchTerms, $originalQuery, false);
                    $results[] = $this->formatEpisodeResult($episode, $relevanceScore);
                }
            } else {
                // No show context, search all episodes normally
                // Enhanced database-level ordering with better relevance scoring
                $episodes = $episodesQuery
                    ->where(function ($q) use ($originalQuery) {
                        $q->where('episodes.name', 'LIKE', "%{$originalQuery}%")
                          ->orWhere('episodes.overview', 'LIKE', "%{$originalQuery}%");
                        
                        if (config('database.default') === 'mysql') {
                            $q->orWhereRaw("JSON_SEARCH(LOWER(episodes.credits), 'all', LOWER(?)) IS NOT NULL", ["%{$originalQuery}%"]);
                        } else {
                            $q->orWhere('episodes.credits', 'LIKE', "%{$originalQuery}%");
                        }
                    })
                    // Enhanced database-level ordering with better relevance scoring
                    ->orderByRaw(
                        config('database.default') === 'mysql' 
                            ? "CASE 
                                WHEN LOWER(episodes.name) = LOWER(?) THEN 1
                                WHEN episodes.name LIKE ? THEN 2
                                WHEN episodes.name LIKE ? THEN 3
                                WHEN episodes.name LIKE ? THEN 4
                                WHEN episodes.overview LIKE ? THEN 5
                                ELSE 6
                              END, 
                              CASE WHEN episodes.vote_average IS NOT NULL THEN episodes.vote_average ELSE 0 END DESC,
                              episodes.name"
                            : "CASE 
                                WHEN LOWER(episodes.name) = LOWER(?) THEN 1
                                WHEN episodes.name LIKE ? THEN 2
                                WHEN episodes.name LIKE ? THEN 3
                                WHEN episodes.name LIKE ? THEN 4
                                WHEN episodes.overview LIKE ? THEN 5
                                ELSE 6
                              END, 
                              CASE WHEN episodes.vote_average IS NOT NULL THEN episodes.vote_average ELSE 0 END DESC,
                              episodes.name",
                        [
                            $originalQuery,                    // Exact match
                            "{$originalQuery} %",              // Starts with query
                            "% {$originalQuery}",              // Ends with query  
                            "%{$originalQuery}%",              // Contains query anywhere
                            "%{$originalQuery}%"               // Overview contains query
                        ]
                    )
                    ->get(); // Removed limit to get all matching episodes
                
                foreach ($episodes as $episode) {
                    $relevanceScore = $this->calculateEpisodeRelevance($episode, [$originalQuery], $originalQuery, false);
                    $results[] = $this->formatEpisodeResult($episode, $relevanceScore);
                }
            }
            
            // Sort results by relevance score (no limit applied)
            usort($results, function ($a, $b) {
                return $b['relevance_score'] <=> $a['relevance_score'];
            });
            
        } catch (\Exception $e) {
            Log::error('Enhanced episode search error', [
                'query' => $query,
                'error' => $e->getMessage()
            ]);
        }

        return $results;
    }

    /**
     * Calculate relevance score for episode results
     *
     * @param object $episode
     * @param array $searchTerms
     * @param string $originalQuery
     * @param bool $hasShowContext
     * @return int
     */
    private function calculateEpisodeRelevance($episode, array $searchTerms, string $originalQuery, bool $hasShowContext): int
    {
        $relevanceScore = 0;
        
        // Boost for show context match
        if ($hasShowContext) {
            $relevanceScore += 100;
        }
        
        // Check for exact episode name match (highest priority)
        if (!empty($searchTerms)) {
            foreach ($searchTerms as $term) {
                if (strtolower($episode->episode_name) === strtolower($term)) {
                    $relevanceScore += 200; // Very high score for exact name match
                } elseif (stripos($episode->episode_name, $term) !== false) {
                    $relevanceScore += 80;
                }
            }
        }
        
        // Check exact match in episode name with original query
        if (strtolower($episode->episode_name) === strtolower($originalQuery)) {
            $relevanceScore += 200; // Very high score for exact name match
        } elseif (stripos($episode->episode_name, $originalQuery) !== false) {
            $relevanceScore += 70;
        }
        
        // Check matches in episode overview
        foreach ($searchTerms as $term) {
            if (stripos($episode->episode_overview, $term) !== false) {
                $relevanceScore += 50;
            }
        }
        
        // Check matches in episode credits
        foreach ($searchTerms as $term) {
            if (stripos($episode->episode_credits, $term) !== false) {
                $relevanceScore += 30;
            }
        }
        
        // Bonus for newer episodes (slight boost)
        if ($episode->episode_air_date && strtotime($episode->episode_air_date) > strtotime('-2 years')) {
            $relevanceScore += 5;
        }
        
        // Bonus for higher rated episodes
        if ($episode->episode_vote_average && $episode->episode_vote_average > 7.0) {
            $relevanceScore += 10;
        }
        
        return $relevanceScore;
    }

    /**
     * Format episode result for API response
     *
     * @param object $episode
     * @param int $relevanceScore
     * @return array
     */
    private function formatEpisodeResult($episode, int $relevanceScore): array
    {
        // Get TV show logo
        $logoUrl = null;
        $tvshowImages = json_decode($episode->tvshow_images, true);
        if (!empty($tvshowImages) && isset($tvshowImages['logos']) && !empty($tvshowImages['logos'])) {
            $selectedLogoIndex = $episode->tvshow_selected_logo ?? 0;
            if (isset($tvshowImages['logos'][$selectedLogoIndex])) {
                $logoUrl = env('TMDB_IMAGE_BASE_URL_300') . $tvshowImages['logos'][$selectedLogoIndex]['file_path'];
            }
        }

        return [
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

    /**
     * Enhanced search seasons with compound query support and better context awareness
     *
     * @param string $query
     * @return array
     */
    private function searchSeasons(string $query): array
    {
        $results = [];
        
        try {
            // Parse the query to understand context
            $parsedQuery = $this->parseCompoundQuery($query);
            $showContext = $parsedQuery['show_context'];
            $searchTerms = $parsedQuery['search_terms'];
            $originalQuery = $parsedQuery['original_query'];
            
            // Build the base query
            $seasonsQuery = DB::table('seasons')
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
                );

            // If we have show context, prioritize seasons from those shows
            if (!empty($showContext)) {
                $showIds = collect($showContext)->pluck('id')->toArray();
                
                // First, get seasons from the identified shows
                $contextSeasons = (clone $seasonsQuery)
                    ->whereIn('tvshows.id', $showIds)
                    ->where(function ($q) use ($searchTerms, $originalQuery) {
                        // Search in season content with the remaining terms
                        foreach ($searchTerms as $term) {
                            $q->where('seasons.name', 'LIKE', "%{$term}%")
                              ->orWhere('seasons.overview', 'LIKE', "%{$term}%");
                        }
                        
                        // Also search with original query in case parsing was wrong
                        $q->orWhere('seasons.name', 'LIKE', "%{$originalQuery}%")
                          ->orWhere('seasons.overview', 'LIKE', "%{$originalQuery}%");
                    })
                    ->get(); // Removed limit to get all context seasons
                
                // Process context seasons with higher relevance
                foreach ($contextSeasons as $season) {
                    $relevanceScore = $this->calculateSeasonRelevance($season, $searchTerms, $originalQuery, true);
                    $results[] = $this->formatSeasonResult($season, $relevanceScore);
                }
                
                // Search more broadly in non-context shows
                $broadSeasons = (clone $seasonsQuery)
                    ->whereNotIn('tvshows.id', $showIds) // Exclude already searched shows
                    ->where(function ($q) use ($searchTerms, $originalQuery) {
                        foreach ($searchTerms as $term) {
                            $q->where('seasons.name', 'LIKE', "%{$term}%")
                              ->orWhere('seasons.overview', 'LIKE', "%{$term}%");
                        }
                        
                        $q->orWhere('seasons.name', 'LIKE', "%{$originalQuery}%")
                          ->orWhere('seasons.overview', 'LIKE', "%{$originalQuery}%");
                    })
                    ->get(); // Removed limit to get all broad search seasons
                
                foreach ($broadSeasons as $season) {
                    $relevanceScore = $this->calculateSeasonRelevance($season, $searchTerms, $originalQuery, false);
                    $results[] = $this->formatSeasonResult($season, $relevanceScore);
                }
            } else {
                // No show context, search all seasons normally
                $seasons = $seasonsQuery
                    ->where(function ($q) use ($originalQuery) {
                        $q->where('seasons.name', 'LIKE', "%{$originalQuery}%")
                          ->orWhere('seasons.overview', 'LIKE', "%{$originalQuery}%");
                    })
                    ->get(); // Removed limit to get all matching seasons
                
                foreach ($seasons as $season) {
                    $relevanceScore = $this->calculateSeasonRelevance($season, [$originalQuery], $originalQuery, false);
                    $results[] = $this->formatSeasonResult($season, $relevanceScore);
                }
            }
            
            // Sort results by relevance score (no limit applied)
            usort($results, function ($a, $b) {
                return $b['relevance_score'] <=> $a['relevance_score'];
            });
            
        } catch (\Exception $e) {
            Log::error('Enhanced season search error', [
                'query' => $query,
                'error' => $e->getMessage()
            ]);
        }

        return $results;
    }

    /**
     * Calculate relevance score for season results
     *
     * @param object $season
     * @param array $searchTerms
     * @param string $originalQuery
     * @param bool $hasShowContext
     * @return int
     */
    private function calculateSeasonRelevance($season, array $searchTerms, string $originalQuery, bool $hasShowContext): int
    {
        $relevanceScore = 0;
        
        // Boost for show context match
        if ($hasShowContext) {
            $relevanceScore += 80;
        }
        
        // Check matches in season name (highest priority)
        foreach ($searchTerms as $term) {
            if (stripos($season->season_name, $term) !== false) {
                $relevanceScore += 60;
            }
        }
        
        // Check exact match in season name with original query
        if (stripos($season->season_name, $originalQuery) !== false) {
            $relevanceScore += 50;
        }
        
        // Check matches in season overview
        foreach ($searchTerms as $term) {
            if (stripos($season->season_overview, $term) !== false) {
                $relevanceScore += 40;
            }
        }
        
        // Bonus for newer seasons (slight boost)
        if ($season->season_air_date && strtotime($season->season_air_date) > strtotime('-3 years')) {
            $relevanceScore += 3;
        }
        
        // Bonus for higher rated seasons
        if ($season->season_vote_average && $season->season_vote_average > 7.0) {
            $relevanceScore += 8;
        }
        
        return $relevanceScore;
    }

    /**
     * Calculate relevance score for TV show results
     *
     * @param object $tvshow
     * @param array $searchTerms
     * @param string $originalQuery
     * @return int
     */
    private function calculateTvshowRelevance($tvshow, array $searchTerms, string $originalQuery): int
    {
        $relevanceScore = 100; // Base score for TV show matches
        
        // Check exact matches in show name (highest priority)
        if (stripos($tvshow->name, $originalQuery) !== false) {
            $relevanceScore += 100;
        }
        
        // Check matches with individual search terms
        foreach ($searchTerms as $term) {
            if (stripos($tvshow->name, $term) !== false) {
                $relevanceScore += 80;
            }
            if (stripos($tvshow->original_name, $term) !== false) {
                $relevanceScore += 70;
            }
            if (stripos($tvshow->overview, $term) !== false) {
                $relevanceScore += 40;
            }
            if (stripos($tvshow->tagline, $term) !== false) {
                $relevanceScore += 30;
            }
        }
        
        // Bonus for exact name match
        if (strtolower($tvshow->name) === strtolower($originalQuery)) {
            $relevanceScore += 200;
        }
        
        // Bonus for higher rated shows
        if ($tvshow->vote_average && $tvshow->vote_average > 7.0) {
            $relevanceScore += 15;
        }
        
        // Bonus for popular shows
        if ($tvshow->vote_count && $tvshow->vote_count > 1000) {
            $relevanceScore += 10;
        }
        
        return $relevanceScore;
    }

    /**
     * Format season result for API response
     *
     * @param object $season
     * @param int $relevanceScore
     * @return array
     */
    private function formatSeasonResult($season, int $relevanceScore): array
    {
        // Get TV show logo
        $logoUrl = null;
        $tvshowImages = json_decode($season->tvshow_images, true);
        if (!empty($tvshowImages) && isset($tvshowImages['logos']) && !empty($tvshowImages['logos'])) {
            $selectedLogoIndex = $season->tvshow_selected_logo ?? 0;
            if (isset($tvshowImages['logos'][$selectedLogoIndex])) {
                $logoUrl = env('TMDB_IMAGE_BASE_URL_300') . $tvshowImages['logos'][$selectedLogoIndex]['file_path'];
            }
        }

        return [
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

    private function getTvshowFromRoute(Request $request)
    {
        $slug = $request->route('tvshow');
        return Tvshow::where('slug', $slug)->firstOrFail();
    }

    /**
     * Get the model from the route parameters.
     * Override the trait's method to use slug-based lookup.
     */
    protected function getModelFromRoute(Request $request): Model
    {
        return $this->getTvshowFromRoute($request);
    }

    /**
     * Toggle watch later status for a tvshow.
     *
     * @param Request $request
     * @param Tvshow $tvshow
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleWatchLater(Request $request, Tvshow $tvshow)
    {
        $user = Auth::user();
        $isWatchLater = WatchLaterService::isWatchLater($tvshow, $user);

        if ($isWatchLater) {
            WatchLaterService::removeWatchLater($tvshow, $user);
        } else {
            WatchLaterService::addWatchLater($tvshow, $user);
        }

        return response()->json([
            'success' => true,
            'is_watch_later' => !$isWatchLater,
        ]);
    }

    /**
     * Toggle watch later status for a tvshow by ID.
     *
     * @param Request $request
     * @param int $tvshowId
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleWatchLaterById(Request $request, int $tvshowId)
    {
        $tvshow = Tvshow::find($tvshowId);
        if (!$tvshow) {
            return response()->json(['error' => 'TV Show not found'], 404);
        }

        $user = Auth::user();
        
        $isWatchLater = WatchLaterService::isWatchLater($tvshow, $user);

        // Use database transaction to ensure the operation is fully committed
        $newStatus = DB::transaction(function () use ($isWatchLater, $tvshow, $user) {
            if ($isWatchLater) {
                WatchLaterService::removeWatchLater($tvshow, $user);
                return false;
            } else {
                WatchLaterService::addWatchLater($tvshow, $user);
                return true;
            }
        });

        return response()->json([
            'success' => true,
            'is_watch_later' => $newStatus,
            'message' => $newStatus ? 'Added to watch later' : 'Removed from watch later'
        ]);
    }

    /**
     * Comprehensive search results page for TV shows, episodes, and seasons
     *
     * @param Request $request
     * @return Response
     */
    public function searchResults(Request $request): Response
    {
        $searchQuery = $request->get('q', '');
        $user = $request->user();
        
        if (empty($searchQuery) || strlen($searchQuery) < 2) {
            return Inertia::render('search-results', [
                'results' => [],
                'searchQuery' => $searchQuery,
                'totalCount' => 0,
                'breakdown' => [
                    'tvshows' => 0,
                    'episodes' => 0,
                    'seasons' => 0,
                ]
            ]);
        }

        $startTime = microtime(true);
        $allResults = collect();
        
        // Parse query for better TV show relevance scoring
        $parsedQuery = $this->parseCompoundQuery($searchQuery);
        
        // 1. Search TV shows directly
        $tvshowsQuery = Tvshow::select('id', 'name', 'original_name', 'slug', 'poster_path', 'first_air_date', 'vote_average', 'overview', 'tagline', 'images', 'selected_logo')
            ->with(['seasons' => function($seasonQuery) {
                $seasonQuery->select('id', 'tvshow_id', 'name', 'overview');
            }]);

        $tvshows = $this->applyTvshowSearchFilters($tvshowsQuery, $searchQuery)
            ->get(); // Removed limit to get all matching TV shows

        // Add TV show results with enhanced relevance scoring
        foreach ($tvshows as $tvshow) {
            $logoUrl = null;
            if (!empty($tvshow->images) && isset($tvshow->images['logos']) && !empty($tvshow->images['logos'])) {
                $selectedLogoIndex = $tvshow->selected_logo ?? 0;
                if (isset($tvshow->images['logos'][$selectedLogoIndex])) {
                    $logoUrl = env('TMDB_IMAGE_BASE_URL_300') . $tvshow->images['logos'][$selectedLogoIndex]['file_path'];
                }
            }
            
            // Calculate enhanced relevance score for TV shows
            $relevanceScore = $this->calculateTvshowRelevance($tvshow, $parsedQuery['search_terms'], $searchQuery);
            
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
                'relevance_score' => $relevanceScore,
                // Add likes and watch later information
                'likes_count' => $tvshow->likesCount(),
                'is_liked' => $user ? $tvshow->isLikedBy($user) : false,
                'is_watch_later' => $user ? WatchLaterService::isWatchLater($tvshow, $user) : false,
            ]);
        }
        
        // 2. Search episodes (with season and TV show info) - Get all episodes
        $episodeResults = $this->searchEpisodes($searchQuery);
        foreach ($episodeResults as $episode) {
            $allResults->push($episode);
        }
        
        // 3. Search seasons (with TV show info) - Get all seasons
        $seasonResults = $this->searchSeasons($searchQuery);
        foreach ($seasonResults as $season) {
            $allResults->push($season);
        }

        // Sort by relevance score and type priority - Return all results
        $sortedResults = $allResults
            ->sortByDesc(function ($item) {
                // Primary sort by type: tvshow > episode > season
                $typePriority = ['tvshow' => 300, 'episode' => 200, 'season' => 100];
                return ($typePriority[$item['type']] ?? 0) + ($item['relevance_score'] ?? 0);
            })
            ->values(); // Return all results without limiting

        $searchTime = round((microtime(true) - $startTime) * 1000, 2);

        // Log the search if user is authenticated
        if ($user && $this->shouldLogTvshowSearch($searchQuery, $user->id, $sortedResults->count())) {
            try {
                SearchQueryTvshow::create([
                    'user_id' => $user->id,
                    'query' => $searchQuery,
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
                    })->toArray(),
                    'has_results' => $sortedResults->count() > 0,
                    'search_type' => 'comprehensive_page',
                    'source_page' => '/search',
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->header('User-Agent'),
                    'session_data' => [
                        'search_time_ms' => $searchTime,
                        'timestamp' => now()->toISOString(),
                        'tvshow_matches' => $tvshows->count(),
                        'episode_matches' => count($episodeResults),
                        'season_matches' => count($seasonResults),
                    ],
                ]);
            } catch (\Exception $logError) {
                Log::warning('Failed to log comprehensive search query', [
                    'query' => $searchQuery,
                    'user_id' => $user->id ?? null,
                    'error' => $logError->getMessage()
                ]);
            }
        }

        return Inertia::render('search-results', [
            'results' => $sortedResults,
            'searchQuery' => $searchQuery,
            'totalCount' => $sortedResults->count(),
            'breakdown' => [
                'tvshows' => $tvshows->count(),
                'episodes' => count($episodeResults),
                'seasons' => count($seasonResults),
            ]
        ]);
    }

    /**
     * Clean up tvshow search record when user clicks on movie
     */
    public function cleanupSearchRecord(Request $request)
    {
        try {
            $request->validate([
                'query' => 'required|string|max:500',
                'timestamp' => 'required|string'
            ]);

            $user = Auth::user();
            if (!$user) {
                return response()->json(['error' => 'Unauthorized'], 401);
            }

            $query = $request->input('query');
            $timestamp = $request->input('timestamp');

            // Find and delete the unused tvshow search record
            $deletedCount = SearchQueryTvshow::where('user_id', $user->id)
                ->where('query', $query)
                ->where('created_at', '>=', \Carbon\Carbon::parse($timestamp)->subMinutes(5))
                ->whereNull('clicked_result_at') // Only delete if not clicked yet
                ->delete();

            return response()->json([
                'success' => true,
                'deleted_records' => $deletedCount,
                'message' => 'TV show search record cleaned up'
            ]);
        } catch (\Exception $e) {
            Log::warning('Failed to cleanup tvshow search record', [
                'query' => $request->get('query'),
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to cleanup search record'
            ], 500);
        }
    }
    
    /**
     * Get language name from language code
     * 
     * @param string $code
     * @return string
     */
    private function getLanguageName(string $code): string
    {
        $languages = [
            'EN' => 'English',
            'ES' => 'Spanish',
            'PT' => 'Portuguese',
            'FR' => 'French',
            'DE' => 'German',
            'IT' => 'Italian',
            'JA' => 'Japanese',
            'KO' => 'Korean',
            'ZH' => 'Chinese',
            'CN' => 'Chinese',
            'RU' => 'Russian',
            'AR' => 'Arabic',
            'HI' => 'Hindi',
            'NL' => 'Dutch',
            'PL' => 'Polish',
            'TR' => 'Turkish',
            'SV' => 'Swedish',
            'DA' => 'Danish',
            'NO' => 'Norwegian',
            'FI' => 'Finnish',
        ];
        
        $normalizedCode = strtoupper($code);
        return $languages[$normalizedCode] ?? $normalizedCode;
    }
}
