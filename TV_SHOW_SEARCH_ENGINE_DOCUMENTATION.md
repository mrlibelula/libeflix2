# TV Show Search Engine & Analytics Documentation

## Table of Contents
1. [Overview](#overview)
2. [Features](#features)
3. [Database Structure](#database-structure)
4. [API Endpoints](#api-endpoints)
5. [Frontend Components](#frontend-components)
6. [Analytics & Reporting](#analytics--reporting)
7. [Usage Examples](#usage-examples)
8. [Configuration](#configuration)
9. [Troubleshooting](#troubleshooting)

## Overview

The TV Show Search Engine is a comprehensive search and analytics system that allows users to search across TV shows, seasons, and episodes with detailed tracking and analytics capabilities. The system provides real-time search suggestions, click tracking, and comprehensive analytics for content optimization.

### Key Components
- **Search Engine**: Multi-level search across TV shows, seasons, and episodes
- **Analytics System**: Comprehensive tracking of search behavior and user interactions
- **Frontend Components**: React-based search interface with real-time suggestions
- **Backend API**: Laravel-based REST API with comprehensive logging

## Features

### Search Capabilities
- **Multi-level Search**: Search across TV shows, seasons, and episodes simultaneously
- **Real-time Suggestions**: Instant search results with debounced input
- **Comprehensive Filtering**: Search by name, overview, cast, crew, networks, and more
- **Relevance Scoring**: Intelligent ranking of results by relevance and type priority
- **Auto-play Integration**: Direct navigation to specific episodes from search results

### Analytics & Tracking
- **Search Logging**: Track all search queries with metadata
- **Click Tracking**: Monitor which results users click on
- **Performance Metrics**: Track search response times and user engagement
- **User Behavior Analysis**: Understand search patterns and content preferences
- **Content Analytics**: Identify popular shows, seasons, and episodes

### Advanced Features
- **Progressive Search**: Handle typing patterns intelligently
- **Fallback Mechanisms**: Robust error handling and data recovery
- **Caching**: Optimized performance with intelligent caching
- **Mobile Responsive**: Full mobile and desktop support

## Database Structure

### `search_query_tvshows` Table

The main analytics table that stores all search and click data:

#### Core Fields
```sql
id                      BIGINT PRIMARY KEY
user_id                 BIGINT (Foreign Key to users)
query                   VARCHAR (The search term)
results_count           INTEGER (Number of results found)
results_summary         JSON (Top 5 results summary)
has_results             BOOLEAN (Whether search found results)
search_type             VARCHAR (real_time, delayed_log, comprehensive, click_fallback)
```

#### Request Metadata
```sql
source_page             VARCHAR (Page where search originated)
ip_address              VARCHAR (User's IP address)
user_agent              TEXT (Browser information)
```

#### Click Tracking
```sql
clicked_result_at       TIMESTAMP (When user clicked a result)
clicked_result_type     VARCHAR (tvshow, season, episode)
time_to_click_ms        INTEGER (Time from search to click)
```

#### Hierarchical Result Data
```sql
-- TV Show Information (always present for clicks)
clicked_tvshow_id       BIGINT
clicked_tvshow_title    VARCHAR
clicked_tvshow_slug     VARCHAR

-- Season Information (for season/episode clicks)
clicked_season_id       BIGINT
clicked_season_name     VARCHAR
clicked_season_number   INTEGER

-- Episode Information (for episode clicks only)
clicked_episode_id      BIGINT
clicked_episode_name    VARCHAR
clicked_episode_number  INTEGER
```

#### Additional Data
```sql
clicked_result_data     JSON (Full result object for deep analysis)
session_data            JSON (Search metadata and debugging info)
created_at              TIMESTAMP
updated_at              TIMESTAMP
```

#### Database Indexes
```sql
INDEX(user_id, query)
INDEX(user_id, created_at)
INDEX(query, has_results)
INDEX(clicked_result_type, clicked_result_at)
INDEX(clicked_tvshow_id, clicked_result_at)
INDEX(search_type, created_at)
```

## API Endpoints

### Search Endpoints

#### 1. Comprehensive Search
```http
GET /api/tvshows/search
```

**Parameters:**
- `q` (string, required): Search query
- `limit` (integer, optional): Maximum results (default: 10)
- `log` (boolean, optional): Whether to log search (default: true)

**Response:**
```json
{
  "success": true,
  "results": [
    {
      "type": "tvshow|season|episode",
      "id": 123,
      "name": "Result Name",
      "slug": "result-slug",
      "poster_url": "https://...",
      "vote_average": 8.5,
      "relevance_score": 85,
      "tvshow_name": "Parent TV Show",
      "season_number": 1,
      "episode_number": 5
    }
  ],
  "query": "search term",
  "total": 15,
  "breakdown": {
    "tvshows": 5,
    "episodes": 8,
    "seasons": 2
  }
}
```

#### 2. Track Search Click
```http
POST /api/tvshows/search/track-click
```

**Payload:**
```json
{
  "query": "search term",
  "result_type": "episode",
  "result_data": {
    "id": 123,
    "name": "Episode Name",
    "tvshow_id": 456,
    "season_number": 1,
    "episode_number": 5
  },
  "search_timestamp": "2025-06-17T04:20:00.000Z"
}
```

#### 3. Delayed Search Logging
```http
POST /api/tvshows/search/log
```

**Payload:**
```json
{
  "query": "search term",
  "timestamp": "2025-06-17T04:20:00.000Z"
}
```

### Analytics Endpoints

#### 1. Popular Search Terms
```http
GET /api/tvshows/search/popular-terms
```

**Description:** Returns the most frequently searched terms in the last 30 days with search frequency and average results count.

**Parameters:** None (hardcoded to return top 10 terms from last 30 days)

**Response:**
```json
[
  {
    "query": "south park",
    "search_count": 45,
    "avg_results": 12.3
  },
  {
    "query": "breaking bad",
    "search_count": 38,
    "avg_results": 8.7
  }
]
```

**Usage Example:**
```javascript
fetch('/api/tvshows/search/popular-terms')
  .then(response => response.json())
  .then(data => {
    console.log('Most popular searches:', data);
  });
```

#### 2. No Results Searches
```http
GET /api/tvshows/search/no-results
```

**Description:** Returns search queries that returned no results, useful for content gap analysis and search algorithm improvement.

**Parameters:** None (hardcoded to return top 20 no-result queries from last 30 days)

**Response:**
```json
[
  {
    "query": "unknown show",
    "search_count": 5
  },
  {
    "query": "missing series",
    "search_count": 3
  }
]
```

**Usage Example:**
```javascript
fetch('/api/tvshows/search/no-results')
  .then(response => response.json())
  .then(data => {
    console.log('Failed searches:', data);
    // Use this data to identify missing content
  });
```

#### 3. Analytics Summary
```http
GET /api/tvshows/search/analytics-summary
```

**Description:** Comprehensive analytics dashboard providing key metrics and insights about search behavior and user engagement.

**Parameters:** None (hardcoded to analyze last 30 days)

**Response:**
```json
{
  "total_searches": 1250,
  "unique_users": 89,
  "searches_with_results": 1180,
  "searches_with_clicks": 892,
  "avg_results_per_search": 8.5,
  "avg_time_to_click": 2340.5,
  "most_clicked_tvshows": [
    {
      "clicked_tvshow_id": 123,
      "clicked_tvshow_title": "South Park",
      "click_count": 45
    },
    {
      "clicked_tvshow_id": 456,
      "clicked_tvshow_title": "Breaking Bad",
      "click_count": 32
    }
  ]
}
```

**Usage Example:**
```javascript
fetch('/api/tvshows/search/analytics-summary')
  .then(response => response.json())
  .then(data => {
    console.log('Search Analytics:', data);
    
    // Calculate derived metrics
    const clickThroughRate = (data.searches_with_clicks / data.total_searches) * 100;
    const successRate = (data.searches_with_results / data.total_searches) * 100;
    
    console.log(`Click-through rate: ${clickThroughRate.toFixed(2)}%`);
    console.log(`Search success rate: ${successRate.toFixed(2)}%`);
  });
```

## Frontend Components

### TvshowSearch Component

Located at: `resources/js/components/tvshow-search.tsx`

**Features:**
- Real-time search with 300ms debounce
- Delayed logging with 1500ms timeout
- Keyboard navigation (↑↓ arrows, Enter, Escape)
- Click tracking with comprehensive data
- Auto-closing on outside clicks

**Usage:**
```tsx
import { TvshowSearch } from '@/components/tvshow-search';

<TvshowSearch onClose={() => setSearchOpen(false)} />
```

### TvshowSearchModal Component

Located at: `resources/js/components/tvshow-search-modal.tsx`

**Features:**
- Modal wrapper for search component
- Backdrop clicking to close
- Keyboard shortcut support

**Usage:**
```tsx
import { TvshowSearchModal } from '@/components/tvshow-search-modal';

<TvshowSearchModal 
  isOpen={searchModalOpen} 
  onClose={() => setSearchModalOpen(false)} 
/>
```

### Search Result Types

The search displays different result types with specific formatting:

#### TV Show Results
- Show poster image
- Show name and original name
- Rating percentage
- Release year

#### Episode Results
- Episode still image (16:9 aspect ratio)
- Episode name with season/episode number
- "Episode" type badge
- Parent TV show context

#### Season Results
- Season poster image
- Season name
- "Season" type badge
- Parent TV show context

## Analytics & Reporting

### Key Metrics

#### Search Performance
- **Total Searches**: Overall search volume
- **Unique Users**: Number of distinct users searching
- **Search Success Rate**: Percentage of searches that return results
- **Click-Through Rate**: Percentage of searches that result in clicks
- **Average Time to Click**: User engagement speed

#### Content Analytics
- **Popular Search Terms**: Most frequently searched queries
- **Popular Content**: Most clicked TV shows, seasons, episodes
- **No Results Queries**: Failed searches for content improvement
- **Search Patterns**: Temporal analysis of search behavior

#### User Behavior
- **Search-to-Click Journey**: Analysis of user interaction patterns
- **Content Discovery**: How users find specific episodes
- **Search Refinement**: Progressive search behavior

### Analytics Queries

#### Most Popular Episodes
```sql
SELECT 
    clicked_tvshow_title,
    clicked_season_number,
    clicked_episode_name,
    COUNT(*) as clicks
FROM search_query_tvshows 
WHERE clicked_result_type = 'episode' 
    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY clicked_tvshow_id, clicked_episode_id 
ORDER BY clicks DESC 
LIMIT 10;
```

#### Search Performance by Type
```sql
SELECT 
    clicked_result_type,
    COUNT(*) as clicks,
    AVG(time_to_click_ms) as avg_time_ms
FROM search_query_tvshows 
WHERE clicked_result_at IS NOT NULL 
    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY clicked_result_type;
```

#### Popular Search Terms Leading to Episode Clicks
```sql
SELECT 
    query,
    COUNT(*) as episode_clicks,
    COUNT(DISTINCT clicked_episode_id) as unique_episodes
FROM search_query_tvshows 
WHERE clicked_result_type = 'episode' 
    AND created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY query 
ORDER BY episode_clicks DESC 
LIMIT 20;
```

#### User Search Patterns
```sql
SELECT 
    user_id,
    COUNT(*) as total_searches,
    COUNT(CASE WHEN clicked_result_at IS NOT NULL THEN 1 END) as searches_with_clicks,
    AVG(time_to_click_ms) as avg_time_to_click
FROM search_query_tvshows 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
GROUP BY user_id 
HAVING total_searches >= 5
ORDER BY total_searches DESC;
```

## Model Methods & Backend Implementation

### SearchQueryTvshow Model

The `SearchQueryTvshow` model provides several static methods for analytics and query scopes for building custom analytics.

#### Static Analytics Methods

#### 1. `getPopularSearchTerms($limit = 10, $days = 30)`

Returns the most popular search terms within a specified time period.

```php
// Get top 15 search terms from last 7 days
$popularTerms = SearchQueryTvshow::getPopularSearchTerms(15, 7);

foreach ($popularTerms as $term) {
    echo "'{$term->query}' searched {$term->search_count} times";
    echo " (avg {$term->avg_results} results)";
}
```

#### 2. `getNoResultSearches($limit = 20, $days = 30)`

Identifies search queries that returned no results, useful for content analysis.

```php
// Get queries with no results from last 14 days
$failedSearches = SearchQueryTvshow::getNoResultSearches(25, 14);

foreach ($failedSearches as $search) {
    echo "'{$search->query}' failed {$search->search_count} times";
    // Consider adding this content or improving search algorithm
}
```

#### 3. `getAnalyticsSummary($days = 30)`

Provides comprehensive analytics summary with key performance indicators.

```php
// Get analytics for last 60 days
$analytics = SearchQueryTvshow::getAnalyticsSummary(60);

echo "Total searches: {$analytics['total_searches']}";
echo "Unique users: {$analytics['unique_users']}";
echo "Success rate: " . ($analytics['searches_with_results'] / $analytics['total_searches'] * 100) . "%";
echo "Click-through rate: " . ($analytics['searches_with_clicks'] / $analytics['total_searches'] * 100) . "%";
echo "Avg time to click: {$analytics['avg_time_to_click']}ms";

// Most popular content
foreach ($analytics['most_clicked_tvshows'] as $tvshow) {
    echo "{$tvshow->clicked_tvshow_title}: {$tvshow->click_count} clicks";
}
```

#### Query Scopes

The model provides several query scopes for building custom analytics:

```php
// Get all searches with results from last week
$successfulSearches = SearchQueryTvshow::withResults()
    ->inLastDays(7)
    ->get();

// Get searches without results by specific user
$userFailedSearches = SearchQueryTvshow::withoutResults()
    ->byUser($userId)
    ->inLastDays(30)
    ->get();

// Get searches with clicks in date range
$clickedSearches = SearchQueryTvshow::withClicks()
    ->inDateRange('2025-06-01', '2025-06-30')
    ->get();

// Custom analytics query
$episodeSearchAnalytics = SearchQueryTvshow::where('clicked_result_type', 'episode')
    ->withClicks()
    ->inLastDays(30)
    ->selectRaw('
        clicked_tvshow_title,
        clicked_season_number,
        clicked_episode_name,
        COUNT(*) as clicks,
        AVG(time_to_click_ms) as avg_time_to_click
    ')
    ->groupBy('clicked_tvshow_id', 'clicked_episode_id')
    ->orderByDesc('clicks')
    ->get();
```

#### Controller Implementation

The analytics endpoints in `TvshowController` are simple wrappers around the model methods:

```php
// In TvshowController.php

public function getPopularSearchTerms()
{
    $terms = SearchQueryTvshow::getPopularSearchTerms(10, 30);
    return response()->json($terms);
}

public function getNoResultSearches()
{
    $searches = SearchQueryTvshow::getNoResultSearches(20, 30);
    return response()->json($searches);
}

public function getAnalyticsSummary()
{
    $summary = SearchQueryTvshow::getAnalyticsSummary(30);
    return response()->json($summary);
}
```

#### Custom Analytics Examples

Build your own analytics queries using the model:

```php
// Weekly search trends
$weeklyTrends = SearchQueryTvshow::selectRaw('
        DATE(created_at) as search_date,
        COUNT(*) as total_searches,
        COUNT(CASE WHEN has_results = 1 THEN 1 END) as successful_searches,
        COUNT(CASE WHEN clicked_result_at IS NOT NULL THEN 1 END) as searches_with_clicks
    ')
    ->inLastDays(7)
    ->groupBy('search_date')
    ->orderBy('search_date')
    ->get();

// Most popular episodes by search clicks
$popularEpisodes = SearchQueryTvshow::where('clicked_result_type', 'episode')
    ->whereNotNull('clicked_episode_id')
    ->inLastDays(30)
    ->selectRaw('
        clicked_tvshow_title,
        clicked_season_number,
        clicked_episode_number,
        clicked_episode_name,
        COUNT(*) as click_count,
        AVG(time_to_click_ms) as avg_engagement_time
    ')
    ->groupBy([
        'clicked_tvshow_id', 
        'clicked_episode_id', 
        'clicked_tvshow_title',
        'clicked_season_number',
        'clicked_episode_number', 
        'clicked_episode_name'
    ])
    ->orderByDesc('click_count')
    ->limit(20)
    ->get();

// Search performance by time of day
$hourlyPerformance = SearchQueryTvshow::selectRaw('
        HOUR(created_at) as hour_of_day,
        COUNT(*) as searches,
        AVG(results_count) as avg_results,
        AVG(time_to_click_ms) as avg_time_to_click
    ')
    ->inLastDays(30)
    ->whereNotNull('time_to_click_ms')
    ->groupBy('hour_of_day')
    ->orderBy('hour_of_day')
    ->get();

// User engagement patterns
$userEngagement = SearchQueryTvshow::selectRaw('
        user_id,
        COUNT(*) as total_searches,
        COUNT(CASE WHEN clicked_result_at IS NOT NULL THEN 1 END) as searches_with_clicks,
        AVG(time_to_click_ms) as avg_time_to_click,
        COUNT(DISTINCT clicked_tvshow_id) as unique_shows_clicked
    ')
    ->inLastDays(30)
    ->groupBy('user_id')
    ->having('total_searches', '>=', 5) // Users with at least 5 searches
    ->orderByDesc('total_searches')
    ->get();
```

## Usage Examples

### Basic Search Implementation

```php
// Controller method for TV show search
public function search(Request $request)
{
    $query = $request->get('q');
    $limit = $request->get('limit', 10);
    
    // Get comprehensive results
    $results = $this->performComprehensiveSearch($query, $limit);
    
    // Log search if needed
    if ($this->shouldLogSearch($query)) {
        $this->logSearchQuery($query, $results);
    }
    
    return response()->json([
        'success' => true,
        'results' => $results,
        'total' => count($results)
    ]);
}
```

### Frontend Search Integration

```tsx
const [query, setQuery] = useState('');
const [results, setResults] = useState([]);
const [isLoading, setIsLoading] = useState(false);

const performSearch = async (searchQuery: string) => {
    if (searchQuery.length < 2) return;
    
    setIsLoading(true);
    try {
        const response = await axios.get('/api/tvshows/search', {
            params: { q: searchQuery, limit: 10 }
        });
        setResults(response.data.results);
    } catch (error) {
        console.error('Search failed:', error);
    } finally {
        setIsLoading(false);
    }
};

// Debounced search
useEffect(() => {
    const timer = setTimeout(() => {
        if (query) performSearch(query);
    }, 300);
    
    return () => clearTimeout(timer);
}, [query]);
```

### Click Tracking Implementation

```tsx
const trackClick = async (result: SearchResult) => {
    try {
        await axios.post('/api/tvshows/search/track-click', {
            query: currentQuery,
            result_type: result.type,
            result_data: result,
            search_timestamp: searchTimestamp
        });
    } catch (error) {
        console.error('Click tracking failed:', error);
    }
};

const handleResultClick = async (result: SearchResult) => {
    // Track the click
    await trackClick(result);
    
    // Navigate to result
    window.location.href = getResultUrl(result);
};
```

## Configuration

### Environment Variables

```env
# Search Configuration
TVSHOW_SEARCH_DEBOUNCE_MS=300
TVSHOW_SEARCH_LOG_DELAY_MS=1500
TVSHOW_SEARCH_MAX_RESULTS=50

# Analytics Configuration
TVSHOW_ANALYTICS_RETENTION_DAYS=365
TVSHOW_ANALYTICS_ENABLE_LOGGING=true
TVSHOW_ANALYTICS_LOG_THRESHOLD=3

# Performance Configuration
TVSHOW_SEARCH_CACHE_TTL=300
TVSHOW_SEARCH_ENABLE_CACHE=true
```

### Search Algorithm Configuration

```php
// config/tvshow-search.php
return [
    'relevance_weights' => [
        'name_exact_match' => 100,
        'name_partial_match' => 70,
        'overview_match' => 30,
        'cast_match' => 20,
        'crew_match' => 15,
    ],
    
    'type_priorities' => [
        'tvshow' => 300,
        'episode' => 200,
        'season' => 100,
    ],
    
    'search_limits' => [
        'tvshows' => 10,
        'episodes' => 10,
        'seasons' => 10,
    ],
];
```

## Troubleshooting

### Common Issues

#### 1. Empty Results Summary
**Problem**: `results_summary` field is empty in database
**Solution**: Ensure SearchQueryTvshow model has proper fillable fields:
```php
protected $fillable = [
    'results_summary',
    'clicked_result_data',
    // ... other fields
];
```

#### 2. Click Tracking Not Working
**Problem**: Click data not being saved to database
**Solution**: Check model fillable array includes click tracking fields:
```php
protected $fillable = [
    'clicked_result_type',
    'clicked_tvshow_id',
    'clicked_season_id',
    'clicked_episode_id',
    // ... other click fields
];
```

#### 3. Search Performance Issues
**Problem**: Slow search responses
**Solutions**:
- Add database indexes on search fields
- Implement query result caching
- Optimize search algorithm
- Limit result set size

#### 4. Log Encoding Issues
**Problem**: Strange characters in Laravel logs
**Solutions**:
- Clear config and cache: `php artisan config:clear && php artisan cache:clear`
- Ensure proper UTF-8 encoding in log configuration
- Check file system encoding settings

### Debug Mode

Enable debug logging by setting in your `.env`:
```env
LOG_LEVEL=debug
TVSHOW_SEARCH_DEBUG=true
```

This will provide detailed logging of:
- Search query processing
- Click tracking requests
- Performance metrics
- Error details

### Performance Monitoring

Monitor search performance with these queries:

```sql
-- Average search response time
SELECT AVG(JSON_EXTRACT(session_data, '$.search_time_ms')) as avg_search_time
FROM search_query_tvshows 
WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 DAY);

-- Searches without results (potential issues)
SELECT query, COUNT(*) as count
FROM search_query_tvshows 
WHERE has_results = 0 
    AND created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY query 
ORDER BY count DESC;
```

## Support

For additional support or feature requests, please refer to:
- Code repository documentation
- API endpoint testing tools
- Database schema documentation
- Frontend component examples

---

*Last updated: June 17, 2025*
*Version: 1.0.0* 