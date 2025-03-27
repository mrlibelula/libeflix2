<?php

use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use App\Http\Controllers\DashboardController;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('dashboard', [DashboardController::class, 'index']);
    Route::get('tvshows', [DashboardController::class, 'index'])->name('dashboard');
    Route::get('tvshow/{slug}', [DashboardController::class, 'show'])->name('tvshow.show');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
