<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use App\Services\TvshowService;
use Illuminate\Support\Str;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    /**
     * Shows all available tv shows on Storage
     *
     * @return Response
     */
    public function index(): Response
    {
        $tvshows = Tvshow::select('id', 'name', 'backdrop_path', 'poster_path', 'vote_average', 'vote_count', 'first_air_date', 'videos', 'images', 'selected_logo', 'slug')
            ->orderBy('name', 'asc')
            ->withCount('seasons')
            ->withCount('episodes')
            ->get();

        return Inertia::render('dashboard', [
            'tvshows' => $tvshows,
        ]);
    }

    public function show(Request $request, string $slug): Response
    {
        $tvshow = Tvshow::where('slug', $slug)
            ->with('seasons')
            ->with('seasons.episodes')
            ->first();
        
        if (!$tvshow) {
            abort(404, 'TV Show not found');
        }

        // Get selected season number from request or use 0 (which will default to first season in React)
        $selectedSeasonNumber = $request->input('season', 0);

        // Append the season poster URL to the season's posterPathUrl property
        // and string limit each episode's overview to
        // overviewStrLimit50, overviewStrLimit100, overviewStrLimit150, overviewStrLimit200, overviewStrLimit250
        $tvshow->seasons = $tvshow->seasons->map(function ($season) {
            $season->posterPathUrl = $season->poster_path ? env('TMDB_IMAGE_BASE_URL_300') . $season->poster_path : env('DEFAULT_POSTER_IMAGE_URL');
            $season->episodes->each(function ($episode) {
                $episode->overviewStrLimit50 = Str::limit($episode->overview, 50);
                $episode->overviewStrLimit100 = Str::limit($episode->overview, 100);
                $episode->overviewStrLimit150 = Str::limit($episode->overview, 150);
                $episode->overviewStrLimit200 = Str::limit($episode->overview, 200);
                $episode->overviewStrLimit250 = Str::limit($episode->overview, 250);
                
                // Add still image URL if it exists
                $episode->stillUrl = $episode->still_path ? env('TMDB_IMAGE_BASE_URL_300') . $episode->still_path : env('DEFAULT_EPISODE_STILL_IMAGE_URL');
            });
            return $season;
        });

        // Append the genre slug to the genres list
        $tvshow->genres = TvshowService::genresWithSlugs($tvshow);

        // Append the creator profile path to the creator list
        $tvshow->created_by = array_map(function ($creator) {
            $creator['profile_path'] = $creator['profile_path'] ? env('TMDB_IMAGE_BASE_URL_300') . $creator['profile_path'] : env('DEFAULT_CREDIT_IMAGE_URL');
            return $creator;
        }, $tvshow->created_by);

        // Append network's logo path to the network list
        $tvshow->networks = array_map(function ($network) {
            $network['logoPathUrl'] = $network['logo_path'] ? env('TMDB_IMAGE_BASE_URL_300') . $network['logo_path'] : null;
            return $network;
        }, $tvshow->networks);

        // Append vote avarage to stars method to each episode
        $tvshow->seasons->each(function ($season) {
            $season->episodes->each(function ($episode) {
                $episode->voteAverageStars = TvshowService::voteAvarageToStars($episode->vote_average, $episode->vote_count);
            });
        });

        // Append voteAvarageStars to the TV show
        $tvshow->voteAverageStars = TvshowService::voteAvarageToStars($tvshow->vote_average, $tvshow->vote_count);

        // Append credits to the TV show
        $tvshow->credits = TvshowService::getTvshowCredits($tvshow);

        return Inertia::render('tvshow', [
            'tvshow' => $tvshow,
            'backdropUrl' => TvshowService::getRandomTvshowImages($tvshow, 'backdrops'),
            'selectedSeasonNumber' => (int) $selectedSeasonNumber,
        ]);
    }
}
