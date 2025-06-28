<?php

namespace App\Http\Controllers;

use App\Models\Movie;
use App\Models\Tvshow;
use App\Services\WatchLaterService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;

class DashboardController extends Controller
{
    protected $movieLimit = 15;
    protected $tvshowLimit = 5;
    protected $totalSliderLimit = 20;

    public function index()
    {
        // Get the authenticated user
        $user = Auth::user();
        
        // Fetch random movies - be more flexible with image filtering
        $randomMovies = Movie::select('id', 'title', 'tagline', 'images', 'slug', 'backdrop_path')
            ->inRandomOrder()
            ->limit($this->movieLimit)
            ->get();

        // Fetch random TV shows - be more flexible with image filtering
        $randomTvshows = Tvshow::select('id', 'name as title', 'tagline', 'images', 'slug', 'backdrop_path')
            ->inRandomOrder()
            ->limit($this->tvshowLimit)
            ->get();

        // Process the data to prepare for carousel
        $carouselItems = collect();

        // Add movies to carousel items
        $randomMovies->each(function ($movie) use ($carouselItems, $user) {
            $backdropPath = null;
            
            // Try to get backdrop from images JSON first
            if ($movie->images && is_array($movie->images) && isset($movie->images['backdrops']) && !empty($movie->images['backdrops'])) {
                $backdropPath = $movie->images['backdrops'][0]['file_path'] ?? null;
            }
            
            // Fallback to direct backdrop_path if images array doesn't have backdrop
            if (!$backdropPath && $movie->backdrop_path) {
                $backdropPath = $movie->backdrop_path;
            }
            
            // Only add if we have a backdrop path
            if ($backdropPath) {
                $carouselItems->push([
                    'type' => 'movie',
                    'id' => $movie->id,
                    'title' => $movie->title,
                    'tagline' => $movie->tagline ?: '',
                    'slug' => $movie->slug,
                    'backdrop_path' => $backdropPath,
                    'is_watch_later' => $user ? WatchLaterService::isWatchLater($movie, $user) : false,
                ]);
            }
        });

        // Add TV shows to carousel items
        $randomTvshows->each(function ($tvshow) use ($carouselItems, $user) {
            $backdropPath = null;
            
            // Try to get backdrop from images JSON first
            if ($tvshow->images && is_array($tvshow->images) && isset($tvshow->images['backdrops']) && !empty($tvshow->images['backdrops'])) {
                $backdropPath = $tvshow->images['backdrops'][0]['file_path'] ?? null;
            }
            
            // Fallback to direct backdrop_path if images array doesn't have backdrop
            if (!$backdropPath && $tvshow->backdrop_path) {
                $backdropPath = $tvshow->backdrop_path;
            }
            
            // Only add if we have a backdrop path
            if ($backdropPath) {
                $carouselItems->push([
                    'type' => 'tvshow',
                    'id' => $tvshow->id,
                    'title' => $tvshow->title,
                    'tagline' => $tvshow->tagline ?: '',
                    'slug' => $tvshow->slug,
                    'backdrop_path' => $backdropPath,
                    'is_watch_later' => $user ? WatchLaterService::isWatchLater($tvshow, $user) : false,
                ]);
            }
        });

        // If we don't have enough items 
        if ($carouselItems->count() < $this->totalSliderLimit) {
            $carouselItems = $carouselItems->merge($carouselItems);
        }

        // Shuffle to intersperse movies and TV shows, then take up to totalSliderLimit
        $carouselItems = $carouselItems->shuffle()->take($this->totalSliderLimit);

        return Inertia::render('dashboard', [
            'carouselItems' => $carouselItems->values(),
            'tmdbImageUrls' => [
                'desktop' => env('TMDB_IMAGE_BASE_URL_1920', 'https://image.tmdb.org/t/p/w1920_and_h800_multi_faces'),
                'mobile' => env('TMDB_IMAGE_BASE_URL_1280', 'https://image.tmdb.org/t/p/w1280'),
            ],
        ]);
    }
}
