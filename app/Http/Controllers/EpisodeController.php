<?php

namespace App\Http\Controllers;

use App\Models\Episode;
use App\Services\WatchLaterService;
use App\Traits\HandlesLikes;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

class EpisodeController extends Controller
{
    use HandlesLikes;

    protected function getModelClass(): string
    {
        return Episode::class;
    }

    /**
     * Toggle watch later status for an episode by ID.
     *
     * @param Request $request
     * @param int $episodeId
     * @return \Illuminate\Http\JsonResponse
     */
    public function toggleWatchLaterById(Request $request, int $episodeId)
    {
        $episode = Episode::find($episodeId);
        if (!$episode) {
            return response()->json(['error' => 'Episode not found'], 404);
        }

        $user = Auth::user();
        
        $isWatchLater = WatchLaterService::isWatchLater($episode, $user);

        // Use database transaction to ensure the operation is fully committed
        $newStatus = DB::transaction(function () use ($isWatchLater, $episode, $user) {
            if ($isWatchLater) {
                WatchLaterService::removeWatchLater($episode, $user);
                return false;
            } else {
                WatchLaterService::addWatchLater($episode, $user);
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