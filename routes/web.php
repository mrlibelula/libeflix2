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
    Route::get('api/movies/{movie}/trailers', [MovieController::class, 'getTrailers'])->name('api.movies.trailers');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
