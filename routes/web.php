<?php

use App\Http\Controllers\DashboardController;
use App\Http\Controllers\MovieController;
use App\Http\Controllers\PopularTopController;
use App\Http\Controllers\StorageController;
use App\Http\Controllers\TvshowController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;


Route::get('/', function () {
    return Inertia::render('dashboard');
})->name('home');

Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

// Public routes (accessible without authentication)
// TV Shows routes
Route::get('tvshows', [TvshowController::class, 'index'])->name('tvshows.index');
Route::get('tvshow/{slug}', [TvshowController::class, 'show'])->name('tvshow.show');

Route::get('movies', [MovieController::class, 'index'])->name('movies.index');
Route::get('movie/{slug}', [MovieController::class, 'show'])->name('movie.show');
Route::get('popular-top', [PopularTopController::class, 'index'])->name('popular-top.index');

// Premium content routes (require subscription for non-free content)
Route::middleware(['premium.content'])->group(function () {
    // TV Show streaming routes
    Route::get('tvshow/stream/{encFilePath}/{disk?}', [StorageController::class, 'tvshowEpisodeServe'])->name('tvshow.episode.serve');
    Route::get('tvshow/subtitles/{encFilePath}/{disk?}', [StorageController::class, 'tvshowSubtitlesServe'])->name('tvshow.subtitles.serve');
    
    Route::get('movie/stream/{encFilePath}/{disk?}', [StorageController::class, 'movieServe'])->name('movie.serve');
    Route::get('movie/subtitles/{encFilePath}/{disk?}', [StorageController::class, 'movieSubtitlesServe'])->name('movie.subtitles.serve');
});

// Public API routes for tvshow data (episodes and credits)
Route::get('api/tvshows/{slug}/seasons/{seasonNumber}/episodes', [TvshowController::class, 'getSeasonEpisodes'])->name('api.tvshows.season.episodes');
Route::get('api/tvshows/{slug}/seasons/{seasonNumber}/credits', [TvshowController::class, 'getSeasonCredits'])->name('api.tvshows.season.credits');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('watch-later', [MovieController::class, 'watchLater'])->name('watch-later.index');
    
    Route::post('movies/{movie}/toggle-watch-later', [MovieController::class, 'toggleWatchLater'])->name('movies.toggle-watch-later');
    Route::post('api/movies/{movieId}/toggle-watch-later', [MovieController::class, 'toggleWatchLaterById'])->name('api.movies.toggle-watch-later-by-id');
    Route::get('api/movies/{movie}/trailers', [MovieController::class, 'getTrailers'])->name('api.movies.trailers');
    Route::get('api/movies/{movieId}/trailers-by-id', [MovieController::class, 'getTrailersById'])->name('api.movies.trailers-by-id');
    Route::get('api/movies/{movie}/recommendations', [MovieController::class, 'getRecommendations'])->name('api.movies.recommendations');
    Route::get('api/movies/{movie}/similar', [MovieController::class, 'getSimilarMovies'])->name('api.movies.similar');
    Route::get('api/movies/search', [MovieController::class, 'search'])->name('api.movies.search');
    Route::post('api/movies/search/log', [MovieController::class, 'logSearch'])->name('api.movies.search.log');
    Route::post('api/movies/search/track-click', [MovieController::class, 'trackSearchClick'])->name('api.movies.search.track-click');
    Route::post('api/movies/search/cleanup', [MovieController::class, 'cleanupSearchQueries'])->name('api.movies.search.cleanup');
    Route::get('api/movies/search/popular-terms', [MovieController::class, 'getPopularSearchTerms'])->name('api.movies.search.popular-terms');
    Route::get('api/movies/search/no-results', [MovieController::class, 'getNoResultSearches'])->name('api.movies.search.no-results');
    Route::get('api/movies/search/analytics-summary', [MovieController::class, 'getAnalyticsSummary'])->name('api.movies.search.analytics-summary');
    
    // TV show routes and API
    Route::get('api/tvshows/search', [TvshowController::class, 'search'])->name('api.tvshows.search');
    Route::post('api/tvshows/search/log', [TvshowController::class, 'logSearch'])->name('api.tvshows.search.log');
    Route::post('api/tvshows/search/track-click', [TvshowController::class, 'trackSearchClick'])->name('api.tvshows.search.track-click');
    Route::get('api/tvshows/search/popular-terms', [TvshowController::class, 'getPopularSearchTerms'])->name('api.tvshows.search.popular-terms');
    Route::get('api/tvshows/search/no-results', [TvshowController::class, 'getNoResultSearches'])->name('api.tvshows.search.no-results');
    Route::get('api/tvshows/search/analytics-summary', [TvshowController::class, 'getAnalyticsSummary'])->name('api.tvshows.search.analytics-summary');
    
    // Alternative Job Queue Routes
    Route::post('api/movies/{movie}/recommendations/initiate', [MovieController::class, 'initiateRecommendationsFetch'])->name('api.movies.recommendations.initiate');
    Route::get('api/movies/{movie}/recommendations/status', [MovieController::class, 'pollRecommendationsStatus'])->name('api.movies.recommendations.status');
});

