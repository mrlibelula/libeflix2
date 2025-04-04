<?php

namespace App\Http\Controllers;

use App\Models\Tvshow;
use App\Services\TvshowService;
use App\Services\SeasonService;
use App\Services\Tool;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
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
            // Check if season folder exists in storage
            $season->seasonFolderExists = SeasonService::isThereSeasonFolder($season->season_number, $tvshow);
            // Add still image URL and append vote avarage to stars method to each episode
            $season->episodes->each(function ($episode) {
                $episode->stillUrl = $episode->still_path 
                    ? env('TMDB_IMAGE_BASE_URL_300') . $episode->still_path 
                    : env('DEFAULT_EPISODE_STILL_IMAGE_URL');
                $episode->voteAverageStars = Tool::voteAvarageToStars($episode->vote_average, $episode->vote_count);
                
                // Pre-encode the file path if it's a string (means it's a valid file path)
                if (is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) {
                    $episode->encFilePath = Tool::encode($episode->is_in_storage);
                }
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
        $tvshow->credits = TvshowService::getTvshowCredits($tvshow, withCrew: true);

        // Encode episodes file paths via is_in_storage and use prop encFilePath as final prop
        $tvshow->episodes = $tvshow->episodes->map(function ($episode) {
            // Debug what we're working with
            Log::debug('Episode data', [
                'id' => $episode->id,
                'name' => $episode->name,
                'is_in_storage_type' => gettype($episode->is_in_storage),
                'is_in_storage_value' => $episode->is_in_storage,
            ]);
            
            // If is_in_storage contains the file path (fallbacks as a boolean (truthy or falsy)), encode it
            if (is_string($episode->is_in_storage) && !empty($episode->is_in_storage)) {
                $episode->encFilePath = Tool::encode($episode->is_in_storage);
                Log::debug('Encoded file path', ['encFilePath' => $episode->encFilePath]);
            } else {
                $episode->encFilePath = null;
                Log::debug('No file path to encode');
            }
            
            return $episode;
        });

        // Make sure encFilePath is explicitly included in the data structure sent to the frontend
        // by ensuring it's part of the array version of the data
        $tvshow->episodes = $tvshow->episodes->map(function ($episode) {
            // Convert to array to ensure all properties are included
            $episodeArray = is_array($episode) ? $episode : $episode->toArray();
            
            // Explicitly ensure encFilePath is included
            if (!isset($episodeArray['encFilePath']) && isset($episode->encFilePath)) {
                $episodeArray['encFilePath'] = $episode->encFilePath;
            }
            
            return $episodeArray;
        });

        return Inertia::render('tvshow', [
            'tvshow' => $tvshow,
            'backdropUrl' => TvshowService::getRandomTvshowImages($tvshow, 'backdrops'),
            'selectedSeasonNumber' => (int)$selectedSeasonNumber,
        ]);
    }
}
