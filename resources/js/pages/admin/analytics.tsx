import { Head } from '@inertiajs/react';
import { useEffect, useState } from 'react';
import axios from 'axios';
import Chart from 'react-apexcharts';
import { type ApexOptions } from 'apexcharts';

import HeadingSmall from '@/components/heading-small';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { type BreadcrumbItem } from '@/types';
import { Skeleton } from '@/components/ui/skeleton';

import AppLayout from '@/layouts/app-layout';
import AdminFullWidthLayout from '@/layouts/admin/full-width-layout';
import {
    BarChart3,
    Eye,
    TrendingUp,
    Users,
    Film,
    Tv,
    Activity,
    Clock,
    Calendar,
    Percent,
    Play,
    Repeat,
    Flame,
    TrendingDown,
} from 'lucide-react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Analytics & Reports',
        href: '/admin/analytics',
    },
];

interface OverviewData {
    total_views: number;
    total_unique_viewers: number;
    total_movie_views: number;
    total_episode_views: number;
    total_watch_progress: number;
    avg_completion_rate: number;
    views_today: number;
    views_this_week: number;
    views_this_month: number;
    // Plays metrics
    total_plays: number;
    total_movie_plays: number;
    total_episode_plays: number;
    unique_players: number;
    avg_play_completion_rate: number;
    plays_today: number;
    plays_this_week: number;
    plays_this_month: number;
    replay_rate: number;
}

interface ViewOverTimeData {
    date: string;
    count: number;
}

interface ContentTypeData {
    type: string;
    count: number;
}

interface MovieData {
    id: number;
    title: string;
    poster_path: string | null;
    views_count: number;
}

interface EpisodeData {
    id: number;
    title: string;
    episode_number: number | null;
    season_number: number | null;
    tvshow_name: string;
    still_path: string | null;
    views_count: number;
}

interface UserEngagementData {
    total_users: number;
    active_users: number;
    users_with_progress: number;
    avg_views_per_user: number;
    engagement_rate: number;
    top_users: Array<{
        user_id: number;
        name: string;
        email: string;
        views_count: number;
    }>;
}

interface RecentView {
    id: number;
    user_name: string;
    user_email: string | null;
    viewable_type: string;
    viewable_title: string;
    viewed_at: string;
    viewed_at_human: string;
}

interface CompletionRateData {
    range: string;
    count: number;
}

interface HourlyData {
    hour: string;
    count: number;
}

interface WeeklyData {
    day: string;
    count: number;
}

interface PlayData {
    id: number;
    title: string;
    poster_path: string | null;
    play_count: number;
}

interface PlayEpisodeData {
    id: number;
    name: string;
    episode_number: number;
    season_number: number;
    tvshow_name: string;
    still_path: string | null;
    play_count: number;
}

interface ReplayRateData {
    id: number;
    title: string;
    replay_rate: number;
    unique_viewers: number;
    total_plays: number;
    poster_path: string | null;
}

interface RecentPlayData {
    id: number;
    user_name: string;
    user_email: string | null;
    content_type: string;
    content_name: string;
    completion_percentage: number;
    watch_duration: number;
    media_duration: number;
    created_at: string;
    created_at_full: string;
}

