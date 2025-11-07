<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class UserPreferenceController extends Controller
{
    /**
     * Save user's audio preference for a TV show.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function saveTvshowAudioPreference(Request $request)
    {
        $request->validate([
            'tvshow_id' => 'required|integer',
            'audio_language_code' => 'required|string|max:10',
        ]);

        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $success = $user->setTvshowAudioPreference(
            $request->tvshow_id,
            $request->audio_language_code
        );

        if ($success) {
            return response()->json([
                'message' => 'Audio preference saved successfully',
                'tvshow_id' => $request->tvshow_id,
                'audio_language_code' => strtoupper($request->audio_language_code),
            ]);
        }

        return response()->json(['error' => 'Failed to save preference'], 500);
    }

    /**
     * Get user's audio preference for a TV show.
     *
     * @param Request $request
     * @param int $tvshowId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getTvshowAudioPreference(Request $request, int $tvshowId)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $preference = $user->getTvshowAudioPreference($tvshowId);

        return response()->json([
            'tvshow_id' => $tvshowId,
            'audio_language_code' => $preference,
        ]);
    }

    /**
     * Remove user's audio preference for a TV show.
     *
     * @param Request $request
     * @param int $tvshowId
     * @return \Illuminate\Http\JsonResponse
     */
    public function removeTvshowAudioPreference(Request $request, int $tvshowId)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $success = $user->removeTvshowAudioPreference($tvshowId);

        if ($success) {
            return response()->json([
                'message' => 'Audio preference removed successfully',
                'tvshow_id' => $tvshowId,
            ]);
        }

        return response()->json(['error' => 'Failed to remove preference'], 500);
    }

    /**
     * Save user's subtitle preference for a TV show.
     *
     * @param Request $request
     * @return \Illuminate\Http\JsonResponse
     */
    public function saveTvshowSubtitlePreference(Request $request)
    {
        $request->validate([
            'tvshow_id' => 'required|integer',
            'subtitle_language_code' => 'required|string|max:10',
        ]);

        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $success = $user->setTvshowSubtitlePreference(
            $request->tvshow_id,
            $request->subtitle_language_code
        );

        if ($success) {
            return response()->json([
                'message' => 'Subtitle preference saved successfully',
                'tvshow_id' => $request->tvshow_id,
                'subtitle_language_code' => strtoupper($request->subtitle_language_code),
            ]);
        }

        return response()->json(['error' => 'Failed to save preference'], 500);
    }

    /**
     * Get user's subtitle preference for a TV show.
     *
     * @param Request $request
     * @param int $tvshowId
     * @return \Illuminate\Http\JsonResponse
     */
    public function getTvshowSubtitlePreference(Request $request, int $tvshowId)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $preference = $user->getTvshowSubtitlePreference($tvshowId);

        return response()->json([
            'tvshow_id' => $tvshowId,
            'subtitle_language_code' => $preference,
        ]);
    }

    /**
     * Remove user's subtitle preference for a TV show.
     *
     * @param Request $request
     * @param int $tvshowId
     * @return \Illuminate\Http\JsonResponse
     */
    public function removeTvshowSubtitlePreference(Request $request, int $tvshowId)
    {
        $user = Auth::user();
        
        if (!$user) {
            return response()->json(['error' => 'Unauthenticated'], 401);
        }

        $success = $user->removeTvshowSubtitlePreference($tvshowId);

        if ($success) {
            return response()->json([
                'message' => 'Subtitle preference removed successfully',
                'tvshow_id' => $tvshowId,
            ]);
        }

        return response()->json(['error' => 'Failed to remove preference'], 500);
    }
}
