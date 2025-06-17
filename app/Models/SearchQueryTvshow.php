<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SearchQueryTvshow extends Model
{
    protected $table = 'search_query_tvshows';
    
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
        'clicked_result_type',
        'time_to_click_ms',
        'clicked_tvshow_id',
        'clicked_tvshow_title',
        'clicked_tvshow_slug',
        'clicked_season_id',
        'clicked_season_name',
        'clicked_season_number',
        'clicked_episode_id',
        'clicked_episode_name',
        'clicked_episode_number',
        'clicked_result_data',
        'session_data',
    ];

    protected $casts = [
        'results_summary' => 'array',
        'clicked_result_data' => 'array',
        'session_data' => 'array',
        'has_results' => 'boolean',
        'clicked_result_at' => 'datetime',
        'clicked_season_number' => 'integer',
        'clicked_episode_number' => 'integer',
        'time_to_click_ms' => 'integer',
    ];

    /**
     * Get the user that performed this search.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the clicked tvshow (if any).
     */
    public function clickedTvshow(): BelongsTo
    {
        return $this->belongsTo(Tvshow::class, 'clicked_tvshow_id');
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
        // If dates are provided without time, assume full day range
        if (strlen($startDate) === 10) { // Y-m-d format
            $startDate = $startDate . ' 00:00:00';
        }
        if (strlen($endDate) === 10) { // Y-m-d format
            $endDate = $endDate . ' 23:59:59';
        }
        
        return $query->whereBetween('created_at', [$startDate, $endDate]);
    }

    /**
     * Scope for searches in the last N days.
     */
    public function scopeInLastDays($query, $days)
    {
        return $query->where('created_at', '>=', now()->subDays($days));
    }

    /**
     * Scope for searches by a specific user.
     */
    public function scopeByUser($query, $userId)
    {
        return $query->where('user_id', $userId);
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
            'most_clicked_tvshows' => static::whereNotNull('clicked_tvshow_id')
                ->where('created_at', '>=', now()->subDays($days))
                ->selectRaw('clicked_tvshow_id, clicked_tvshow_title, COUNT(*) as click_count')
                ->groupBy('clicked_tvshow_id', 'clicked_tvshow_title')
                ->orderByDesc('click_count')
                ->limit(10)
                ->get(),
        ];
    }
}
