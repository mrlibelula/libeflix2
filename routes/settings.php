<?php

use App\Http\Controllers\AnalyticsController;
use App\Http\Controllers\Settings\PasswordController;
use App\Http\Controllers\Settings\ProfileController;
use App\Http\Controllers\SubscriptionController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::middleware('auth')->group(function () {
    Route::redirect('settings', 'settings/profile');

    Route::get('settings/profile', [ProfileController::class, 'edit'])->name('profile.edit');
    Route::patch('settings/profile', [ProfileController::class, 'update'])->name('profile.update');
    Route::delete('settings/profile', [ProfileController::class, 'destroy'])->name('profile.destroy');

    Route::get('settings/password', [PasswordController::class, 'edit'])->name('password.edit');
    Route::put('settings/password', [PasswordController::class, 'update'])->name('password.update');

    Route::get('settings/appearance', function () {
        return Inertia::render('settings/appearance');
    })->name('appearance');

    Route::get('settings/subscription', [SubscriptionController::class, 'manage'])->name('settings.subscription');
});

// Analytics routes - Admin only
Route::middleware(['auth', 'role:admin'])->group(function () {
    Route::get('settings/analytics', [AnalyticsController::class, 'index'])->name('settings.analytics');
    
    // API endpoints for analytics data
    Route::prefix('api/analytics')->name('api.analytics.')->group(function () {
        Route::get('overview', [AnalyticsController::class, 'overview'])->name('overview');
        Route::get('views-over-time', [AnalyticsController::class, 'viewsOverTime'])->name('views-over-time');
        Route::get('views-by-content-type', [AnalyticsController::class, 'viewsByContentType'])->name('views-by-content-type');
        Route::get('most-viewed-movies', [AnalyticsController::class, 'mostViewedMovies'])->name('most-viewed-movies');
        Route::get('most-viewed-episodes', [AnalyticsController::class, 'mostViewedEpisodes'])->name('most-viewed-episodes');
        Route::get('user-engagement', [AnalyticsController::class, 'userEngagement'])->name('user-engagement');
        Route::get('recent-views', [AnalyticsController::class, 'recentViews'])->name('recent-views');
        Route::get('completion-rate-distribution', [AnalyticsController::class, 'completionRateDistribution'])->name('completion-rate-distribution');
        Route::get('hourly-distribution', [AnalyticsController::class, 'hourlyDistribution'])->name('hourly-distribution');
        Route::get('weekly-distribution', [AnalyticsController::class, 'weeklyDistribution'])->name('weekly-distribution');
    });
});
