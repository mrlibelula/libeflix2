<?php

namespace App\Http\Controllers;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\User;
use App\Models\View;
use App\Models\WatchProgress;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;

class AnalyticsController extends Controller
{
    /**
     * Display the analytics dashboard
     */
    public function index()
    {
        return Inertia::render('settings/analytics');
    }

    /**
     * Get overview statistics
     */
    public function overview()
    {
        $totalViews = View::count();
        $totalUniqueViewers = View::distinct('user_id')->whereNotNull('user_id')->count('user_id');
        $totalMovieViews = View::where('viewable_type', Movie::class)->count();
        $totalEpisodeViews = View::where('viewable_type', Episode::class)->count();
        $totalWatchProgress = WatchProgress::count();
        
        // Average completion rate
        $avgCompletionRate = WatchProgress::where('progress_percentage', '>', 0)
            ->avg('progress_percentage');

        // Views today
        $viewsToday = View::whereDate('viewed_at', today())->count();
        
        // Views this week
        $viewsThisWeek = View::whereBetween('viewed_at', [
            now()->startOfWeek(),
            now()->endOfWeek()
        ])->count();
        
        // Views this month
        $viewsThisMonth = View::whereMonth('viewed_at', now()->month)
            ->whereYear('viewed_at', now()->year)
            ->count();

        return response()->json([
            'total_views' => $totalViews,
            'total_unique_viewers' => $totalUniqueViewers,
            'total_movie_views' => $totalMovieViews,
            'total_episode_views' => $totalEpisodeViews,
            'total_watch_progress' => $totalWatchProgress,
            'avg_completion_rate' => round($avgCompletionRate ?? 0, 2),
            'views_today' => $viewsToday,
            'views_this_week' => $viewsThisWeek,
            'views_this_month' => $viewsThisMonth,
        ]);
    }

    /**
     * Get views over time (daily for last 30 days)
     */
    public function viewsOverTime(Request $request)
    {
        $days = $request->get('days', 30);
        
        $viewsData = View::select(
                DB::raw('DATE(viewed_at) as date'),
                DB::raw('COUNT(*) as count')
            )
            ->where('viewed_at', '>=', now()->subDays($days))
            ->groupBy('date')
            ->orderBy('date', 'asc')
            ->get();

        // Fill in missing dates with 0 views
        $dates = collect();
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $views = $viewsData->firstWhere('date', $date);
            $dates->push([
                'date' => $date,
                'count' => $views ? $views->count : 0,
            ]);
        }

