<?php

namespace App\Http\Controllers;

use App\Models\Movie;
use App\Models\Tvshow;
use App\Services\Tool;
use App\Services\WatchLaterService;
use App\Traits\HandlesLikes;
use Illuminate\Http\Request;
use Inertia\Inertia;

class GenreController extends Controller
{
    use HandlesLikes;
    /**
     * Display movies and TV shows for a specific genre
     */
    public function show(Request $request, string $genreSlug)
    {
        // Get all available genres with slugs to validate the requested genre
        $availableGenres = Tool::getMoviesAndTVShowsGenresWithSlugs();
        
        // Find the genre by slug
        $genreData = collect($availableGenres)->firstWhere('slug', $genreSlug);
        
        if (!$genreData) {
            abort(404, 'Genre not found');
        }
        
        $genre = $genreData['name'];
        $user = $request->user();

        // Get movies with the specified genre
        $movies = Movie::where(function ($query) use ($genre) {
            // For MySQL/PostgreSQL
            if (config('database.default') === 'mysql') {
                $query->whereJsonContains('genres', [['name' => $genre]])
                      ->orWhereRaw('JSON_EXTRACT(genres, "$[*].name") LIKE ?', ["%{$genre}%"]);
            } else {
                // For SQLite - search in genres as text
                $query->where('genres', 'LIKE', "%\"name\":\"{$genre}\"%")
                      ->orWhere('genres', 'LIKE', "%{$genre}%");
            }
        })
        ->orderBy('vote_average', 'desc')
        ->limit(50)
        ->get()
            ->map(function ($movie) use ($user) {
                return [
                    'id' => $movie->id,
                    'title' => $movie->title,
                    'slug' => $movie->slug,
                    'poster_path' => $movie->poster_path,
                    'backdrop_path' => $movie->backdrop_path,
                    'overview' => $movie->overview,
                    'release_date' => $movie->release_date,
                    'vote_average' => $movie->vote_average,
                    'vote_count' => $movie->vote_count,
                    'runtime' => $movie->runtime,
                    'genres' => is_array($movie->genres) ? $movie->genres : json_decode($movie->genres, true),
                    'is_free' => $movie->is_free,
                    'google_drive_file_id' => $movie->google_drive_file_id,
                    'subtitles' => $movie->subtitles ? (is_array($movie->subtitles) ? $movie->subtitles : json_decode($movie->subtitles, true)) : [],
                    'is_liked' => $user ? $movie->isLikedBy($user) : false,
                    'likes_count' => $movie->likesCount(),
                    'is_watch_later' => $user ? WatchLaterService::isWatchLater($movie, $user) : false,
                ];
            });

        // Get TV shows with the specified genre
        $tvshows = Tvshow::where(function ($query) use ($genre) {
            // For MySQL/PostgreSQL
            if (config('database.default') === 'mysql') {
                $query->whereJsonContains('genres', [['name' => $genre]])
                      ->orWhereRaw('JSON_EXTRACT(genres, "$[*].name") LIKE ?', ["%{$genre}%"]);
            } else {
                // For SQLite - search in genres as text
                $query->where('genres', 'LIKE', "%\"name\":\"{$genre}\"%")
                      ->orWhere('genres', 'LIKE', "%{$genre}%");
            }
        })
        ->orderBy('vote_average', 'desc')
        ->limit(50)
        ->get()
            ->map(function ($tvshow) use ($user) {
                return [
                    'id' => $tvshow->id,
                    'name' => $tvshow->name,
                    'slug' => $tvshow->slug,
                    'poster_path' => $tvshow->poster_path,
                    'backdrop_path' => $tvshow->backdrop_path,
                    'overview' => $tvshow->overview,
                    'first_air_date' => $tvshow->first_air_date,
                    'vote_average' => $tvshow->vote_average,
                    'vote_count' => $tvshow->vote_count,
                    'number_of_seasons' => $tvshow->number_of_seasons,
                    'number_of_episodes' => $tvshow->number_of_episodes,
                    'genres' => is_array($tvshow->genres) ? $tvshow->genres : json_decode($tvshow->genres, true),
                    'is_free' => $tvshow->is_free,
                    'is_liked' => $user ? $tvshow->isLikedBy($user) : false,
                    'likes_count' => $tvshow->likesCount(),
                    'is_watch_later' => $user ? WatchLaterService::isWatchLater($tvshow, $user) : false,
                ];
            });

        return Inertia::render('genre', [
            'genre' => $genre,
            'genreSlug' => $genreSlug,
            'movies' => $movies,
            'tvshows' => $tvshows,
            'imgBaseUrl' => 'https://image.tmdb.org/t/p/w500/',
        ]);
    }
} 