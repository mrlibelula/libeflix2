<?php

namespace App\Http\Controllers;

use App\Models\Season;
use App\Services\WatchLaterService;
use App\Traits\HandlesLikes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class SeasonController extends Controller
{
    use HandlesLikes;

    /**
     * Toggle watch later status for a season by ID.
     *
     * @param Request $request
     * @param int $seasonId
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleWatchLaterById(Request $request, int $seasonId)
    {
        $season = Season::find($seasonId);
        if (!$season) {
            return response()->json(['error' => 'Season not found'], 404);
        }

        $user = Auth::user();
        
        $isWatchLater = WatchLaterService::isWatchLater($season, $user);

        // Use database transaction to ensure the operation is fully committed
        $newStatus = DB::transaction(function () use ($isWatchLater, $season, $user) {
            if ($isWatchLater) {
                WatchLaterService::removeWatchLater($season, $user);
                return false;
            } else {
                WatchLaterService::addWatchLater($season, $user);
                return true;
            }
        });

        return response()->json([
            'success' => true,
            'is_watch_later' => $newStatus,
            'message' => $newStatus ? 'Added to watch later' : 'Removed from watch later'
        ]);
    }
} 