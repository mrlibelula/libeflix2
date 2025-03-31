<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use App\Services\SeasonService;
use App\Services\Tool;
use App\Services\TvshowService;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response;

class TvshowController extends Controller
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

        // Append the season poster URL to the season's posterPathUrl property and check if seasonExists in storage, as a folder
        // and string limit each episode's overview
        $tvshow->seasons = $tvshow->seasons->map(function ($season) use ($tvshow) {
            $season->posterPathUrl = $season->poster_path 
                ? env('TMDB_IMAGE_BASE_URL_300') . $season->poster_path 
                : env('DEFAULT_POSTER_IMAGE_URL');
            $season->seasonFolderExists = SeasonService::isThereSeasonFolder($season->season_number, $tvshow);
            // Add still image URL and append vote avarage to stars method to each episode
            $season->episodes->each(function ($episode) {
                $episode->stillUrl = $episode->still_path 
                    ? env('TMDB_IMAGE_BASE_URL_300') . $episode->still_path 
                    : env('DEFAULT_EPISODE_STILL_IMAGE_URL');
                $episode->voteAverageStars = Tool::voteAvarageToStars($episode->vote_average, $episode->vote_count);
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

        // Append voteAvarageStars to the TV show
        $tvshow->voteAverageStars = Tool::voteAvarageToStars($tvshow->vote_average, $tvshow->vote_count);

        // Append credits to the TV show
        $tvshow->credits = TvshowService::getTvshowCredits($tvshow);

        return Inertia::render('tvshow', [
            'tvshow' => $tvshow,
            'backdropUrl' => TvshowService::getRandomTvshowImages($tvshow, 'backdrops'),
            'selectedSeasonNumber' => (int)$selectedSeasonNumber,
        ]);
    }
}
