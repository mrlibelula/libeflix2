<?php

use App\Http\Controllers\AdminController;
use App\Http\Controllers\CommentController;
use App\Http\Controllers\DashboardController;
use App\Http\Controllers\EpisodeController;
use App\Http\Controllers\GenreController;
use App\Http\Controllers\MovieController;
use App\Http\Controllers\PopularTopController;
use App\Http\Controllers\SeasonController;
use App\Http\Controllers\StorageController;
use App\Http\Controllers\TvshowController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

// PUBLIC COMMENT ROUTES - MUST BE FIRST TO AVOID CONFLICTS
Route::get('api/comments/public', [CommentController::class, 'publicIndex'])->name('api.comments.public.index');
Route::get('api/comments/{comment}/public', [CommentController::class, 'publicShow'])->name('api.comments.public.show');

// Public comment share route (accessible without authentication)
Route::get('api/comments/{comment}/share', [CommentController::class, 'share'])->name('api.comments.share');

// Test route to verify public access works
Route::get('api/test-public', function () {
    return response()->json(['message' => 'Public access works!', 'timestamp' => now()]);
});

Route::get('/', [DashboardController::class, 'index'])->name('home');

Route::get('dashboard', [DashboardController::class, 'index'])->name('dashboard');

// CSRF token refresh endpoint
Route::get('csrf-token', function () {
    return response()->json(['csrf_token' => csrf_token()]);
});

// Public routes (accessible without authentication)
// TV Shows routes
Route::get('tvshows', [TvshowController::class, 'index'])->name('tvshows.index');
Route::get('tvshow/{slug}', [TvshowController::class, 'show'])->name('tvshow.show');
Route::get('search', [TvshowController::class, 'searchResults'])->name('search.results');

// Movies routes - accessible without auth but enhanced when authenticated
Route::get('movies', [MovieController::class, 'index'])->name('movies.index');
Route::get('movie/{slug}', [MovieController::class, 'show'])->name('movie.show');
Route::get('free-media', [MovieController::class, 'freeMedia'])->name('free-media.index');
Route::get('popular-top', [PopularTopController::class, 'index'])->name('popular-top.index');

