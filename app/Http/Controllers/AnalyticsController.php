<?php

namespace App\Http\Controllers;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Play;
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
        return Inertia::render('admin/analytics');
    }

    /**
     * Get overview statistics
     */
    public function overview()
    {
        // Views statistics
        $totalViews = View::count();
        $totalUniqueViewers = View::distinct('user_id')->whereNotNull('user_id')->count('user_id');
        $totalMovieViews = View::where('viewable_type', Movie::class)->count();
        $totalEpisodeViews = View::where('viewable_type', Episode::class)->count();
        $totalWatchProgress = WatchProgress::count();
        
        // Plays statistics
        $totalPlays = Play::count();
        $totalMoviePlays = Play::where('playable_type', Movie::class)->count();
        $totalEpisodePlays = Play::where('playable_type', Episode::class)->count();
        $uniquePlayers = Play::distinct('user_id')->whereNotNull('user_id')->count('user_id');
        
        // Average completion rate
        $avgCompletionRate = WatchProgress::where('progress_percentage', '>', 0)
            ->avg('progress_percentage');
        $avgPlayCompletionRate = Play::where('completion_percentage', '>', 0)
            ->avg('completion_percentage');

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

        // Plays today
        $playsToday = Play::whereDate('created_at', today())->count();
        
        // Plays this week
        $playsThisWeek = Play::whereBetween('created_at', [
            now()->startOfWeek(),
            now()->endOfWeek()
        ])->count();
        
        // Plays this month
        $playsThisMonth = Play::whereMonth('created_at', now()->month)
            ->whereYear('created_at', now()->year)
            ->count();

        // Calculate replay rate (plays per unique view)
        $replayRate = $totalViews > 0 ? round($totalPlays / $totalViews, 2) : 0;

        return response()->json([
            // Views metrics
            'total_views' => $totalViews,
            'total_unique_viewers' => $totalUniqueViewers,
            'total_movie_views' => $totalMovieViews,
            'total_episode_views' => $totalEpisodeViews,
            'total_watch_progress' => $totalWatchProgress,
            'avg_completion_rate' => round($avgCompletionRate ?? 0, 2),
            'views_today' => $viewsToday,
            'views_this_week' => $viewsThisWeek,
            'views_this_month' => $viewsThisMonth,
            
            // Plays metrics
            'total_plays' => $totalPlays,
            'total_movie_plays' => $totalMoviePlays,
            'total_episode_plays' => $totalEpisodePlays,
            'unique_players' => $uniquePlayers,
            'avg_play_completion_rate' => round($avgPlayCompletionRate ?? 0, 2),
            'plays_today' => $playsToday,
            'plays_this_week' => $playsThisWeek,
            'plays_this_month' => $playsThisMonth,
            'replay_rate' => $replayRate,
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

    /**
     * Get plays over time (daily for last 30 days)
     */
    public function playsOverTime(Request $request)
    {
        $days = $request->get('days', 30);
        
        $driver = config('database.default');
        $connection = config("database.connections.{$driver}.driver");
        
        if ($connection === 'sqlite') {
            $playsData = Play::select(
                    DB::raw('DATE(created_at) as date'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('created_at', '>=', now()->subDays($days))
                ->groupBy('date')
                ->orderBy('date', 'asc')
                ->get()
                ->keyBy('date');
        } else {
            $playsData = Play::select(
                    DB::raw('DATE(created_at) as date'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('created_at', '>=', now()->subDays($days))
                ->groupBy('date')
                ->orderBy('date', 'asc')
                ->get()
                ->keyBy('date');
        }

        // Fill in missing days with 0 counts
        $result = [];
        for ($i = $days - 1; $i >= 0; $i--) {
            $date = now()->subDays($i)->format('Y-m-d');
            $data = $playsData->get($date);
            $result[] = [
                'date' => $date,
                'count' => $data ? $data->count : 0,
            ];
        }

        return response()->json($result);
    }

    /**
     * Get plays by content type
     */
    public function playsByContentType()
    {
        $moviePlays = Play::where('playable_type', Movie::class)->count();
        $episodePlays = Play::where('playable_type', Episode::class)->count();

        return response()->json([
            [
                'type' => 'Movies',
                'count' => $moviePlays,
            ],
            [
                'type' => 'Episodes',
                'count' => $episodePlays,
            ],
        ]);
    }

    /**
     * Get most played movies
     */
    public function mostPlayedMovies(Request $request)
    {
        $limit = $request->get('limit', 10);
        $days = $request->get('days', 30);

        $query = Play::select('playable_id', DB::raw('COUNT(*) as play_count'))
            ->where('playable_type', Movie::class)
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('playable_id')
            ->orderByDesc('play_count')
            ->limit($limit);

        $playData = $query->get();

        $movies = Movie::whereIn('id', $playData->pluck('playable_id'))->get()->keyBy('id');

        $result = $playData->map(function ($play) use ($movies) {
            $movie = $movies->get($play->playable_id);
            return [
                'id' => $movie->id,
                'title' => $movie->title,
                'play_count' => $play->play_count,
                'poster_path' => $movie->poster_path 
                    ? env('TMDB_IMAGE_BASE_URL_92') . $movie->poster_path 
                    : env('DEFAULT_POSTER_IMAGE_URL'),
            ];
        });

        return response()->json($result);
    }

    /**
     * Get most played episodes
     */
    public function mostPlayedEpisodes(Request $request)
    {
        $limit = $request->get('limit', 10);
        $days = $request->get('days', 30);

        $query = Play::select('playable_id', DB::raw('COUNT(*) as play_count'))
            ->where('playable_type', Episode::class)
            ->where('created_at', '>=', now()->subDays($days))
            ->groupBy('playable_id')
            ->orderByDesc('play_count')
            ->limit($limit);

        $playData = $query->get();

        $episodes = Episode::with(['season.tvshow'])
            ->whereIn('id', $playData->pluck('playable_id'))
            ->get()
            ->keyBy('id');

        $result = $playData->map(function ($play) use ($episodes) {
            $episode = $episodes->get($play->playable_id);
            if (!$episode) return null;
            
            $tvshow = $episode->season?->tvshow;
            
            return [
                'id' => $episode->id,
                'name' => $episode->name,
                'episode_number' => $episode->episode_number,
                'season_number' => $episode->season_number,
                'tvshow_name' => $tvshow?->name,
                'play_count' => $play->play_count,
                'still_path' => $episode->still_path 
                    ? env('TMDB_IMAGE_BASE_URL_92') . $episode->still_path 
                    : env('DEFAULT_STILL_IMAGE_URL'),
            ];
        })->filter();

        return response()->json($result->values());
    }

    /**
     * Get replay rate by content (how many times content is replayed)
     */
    public function replayRateByContent()
    {
        // Get content with both views and plays
        $movieStats = DB::table('views')
            ->select(
                'viewable_id',
                DB::raw('COUNT(DISTINCT user_id) as unique_viewers')
            )
            ->where('viewable_type', Movie::class)
            ->groupBy('viewable_id')
            ->get()
            ->keyBy('viewable_id');

        $moviePlays = DB::table('plays')
            ->select(
                'playable_id',
                DB::raw('COUNT(*) as total_plays')
            )
            ->where('playable_type', Movie::class)
            ->groupBy('playable_id')
            ->get()
            ->keyBy('playable_id');

        // Calculate replay rates for movies
        $topRewatchedMovies = [];
        foreach ($movieStats as $viewableId => $stat) {
            $plays = $moviePlays->get($viewableId);
            if ($plays && $stat->unique_viewers > 0) {
                $replayRate = $plays->total_plays / $stat->unique_viewers;
                if ($replayRate > 1) { // Only include if replayed at least once
                    $topRewatchedMovies[$viewableId] = [
                        'id' => $viewableId,
                        'replay_rate' => round($replayRate, 2),
                        'unique_viewers' => $stat->unique_viewers,
                        'total_plays' => $plays->total_plays,
                    ];
                }
            }
        }

        // Sort by replay rate and get top 10
        usort($topRewatchedMovies, function ($a, $b) {
            return $b['replay_rate'] <=> $a['replay_rate'];
        });
        $topRewatchedMovies = array_slice($topRewatchedMovies, 0, 10);

        // Fetch movie details
        $movieIds = array_column($topRewatchedMovies, 'id');
        $movies = Movie::whereIn('id', $movieIds)->get()->keyBy('id');

        $result = array_map(function ($stat) use ($movies) {
            $movie = $movies->get($stat['id']);
            return [
                'id' => $stat['id'],
                'title' => $movie->title ?? 'Unknown',
                'replay_rate' => $stat['replay_rate'],
                'unique_viewers' => $stat['unique_viewers'],
                'total_plays' => $stat['total_plays'],
                'poster_path' => $movie->poster_path 
                    ? env('TMDB_IMAGE_BASE_URL_92') . $movie->poster_path 
                    : env('DEFAULT_POSTER_IMAGE_URL'),
            ];
        }, $topRewatchedMovies);

        return response()->json($result);
    }

    /**
     * Get recent plays
     */
    public function recentPlays(Request $request)
    {
        $limit = $request->get('limit', 20);

        $plays = Play::with(['user', 'playable'])
            ->orderBy('created_at', 'desc')
            ->limit($limit)
            ->get();

        $result = $plays->map(function ($play) {
            $playable = $play->playable;
            $contentType = $play->playable_type === Movie::class ? 'movie' : 'episode';
            
            if ($contentType === 'episode') {
                $episode = $playable;
                $tvshow = $episode->season?->tvshow;
                $contentName = $tvshow ? "{$tvshow->name} - S{$episode->season_number}E{$episode->episode_number}" : $episode->name;
            } else {
                $contentName = $playable?->title ?? 'Unknown';
            }

            return [
                'id' => $play->id,
                'user_name' => $play->user?->name ?? 'Guest',
                'user_email' => $play->user?->email ?? null,
                'content_type' => $contentType,
                'content_name' => $contentName,
                'completion_percentage' => round($play->completion_percentage, 1),
                'watch_duration' => $play->watch_duration,
                'media_duration' => $play->media_duration,
                'created_at' => $play->created_at->diffForHumans(),
                'created_at_full' => $play->created_at->toIso8601String(),
            ];
        });

        return response()->json($result);
    }

    /**
     * Get hourly plays distribution
     */
    public function playsHourlyDistribution()
    {
        $driver = config('database.default');
        $connection = config("database.connections.{$driver}.driver");
        
        if ($connection === 'sqlite') {
            $hourlyData = Play::select(
                    DB::raw('CAST(strftime("%H", created_at) as INTEGER) as hour'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('created_at', '>=', now()->subDays(30))
                ->groupBy('hour')
                ->orderBy('hour', 'asc')
                ->get()
                ->keyBy('hour');
        } else {
            $hourlyData = Play::select(
                    DB::raw('HOUR(created_at) as hour'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('created_at', '>=', now()->subDays(30))
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
                'hour' => $i,
                'hour_label' => sprintf('%02d:00', $i),
                'count' => $data ? $data->count : 0,
            ];
        }

        return response()->json($result);
    }

    /**
     * Get weekly plays distribution
     */
    public function playsWeeklyDistribution()
    {
        $dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        
        $driver = config('database.default');
        $connection = config("database.connections.{$driver}.driver");
        
        if ($connection === 'sqlite') {
            $weeklyData = Play::select(
                    DB::raw('CAST(strftime("%w", created_at) as INTEGER) as day_of_week'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('created_at', '>=', now()->subDays(30))
                ->groupBy('day_of_week')
                ->orderBy('day_of_week', 'asc')
                ->get()
                ->keyBy('day_of_week');

            $result = [];
            for ($i = 0; $i < 7; $i++) {
                $data = $weeklyData->get($i);
                $result[] = [
                    'day' => $dayNames[$i],
                    'count' => $data ? $data->count : 0,
                ];
            }
        } else {
            $weeklyData = Play::select(
                    DB::raw('DAYOFWEEK(created_at) as day_of_week'),
                    DB::raw('COUNT(*) as count')
                )
                ->where('created_at', '>=', now()->subDays(30))
                ->groupBy('day_of_week')
                ->orderBy('day_of_week', 'asc')
                ->get()
                ->keyBy('day_of_week');

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