export default function Analytics() {
    const [overview, setOverview] = useState<OverviewData | null>(null);
    const [viewsOverTime, setViewsOverTime] = useState<ViewOverTimeData[]>([]);
    const [contentTypeData, setContentTypeData] = useState<ContentTypeData[]>([]);
    const [mostViewedMovies, setMostViewedMovies] = useState<MovieData[]>([]);
    const [mostViewedEpisodes, setMostViewedEpisodes] = useState<EpisodeData[]>([]);
    const [userEngagement, setUserEngagement] = useState<UserEngagementData | null>(null);
    const [recentViews, setRecentViews] = useState<RecentView[]>([]);
    const [completionRate, setCompletionRate] = useState<CompletionRateData[]>([]);
    const [hourlyDistribution, setHourlyDistribution] = useState<HourlyData[]>([]);
    const [weeklyDistribution, setWeeklyDistribution] = useState<WeeklyData[]>([]);
    
    // Plays state
    const [playsOverTime, setPlaysOverTime] = useState<ViewOverTimeData[]>([]);
    const [playsContentTypeData, setPlaysContentTypeData] = useState<ContentTypeData[]>([]);
    const [mostPlayedMovies, setMostPlayedMovies] = useState<PlayData[]>([]);
    const [mostPlayedEpisodes, setMostPlayedEpisodes] = useState<PlayEpisodeData[]>([]);
    const [replayRateData, setReplayRateData] = useState<ReplayRateData[]>([]);
    const [recentPlays, setRecentPlays] = useState<RecentPlayData[]>([]);
    const [playsHourlyDistribution, setPlaysHourlyDistribution] = useState<HourlyData[]>([]);
    const [playsWeeklyDistribution, setPlaysWeeklyDistribution] = useState<WeeklyData[]>([]);
    
    const [loading, setLoading] = useState(true);
    const [timeRange, setTimeRange] = useState<number>(30);
    const [mainTab, setMainTab] = useState<string>('views');
    const [playsLoaded, setPlaysLoaded] = useState(false);

    useEffect(() => {
        fetchViewsData();
    }, [timeRange]);

    useEffect(() => {
        if (mainTab === 'plays' && !playsLoaded) {
            fetchPlaysData();
        }
    }, [mainTab]);

    useEffect(() => {
        if (playsLoaded) {
            fetchPlaysData();
        }
    }, [timeRange]);

    const fetchViewsData = async () => {
        setLoading(true);
        try {
            const [
                overviewRes,
                viewsRes,
                contentRes,
                moviesRes,
                episodesRes,
                engagementRes,
                recentRes,
                completionRes,
                hourlyRes,
                weeklyRes,
            ] = await Promise.all([
                axios.get('/api/analytics/overview'),
                axios.get(`/api/analytics/views-over-time?days=${timeRange}`),
                axios.get('/api/analytics/views-by-content-type'),
                axios.get(`/api/analytics/most-viewed-movies?limit=10&days=${timeRange}`),
                axios.get(`/api/analytics/most-viewed-episodes?limit=10&days=${timeRange}`),
                axios.get('/api/analytics/user-engagement'),
                axios.get('/api/analytics/recent-views?limit=20'),
                axios.get('/api/analytics/completion-rate-distribution'),
                axios.get('/api/analytics/hourly-distribution'),
                axios.get('/api/analytics/weekly-distribution'),
            ]);

            setOverview(overviewRes.data);
            setViewsOverTime(viewsRes.data);
            setContentTypeData(contentRes.data);
            setMostViewedMovies(moviesRes.data);
            setMostViewedEpisodes(episodesRes.data);
            setUserEngagement(engagementRes.data);
            setRecentViews(recentRes.data);
            setCompletionRate(completionRes.data);
            setHourlyDistribution(hourlyRes.data);
            setWeeklyDistribution(weeklyRes.data);
        } catch (error) {
            console.error('Error fetching views analytics data:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlaysData = async () => {
        try {
            const [
                playsRes,
                playsContentRes,
                playedMoviesRes,
                playedEpisodesRes,
                replayRateRes,
                recentPlaysRes,
                playsHourlyRes,
                playsWeeklyRes,
            ] = await Promise.all([
                axios.get(`/api/analytics/plays-over-time?days=${timeRange}`),
                axios.get('/api/analytics/plays-by-content-type'),
                axios.get(`/api/analytics/most-played-movies?limit=10&days=${timeRange}`),
                axios.get(`/api/analytics/most-played-episodes?limit=10&days=${timeRange}`),
                axios.get('/api/analytics/replay-rate-by-content'),
                axios.get('/api/analytics/recent-plays?limit=20'),
                axios.get('/api/analytics/plays-hourly-distribution'),
                axios.get('/api/analytics/plays-weekly-distribution'),
            ]);

            setPlaysOverTime(playsRes.data);
            setPlaysContentTypeData(playsContentRes.data);
            setMostPlayedMovies(playedMoviesRes.data);
            setMostPlayedEpisodes(playedEpisodesRes.data);
            setReplayRateData(replayRateRes.data);
            setRecentPlays(recentPlaysRes.data);
            setPlaysHourlyDistribution(playsHourlyRes.data);
            setPlaysWeeklyDistribution(playsWeeklyRes.data);
            setPlaysLoaded(true);
        } catch (error) {
            console.error('Error fetching plays analytics data:', error);
        }
    };

    // Chart configurations
    const viewsOverTimeOptions: ApexOptions = {
        chart: {
            type: 'area',
            height: 350,
            width: '100%',
            toolbar: {
                show: true,
            },
            zoom: {
                enabled: true,
            },
        },
        dataLabels: {
            enabled: false,
        },
        stroke: {
            curve: 'smooth',
            width: 2,
        },
        fill: {
            type: 'gradient',
            gradient: {
                shadeIntensity: 1,
                opacityFrom: 0.7,
                opacityTo: 0.3,
                stops: [0, 90, 100],
            },
        },
        xaxis: {
            categories: viewsOverTime.map((d) => d.date),
            labels: {
                rotate: -45,
                rotateAlways: false,
            },
        },
        yaxis: {
            title: {
                text: 'Views',
            },
        },
        tooltip: {
            x: {
                format: 'dd MMM yyyy',
            },
        },
        responsive: [{
            breakpoint: 480,
            options: {
                legend: {
                    position: 'bottom'
                }
            }
        }]
    };

    const viewsOverTimeSeries = [
        {
            name: 'Views',
            data: viewsOverTime.map((d) => d.count),
        },
    ];

    const contentTypeOptions: ApexOptions = {
        chart: {
            type: 'donut',
            height: 350,
            width: '100%',
        },
        labels: contentTypeData.map((d) => d.type),
        colors: ['#10b981', '#3b82f6'],
        legend: {
            position: 'bottom',
        },
        dataLabels: {
            enabled: true,
        },
        plotOptions: {
            pie: {
                donut: {
                    size: '70%',
                    labels: {
                        show: true,
                        total: {
                            show: true,
                            label: 'Total Views',
                        },
                    },
                },
            },
        },
    };

    const contentTypeSeries = contentTypeData.map((d) => d.count);

    const completionRateOptions: ApexOptions = {
        chart: {
            type: 'bar',
            height: 350,
            width: '100%',
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4,
            },
        },
        dataLabels: {
            enabled: false,
        },
        xaxis: {
            categories: completionRate.map((d) => d.range),
            title: {
                text: 'Completion Range',
            },
        },
        yaxis: {
            title: {
                text: 'Count',
            },
        },
        colors: ['#8b5cf6'],
    };

    const completionRateSeries = [
        {
            name: 'Watch Progress',
            data: completionRate.map((d) => d.count),
        },
    ];

    const hourlyDistributionOptions: ApexOptions = {
        chart: {
            type: 'line',
            height: 350,
            width: '100%',
        },
        stroke: {
            curve: 'smooth',
            width: 3,
        },
        xaxis: {
            categories: hourlyDistribution.map((d) => d.hour),
            title: {
                text: 'Hour of Day',
            },
        },
        yaxis: {
            title: {
                text: 'Views',
            },
        },
        colors: ['#f59e0b'],
        markers: {
            size: 4,
        },
    };

    const hourlyDistributionSeries = [
        {
            name: 'Views',
            data: hourlyDistribution.map((d) => d.count),
        },
    ];

    const weeklyDistributionOptions: ApexOptions = {
        chart: {
            type: 'bar',
            height: 350,
            width: '100%',
        },
        plotOptions: {
            bar: {
                horizontal: false,
                columnWidth: '55%',
                borderRadius: 4,
            },
        },
        dataLabels: {
            enabled: false,
        },
        xaxis: {
            categories: weeklyDistribution.map((d) => d.day),
            title: {
                text: 'Day of Week',
            },
        },
        yaxis: {
            title: {
                text: 'Views',
            },
        },
        colors: ['#06b6d4'],
    };

    const weeklyDistributionSeries = [
        {
            name: 'Views',
            data: weeklyDistribution.map((d) => d.count),
        },
    ];

    if (loading) {
        return (
            <AppLayout breadcrumbs={breadcrumbs}>
                <Head title="Analytics & Reports" />
                <AdminFullWidthLayout>
                    <div className="space-y-6">
                        <HeadingSmall title="Analytics & Reports" description="Loading analytics data..." />
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            {[...Array(8)].map((_, i) => (
                                <Card key={i}>
                                    <CardHeader>
                                        <Skeleton className="h-4 w-24" />
                                    </CardHeader>
                                    <CardContent>
                                        <Skeleton className="h-8 w-16" />
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    </div>
                </AdminFullWidthLayout>
            </AppLayout>
        );
    }

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Analytics & Reports" />

            <AdminFullWidthLayout>
                <div className="space-y-6 max-w-full overflow-hidden">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <HeadingSmall
                            title="Analytics & Reports"
                            description="Comprehensive analytics and insights for your platform"
                        />
                        <div className="flex gap-2 flex-shrink-0">
                            <button
                                onClick={() => setTimeRange(7)}
                                className={`px-3 py-1 text-sm rounded ${
                                    timeRange === 7
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80'
                                }`}
                            >
                                7 Days
                            </button>
                            <button
                                onClick={() => setTimeRange(30)}
                                className={`px-3 py-1 text-sm rounded ${
                                    timeRange === 30
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80'
                                }`}
                            >
                                30 Days
                            </button>
                            <button
                                onClick={() => setTimeRange(90)}
                                className={`px-3 py-1 text-sm rounded ${
                                    timeRange === 90
                                        ? 'bg-primary text-primary-foreground'
                                        : 'bg-muted hover:bg-muted/80'
                                }`}
                            >
                                90 Days
                            </button>
                        </div>
                    </div>

                    {/* Main Tabs: Views vs Plays */}
                    <Tabs value={mainTab} onValueChange={setMainTab} className="space-y-6">
                        <TabsList className="grid w-full max-w-md grid-cols-2">
                            <TabsTrigger value="views" className="flex items-center gap-2">
                                <Eye className="h-4 w-4" />
                                Views Analytics
                            </TabsTrigger>
                            <TabsTrigger value="plays" className="flex items-center gap-2">
                                <Play className="h-4 w-4" />
                                Plays & Engagement
                            </TabsTrigger>
                        </TabsList>

                        {/* Views Analytics Tab */}
                        <TabsContent value="views" className="space-y-6 mt-6">
                            {/* Overview Stats */}
                            {overview && (
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 max-w-full">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Views</CardTitle>
                                    <Eye className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{overview.total_views.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {overview.total_unique_viewers.toLocaleString()} unique viewers
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Movie Views</CardTitle>
                                    <Film className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{overview.total_movie_views.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">
                                        {overview.total_views > 0
                                            ? Math.round((overview.total_movie_views / overview.total_views) * 100)
                                            : 0}
                                        % of total
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Episode Views</CardTitle>
                                    <Tv className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">
                                        {overview.total_episode_views.toLocaleString()}
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        {overview.total_views > 0
                                            ? Math.round((overview.total_episode_views / overview.total_views) * 100)
                                            : 0}
                                        % of total
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Avg Completion</CardTitle>
                                    <Percent className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{overview.avg_completion_rate}%</div>
                                    <p className="text-xs text-muted-foreground">
                                        {overview.total_watch_progress.toLocaleString()} in progress
                                    </p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Today</CardTitle>
                                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{overview.views_today.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">Views today</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">This Week</CardTitle>
                                    <Calendar className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{overview.views_this_week.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">Views this week</p>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                                    <Activity className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    <div className="text-2xl font-bold">{overview.views_this_month.toLocaleString()}</div>
                                    <p className="text-xs text-muted-foreground">Views this month</p>
                                </CardContent>
                            </Card>

                            {userEngagement && (
                                <Card>
                                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                        <CardTitle className="text-sm font-medium">Engagement Rate</CardTitle>
                                        <Users className="h-4 w-4 text-muted-foreground" />
                                    </CardHeader>
                                    <CardContent>
                                        <div className="text-2xl font-bold">{userEngagement.engagement_rate}%</div>
                                        <p className="text-xs text-muted-foreground">
                                            {userEngagement.active_users.toLocaleString()} /{' '}
                                            {userEngagement.total_users.toLocaleString()} users
                                        </p>
                                    </CardContent>
                                </Card>
                            )}
                        </div>
                    )}

                    {/* Charts Tabs */}
                    <Tabs defaultValue="trends" className="space-y-4 max-w-full overflow-hidden">
                        <TabsList>
                            <TabsTrigger value="trends">Trends</TabsTrigger>
                            <TabsTrigger value="content">Content</TabsTrigger>
                            <TabsTrigger value="engagement">Engagement</TabsTrigger>
                            <TabsTrigger value="recent">Recent Activity</TabsTrigger>
                        </TabsList>

                        {/* Trends Tab */}
                        <TabsContent value="trends" className="space-y-4 max-w-full">
                            <Card className="max-w-full">
                                <CardHeader>
                                    <CardTitle>Views Over Time</CardTitle>
                                    <CardDescription>Daily views for the selected period</CardDescription>
                                </CardHeader>
                                <CardContent className="overflow-hidden max-w-full">
                                    <div className="w-full overflow-hidden">
                                        <Chart
                                            options={viewsOverTimeOptions}
                                            series={viewsOverTimeSeries}
                                            type="area"
                                            height={350}
                                            width="100%"
                                        />
                                    </div>
                                </CardContent>
                            </Card>

                            <div className="grid gap-4 md:grid-cols-2 max-w-full">
                                <Card className="max-w-full min-w-0">
                                    <CardHeader>
                                        <CardTitle>Hourly Distribution</CardTitle>
                                        <CardDescription>Views by hour of day (last 30 days)</CardDescription>
                                    </CardHeader>
                                    <CardContent className="overflow-hidden max-w-full">
                                        <div className="w-full overflow-hidden">
                                            <Chart
                                                options={hourlyDistributionOptions}
                                                series={hourlyDistributionSeries}
                                                type="line"
                                                height={350}
                                                width="100%"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card className="max-w-full min-w-0">
                                    <CardHeader>
                                        <CardTitle>Weekly Distribution</CardTitle>
                                        <CardDescription>Views by day of week (last 30 days)</CardDescription>
                                    </CardHeader>
                                    <CardContent className="overflow-hidden max-w-full">
                                        <div className="w-full overflow-hidden">
                                            <Chart
                                                options={weeklyDistributionOptions}
                                                series={weeklyDistributionSeries}
                                                type="bar"
                                                height={350}
                                                width="100%"
                                            />
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Content Tab */}
                        <TabsContent value="content" className="space-y-4">
                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Views by Content Type</CardTitle>
                                        <CardDescription>Distribution of movie vs episode views</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Chart
                                            options={contentTypeOptions}
                                            series={contentTypeSeries}
                                            type="donut"
                                            height={350}
                                        />
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Completion Rate Distribution</CardTitle>
                                        <CardDescription>Watch progress distribution</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <Chart
                                            options={completionRateOptions}
                                            series={completionRateSeries}
                                            type="bar"
                                            height={350}
                                        />
                                    </CardContent>
                                </Card>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                                <Card>
                                    <CardHeader>
                                        <CardTitle>Most Viewed Movies</CardTitle>
                                        <CardDescription>Top 10 movies by views</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {mostViewedMovies.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No data available</p>
                                            ) : (
                                                mostViewedMovies.map((movie) => (
                                                    <div
                                                        key={movie.id}
                                                        className="flex items-center justify-between border-b pb-2 last:border-0"
                                                    >
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium">{movie.title}</p>
                                                        </div>
                                                        <Badge variant="secondary">{movie.views_count} views</Badge>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>

                                <Card>
                                    <CardHeader>
                                        <CardTitle>Most Viewed Episodes</CardTitle>
                                        <CardDescription>Top 10 episodes by views</CardDescription>
                                    </CardHeader>
                                    <CardContent>
                                        <div className="space-y-3">
                                            {mostViewedEpisodes.length === 0 ? (
                                                <p className="text-sm text-muted-foreground">No data available</p>
                                            ) : (
                                                mostViewedEpisodes.map((episode) => (
                                                    <div
                                                        key={episode.id}
                                                        className="flex items-center justify-between border-b pb-2 last:border-0"
                                                    >
                                                        <div className="flex-1">
                                                            <p className="text-sm font-medium">{episode.tvshow_name}</p>
                                                            <p className="text-xs text-muted-foreground">
                                                                S{episode.season_number}E{episode.episode_number} -{' '}
                                                                {episode.title}
                                                            </p>
                                                        </div>
                                                        <Badge variant="secondary">{episode.views_count} views</Badge>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </div>
                        </TabsContent>

                        {/* Engagement Tab */}
                        <TabsContent value="engagement" className="space-y-4">
                            {userEngagement && (
                                <>
                                    <div className="grid gap-4 md:grid-cols-3">
                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Total Users</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-3xl font-bold">
                                                    {userEngagement.total_users.toLocaleString()}
                                                </div>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Active Users</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-3xl font-bold">
                                                    {userEngagement.active_users.toLocaleString()}
                                                </div>
                                                <p className="text-xs text-muted-foreground">
                                                    Users who have watched content
                                                </p>
                                            </CardContent>
                                        </Card>

                                        <Card>
                                            <CardHeader>
                                                <CardTitle>Avg Views/User</CardTitle>
                                            </CardHeader>
                                            <CardContent>
                                                <div className="text-3xl font-bold">
                                                    {userEngagement.avg_views_per_user}
                                                </div>
                                                <p className="text-xs text-muted-foreground">Among active users</p>
                                            </CardContent>
                                        </Card>
                                    </div>

                                    <Card>
                                        <CardHeader>
                                            <CardTitle>Most Active Users</CardTitle>
                                            <CardDescription>Top 5 users by view count</CardDescription>
                                        </CardHeader>
                                        <CardContent>
                                            <div className="space-y-3">
                                                {userEngagement.top_users.map((user, index) => (
                                                    <div
                                                        key={user.user_id}
                                                        className="flex items-center justify-between border-b pb-2 last:border-0"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold">
                                                                {index + 1}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm font-medium">{user.name}</p>
                                                                <p className="text-xs text-muted-foreground">
                                                                    {user.email}
                                                                </p>
                                                            </div>
                                                        </div>
                                                        <Badge variant="secondary">{user.views_count} views</Badge>
                                                    </div>
                                                ))}
                                            </div>
                                        </CardContent>
                                    </Card>
                                </>
                            )}
                        </TabsContent>

                        {/* Recent Activity Tab */}
                        <TabsContent value="recent" className="space-y-4">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Recent Views</CardTitle>
                                    <CardDescription>Last 20 content views across the platform</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    <div className="space-y-3">
                                        {recentViews.length === 0 ? (
                                            <p className="text-sm text-muted-foreground">No recent views</p>
                                        ) : (
                                            recentViews.map((view) => (
                                                <div
                                                    key={view.id}
                                                    className="flex items-center justify-between border-b pb-2 last:border-0"
                                                >
                                                    <div className="flex-1">
                                                        <p className="text-sm font-medium">{view.viewable_title}</p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {view.user_name} • {view.viewable_type}
                                                        </p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-xs text-muted-foreground">
                                                            {view.viewed_at_human}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        </TabsContent>
                    </Tabs>
                        </TabsContent>

                        {/* Plays & Engagement Tab */}
                        <TabsContent value="plays" className="space-y-6 mt-6">
                            {!playsLoaded ? (
                                <div className="flex items-center justify-center py-12">
                                    <div className="text-center space-y-4">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
                                        <p className="text-muted-foreground">Loading plays analytics...</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-6">

                        {/* Plays Overview Stats */}
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Total Plays</CardTitle>
                                    <Play className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <Skeleton className="h-8 w-20" />
                                    ) : (
                                        <>
                                            <div className="text-2xl font-bold">
                                                {overview?.total_plays?.toLocaleString() || 0}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {overview?.plays_this_week || 0} this week
                                            </p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Replay Rate</CardTitle>
                                    <Repeat className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <Skeleton className="h-8 w-20" />
                                    ) : (
                                        <>
                                            <div className="text-2xl font-bold">
                                                {overview?.replay_rate?.toFixed(2) || '0.00'}x
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                Avg replays per view
                                            </p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Movie Plays</CardTitle>
                                    <Film className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <Skeleton className="h-8 w-20" />
                                    ) : (
                                        <>
                                            <div className="text-2xl font-bold">
                                                {overview?.total_movie_plays?.toLocaleString() || 0}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {((overview?.total_movie_plays || 0) / (overview?.total_plays || 1) * 100).toFixed(1)}% of total
                                            </p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <CardTitle className="text-sm font-medium">Episode Plays</CardTitle>
                                    <Tv className="h-4 w-4 text-muted-foreground" />
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <Skeleton className="h-8 w-20" />
                                    ) : (
                                        <>
                                            <div className="text-2xl font-bold">
                                                {overview?.total_episode_plays?.toLocaleString() || 0}
                                            </div>
                                            <p className="text-xs text-muted-foreground">
                                                {((overview?.total_episode_plays || 0) / (overview?.total_plays || 1) * 100).toFixed(1)}% of total
                                            </p>
                                        </>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Plays Over Time Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Plays Over Time</CardTitle>
                                <CardDescription>
                                    Daily completed playbacks for the last {timeRange} days
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <Skeleton className="h-[350px] w-full" />
                                ) : (
                                    <Chart
                                        options={{
                                            ...viewsOverTimeOptions,
                                            xaxis: {
                                                ...viewsOverTimeOptions.xaxis,
                                                categories: playsOverTime.map((d) => d.date),
                                            },
                                            colors: ['#10b981'],
                                        }}
                                        series={[
                                            {
                                                name: 'Plays',
                                                data: playsOverTime.map((d) => d.count),
                                            },
                                        ]}
                                        type="area"
                                        height={350}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Plays by Content Type & Top Content */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle>Plays by Content Type</CardTitle>
                                    <CardDescription>Distribution of plays between movies and episodes</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <Skeleton className="h-[300px] w-full" />
                                    ) : (
                                        <Chart
                                            options={{
                                                chart: {
                                                    type: 'donut',
                                                },
                                                labels: playsContentTypeData.map((d) => d.type),
                                                colors: ['#3b82f6', '#8b5cf6'],
                                                legend: {
                                                    position: 'bottom',
                                                },
                                                dataLabels: {
                                                    enabled: true,
                                                },
                                            }}
                                            series={playsContentTypeData.map((d) => d.count)}
                                            type="donut"
                                            height={300}
                                        />
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle>Hourly Play Distribution</CardTitle>
                                    <CardDescription>When users complete their watching</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <Skeleton className="h-[300px] w-full" />
                                    ) : (
                                        <Chart
                                            options={{
                                                chart: {
                                                    type: 'bar',
                                                },
                                                xaxis: {
                                                    categories: playsHourlyDistribution.map((d) => d.hour),
                                                    title: {
                                                        text: 'Hour of Day',
                                                    },
                                                },
                                                yaxis: {
                                                    title: {
                                                        text: 'Plays',
                                                    },
                                                },
                                                colors: ['#10b981'],
                                                plotOptions: {
                                                    bar: {
                                                        borderRadius: 4,
                                                    },
                                                },
                                            }}
                                            series={[
                                                {
                                                    name: 'Plays',
                                                    data: playsHourlyDistribution.map((d) => d.count),
                                                },
                                            ]}
                                            type="bar"
                                            height={300}
                                        />
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Most Played Content */}
                        <div className="grid gap-4 md:grid-cols-2">
                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Flame className="h-5 w-5 text-orange-500" />
                                        Most Played Movies
                                    </CardTitle>
                                    <CardDescription>Top movies by total plays</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3, 4, 5].map((i) => (
                                                <Skeleton key={i} className="h-16 w-full" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {mostPlayedMovies.slice(0, 5).map((movie, index) => (
                                                <div
                                                    key={movie.id}
                                                    className="flex items-center gap-3 border-b pb-2 last:border-0"
                                                >
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    {movie.poster_path && (
                                                        <img
                                                            src={movie.poster_path}
                                                            alt={movie.title}
                                                            className="h-12 w-8 object-cover rounded"
                                                        />
                                                    )}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {movie.title}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            {movie.play_count} plays
                                                        </p>
                                                    </div>
                                                    <Badge variant="secondary">
                                                        <Play className="h-3 w-3 mr-1" />
                                                        {movie.play_count}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>

                            <Card>
                                <CardHeader>
                                    <CardTitle className="flex items-center gap-2">
                                        <Flame className="h-5 w-5 text-orange-500" />
                                        Most Played Episodes
                                    </CardTitle>
                                    <CardDescription>Top episodes by total plays</CardDescription>
                                </CardHeader>
                                <CardContent>
                                    {loading ? (
                                        <div className="space-y-3">
                                            {[1, 2, 3, 4, 5].map((i) => (
                                                <Skeleton key={i} className="h-16 w-full" />
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="space-y-3">
                                            {mostPlayedEpisodes.slice(0, 5).map((episode, index) => (
                                                <div
                                                    key={episode.id}
                                                    className="flex items-center gap-3 border-b pb-2 last:border-0"
                                                >
                                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white font-bold text-sm">
                                                        {index + 1}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-medium truncate">
                                                            {episode.tvshow_name}
                                                        </p>
                                                        <p className="text-xs text-muted-foreground">
                                                            S{episode.season_number}E{episode.episode_number} - {episode.name}
                                                        </p>
                                                    </div>
                                                    <Badge variant="secondary">
                                                        <Play className="h-3 w-3 mr-1" />
                                                        {episode.play_count}
                                                    </Badge>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </CardContent>
                            </Card>
                        </div>

                        {/* Replay Rate Leaderboard */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <Repeat className="h-5 w-5 text-primary" />
                                    Most Rewatched Content
                                </CardTitle>
                                <CardDescription>
                                    Movies with the highest replay rate (plays per unique viewer)
                                </CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <Skeleton key={i} className="h-20 w-full" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {replayRateData.slice(0, 5).map((item, index) => (
                                            <div
                                                key={item.id}
                                                className="flex items-center gap-4 border-b pb-3 last:border-0"
                                            >
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-purple-500 to-pink-500 text-white font-bold">
                                                    {index + 1}
                                                </div>
                                                {item.poster_path && (
                                                    <img
                                                        src={item.poster_path}
                                                        alt={item.title}
                                                        className="h-16 w-11 object-cover rounded"
                                                    />
                                                )}
                                                <div className="flex-1">
                                                    <p className="font-medium">{item.title}</p>
                                                    <div className="flex gap-4 mt-1 text-xs text-muted-foreground">
                                                        <span>{item.unique_viewers} viewers</span>
                                                        <span>•</span>
                                                        <span>{item.total_plays} plays</span>
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <div className="text-2xl font-bold text-primary">
                                                        {item.replay_rate.toFixed(1)}x
                                                    </div>
                                                    <p className="text-xs text-muted-foreground">replay rate</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Weekly Distribution */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Weekly Play Pattern</CardTitle>
                                <CardDescription>Plays distribution across days of the week</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <Skeleton className="h-[300px] w-full" />
                                ) : (
                                    <Chart
                                        options={{
                                            chart: {
                                                type: 'bar',
                                            },
                                            xaxis: {
                                                categories: playsWeeklyDistribution.map((d) => d.day),
                                            },
                                            colors: ['#8b5cf6'],
                                            plotOptions: {
                                                bar: {
                                                    borderRadius: 8,
                                                    distributed: false,
                                                },
                                            },
                                        }}
                                        series={[
                                            {
                                                name: 'Plays',
                                                data: playsWeeklyDistribution.map((d) => d.count),
                                            },
                                        ]}
                                        type="bar"
                                        height={300}
                                    />
                                )}
                            </CardContent>
                        </Card>

                        {/* Recent Plays Activity */}
                        <Card>
                            <CardHeader>
                                <CardTitle>Recent Plays</CardTitle>
                                <CardDescription>Latest completed playbacks on the platform</CardDescription>
                            </CardHeader>
                            <CardContent>
                                {loading ? (
                                    <div className="space-y-3">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <Skeleton key={i} className="h-16 w-full" />
                                        ))}
                                    </div>
                                ) : (
                                    <div className="space-y-3 max-h-[400px] overflow-y-auto">
                                        {recentPlays.map((play) => (
                                            <div
                                                key={play.id}
                                                className="flex items-start gap-3 border-b pb-3 last:border-0"
                                            >
                                                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900">
                                                    <Play className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-center gap-2">
                                                        <p className="text-sm font-medium">{play.user_name}</p>
                                                        <Badge variant="outline" className="text-xs">
                                                            {play.content_type}
                                                        </Badge>
                                                    </div>
                                                    <p className="text-sm text-muted-foreground truncate">
                                                        {play.content_name}
                                                    </p>
                                                    <div className="flex items-center gap-2 mt-1">
                                                        <span className="text-xs text-muted-foreground">
                                                            {play.completion_percentage.toFixed(1)}% completed
                                                        </span>
                                                        <span>•</span>
                                                        <span className="text-xs text-muted-foreground">
                                                            {play.created_at}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                                </div>
                            )}
                        </TabsContent>
                    </Tabs>
                </div>
            </AdminFullWidthLayout>
        </AppLayout>
    );
}

