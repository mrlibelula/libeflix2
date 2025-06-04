<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Inertia\Inertia;
use App\Models\Movie;

class MovieController extends Controller
{
    public function index()
    {
        $movies = Movie::select('id', 'title', 'poster_path', 'vote_average', 'release_date', 'videos', 'slug')
            ->orderBy('title', 'asc')
            ->get();

        return Inertia::render('movies', [
            'movies' => $movies->shuffle(),
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
        ]);
    }
}