// Genre routes
Route::get('genre/{genreSlug}', [GenreController::class, 'show'])->name('genre.show');

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
    Route::post('api/movies/{movie:slug}/toggle-watch-later', [MovieController::class, 'toggleWatchLater'])->name('api.movies.toggle-watch-later-by-slug');
    
    // TV Show watch later routes
    Route::post('tvshows/{tvshow}/toggle-watch-later', [TvshowController::class, 'toggleWatchLater'])->name('tvshows.toggle-watch-later');
    Route::post('api/tvshows/{tvshow:slug}/toggle-watch-later', [TvshowController::class, 'toggleWatchLater'])->name('api.tvshows.toggle-watch-later-by-slug');
    
    // Season watch later routes
    Route::post('api/seasons/{seasonId}/toggle-watch-later', [SeasonController::class, 'toggleWatchLaterById'])->name('api.seasons.toggle-watch-later-by-id');
    
    // Episode watch later routes
    Route::post('api/episodes/{episodeId}/toggle-watch-later', [EpisodeController::class, 'toggleWatchLaterById'])->name('api.episodes.toggle-watch-later-by-id');
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
    
    // Movie likes API routes
    Route::post('api/movies/{movie}/like', [MovieController::class, 'like'])->name('api.movies.like');
    Route::delete('api/movies/{movie}/like', [MovieController::class, 'unlike'])->name('api.movies.unlike');
    
    // Comments API routes
    Route::get('api/comments', [CommentController::class, 'index'])->name('api.comments.index');
    Route::post('api/comments', [CommentController::class, 'store'])->name('api.comments.store');
    Route::get('api/comments/{comment}', [CommentController::class, 'show'])->name('api.comments.show');
    Route::put('api/comments/{comment}', [CommentController::class, 'update'])->name('api.comments.update');
    Route::delete('api/comments/{comment}', [CommentController::class, 'destroy'])->name('api.comments.destroy');
    Route::get('api/comments/{comment}/replies', [CommentController::class, 'replies'])->name('api.comments.replies');
    Route::post('api/comments/{comment}/like', [CommentController::class, 'toggleLike'])->name('api.comments.like');
    
    // TV show routes and API
    Route::get('api/tvshows/search', [TvshowController::class, 'search'])->name('api.tvshows.search');
    Route::post('api/tvshows/search/log', [TvshowController::class, 'logSearch'])->name('api.tvshows.search.log');
    Route::post('api/tvshows/search/track-click', [TvshowController::class, 'trackSearchClick'])->name('api.tvshows.search.track-click');
    Route::get('api/tvshows/search/popular-terms', [TvshowController::class, 'getPopularSearchTerms'])->name('api.tvshows.search.popular-terms');
    Route::get('api/tvshows/search/no-results', [TvshowController::class, 'getNoResultSearches'])->name('api.tvshows.search.no-results');
    Route::get('api/tvshows/search/analytics-summary', [TvshowController::class, 'getAnalyticsSummary'])->name('api.tvshows.search.analytics-summary');
    
    // TV show likes API routes
    Route::post('api/tvshows/{tvshow}/like', [TvshowController::class, 'like'])->name('api.tvshows.like');
    Route::delete('api/tvshows/{tvshow}/like', [TvshowController::class, 'unlike'])->name('api.tvshows.unlike');
    
    // Episode likes API routes
    Route::post('api/episodes/{episode}/like', [EpisodeController::class, 'like'])->name('api.episodes.like');
    Route::delete('api/episodes/{episode}/like', [EpisodeController::class, 'unlike'])->name('api.episodes.unlike');
    
    // Season likes API routes
    Route::post('api/seasons/{season}/like', [SeasonController::class, 'like'])->name('api.seasons.like');
    Route::delete('api/seasons/{season}/like', [SeasonController::class, 'unlike'])->name('api.seasons.unlike');
    
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
Route::get('api/movies/{movie}/certification', [MovieController::class, 'getCertification'])->name('api.movies.certification');
Route::get('api/movies/{movie}/reviews', [MovieController::class, 'getReviews'])->name('api.movies.reviews');

// Public likes routes (for viewing likes count without authentication)
Route::get('api/movies/{movie}/likes', [MovieController::class, 'getLikes'])->name('api.movies.likes.public');
Route::get('api/movies/{movie}/liked-users', [MovieController::class, 'getLikedUsers'])->name('api.movies.liked-users');
Route::get('api/tvshows/{tvshow}/likes', [TvshowController::class, 'getLikes'])->name('api.tvshows.likes.public');
Route::get('api/episodes/{episode}/likes', [EpisodeController::class, 'getLikes'])->name('api.episodes.likes.public');
Route::get('api/seasons/{season}/likes', [SeasonController::class, 'getLikes'])->name('api.seasons.likes.public');

// Admin routes - admin dashboard
Route::middleware(['auth', 'role:admin'])->prefix('admin')->name('admin.')->group(function () {
    Route::get('dashboard', [AdminController::class, 'dashboard'])->name('admin.dashboard');
    Route::get('users', [AdminController::class, 'users'])->name('admin.users');
});

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

// Test route for debugging comments
Route::get('test-comments/{movieId}', function ($movieId) {
    try {
        $movie = \App\Models\Movie::findOrFail($movieId);
        
        // Test basic relationship
        $basicComments = $movie->comments()->get();
        
        // Test with replies
        $commentsWithReplies = $movie->commentsWithReplies()->get();
        
        return response()->json([
            'movie_id' => $movieId,
            'basic_comments_count' => $basicComments->count(),
            'comments_with_replies_count' => $commentsWithReplies->count(),
            'basic_comments' => $basicComments,
            'comments_with_replies' => $commentsWithReplies,
            'total_comments' => $movie->commentsCount(),
        ]);
    } catch (\Exception $e) {
        return response()->json([
            'error' => $e->getMessage(),
            'trace' => $e->getTraceAsString()
        ]);
    }
});

require __DIR__.'/settings.php';
require __DIR__.'/auth.php';
