<?php

namespace App\Jobs;

use App\Models\Movie;
use App\Services\MovieService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class FetchMovieRecommendationsJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    protected Movie $movie;
    protected string $cacheKey;

    /**
     * Create a new job instance.
     */
    public function __construct(Movie $movie)
    {
        $this->movie = $movie;
        $this->cacheKey = "movie_recommendations_{$movie->id}";
    }

    /**
     * Execute the job.
     */
    public function handle(): void
    {
        try {
            // Set loading state
            Cache::put($this->cacheKey . '_status', 'loading', 300); // 5 minutes

            // Fetch recommendations and similar movies
            $recommendations = MovieService::getMovieRecommendations($this->movie);
            $similarMovies = MovieService::getSimilarMovies($this->movie);

            // Process the data
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
            })->take(20);

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
            })->take(20);

            // Cache the results
            $data = [
                'recommendations' => $processedRecommendations,
                'similar_movies' => $processedSimilarMovies,
                'fetched_at' => now()->toISOString(),
            ];

            Cache::put($this->cacheKey, $data, 3600); // Cache for 1 hour
            Cache::put($this->cacheKey . '_status', 'completed', 300);

            // Log::info("Successfully fetched recommendations for movie ID: {$this->movie->id}");

        } catch (\Exception $e) {
            Log::error("Failed to fetch recommendations for movie ID: {$this->movie->id}", [
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);

            Cache::put($this->cacheKey . '_status', 'failed', 300);
            Cache::put($this->cacheKey . '_error', $e->getMessage(), 300);
        }
    }

    /**
     * Handle a job failure.
     */
    public function failed(\Throwable $exception): void
    {
        Log::error("Movie recommendations job failed for movie ID: {$this->movie->id}", [
            'error' => $exception->getMessage(),
            'trace' => $exception->getTraceAsString()
        ]);

        Cache::put($this->cacheKey . '_status', 'failed', 300);
        Cache::put($this->cacheKey . '_error', $exception->getMessage(), 300);
    }
} 