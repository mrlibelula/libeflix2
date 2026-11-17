<?php

namespace App\Http\Controllers;

use App\Services\HistoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Inertia\Inertia;
use Inertia\Response;

class HistoryController extends Controller
{
    /**
     * Display the authenticated user's watch history (first page of each section).
     */
    public function index(): Response
    {
        $user = Auth::user();
        $history = HistoryService::getHistory($user, HistoryService::PAGE_SIZE);

        return Inertia::render('history', [
            'continueWatching' => $history['continueWatching'],
            'historyMovies' => $history['movies'],
            'historyEpisodes' => $history['episodes'],
            'mostRewatched' => $history['mostRewatched'],
            'stats' => $history['stats'],
            'imgBaseUrl' => env('TMDB_IMAGE_BASE_URL_300'),
            'pageSize' => HistoryService::PAGE_SIZE,
        ]);
    }

    /**
     * Lazy-load a single history carousel page.
     */
    public function section(Request $request, string $section): JsonResponse
    {
        $user = Auth::user();

        $validated = $request->validate([
            'page' => 'sometimes|integer|min:1',
            'per_page' => 'sometimes|integer|min:1|max:48',
            'sort' => 'sometimes|string|max:32',
            'direction' => 'sometimes|string|in:asc,desc',
        ]);

        if (! in_array($section, HistoryService::SECTIONS, true)) {
            return response()->json(['error' => 'Invalid section'], 404);
        }

        $page = (int) ($validated['page'] ?? 1);
        $perPage = (int) ($validated['per_page'] ?? HistoryService::PAGE_SIZE);
        $sort = $validated['sort'] ?? null;
        $direction = $validated['direction'] ?? null;

        $result = HistoryService::paginateSection(
            $user,
            $section,
            $page,
            $perPage,
            $sort,
            $direction
        );

        return response()->json([
            'success' => true,
            'section' => $section,
            ...$result,
        ]);
    }
}
