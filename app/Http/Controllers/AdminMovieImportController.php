<?php

namespace App\Http\Controllers;

use App\Services\MovieService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class AdminMovieImportController extends Controller
{
    public function index(): Response
    {
        return Inertia::render('admin/content-management');
    }

    public function scan(): JsonResponse
    {
        return response()->json(MovieService::scanPendingMovieFolders());
    }

    public function suggestYear(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folder' => ['required', 'string'],
            'use_openai' => ['sometimes', 'boolean'],
        ]);

        return response()->json(
            MovieService::suggestReleaseYear(
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
            'results' => MovieService::searchTmdbMovies(
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
        ]);

        MovieService::createMetadataJson($validated['folder'], $validated);

        return response()->json([
            'success' => true,
            'metadata' => MovieService::readMetadataJson($validated['folder']),
        ]);
    }

    public function run(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'folders' => ['required', 'array', 'min:1'],
            'folders.*' => ['required', 'string'],
        ]);

        // Run synchronously — admin UI waits for the result and no queue worker is required.
        $results = MovieService::importMovieFolders($validated['folders']);

        return response()->json(['results' => $results]);
    }
}
