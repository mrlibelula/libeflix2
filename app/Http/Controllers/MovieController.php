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
        $user = Auth::user();

        $movies = Movie::select('id', 'title', 'poster_path', 'vote_average', 'release_date', 'slug', 'subtitles')
            ->selectRaw('COALESCE(json_array_length(trailers), 0) as trailer_count')
            ->orderBy('title', 'asc')
            ->get();

        $movies = $movies->map(function ($movie) use ($user) {
            $movie->is_watch_later = MovieService::isWatchLater($movie, $user);
            $movie->subtitles = json_decode($movie->subtitles, true) ?: [];
            if (isset($movie->subtitles['path'])) unset($movie->subtitles['path']);
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
                return $movie;
            });

        return Inertia::render('movies', [
            'movies' => $movies->shuffle(),
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
            'watchLaterMovies' => $watchLaterMovies,
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
}
