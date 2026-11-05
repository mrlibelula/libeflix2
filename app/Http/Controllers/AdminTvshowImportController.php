<?php

namespace App\Http\Controllers;

use App\Services\TvshowService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminTvshowImportController extends Controller
{
    public function scan(): JsonResponse
    {
        return response()->json(TvshowService::scanPendingTvshowFolders());
    }

    public function suggestYear(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folder' => ['required', 'string'],
            'use_openai' => ['sometimes', 'boolean'],
        ]);

        return response()->json(
            TvshowService::suggestReleaseYear(
                $validated['folder'],
                (bool) ($validated['use_openai'] ?? false)
            )
        );
    }

    public function search(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'year' => ['nullable', 'integer', 'min:1900', 'max:2100'],
        ]);

        return response()->json([
            'results' => TvshowService::searchTmdbTvshows(
                $validated['name'],
                $validated['year'] ?? null
            ),
        ]);
    }

    public function storeMetadata(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folder' => ['required', 'string'],
            'name' => ['required', 'string', 'max:255'],
            'release_year' => ['required', 'integer', 'min:1900', 'max:2100'],
            'pick' => ['required', 'integer', 'min:0'],
            'id' => ['required', 'integer', 'min:1'],
            'selected_logo' => ['sometimes', 'integer', 'min:0'],
        ]);

        TvshowService::createMetadataJson($validated['folder'], $validated);

        return response()->json([
            'success' => true,
            'metadata' => TvshowService::readMetadataJson($validated['folder']),
        ]);
    }

    public function run(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folders' => ['required', 'array', 'min:1'],
            'folders.*' => ['required', 'string'],
        ]);

        // Run synchronously — admin UI waits for the result and no queue worker is required.
        $results = TvshowService::importTvshowFolders($validated['folders']);

        return response()->json(['results' => $results]);
    }
}