        return response()->json($dates);
    }

    /**
     * Get views by content type
     */
    public function viewsByContentType()
    {
        $movieViews = View::where('viewable_type', Movie::class)->count();
        $episodeViews = View::where('viewable_type', Episode::class)->count();

        return response()->json([
            [
                'type' => 'Movies',
                'count' => $movieViews,
            ],
            [
                'type' => 'Episodes',
                'count' => $episodeViews,
            ],
        ]);
    }

    /**
     * Get most viewed movies
     */
    public function mostViewedMovies(Request $request)
    {
        $limit = $request->get('limit', 10);
        $days = $request->get('days', null);

        $query = View::select('viewable_id', DB::raw('COUNT(*) as views_count'))
            ->where('viewable_type', Movie::class)
            ->groupBy('viewable_id')
            ->orderBy('views_count', 'desc')
            ->limit($limit);

        if ($days) {
            $query->where('viewed_at', '>=', now()->subDays($days));
        }

        $viewsData = $query->get();

        $movies = Movie::whereIn('id', $viewsData->pluck('viewable_id'))
            ->get()
            ->keyBy('id');

        $result = $viewsData->map(function ($item) use ($movies) {
            $movie = $movies->get($item->viewable_id);
            return [
                'id' => $item->viewable_id,
                'title' => $movie ? $movie->title : 'Unknown',
                'poster_path' => $movie ? $movie->poster_path : null,
                'views_count' => $item->views_count,
            ];
        });

        return response()->json($result);
    }

    /**
     * Get most viewed episodes
     */
    public function mostViewedEpisodes(Request $request)
    {
        $limit = $request->get('limit', 10);
        $days = $request->get('days', null);

        $query = View::select('viewable_id', DB::raw('COUNT(*) as views_count'))
            ->where('viewable_type', Episode::class)
            ->groupBy('viewable_id')
            ->orderBy('views_count', 'desc')
            ->limit($limit);

        if ($days) {
            $query->where('viewed_at', '>=', now()->subDays($days));
        }

        $viewsData = $query->get();

        $episodes = Episode::with(['season.tvshow'])
            ->whereIn('id', $viewsData->pluck('viewable_id'))
            ->get()
            ->keyBy('id');

        $result = $viewsData->map(function ($item) use ($episodes) {
            $episode = $episodes->get($item->viewable_id);
            return [
                'id' => $item->viewable_id,
                'title' => $episode ? $episode->name : 'Unknown',
                'episode_number' => $episode ? $episode->episode_number : null,
                'season_number' => $episode && $episode->season ? $episode->season->season_number : null,
                'tvshow_name' => $episode && $episode->season && $episode->season->tvshow ? 
                    $episode->season->tvshow->name : 'Unknown',
                'still_path' => $episode ? $episode->still_path : null,
                'views_count' => $item->views_count,
            ];
        });

        return response()->json($result);
    }

    /**
     * Get user engagement metrics
     */
    public function userEngagement()
    {
        // Total registered users
        $totalUsers = User::count();
        
        // Users who have watched something
        $activeUsers = User::whereHas('views')->count();
        
        // Users with watch progress
        $usersWithProgress = User::whereHas('watchProgresses')->count();
        
        // Average views per user
        $avgViewsPerUser = $activeUsers > 0 ? 
            round(View::whereNotNull('user_id')->count() / $activeUsers, 2) : 0;

        // Most active users
        $mostActiveUsers = View::select('user_id', DB::raw('COUNT(*) as views_count'))
            ->whereNotNull('user_id')
            ->groupBy('user_id')
            ->orderBy('views_count', 'desc')
            ->limit(5)
            ->get();

        $userIds = $mostActiveUsers->pluck('user_id');
        $users = User::whereIn('id', $userIds)->get()->keyBy('id');

        $topUsers = $mostActiveUsers->map(function ($item) use ($users) {
            $user = $users->get($item->user_id);
            return [
                'user_id' => $item->user_id,
                'name' => $user ? $user->name : 'Unknown',
                'email' => $user ? $user->email : 'Unknown',
                'views_count' => $item->views_count,
            ];
        });

        return response()->json([
            'total_users' => $totalUsers,
            'active_users' => $activeUsers,
            'users_with_progress' => $usersWithProgress,
            'avg_views_per_user' => $avgViewsPerUser,
            'engagement_rate' => $totalUsers > 0 ? round(($activeUsers / $totalUsers) * 100, 2) : 0,
            'top_users' => $topUsers,
        ]);
    }

    /**
     * Get recent views
     */
    public function recentViews(Request $request)
    {
        $limit = $request->get('limit', 20);

        $recentViews = View::with(['user', 'viewable'])
            ->orderBy('viewed_at', 'desc')
            ->limit($limit)
            ->get();

        $result = $recentViews->map(function ($view) {
            $viewable = $view->viewable;
            $viewableTitle = 'Unknown';
            $viewableType = 'Unknown';
            
            if ($viewable instanceof Movie) {
                $viewableTitle = $viewable->title;
                $viewableType = 'Movie';
            } elseif ($viewable instanceof Episode) {
                $viewableTitle = $viewable->name;
                $viewableType = 'Episode';
                if ($viewable->season && $viewable->season->tvshow) {
                    $viewableTitle = $viewable->season->tvshow->name . 
                        ' - S' . $viewable->season->season_number . 
                        'E' . $viewable->episode_number;
                }
            }

            return [
                'id' => $view->id,
                'user_name' => $view->user ? $view->user->name : 'Guest',
                'user_email' => $view->user ? $view->user->email : null,
                'viewable_type' => $viewableType,
                'viewable_title' => $viewableTitle,
                'viewed_at' => $view->viewed_at->format('Y-m-d H:i:s'),
                'viewed_at_human' => $view->viewed_at->diffForHumans(),
            ];
        });

        return response()->json($result);
    }

    /**
     * Get completion rate distribution
     */
    public function completionRateDistribution()
    {
        // Group by progress ranges
        $ranges = [
            '0-25%' => [0, 25],
            '26-50%' => [26, 50],
            '51-75%' => [51, 75],
            '76-99%' => [76, 99],
            '100%' => [100, 100],
        ];

        $distribution = [];
        foreach ($ranges as $label => $range) {
            $count = WatchProgress::whereBetween('progress_percentage', $range)->count();
            $distribution[] = [
                'range' => $label,
                'count' => $count,
            ];
        }

        return response()->json($distribution);
    }

    /**
     * Get hourly views distribution
     */
    public function hourlyDistribution()
    {
        // Use database-agnostic approach
        $driver = config('database.default');
        $connection = config("database.connections.{$driver}.driver");
        
        if ($connection === 'sqlite') {
            $hourlyData = View::select(
                    DB::raw('CAST(strftime("%H", viewed_at) as INTEGER) as hour'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('viewed_at', '>=', now()->subDays(30))
                ->groupBy('hour')
                ->orderBy('hour', 'asc')
                ->get()
                ->keyBy('hour');
        } else {
            // MySQL
            $hourlyData = View::select(
                    DB::raw('HOUR(viewed_at) as hour'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('viewed_at', '>=', now()->subDays(30))
                ->groupBy('hour')
                ->orderBy('hour', 'asc')
                ->get()
                ->keyBy('hour');
        }

        // Fill in all 24 hours
        $result = [];
        for ($i = 0; $i < 24; $i++) {
            $data = $hourlyData->get($i);
            $result[] = [
                'hour' => str_pad($i, 2, '0', STR_PAD_LEFT) . ':00',
                'count' => $data ? $data->count : 0,
            ];
        }

        return response()->json($result);
    }

    /**
     * Get weekly views distribution
     */
    public function weeklyDistribution()
    {
        $dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        // Use database-agnostic approach
        $driver = config('database.default');
        $connection = config("database.connections.{$driver}.driver");
        
        if ($connection === 'sqlite') {
            // SQLite: strftime('%w', ...) returns 0-6 where 0=Sunday
            $weeklyData = View::select(
                    DB::raw('CAST(strftime("%w", viewed_at) as INTEGER) as day_of_week'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('viewed_at', '>=', now()->subDays(30))
                ->groupBy('day_of_week')
                ->orderBy('day_of_week', 'asc')
                ->get()
                ->keyBy('day_of_week');

            // Fill in all 7 days (SQLite: 0=Sunday, 6=Saturday)
            $result = [];
            for ($i = 0; $i < 7; $i++) {
                $data = $weeklyData->get($i);
                $result[] = [
                    'day' => $dayNames[$i],
                    'count' => $data ? $data->count : 0,
                ];
            }
        } else {
            // MySQL
            $weeklyData = View::select(
                    DB::raw('DAYOFWEEK(viewed_at) as day_of_week'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('viewed_at', '>=', now()->subDays(30))
                ->groupBy('day_of_week')
                ->orderBy('day_of_week', 'asc')
                ->get()
                ->keyBy('day_of_week');

            // Fill in all 7 days (MySQL DAYOFWEEK: 1=Sunday, 7=Saturday)
            $result = [];
            for ($i = 1; $i <= 7; $i++) {
                $data = $weeklyData->get($i);
                $result[] = [
                    'day' => $dayNames[$i - 1],
                    'count' => $data ? $data->count : 0,
                ];
            }
        }

        return response()->json($result);
    }
}