// Subscription routes
use App\Http\Controllers\SubscriptionController;
// use App\Http\Controllers\WebhookController; // Commented out for local development

# Public subscription plans (accessible without auth for unauthenticated users who want to see plans)
Route::get('subscription/plans/public', [SubscriptionController::class, 'plans'])->name('subscription.plans.public');

Route::middleware(['auth'])->group(function () {
    Route::get('subscription/plans', [SubscriptionController::class, 'plans'])->name('subscription.plans');
    Route::get('subscription/manage', [SubscriptionController::class, 'manage'])->name('subscription.manage');
    Route::post('subscription/subscribe', [SubscriptionController::class, 'subscribe'])->name('subscription.subscribe');
    Route::post('subscription/cancel', [SubscriptionController::class, 'cancel'])->name('subscription.cancel');
    Route::post('subscription/resume', [SubscriptionController::class, 'resume'])->name('subscription.resume');
    Route::post('subscription/update-plan', [SubscriptionController::class, 'updatePlan'])->name('subscription.update-plan');
    Route::post('subscription/update-payment-method', [SubscriptionController::class, 'updatePaymentMethod'])->name('subscription.update-payment-method');
    Route::get('subscription/invoice/{invoiceId}', [SubscriptionController::class, 'downloadInvoice'])->name('subscription.download-invoice');
});



// Stripe webhook endpoint (commented out for local development)
// Route::post('stripe/webhook', [WebhookController::class, 'handleWebhook'])->name('cashier.webhook');

// API routes (some public, some require auth)
Route::get('api/movies/search', [MovieController::class, 'search'])->name('api.movies.search');
// TV Shows search API
Route::get('api/tvshows/search', [TvshowController::class, 'search'])->name('api.tvshows.search');
Route::get('api/movies/{movie}/trailers', [MovieController::class, 'getTrailers'])->name('api.movies.trailers');
Route::get('api/movies/{movieId}/trailers-by-id', [MovieController::class, 'getTrailersById'])->name('api.movies.trailers-by-id');
Route::get('api/movies/{movie}/recommendations', [MovieController::class, 'getRecommendations'])->name('api.movies.recommendations');
Route::get('api/movies/{movie}/similar', [MovieController::class, 'getSimilarMovies'])->name('api.movies.similar');

// Admin routes - protected by admin role
Route::middleware(['auth', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('admin/dashboard');
    })->name('dashboard');
    
    // Admin-only analytics routes
    Route::get('api/movies/search/popular-terms', [MovieController::class, 'getPopularSearchTerms'])->name('api.movies.search.popular-terms');
    Route::get('api/movies/search/no-results', [MovieController::class, 'getNoResultSearches'])->name('api.movies.search.no-results');
    Route::get('api/movies/search/analytics-summary', [MovieController::class, 'getAnalyticsSummary'])->name('api.movies.search.analytics-summary');
    
    // TV Shows admin analytics
    Route::get('api/tvshows/search/popular-terms', [TvshowController::class, 'getPopularSearchTerms'])->name('api.tvshows.search.popular-terms');
    Route::get('api/tvshows/search/no-results', [TvshowController::class, 'getNoResultSearches'])->name('api.tvshows.search.no-results');
    Route::get('api/tvshows/search/analytics-summary', [TvshowController::class, 'getAnalyticsSummary'])->name('api.tvshows.search.analytics-summary');
    
    // Admin-only content management routes (future implementation)
    // Route::resource('movies', AdminMovieController::class);
    // Route::resource('tvshows', AdminTvshowController::class);
    // Route::resource('users', AdminUserController::class);
});

// Editor routes - protected by editor or admin role
Route::middleware(['auth', 'role_or_permission:editor|manage movies'])->prefix('editor')->name('editor.')->group(function () {
    Route::get('dashboard', function () {
        return Inertia::render('editor/dashboard');
    })->name('dashboard');
    
    // Editor content management routes (future implementation)
    // Route::get('movies', [EditorMovieController::class, 'index'])->name('movies.index');
    // Route::get('tvshows', [EditorTvshowController::class, 'index'])->name('tvshows.index');
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
