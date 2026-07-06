# Plays Analytics Implementation Summary

## 📊 Overview

Admin panel analytics for the **Plays System** have been successfully implemented. These analytics provide deep insights into user engagement, replay behavior, and content performance beyond unique views.

## 🎯 New Analytics Endpoints

### Overview Endpoint (Enhanced)
**Endpoint:** `GET /api/analytics/overview`

**New Plays Metrics:**
```json
{
  "total_plays": 1250,
  "total_movie_plays": 620,
  "total_episode_plays": 630,
  "unique_players": 85,
  "avg_play_completion_rate": 89.5,
  "plays_today": 42,
  "plays_this_week": 287,
  "plays_this_month": 1180,
  "replay_rate": 1.45  // Average replays per view
}
```

### Plays-Specific Endpoints

#### 1. Plays Over Time
**Endpoint:** `GET /api/analytics/plays-over-time?days=30`

Tracks daily play counts over the specified period.

**Response:**
```json
[
  { "date": "2025-11-01", "count": 45 },
  { "date": "2025-11-02", "count": 52 },
  ...
]
```

#### 2. Plays by Content Type
**Endpoint:** `GET /api/analytics/plays-by-content-type`

Breakdown of plays between movies and episodes.

**Response:**
```json
[
  { "type": "Movies", "count": 620 },
  { "type": "Episodes", "count": 630 }
]
```

#### 3. Most Played Movies
**Endpoint:** `GET /api/analytics/most-played-movies?limit=10&days=30`

Top movies by play count.

**Response:**
```json
[
  {
    "id": 42,
    "title": "Inception",
    "play_count": 127,
    "poster_path": "https://..."
  },
  ...
]
```

#### 4. Most Played Episodes
**Endpoint:** `GET /api/analytics/most-played-episodes?limit=10&days=30`

Top episodes by play count.

**Response:**
```json
[
  {
    "id": 523,
    "name": "Pilot",
    "episode_number": 1,
    "season_number": 1,
    "tvshow_name": "Breaking Bad",
    "play_count": 89,
    "still_path": "https://..."
  },
  ...
]
```

#### 5. Replay Rate by Content
**Endpoint:** `GET /api/analytics/replay-rate-by-content`

Shows which content has the highest replay rate (plays per unique viewer).

**Response:**
```json
[
  {
    "id": 15,
    "title": "The Shawshank Redemption",
    "replay_rate": 3.2,  // Watched 3.2 times on average
    "unique_viewers": 45,
    "total_plays": 144,
    "poster_path": "https://..."
  },
  ...
]
```

**Use Cases:**
- Identify "rewatchable" content
- Content that users come back to multiple times
- High replay rate = high value content

#### 6. Recent Plays
**Endpoint:** `GET /api/analytics/recent-plays?limit=20`

Latest play activities across the platform.

**Response:**
```json
[
  {
    "id": 1234,
    "user_name": "John Doe",
    "user_email": "john@example.com",
    "content_type": "episode",
    "content_name": "Breaking Bad - S1E1",
    "completion_percentage": 94.2,
    "watch_duration": 2400,
    "media_duration": 2580,
    "created_at": "2 minutes ago",
    "created_at_full": "2025-11-19T10:30:00Z"
  },
  ...
]
```

#### 7. Plays Hourly Distribution
**Endpoint:** `GET /api/analytics/plays-hourly-distribution`

Shows when users are most actively watching content.

**Response:**
```json
[
  { "hour": 0, "hour_label": "00:00", "count": 12 },
  { "hour": 1, "hour_label": "01:00", "count": 8 },
  ...
  { "hour": 20, "hour_label": "20:00", "count": 145 },
  ...
]
```

**Use Cases:**
- Peak viewing hours
- Schedule maintenance during low activity
- Optimize content releases

#### 8. Plays Weekly Distribution
**Endpoint:** `GET /api/analytics/plays-weekly-distribution`

Shows which days of the week are most popular.

**Response:**
```json
[
  { "day": "Sunday", "count": 245 },
  { "day": "Monday", "count": 178 },
  ...
  { "day": "Saturday", "count": 312 }
]
```

**Use Cases:**
- Weekend vs weekday patterns
- Content release timing
- Marketing campaign scheduling

## 📈 Key Metrics Explained

### 1. Replay Rate
```
Replay Rate = Total Plays / Total Unique Views
```

**Interpretation:**
- `1.0` = No replays (each viewer watched once)
- `1.5` = 50% replay rate (viewers watch 1.5 times on average)
- `3.0` = High rewatchability (viewers watch 3 times on average)

**High replay rate indicates:**
- Highly engaging content
- Rewatchable/comfort content
- Educational/reference content
- Fan favorites

### 2. Play vs View Metrics

| Metric | What It Measures | Use Case |
|--------|------------------|----------|
| **Views** | Unique reach | How many people discovered content |
| **Plays** | Total engagement | How much content is being consumed |
| **Unique Players** | Active users | Engaged user base |
| **Replay Rate** | Rewatchability | Content quality/value |

