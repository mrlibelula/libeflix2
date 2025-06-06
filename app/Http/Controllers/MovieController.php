<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Movie;
use App\Services\MovieService;
use Illuminate\Support\Facades\Auth;

class MovieController extends Controller
{
    /**
     * Display a listing of the movies.
     *
     * @return \Inertia\Response
     */
    public function index()
    {
        $movies = Movie::select('id', 'title', 'poster_path', 'vote_average', 'release_date', 'trailers', 'slug')
            ->orderBy('title', 'asc')
            ->get();

        if (!$movies) {
            abort(404, 'No movies found');
        }

        $user = Auth::user();

        $movies = $movies->map(function ($movie) use ($user) {
            $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
            return $movie;
        });

        $watchLaterMovies = $user->watchLaterMovies()->get()->map(function ($movie) use ($user) {
            $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
            return $movie;
        });

        return Inertia::render('movies', [
            'movies' => $movies->shuffle(),
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
            'watchLaterMovies' => $watchLaterMovies,
        ]);
    }
}
