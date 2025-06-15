<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MovieController;
use App\Http\Controllers\StorageController;
use App\Http\Controllers\TvshowController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;


Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('tvshows', [TvshowController::class, 'index'])->name('tvshows.index');
    Route::get('tvshow/{slug}', [TvshowController::class, 'show'])->name('tvshow.show');
    Route::get('tvshow/stream/{encFilePath}/{disk?}', [StorageController::class, 'tvshowEpisodeServe'])->name('tvshow.episode.serve');
    Route::get('tvshow/subtitles/{encFilePath}/{disk?}', [StorageController::class, 'tvshowSubtitlesServe'])->name('tvshow.subtitles.serve');
    Route::get('movies', [MovieController::class, 'index'])->name('movies.index');
    Route::post('movies/{movie}/toggle-watch-later', [MovieController::class, 'toggleWatchLater'])->name('movies.toggle-watch-later');
    Route::post('api/movies/{movieId}/toggle-watch-later', [MovieController::class, 'toggleWatchLaterById'])->name('api.movies.toggle-watch-later-by-id');
    Route::get('api/movies/{movie}/trailers', [MovieController::class, 'getTrailers'])->name('api.movies.trailers');
    Route::get('api/movies/{movieId}/trailers-by-id', [MovieController::class, 'getTrailersById'])->name('api.movies.trailers-by-id');
    Route::get('api/movies/{movie}/recommendations', [MovieController::class, 'getRecommendations'])->name('api.movies.recommendations');
    Route::get('api/movies/{movie}/similar', [MovieController::class, 'getSimilarMovies'])->name('api.movies.similar');
    
    // Alternative Job Queue Routes
    Route::post('api/movies/{movie}/recommendations/initiate', [MovieController::class, 'initiateRecommendationsFetch'])->name('api.movies.recommendations.initiate');
    Route::get('api/movies/{movie}/recommendations/status', [MovieController::class, 'pollRecommendationsStatus'])->name('api.movies.recommendations.status');
    Route::get('movie/{slug}', [MovieController::class, 'show'])->name('movie.show');
    Route::get('movie/stream/{encFilePath}/{disk?}', [StorageController::class, 'movieServe'])->name('movie.serve');
    Route::get('movie/subtitles/{encFilePath}/{disk?}', [StorageController::class, 'movieSubtitlesServe'])->name('movie.subtitles.serve');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
