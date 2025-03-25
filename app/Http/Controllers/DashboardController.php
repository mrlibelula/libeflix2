<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use App\Services\TvshowService;
use App\Services\Tool;
use Inertia\Inertia;
use Inertia\Response;
use Illuminate\Http\Request;

class DashboardController extends Controller
{
    /**
     * Shows all available tv shows on Storage
     *
     * @return Response
     */
    public function index(): Response
    {
        $tvshows = Tvshow::select('id', 'tmdb_id', 'name', 'backdrop_path', 'poster_path', 'vote_average', 'vote_count', 'first_air_date', 'videos', 'images', 'selected_logo', 'slug')
            ->orderBy('name', 'asc')
            ->withCount('seasons')
            ->withCount('episodes')
            ->get();

        return Inertia::render('dashboard', [
            'tvshows' => $tvshows,
        ]);
    }

    public function show(string $slug): Response
    {
        $tvshow = Tvshow::where('slug', $slug)
            ->with('seasons')
            ->first();
        
        if (!$tvshow) {
            abort(404, 'TV Show not found');
        }

        // Append the season poster URL to the season's poster_path
        $tvshow->seasons = $tvshow->seasons->map(function ($season) {
            $season->poster_path = $season->poster_path ? env('TMDB_IMAGE_BASE_URL_300') . $season->poster_path : env('DEFAULT_POSTER_IMAGE_URL');
            return $season;
        });

        return Inertia::render('tvshow', [
            'tvshow' => $tvshow,
            'backdropUrl' => TvshowService::getRandomTvshowImages($tvshow, 'backdrops'),
        ]);
    }
}
