<?php

namespace App\Http\Controllers;

use App\Models\Movie;
use App\Models\SearchQuery;
use App\Services\MovieService;
use App\Services\Tool;
use App\Traits\HandlesLikes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\App;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Illuminate\Http\JsonResponse;

class MovieController extends Controller
{
    use HandlesLikes;
    /**
     * Display a listing of the movies.
     *
     * @param Request $request
     * @param array|string $columns
     * @param bool $showOnlyFreeMovies
     * @return \Inertia\Response
     */
    public function index(Request $request, array|string $columns = ['id', 'title', 'poster_path', 'vote_average', 'release_date', 'slug', 'subtitles', 'google_drive_file_id', 'is_free'])
    {
        $isProduction = App::environment('production');
        $showOnlyFreeMovies = env('SHOW_ONLY_FREE_MOVIES_IN_PRODUCTION', false);

        $user = Auth::user();
        $searchQuery = $request->get('search');

        // if columns is a string '*', grab all columns
        if (is_string($columns) && $columns === '*') {
            $columns = Schema::getColumnListing((new Movie)->getTable());
        }

        if ($isProduction) {
            if ($showOnlyFreeMovies) {
                $moviesQuery = Movie::select($columns)
                    ->whereNotNull('google_drive_file_id')
                    ->where('is_free', true)
                    ->selectRaw('COALESCE(json_array_length(trailers), 0) as trailer_count');
            } else {
                $moviesQuery = Movie::select($columns)
                    ->whereNotNull('google_drive_file_id')
                    ->selectRaw('COALESCE(json_array_length(trailers), 0) as trailer_count');
            }
        } else {
            $moviesQuery = Movie::select($columns)
                ->selectRaw('COALESCE(json_array_length(trailers), 0) as trailer_count');
        }

        // Apply search filter if search query exists
        if ($searchQuery && strlen($searchQuery) >= 2) {
            $moviesQuery->where(function ($q) use ($searchQuery) {
                $q->where('title', 'LIKE', "%{$searchQuery}%")
                  ->orWhere('original_name', 'LIKE', "%{$searchQuery}%")
                  ->orWhere('tagline', 'LIKE', "%{$searchQuery}%")
                  ->orWhere('overview', 'LIKE', "%{$searchQuery}%")
                  ->orWhereRaw('CAST(alternative_titles AS CHAR) LIKE ?', ["%{$searchQuery}%"])
                  ->orWhereRaw('CAST(keywords AS CHAR) LIKE ?', ["%{$searchQuery}%"])
                  ->orWhereRaw('CAST(credits AS CHAR) LIKE ?', ["%{$searchQuery}%"]);
            })->orderByRaw("CASE 
                WHEN title LIKE ? THEN 1
                WHEN original_name LIKE ? THEN 2
                WHEN tagline LIKE ? THEN 3
                WHEN overview LIKE ? THEN 4
                ELSE 5
            END", ["{$searchQuery}%", "{$searchQuery}%", "{$searchQuery}%", "{$searchQuery}%"]);
        } else {
            $moviesQuery->orderBy('title', 'asc');
        }

        $movies = $moviesQuery->get();

        $movies = $movies->map(function ($movie) use ($user) {
            $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
            $movie->is_liked = $user ? $movie->isLikedBy($user) : false;
            $movie->likes_count = $movie->likesCount();
            $movie->subtitles = json_decode($movie->subtitles, true) ?: [];
            if (isset($movie->subtitles['path'])) unset($movie->subtitles['path']);
            if (isset($movie->subtitles['encPath'])) unset($movie->subtitles['encPath']);
            return $movie;
        });

        if ($isProduction) {
            $recentlyAddedMoviesQuery = Movie::select('id', 'title', 'poster_path', 'vote_average', 'release_date', 'slug', 'subtitles', 'google_drive_file_id')
                ->whereNotNull('google_drive_file_id');
        } else {
            $recentlyAddedMoviesQuery = Movie::select('id', 'title', 'poster_path', 'vote_average', 'release_date', 'slug', 'subtitles', 'google_drive_file_id');
        }
        
        $recentlyAddedMovies = $recentlyAddedMoviesQuery
            ->selectRaw('COALESCE(json_array_length(trailers), 0) as trailer_count')
            ->orderBy('created_at', 'desc')
            ->take(20)
            ->get()
            ->map(function ($movie) use ($user) {
                $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
                $movie->is_liked = $user ? $movie->isLikedBy($user) : false;
                $movie->likes_count = $movie->likesCount();
                $movie->subtitles = json_decode($movie->subtitles, true) ?: [];
                if (isset($movie->subtitles['path'])) unset($movie->subtitles['path']);
                if (isset($movie->subtitles['encPath'])) unset($movie->subtitles['encPath']);
                return $movie;
            });

        return Inertia::render('movies', [
            'movies' => $movies,
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
            'recentlyAddedMovies' => $recentlyAddedMovies,
            'searchQuery' => $searchQuery,
        ]);
    }

    /**
     * Display the user's watch later movies.
     *
     * @return \Inertia\Response
     */
    public function watchLater()
    {
        $user = Auth::user();

        $watchLaterMovies = $user->watchLaterMovies()
            ->select('movies.id', 'movies.title', 'movies.poster_path', 'movies.vote_average', 'movies.release_date', 'movies.slug', 'movies.subtitles', 'movies.google_drive_file_id')
            ->selectRaw('COALESCE(json_array_length(movies.trailers), 0) as trailer_count')
            ->get()
            ->map(function ($movie) use ($user) {
                $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
                $movie->is_liked = $user ? $movie->isLikedBy($user) : false;
                $movie->likes_count = $movie->likesCount();
                $movie->subtitles = json_decode($movie->subtitles, true) ?: [];
                if (isset($movie->subtitles['path'])) unset($movie->subtitles['path']);
                if (isset($movie->subtitles['encPath'])) unset($movie->subtitles['encPath']);
                return $movie;
            });

        return Inertia::render('watch-later', [
            'watchLaterMovies' => $watchLaterMovies,
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
        ]);
    }

    public function show(string $slug)
    {
        $movie = Movie::where('slug', $slug)->first();
        if (!$movie) {
            return redirect()->route('movies.index');
        }

        $isProduction = App::environment('production');
        
        // In production, only allow access to movies with Google Drive IDs
        if ($isProduction && empty($movie->google_drive_file_id)) {
            return redirect()->route('movies.index');
        }
        
        $user = Auth::user();
        
        // Add like data
        $movie->is_liked = $user ? $movie->isLikedBy($user) : false;
        $movie->likes_count = $movie->likesCount();
        
        // Add comments count
        $movie->comments_count = $movie->commentsCount();
        
        // Decode subtitles JSON to make it accessible in React
        $movie->subtitles = json_decode($movie->subtitles, true) ?: [];
        $movie->genres = json_decode($movie->genres, true) ?: [];
        
        // Decode and process credits
        $credits = json_decode($movie->credits, true) ?: [];
        
        // Add profile path URLs to cast and crew
        if (isset($credits['cast'])) {
            $credits['cast'] = array_map(function ($cast) {
                $cast['profilePathUrl'] = isset($cast['profile_path']) && $cast['profile_path'] 
                    ? env('TMDB_IMAGE_BASE_URL_300') . $cast['profile_path'] 
                    : env('DEFAULT_CREDIT_IMAGE_URL');
                return $cast;
            }, $credits['cast']);
        }
        
        if (isset($credits['crew'])) {
            // Add profile path URLs to crew
            $credits['crew'] = array_map(function ($crew) {
                $crew['profilePathUrl'] = isset($crew['profile_path']) && $crew['profile_path'] 
                    ? env('TMDB_IMAGE_BASE_URL_300') . $crew['profile_path'] 
                    : env('DEFAULT_CREDIT_IMAGE_URL');
                return $crew;
            }, $credits['crew']);
            
            // Define priority positions in order
            $priorityPositions = ['director', 'executive producer', 'producer'];
            
            // Separate crew members by priority positions
            $priorityCrew = [
                'director' => [],
                'executive producer' => [],
                'producer' => [],
            ];
            $otherCrew = [];
            
            foreach ($credits['crew'] as $crewMember) {
                if (isset($crewMember['job'])) {
                    $jobLower = strtolower($crewMember['job']);
                    
                    if (in_array($jobLower, $priorityPositions)) {
                        $priorityCrew[$jobLower][] = $crewMember;
                    } else {
                        $otherCrew[] = $crewMember;
                    }
                } else {
                    $otherCrew[] = $crewMember;
                }
            }
            
            // Merge in priority order: Director, Executive Producer, Producer, then others
            $sortedCrew = [];
            foreach ($priorityPositions as $position) {
                $sortedCrew = array_merge($sortedCrew, $priorityCrew[$position]);
            }
            $credits['crew'] = array_merge($sortedCrew, $otherCrew);
        }
        
        // Assign the processed credits back to the movie
        $movie->credits = $credits;

        $movie->images = json_decode($movie->images, true);
        
        return Inertia::render('movie', [
            'movie' => $movie,
            'isProduction' => $isProduction,
            'encFilePath' => Tool::encode($movie->path),
            'imgBaseUrl300' => env('TMDB_IMAGE_BASE_URL_300'),
            'imgBaseUrl500' => env('TMDB_IMAGE_BASE_URL_500'),
            'imgBaseUrl780' => env('TMDB_IMAGE_BASE_URL_780'),
            'imgBaseUrl1280' => env('TMDB_IMAGE_BASE_URL_1280'),
        ]);
    }

    /**
     * Toggle watch later status for a movie.
     *
     * @param Request $request
     * @param Movie $movie
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleWatchLater(Request $request, Movie $movie)
    {
        $user = Auth::user();
        $isWatchLater = MovieService::isWatchLater($movie, $user);

        if ($isWatchLater) {
            MovieService::removeWatchLater($movie, $user);
        } else {
            MovieService::addWatchLater($movie, $user);
        }

        return response()->json([
            'success' => true,
            'is_watch_later' => !$isWatchLater,
        ]);
    }

    /**
     * Toggle watch later status for a movie by ID.
     *
     * @param Request $request
     * @param int $movieId
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleWatchLaterById(Request $request, int $movieId)
    {
        $movie = Movie::find($movieId);
        
        if (!$movie) {
            return response()->json([
                'success' => false,
                'message' => 'Movie not found'
            ], 404);
        }

        $user = Auth::user();
        $isWatchLater = MovieService::isWatchLater($movie, $user);

        if ($isWatchLater) {
            MovieService::removeWatchLater($movie, $user);
        } else {
            MovieService::addWatchLater($movie, $user);
        }

        return response()->json([
            'success' => true,
            'is_watch_later' => !$isWatchLater,
        ]);
    }

    /**
     * Get movie trailers.
     *
     * @param Movie $movie
     * @return \Illuminate\Http\JsonResponse
     */
    public function getTrailers(Movie $movie)
    {
        $trailers = MovieService::getMovieTrailers($movie->id);
        
        return response()->json($trailers);
    }

    /**
     * Get movie trailers by ID (works for both local and external movies).
     *
     * @param int $movieId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getTrailersById(int $movieId)
    {
        try {
            // First check if it's a local movie
            $localMovie = Movie::find($movieId);
            
            if ($localMovie) {
                // Use local movie trailers
                $trailers = MovieService::getMovieTrailers($movieId);
            } else {
                // Fetch trailers from TMDB API for external movies
                $trailers = MovieService::getTrailersFromTMDB($movieId);
            }
            
            return response()->json($trailers);
        } catch (\Exception $e) {
            return response()->json([
                'error' => 'Failed to fetch trailers',
                'message' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get movie recommendations asynchronously.
     *
     * @param Movie $movie
     * @return \Illuminate\Http\JsonResponse
     */
    public function getRecommendations(Movie $movie)
    {
        try {
            $recommendations = MovieService::getMovieRecommendations($movie);
            $user = Auth::user();
            
            // Process recommendations to include image URLs and check for local availability
            $processedRecommendations = collect($recommendations)->map(function ($recommendation) use ($user) {
                // Check if this movie exists in our local database
                $localMovie = Movie::where('id', $recommendation['id'])->first();
                
                $baseData = [
                    'id' => $recommendation['id'],
                    'title' => $recommendation['title'],
                    'poster_path' => $recommendation['poster_path'],
                    'backdrop_path' => $recommendation['backdrop_path'],
                    'vote_average' => $recommendation['vote_average'],
                    'release_date' => $recommendation['release_date'],
                    'overview' => $recommendation['overview'],
                    'poster_url' => $recommendation['poster_path'] 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $recommendation['poster_path']
                        : null,
                    'backdrop_url' => $recommendation['backdrop_path']
                        ? env('TMDB_IMAGE_BASE_URL_780') . $recommendation['backdrop_path']
                        : null,
                    'is_local' => false,
                ];

                // If movie exists locally, add additional data
                // In production, only consider movies with Google Drive IDs as locally available
                if ($localMovie && (!app()->environment('production') || !empty($localMovie->google_drive_file_id))) {
                    $subtitles = json_decode($localMovie->subtitles, true) ?: [];
                    
                    $baseData['is_local'] = true;
                    $baseData['slug'] = $localMovie->slug;
                    $baseData['google_drive_file_id'] = $localMovie->google_drive_file_id;
                    $baseData['is_watch_later'] = MovieService::isWatchLater($localMovie, $user);
                    $baseData['has_subtitles'] = !empty($subtitles);
                    $baseData['subtitle_languages'] = collect($subtitles)->pluck('languageCode')->take(3)->toArray();
                    $baseData['is_liked'] = $user ? $localMovie->isLikedBy($user) : false;
                    $baseData['likes_count'] = $localMovie->likesCount();
                } else {
                    // For non-local movies, set default like values
                    $baseData['is_liked'] = false;
                    $baseData['likes_count'] = 0;
                }

                return $baseData;
            })->take(20); // Limit to 10 recommendations
            
            return response()->json([
                'success' => true,
                'recommendations' => $processedRecommendations
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch recommendations',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get similar movies asynchronously.
     *
     * @param Movie $movie
     * @return \Illuminate\Http\JsonResponse
     */
    public function getSimilarMovies(Movie $movie)
    {
        try {
            $similarMovies = MovieService::getSimilarMovies($movie);
            $user = Auth::user();
            
            // Process similar movies to include image URLs and check for local availability
            $processedSimilarMovies = collect($similarMovies)->map(function ($movie) use ($user) {
                // Check if this movie exists in our local database
                $localMovie = Movie::where('id', $movie['id'])->first();
                
                $baseData = [
                    'id' => $movie['id'],
                    'title' => $movie['title'],
                    'poster_path' => $movie['poster_path'],
                    'backdrop_path' => $movie['backdrop_path'],
                    'vote_average' => $movie['vote_average'],
                    'release_date' => $movie['release_date'],
                    'overview' => $movie['overview'],
                    'poster_url' => $movie['poster_path'] 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $movie['poster_path']
                        : null,
                    'backdrop_url' => $movie['backdrop_path']
                        ? env('TMDB_IMAGE_BASE_URL_780') . $movie['backdrop_path']
                        : null,
                    'is_local' => false,
                ];

                // If movie exists locally, add additional data
                // In production, only consider movies with Google Drive IDs as locally available
                if ($localMovie && (!app()->environment('production') || !empty($localMovie->google_drive_file_id))) {
                    $subtitles = json_decode($localMovie->subtitles, true) ?: [];
                    
                    $baseData['is_local'] = true;
                    $baseData['slug'] = $localMovie->slug;
                    $baseData['google_drive_file_id'] = $localMovie->google_drive_file_id;
                    $baseData['is_watch_later'] = MovieService::isWatchLater($localMovie, $user);
                    $baseData['has_subtitles'] = !empty($subtitles);
                    $baseData['subtitle_languages'] = collect($subtitles)->pluck('languageCode')->take(3)->toArray();
                    $baseData['is_liked'] = $user ? $localMovie->isLikedBy($user) : false;
                    $baseData['likes_count'] = $localMovie->likesCount();
                } else {
                    // For non-local movies, set default like values
                    $baseData['is_liked'] = false;
                    $baseData['likes_count'] = 0;
                }

                return $baseData;
            })->take(20); // Limit to 10 similar movies
            
            return response()->json([
                'success' => true,
                'similar_movies' => $processedSimilarMovies
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to fetch similar movies',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Initiate async job to fetch movie recommendations and similar movies.
     * (Alternative Job Queue Approach)
     *
     * @param Movie $movie
     * @return \Illuminate\Http\JsonResponse
     */
    public function initiateRecommendationsFetch(Movie $movie)
    {
        $cacheKey = "movie_recommendations_{$movie->id}";
        
        // Check if we already have cached data
        $cachedData = Cache::get($cacheKey);
        if ($cachedData) {
            return response()->json([
                'success' => true,
                'status' => 'cached',
                'data' => $cachedData
            ]);
        }

        // Check if job is already running
        $status = Cache::get($cacheKey . '_status');
        if ($status === 'loading') {
            return response()->json([
                'success' => true,
                'status' => 'loading',
                'message' => 'Recommendations are being fetched'
            ]);
        }

        // Dispatch the job
        \App\Jobs\FetchMovieRecommendationsJob::dispatch($movie);
        
        return response()->json([
            'success' => true,
            'status' => 'initiated',
            'message' => 'Recommendation fetch job initiated'
        ]);
    }

    /**
     * Poll for job status and results.
     * (Alternative Job Queue Approach)
     *
     * @param Movie $movie
     * @return \Illuminate\Http\JsonResponse
     */
    public function pollRecommendationsStatus(Movie $movie)
    {
        $cacheKey = "movie_recommendations_{$movie->id}";
        $status = Cache::get($cacheKey . '_status', 'not_started');
        
        switch ($status) {
            case 'completed':
                $data = Cache::get($cacheKey);
                return response()->json([
                    'success' => true,
                    'status' => 'completed',
                    'data' => $data
                ]);
                
            case 'loading':
                return response()->json([
                    'success' => true,
                    'status' => 'loading',
                    'message' => 'Still fetching recommendations...'
                ]);
                
            case 'failed':
                $error = Cache::get($cacheKey . '_error', 'Unknown error');
                return response()->json([
                    'success' => false,
                    'status' => 'failed',
                    'message' => $error
                ]);
                
            default:
                return response()->json([
                    'success' => false,
                    'status' => 'not_started',
                    'message' => 'Job not initiated'
                ]);
        }
    }

    /**
     * Search movies based on multiple criteria.
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
            
            // Search movies with comprehensive criteria
            $movies = Movie::select('id', 'title', 'original_name', 'slug', 'poster_path', 'release_date', 'vote_average', 'overview', 'tagline', 'subtitles')
                ->where(function ($q) use ($query) {
                    // Search in title
                    $q->where('title', 'LIKE', "%{$query}%")
                      // Search in original_name
                      ->orWhere('original_name', 'LIKE', "%{$query}%")
                      // Search in tagline
                      ->orWhere('tagline', 'LIKE', "%{$query}%")
                      // Search in overview
                      ->orWhere('overview', 'LIKE', "%{$query}%")
                      // Search in alternative_titles JSON (convert to string and search)
                      ->orWhereRaw('CAST(alternative_titles AS CHAR) LIKE ?', ["%{$query}%"])
                      // Search in keywords JSON (convert to string and search)
                      ->orWhereRaw('CAST(keywords AS CHAR) LIKE ?', ["%{$query}%"])
                      // Search in credits JSON (convert to string and search)
                      ->orWhereRaw('CAST(credits AS CHAR) LIKE ?', ["%{$query}%"]);
                })
                ->orderByRaw("CASE 
                    WHEN title LIKE ? THEN 1
                    WHEN original_name LIKE ? THEN 2
                    WHEN tagline LIKE ? THEN 3
                    WHEN overview LIKE ? THEN 4
                    ELSE 5
                END", ["{$query}%", "{$query}%", "{$query}%", "{$query}%"])
                ->limit($limit)
                ->get();

            // Process results
            $results = $movies->map(function ($movie) use ($user) {
                $subtitles = json_decode($movie->subtitles, true) ?: [];
                
                return [
                    'id' => $movie->id,
                    'title' => $movie->title,
                    'original_name' => $movie->original_name,
                    'slug' => $movie->slug,
                    'poster_path' => $movie->poster_path,
                    'poster_url' => $movie->poster_path 
                        ? env('TMDB_IMAGE_BASE_URL_300') . $movie->poster_path
                        : null,
                    'release_date' => $movie->release_date,
                    'vote_average' => $movie->vote_average,
                    'overview' => $movie->overview,
                    'tagline' => $movie->tagline,
                    'is_watch_later' => MovieService::isWatchLater($movie, $user),
                    'has_subtitles' => !empty($subtitles),
                    'subtitle_languages' => collect($subtitles)->pluck('languageCode')->take(3)->toArray(),
                ];
            });

            $searchTime = round((microtime(true) - $startTime) * 1000, 2); // Convert to milliseconds

            // Smart logging: Only log if requested and meaningful
            if ($shouldLog && $this->shouldLogSearch($query, $user->id, $results->count())) {
                try {
                    SearchQuery::create([
                        'user_id' => $user->id,
                        'query' => $query,
                        'results_count' => $results->count(),
                        'results_summary' => $results->take(5)->map(function ($movie) {
                            return [
                                'id' => $movie['id'],
                                'title' => $movie['title'],
                                'slug' => $movie['slug']
                            ];
                        })->toArray(),
                        'has_results' => $results->count() > 0,
                        'search_type' => 'real_time',
                        'source_page' => $request->header('Referer') ? parse_url($request->header('Referer'), PHP_URL_PATH) : null,
                        'ip_address' => $request->ip(),
                        'user_agent' => $request->header('User-Agent'),
                        'session_data' => [
                            'search_time_ms' => $searchTime,
                            'limit' => $limit,
                            'timestamp' => now()->toISOString(),
                        ],
                    ]);
                } catch (\Exception $logError) {
                    // Don't fail the search if logging fails
                    Log::warning('Failed to log search query', [
                        'query' => $query,
                        'user_id' => $user->id,
                        'error' => $logError->getMessage()
                    ]);
                }
            }

            return response()->json([
                'success' => true,
                'results' => $results,
                'query' => $query,
                'total' => $results->count()
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Search failed',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Track when a user clicks on a search result.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function trackSearchClick(Request $request)
    {
        try {
            $request->validate([
                'query' => 'required|string|max:500',
                'movie_id' => 'required|integer',
                'movie_title' => 'required|string|max:255',
                'search_timestamp' => 'required|string', // ISO timestamp of when search was performed
            ]);

            $user = Auth::user();
            $clickTimestamp = now();
            
            // Calculate time from search to click
            $searchTime = \Carbon\Carbon::parse($request->input('search_timestamp'));
            $timeToClickMs = $clickTimestamp->diffInMilliseconds($searchTime);

            // Find the most recent search query to update
            $searchQuery = SearchQuery::where('user_id', $user->id)
                ->where('query', $request->input('query'))
                ->where('created_at', '>=', $searchTime->subMinutes(5)) // Within 5 minutes
                ->whereNull('clicked_result_at') // Haven't clicked yet
                ->orderByDesc('created_at')
                ->first();

            if ($searchQuery) {
                // Update existing search record
                $searchQuery->update([
                    'clicked_result_at' => $clickTimestamp,
                    'clicked_movie_id' => $request->input('movie_id'),
                    'clicked_movie_title' => $request->input('movie_title'),
                    'time_to_click_ms' => $timeToClickMs,
                ]);
            } else {
                // Create new search record if not found (fallback)
                SearchQuery::create([
                    'user_id' => $user->id,
                    'query' => $request->input('query'),
                    'results_count' => 1, // We know they found at least this one
                    'has_results' => true,
                    'search_type' => 'real_time',
                    'clicked_result_at' => $clickTimestamp,
                    'clicked_movie_id' => $request->input('movie_id'),
                    'clicked_movie_title' => $request->input('movie_title'),
                    'time_to_click_ms' => $timeToClickMs,
                    'ip_address' => $request->ip(),
                    'user_agent' => $request->header('User-Agent'),
                    'session_data' => [
                        'fallback_creation' => true,
                        'timestamp' => $clickTimestamp->toISOString(),
                    ],
                ]);
            }

            return response()->json(['success' => true]);
        } catch (\Exception $e) {
            Log::warning('Failed to track search click', [
                'query' => $request->get('query'),
                'movie_id' => $request->get('movie_id'),
                'user_id' => Auth::id(),
                'error' => $e->getMessage()
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Failed to track click'
            ], 500);
        }
    }

    // Popular searches in last 30 days
    public function getPopularSearchTerms()
    {
        // Check if user has permission to view analytics
        if (!Auth::user()->hasPermissionTo('view analytics')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $terms = SearchQuery::getPopularSearchTerms(10, 30);
        return response()->json($terms);
    }

    // Searches with no results (need to improve)
    public function getNoResultSearches()
    {
        // Check if user has permission to view analytics
        if (!Auth::user()->hasPermissionTo('view analytics')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $searches = SearchQuery::getNoResultSearches(20, 30);
        return response()->json($searches);
    }

    // Complete analytics summary
    public function getAnalyticsSummary()
    {
        // Check if user has permission to view analytics
        if (!Auth::user()->hasPermissionTo('view analytics')) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $summary = SearchQuery::getAnalyticsSummary(30);
        return response()->json($summary);
    }

    // Custom queries
    public function getCustomQueries()
    {
        $queries = SearchQuery::withResults()->withClicks()->count();
        return response()->json($queries);
    }

    /**
     * Log a search query without performing the search (for delayed logging).
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function logSearch(Request $request)
    {
        try {
            $request->validate([
                'query' => 'required|string|max:500',
                'timestamp' => 'required|string',
            ]);

            $query = $request->input('query');
            $user = Auth::user();
            
            // Only log if it meets our criteria
            if (!$this->shouldLogSearch($query, $user->id, 0)) {
                return response()->json(['success' => true, 'logged' => false]);
            }

            // Check if we already logged this exact query recently (avoid duplicates)
            $recentLog = SearchQuery::where('user_id', $user->id)
                ->where('query', $query)
                ->where('created_at', '>=', now()->subMinutes(5))
                ->first();

            if ($recentLog) {
                return response()->json(['success' => true, 'logged' => false, 'reason' => 'duplicate']);
            }

            // First get the total count of matching movies
            $resultsCount = Movie::where(function ($q) use ($query) {
                $q->where('title', 'LIKE', "%{$query}%")
                  ->orWhere('original_name', 'LIKE', "%{$query}%")
                  ->orWhere('tagline', 'LIKE', "%{$query}%")
                  ->orWhere('overview', 'LIKE', "%{$query}%")
                  ->orWhereRaw('CAST(alternative_titles AS CHAR) LIKE ?', ["%{$query}%"])
                  ->orWhereRaw('CAST(keywords AS CHAR) LIKE ?', ["%{$query}%"])
                  ->orWhereRaw('CAST(credits AS CHAR) LIKE ?', ["%{$query}%"]);
            })->count();

            // Then get top 5 results for summary
            $movies = Movie::select('id', 'title', 'slug')
                ->where(function ($q) use ($query) {
                    $q->where('title', 'LIKE', "%{$query}%")
                      ->orWhere('original_name', 'LIKE', "%{$query}%")
                      ->orWhere('tagline', 'LIKE', "%{$query}%")
                      ->orWhere('overview', 'LIKE', "%{$query}%")
                      ->orWhereRaw('CAST(alternative_titles AS CHAR) LIKE ?', ["%{$query}%"])
                      ->orWhereRaw('CAST(keywords AS CHAR) LIKE ?', ["%{$query}%"])
                      ->orWhereRaw('CAST(credits AS CHAR) LIKE ?', ["%{$query}%"]);
                })
                ->orderByRaw("CASE 
                    WHEN title LIKE ? THEN 1
                    WHEN original_name LIKE ? THEN 2
                    WHEN tagline LIKE ? THEN 3
                    WHEN overview LIKE ? THEN 4
                    ELSE 5
                END", ["{$query}%", "{$query}%", "{$query}%", "{$query}%"])
                ->limit(5) // Get top 5 for summary
                ->get();

            $resultsSummary = $movies->map(function ($movie) {
                return [
                    'id' => $movie->id,
                    'title' => $movie->title,
                    'slug' => $movie->slug
                ];
            })->toArray();

            SearchQuery::create([
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
                    'logged_at' => now()->toISOString(),
                    'original_timestamp' => $request->input('timestamp'),
                ],
            ]);

            return response()->json(['success' => true, 'logged' => true]);
        } catch (\Exception $e) {
            Log::warning('Failed to log search query', [
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
     * Determine if a search query should be logged to reduce noise from partial typing.
     *
     * @param string $query
     * @param int $userId
     * @param int $resultsCount
     * @return bool
     */
    private function shouldLogSearch(string $query, int $userId, int $resultsCount): bool
    {
        // Always log if query is very short (likely intentional)
        if (strlen($query) <= 2) {
            return false;
        }

        // Always log if query is long enough (likely complete thought)
        if (strlen($query) >= 5) {
            return true;
        }

        // For medium length queries (3-4 chars), check for recent similar searches
        $recentSearch = SearchQuery::where('user_id', $userId)
            ->where('created_at', '>=', now()->subMinutes(2))
            ->orderByDesc('created_at')
            ->first();

        if ($recentSearch) {
            // Don't log if this query is just an extension of the recent search
            // e.g., "kea" -> "kean" -> "keanu"
            if (str_starts_with($query, $recentSearch->query) || str_starts_with($recentSearch->query, $query)) {
                // Only log if this search has significantly more results (found something good)
                return $resultsCount > 0 && ($recentSearch->results_count == 0 || $resultsCount > $recentSearch->results_count * 1.5);
            }
        }

        // Log 3-4 character searches if they return results
        return $resultsCount > 0;
    }

    /**
     * Clean up partial/duplicate search queries to reduce noise in analytics.
     * This can be run manually or scheduled to clean up existing data.
     *
     * @return \Illuminate\Http\JsonResponse
     */
    public function cleanupSearchQueries()
    {
        try {
            $deletedCount = 0;
            
            // Delete very short queries (1-2 characters) that are likely partial typing
            $shortQueries = SearchQuery::whereRaw('LENGTH(query) <= 2')->count();
            SearchQuery::whereRaw('LENGTH(query) <= 2')->delete();
            $deletedCount += $shortQueries;
            
            // Find and delete progressive typing sequences
            // e.g., keep "keanu reeves" but delete "kea", "kean", "keanu", "keanu r", "keanu ree"
            $users = SearchQuery::distinct('user_id')->pluck('user_id');
            
            foreach ($users as $userId) {
                $userSearches = SearchQuery::where('user_id', $userId)
                    ->whereNull('clicked_result_at') // Don't delete searches that led to clicks
                    ->orderBy('created_at')
                    ->get();
                
                $toDelete = [];
                $lastQuery = '';
                
                foreach ($userSearches as $search) {
                    // If this query is a prefix of the last query, mark the shorter one for deletion
                    if (!empty($lastQuery) && str_starts_with($lastQuery, $search->query) && strlen($search->query) < strlen($lastQuery)) {
                        $toDelete[] = $search->id;
                    } elseif (!empty($lastQuery) && str_starts_with($search->query, $lastQuery) && strlen($lastQuery) < strlen($search->query)) {
                        // Current query extends the last one, so we can remove the previous shorter one
                        $previousSearch = SearchQuery::where('user_id', $userId)
                            ->where('query', $lastQuery)
                            ->whereNull('clicked_result_at')
                            ->first();
                        if ($previousSearch) {
                            $toDelete[] = $previousSearch->id;
                        }
                    }
                    $lastQuery = $search->query;
                }
                
                if (!empty($toDelete)) {
                    SearchQuery::whereIn('id', $toDelete)->delete();
                    $deletedCount += count($toDelete);
                }
            }
            
            return response()->json([
                'success' => true,
                'message' => "Cleaned up {$deletedCount} partial/duplicate search queries",
                'deleted_count' => $deletedCount
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'success' => false,
                'message' => 'Failed to cleanup search queries',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get users who liked a movie.
     *
     * @param Movie $movie
     * @return JsonResponse
     */
    public function getLikedUsers(Movie $movie): JsonResponse
    {
        $users = $movie->likes()->with('user:id,name')->get()->map(function ($like) {
            return [
                'id' => $like->user->id,
                'name' => $like->user->name,
            ];
        });

        return response()->json([
            'users' => $users,
            'count' => $users->count()
        ]);
    }

    /**
     * Get the movie from the route parameters.
     *
     * @param Request $request
     * @return Movie
     */
    public function getMovieFromRoute(Request $request)
    {
        $slug = $request->route('slug');
        return Movie::where('slug', $slug)->first();
    }
}
