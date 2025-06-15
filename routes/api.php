<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Http\Controllers\MovieController;

Route::middleware(['auth:sanctum'])->get('/user', function (Request $request) {
    return $request->user();
});

// Movie routes
Route::middleware(['auth:sanctum'])->group(function () {
    Route::get('/movies/{movie}/recommendations', [MovieController::class, 'getRecommendations']);
    Route::get('/movies/{movie}/similar', [MovieController::class, 'getSimilarMovies']);
    Route::get('/movies/{movieId}/trailers', [MovieController::class, 'getTrailersById']);
}); 