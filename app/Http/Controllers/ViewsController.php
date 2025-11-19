<?php

namespace App\Http\Controllers;

use App\Models\Episode;
use App\Models\Movie;
use App\Services\ViewService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class ViewsController extends Controller
{
    /**
     * Update watch progress for a movie or episode.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function updateProgress(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:movie,episode',
            'id' => 'required|integer',
            'current_time' => 'required|integer|min:0',
            'duration' => 'nullable|integer|min:1',
        ]);

        // Get the watchable model
        $watchable = $validated['type'] === 'movie' 
            ? Movie::find($validated['id'])
            : Episode::find($validated['id']);

        if (!$watchable) {
            return response()->json(['error' => 'Content not found'], 404);
        }

        // Update progress
        $result = ViewService::updateProgress(
            $watchable, 
            $user, 
            $validated['current_time'], 
            $validated['duration']
        );

        return response()->json([
            'success' => true,
            'progress' => [
                'current_time' => $result['progress']->current_time,
                'duration' => $result['progress']->duration,
                'progress_percentage' => (float) $result['progress']->progress_percentage,
                'completed' => (bool) $result['progress']->completed,
            ],
            'view_recorded' => $result['view_recorded'],
        ]);
    }

    /**
     * Get watch progress for a movie or episode.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getProgress(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:movie,episode',
            'id' => 'required|integer',
        ]);

        // Get the watchable model
        $watchable = $validated['type'] === 'movie' 
            ? Movie::find($validated['id'])
            : Episode::find($validated['id']);

        if (!$watchable) {
            return response()->json(['error' => 'Content not found'], 404);
        }

        $progress = ViewService::getProgress($watchable, $user);

        if (!$progress) {
            return response()->json([
                'success' => true,
                'progress' => null,
            ]);
        }

        return response()->json([
            'success' => true,
            'progress' => [
                'current_time' => $progress->current_time,
                'duration' => $progress->duration,
                'progress_percentage' => (float) $progress->progress_percentage,
                'completed' => (bool) $progress->completed,
                'last_watched_at' => $progress->last_watched_at->toIso8601String(),
            ],
        ]);
    }

    /**
     * Reset watch progress for a movie or episode.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function resetProgress(Request $request): JsonResponse
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthorized'], 401);
        }

        $validated = $request->validate([
            'type' => 'required|string|in:movie,episode',
            'id' => 'required|integer',
        ]);

        // Get the watchable model
        $watchable = $validated['type'] === 'movie' 
            ? Movie::find($validated['id'])
            : Episode::find($validated['id']);

        if (!$watchable) {
            return response()->json(['error' => 'Content not found'], 404);
        }

        ViewService::resetProgress($watchable, $user);

        return response()->json([
            'success' => true,
        ]);
    }

    /**
     * Get views count for a movie or episode.
     *
     * @param Request $request
     * @return JsonResponse
     */
    public function getViewsCount(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'type' => 'required|string|in:movie,episode',
            'id' => 'required|integer',
        ]);

        // Get the viewable model
        $viewable = $validated['type'] === 'movie' 
            ? Movie::find($validated['id'])
            : Episode::find($validated['id']);

        if (!$viewable) {
            return response()->json(['error' => 'Content not found'], 404);
        }

        $viewsCount = ViewService::getViewsCount($viewable);

        return response()->json([
            'success' => true,
            'views_count' => $viewsCount,
        ]);
    }
}

