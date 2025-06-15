<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SearchQuery extends Model
{
    protected $fillable = [
        'user_id',
        'query',
        'results_count',
        'results_summary',
        'has_results',
        'search_type',
        'source_page',
        'ip_address',
        'user_agent',
        'clicked_result_at',
        'clicked_movie_id',
        'clicked_movie_title',
        'time_to_click_ms',
        'session_data',
    ];

    protected $casts = [
        'results_summary' => 'array',
        'session_data' => 'array',
        'has_results' => 'boolean',
        'clicked_result_at' => 'datetime',
    ];

    /**
     * Get the user that performed this search.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the clicked movie (if any).
     */
    public function clickedMovie(): BelongsTo
    {
        return $this->belongsTo(Movie::class, 'clicked_movie_id');
    }

    /**
     * Scope for successful searches (with results).
     */
    public function scopeWithResults($query)
    {
        return $query->where('has_results', true);
    }

    /**
     * Scope for searches without results.
     */
    public function scopeWithoutResults($query)
    {
        return $query->where('has_results', false);
    }

    /**
     * Scope for searches with clicks.
     */
    public function scopeWithClicks($query)
    {
        return $query->whereNotNull('clicked_result_at');
    }

    /**
     * Scope for searches within date range.
     */
    public function scopeInDateRange($query, $startDate, $endDate)
    {
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }

    /**
     * Get the click-through rate as a percentage.
     */
    public function getClickThroughRateAttribute(): float
    {
        if ($this->results_count === 0) {
            return 0;
        }
        
        return $this->clicked_result_at ? 100 : 0;
    }

    /**
     * Get popular search terms.
     */
    public static function getPopularSearchTerms($limit = 10, $days = 30)
    {
        return static::where('created_at', '>=', now()->subDays($days))
            ->selectRaw('query, COUNT(*) as search_count, AVG(results_count) as avg_results')
            ->groupBy('query')
            ->orderByDesc('search_count')
            ->limit($limit)
            ->get();
    }

    /**
     * Get searches with no results for improving search algorithm.
     */
    public static function getNoResultSearches($limit = 20, $days = 30)
    {
        return static::withoutResults()
            ->where('created_at', '>=', now()->subDays($days))
            ->selectRaw('query, COUNT(*) as search_count')
            ->groupBy('query')
            ->orderByDesc('search_count')
            ->limit($limit)
            ->get();
    }

    /**
     * Get search analytics summary.
     */
    public static function getAnalyticsSummary($days = 30)
    {
        $baseQuery = static::where('created_at', '>=', now()->subDays($days));
        
        return [
            'total_searches' => $baseQuery->count(),
            'unique_users' => $baseQuery->distinct('user_id')->count(),
            'searches_with_results' => $baseQuery->withResults()->count(),
            'searches_with_clicks' => $baseQuery->withClicks()->count(),
            'avg_results_per_search' => $baseQuery->avg('results_count'),
            'avg_time_to_click' => $baseQuery->whereNotNull('time_to_click_ms')->avg('time_to_click_ms'),
            'most_clicked_movies' => static::whereNotNull('clicked_movie_id')
                ->where('created_at', '>=', now()->subDays($days))
                ->selectRaw('clicked_movie_id, clicked_movie_title, COUNT(*) as click_count')
                ->groupBy('clicked_movie_id', 'clicked_movie_title')
                ->orderByDesc('click_count')
                ->limit(10)
                ->get(),
        ];
    }
}
