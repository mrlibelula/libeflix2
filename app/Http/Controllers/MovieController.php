<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Movie;
use App\Services\MovieService;
use Illuminate\Support\Facades\Auth;
use App\Services\Tool;
use Illuminate\Support\Facades\Cache;

class MovieController extends Controller
{
    /**
     * Display a listing of the movies.
     *
     * @return \Inertia\Response
     */
    public function index()
    {
        $user = Auth::user();

        $movies = Movie::select('id', 'title', 'poster_path', 'vote_average', 'release_date', 'slug', 'subtitles')
            ->selectRaw('COALESCE(json_array_length(trailers), 0) as trailer_count')
            ->orderBy('title', 'asc')
            ->get();

        $movies = $movies->map(function ($movie) use ($user) {
            $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
            $movie->subtitles = json_decode($movie->subtitles, true) ?: [];
            if (isset($movie->subtitles['path'])) unset($movie->subtitles['path']);
            if (isset($movie->subtitles['encPath'])) unset($movie->subtitles['encPath']);
            return $movie;
        });

        $watchLaterMovies = $user->watchLaterMovies()
            ->select('movies.id', 'movies.title', 'movies.poster_path', 'movies.vote_average', 'movies.release_date', 'movies.slug', 'movies.subtitles')
            ->selectRaw('COALESCE(json_array_length(movies.trailers), 0) as trailer_count')
            ->get()
            ->map(function ($movie) use ($user) {
                $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
                $movie->subtitles = json_decode($movie->subtitles, true) ?: [];
                if (isset($movie->subtitles['path'])) unset($movie->subtitles['path']);
                if (isset($movie->subtitles['encPath'])) unset($movie->subtitles['encPath']);
                return $movie;
            });

        return Inertia::render('movies', [
            'movies' => $movies->shuffle(),
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
            'watchLaterMovies' => $watchLaterMovies,
        ]);
    }

    public function show(string $slug)
    {
        $movie = Movie::where('slug', $slug)->first();
        if (!$movie) {
            return redirect()->route('movies.index');
        }
        
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
        
        return Inertia::render('movie', [
            'movie' => $movie,
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
     * Get movie recommendations asynchronously.
     *
     * @param Movie $movie
     * @return \Illuminate\Http\JsonResponse
     */
    public function getRecommendations(Movie $movie)
    {
        try {
            $recommendations = MovieService::getMovieRecommendations($movie);
            
            // Process recommendations to include image URLs and other needed data
            $processedRecommendations = collect($recommendations)->map(function ($recommendation) {
                return [
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
                ];
            })->take(10); // Limit to 10 recommendations
            
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
            
            // Process similar movies to include image URLs and other needed data
            $processedSimilarMovies = collect($similarMovies)->map(function ($movie) {
                return [
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
                ];
            })->take(10); // Limit to 10 similar movies
            
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
}