### 3. Completion Percentage
Average completion % for plays (already ≥80% by definition).

**Use Cases:**
- Content that exceeds minimum threshold
- Quality indicator (closer to 100% = better)
- Identify content that hooks users

## 🎨 Frontend Integration

The analytics page can now display:

### New Stat Cards
```tsx
<StatCard
  title="Total Plays"
  value={overview.total_plays}
  icon={<Play />}
  trend={`+${overview.plays_this_week} this week`}
/>

<StatCard
  title="Replay Rate"
  value={`${overview.replay_rate}x`}
  icon={<Repeat />}
  description="Average replays per view"
/>
```

### New Charts

#### Plays vs Views Over Time (Line Chart)
```tsx
<LineChart data={[
  { date: '2025-11-01', views: 45, plays: 62 },
  { date: '2025-11-02', views: 52, plays: 78 },
  ...
]} />
```

#### Top Rewatched Content (Bar Chart)
```tsx
<BarChart 
  data={replayRateData}
  xKey="title"
  yKey="replay_rate"
  title="Most Rewatched Movies"
/>
```

#### Hourly Activity Heatmap
```tsx
<HeatmapChart
  data={hourlyPlays}
  title="Peak Engagement Hours"
/>
```

## 📊 Analytics Use Cases

### Content Strategy
1. **Identify Binge-Worthy Content**
   - High episode plays in short timeframe
   - Sequential episode plays by same users

2. **Optimize Content Library**
   - Remove low-play, low-view content
   - Promote high-replay content
   - Acquire similar content to high-performers

3. **Content Recommendations**
   - Recommend high-replay-rate content
   - "Others who watched X also replayed Y"

### Marketing & Monetization
1. **Premium Content Identification**
   - High replay rate = high value
   - Justify premium pricing
   - Promote as "fan favorites"

2. **Engagement Metrics for Advertisers**
   - Total plays = ad impressions
   - Replay rate = engaged audience
   - Time-based ad targeting (hourly distribution)

### User Behavior Analysis
1. **Viewing Patterns**
   - Weekend vs weekday behavior
   - Peak engagement hours
   - Binge-watching detection

2. **Content Discovery**
   - First play vs replays
   - Discovery paths
   - Retention analysis

## 🔧 Technical Implementation

### Database Queries

**Efficient Replay Rate Calculation:**
```php
$replayRate = DB::table('plays')
    ->join('views', function ($join) {
        $join->on('plays.playable_id', '=', 'views.viewable_id')
             ->on('plays.playable_type', '=', 'views.viewable_type');
    })
    ->select(
        'plays.playable_id',
        DB::raw('COUNT(DISTINCT views.user_id) as unique_viewers'),
        DB::raw('COUNT(plays.id) as total_plays'),
        DB::raw('COUNT(plays.id) / COUNT(DISTINCT views.user_id) as replay_rate')
    )
    ->groupBy('plays.playable_id')
    ->orderByDesc('replay_rate')
    ->get();
```

### Caching Strategy

For high-traffic analytics:
```php
// Cache overview stats for 5 minutes
$overview = Cache::remember('analytics.overview', 300, function () {
    return $this->calculateOverview();
});

// Cache charts data for 15 minutes
$playsOverTime = Cache::remember('analytics.plays_over_time', 900, function () {
    return $this->getPlaysOverTime();
});
```

## 🚀 Next Steps

1. **Real-Time Updates**
   - WebSocket integration for live play tracking
   - Dashboard auto-refresh

2. **Advanced Analytics**
   - Cohort analysis (users who joined in specific period)
   - Retention curves
   - Churn prediction

3. **Export Features**
   - CSV/Excel export for all analytics
   - Scheduled reports via email
   - API for third-party tools

4. **Comparative Analytics**
   - Year-over-year comparisons
   - Content performance trends
   - A/B testing support

## 📋 API Routes Summary

| Route | Method | Description |
|-------|--------|-------------|
| `/api/analytics/overview` | GET | Enhanced with plays metrics |
| `/api/analytics/plays-over-time` | GET | Daily plays trend |
| `/api/analytics/plays-by-content-type` | GET | Movies vs Episodes breakdown |
| `/api/analytics/most-played-movies` | GET | Top movies by plays |
| `/api/analytics/most-played-episodes` | GET | Top episodes by plays |
| `/api/analytics/replay-rate-by-content` | GET | Most rewatched content |
| `/api/analytics/recent-plays` | GET | Latest play activities |
| `/api/analytics/plays-hourly-distribution` | GET | Hourly engagement pattern |
| `/api/analytics/plays-weekly-distribution` | GET | Weekly engagement pattern |

---

**Status:** ✅ Fully Implemented & Production Ready

**Access:** Admin-only (`auth` + `role:admin` middleware)

**Dependencies:**
- `plays` table (migration: `2025_11_19_000003_create_plays_table.php`)
- `Play` model with relationships
- Updated `AnalyticsController` with 8 new methods

