<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use Inertia\Inertia;
use Inertia\Response;
use App\Services\TvshowService;

class DashboardController extends Controller
{
    /**
     * Shows all available tv shows on Storage
     *
     * @return Response
     */
    public function index(): Response
    {
        $tvshows = Tvshow::select('id', 'tmdb_id', 'name', 'backdrop_path', 'poster_path', 'vote_average', 'vote_count', 'first_air_date', 'videos', 'images', 'selected_logo')
            ->orderBy('name', 'asc')
            ->withCount('seasons')
            ->withCount('episodes')
            ->get();

        return Inertia::render('dashboard', [
            'tvshows' => $tvshows,
        ]);
    }
}
