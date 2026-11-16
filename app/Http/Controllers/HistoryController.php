<?php

namespace App\Http\Controllers;

use App\Services\HistoryService;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class HistoryController extends Controller
{
    /**
     * Display the authenticated user's watch history.
     */
    public function index(): Response
    {
        $user = Auth::user();
        $history = HistoryService::getHistory($user);

        return Inertia::render('history', [
            'continueWatching' => $history['continueWatching'],
            'historyMovies' => $history['movies'],
            'historyEpisodes' => $history['episodes'],
            'mostRewatched' => $history['mostRewatched'],
            'stats' => $history['stats'],
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
        ]);
    }
}
