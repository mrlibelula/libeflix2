<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;
use Inertia\Inertia;
use App\Models\Movie;
use App\Services\MovieService;

class PopularTopController extends Controller
{
    /**
     * Display the popular and top movies page.
     *
     * @return \Inertia\Response
     */
    public function index()
    {
        try {
            $user = Auth::user();
            
            // Fetch popular movies from TMDB API with cache (30 minutes)
            $popularMovies = Cache::remember('tmdb_popular_movies', 1800, function () {
                $response = Http::get(env('TMDB_BASE_URL') . '/movie/popular', [
                    'api_key' => env('TMDB_API_KEY'),
                    'language' => 'en-US',
                    'page' => 1
                ]);
                
                if ($response->successful()) {
                    return $response->json()['results'] ?? [];
                }
                
                return [];
            });
            
            // Fetch top rated movies from TMDB API with cache (30 minutes)
            $topRatedMovies = Cache::remember('tmdb_top_rated_movies', 1800, function () {
                $response = Http::get(env('TMDB_BASE_URL') . '/movie/top_rated', [
                    'api_key' => env('TMDB_API_KEY'),
                    'language' => 'en-US',
                    'page' => 1
                ]);
                
                if ($response->successful()) {
                    return $response->json()['results'] ?? [];
                }
                
                return [];
            });
            
            // Process movies to include additional data and check for local availability
            $processedPopularMovies = $this->processMovies($popularMovies, $user);
            $processedTopRatedMovies = $this->processMovies($topRatedMovies, $user);
            
            return Inertia::render('popular-top', [
                'popularMovies' => $processedPopularMovies,
                'topRatedMovies' => $processedTopRatedMovies,
                'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
            ]);
            
        } catch (\Exception $e) {
            // Log error and return with empty arrays
            Log::error('Error fetching popular/top movies: ' . $e->getMessage());
            
            return Inertia::render('popular-top', [
                'popularMovies' => [],
                'topRatedMovies' => [],
                'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
                'error' => 'Failed to fetch movies from TMDB. Please try again later.'
            ]);
        }
    }
    
    /**
     * Process movies array to include additional data and check for local availability
     *
     * @param array $movies
     * @param \App\Models\User $user
     * @return array
     */
    private function processMovies(array $movies, $user): array
    {
        return collect($movies)->map(function ($movie) use ($user) {
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
                'genre_ids' => $movie['genre_ids'] ?? [],
                'poster_url' => $movie['poster_path'] 
                    ? env('TMDB_IMAGE_BASE_URL_300') . $movie['poster_path']
                    : null,
                'backdrop_url' => $movie['backdrop_path']
                    ? env('TMDB_IMAGE_BASE_URL_780') . $movie['backdrop_path']
                    : null,
                'is_local' => false,
                'is_watch_later' => false,
                'has_subtitles' => false,
                'subtitle_languages' => [],
            ];

            // If movie exists locally, add additional data
            // In production, only consider movies with Google Drive IDs as locally available
            if ($localMovie && (!app()->environment('production') || !empty($localMovie->google_drive_file_id))) {
                $subtitles = json_decode($localMovie->subtitles, true) ?: [];
                
                $baseData['is_local'] = true;
                $baseData['slug'] = $localMovie->slug;
                $baseData['is_watch_later'] = MovieService::isWatchLater($localMovie, $user);
                $baseData['has_subtitles'] = !empty($subtitles);
                $baseData['subtitle_languages'] = collect($subtitles)->pluck('languageCode')->take(3)->toArray();
            }

            return $baseData;
        })->take(20)->toArray(); // Limit to 20 movies per section
    }
} 