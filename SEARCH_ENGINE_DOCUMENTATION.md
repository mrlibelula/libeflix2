# Search Engine & Analytics Documentation

## Overview

This documentation covers the comprehensive search engine implementation with real-time search capabilities, user behavior tracking, and analytics system for the Libeflix2 movie platform.

## Features

### 🔍 Search Engine
- **Real-time search** with 300ms debouncing
- **Comprehensive indexing** across multiple movie fields
- **Keyboard navigation** (arrow keys, enter, escape)
- **Visual search results** with movie posters and metadata
- **Conditional display** (only appears on movies and movie pages)
- **Performance optimized** with relevance ranking

### 📊 Analytics & Tracking
- **Automatic query logging** with performance metrics
- **Click tracking** with time-to-click measurements
- **User behavior analysis** with session data
- **Popular search terms** identification
- **No-result searches** tracking for improvement opportunities
- **Comprehensive analytics** dashboard data

## Search Fields Indexed

The search engine indexes the following movie fields:

1. **title** - Primary movie title
2. **original_name** - Original language title
3. **tagline** - Movie tagline/slogan
4. **overview** - Movie description/synopsis
5. **alternative_titles** - JSON field with alternative titles
6. **keywords** - JSON field with movie keywords/tags
7. **credits** - JSON field with cast and crew information (directors and cast only)

## Database Schema

### Search Queries Table

```sql
CREATE TABLE search_queries (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    query VARCHAR(500) NOT NULL,
    results_count INT NOT NULL DEFAULT 0,
    results_summary JSON NULL,
    has_results BOOLEAN NOT NULL DEFAULT FALSE,
    search_type VARCHAR(50) NOT NULL DEFAULT 'real_time',
    source_page VARCHAR(255) NULL,
    clicked_result_at TIMESTAMP NULL,
    clicked_movie_id INT NULL,
    clicked_movie_title VARCHAR(255) NULL,
    time_to_click_ms INT NULL,
    ip_address VARCHAR(45) NULL,
    user_agent TEXT NULL,
    session_data JSON NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    
    INDEX idx_user_id (user_id),
    INDEX idx_query (query),
    INDEX idx_created_at (created_at),
    INDEX idx_has_results (has_results),
    INDEX idx_clicked_result_at (clicked_result_at),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

### Field Descriptions

- **user_id**: ID of the user performing the search
- **query**: The search term entered by the user
- **results_count**: Number of results returned
- **results_summary**: JSON array of top 5 results with basic info
- **has_results**: Boolean indicating if search returned any results
- **search_type**: Type of search ('real_time', 'full_page', etc.)
- **source_page**: Page where search was initiated
- **clicked_result_at**: Timestamp when user clicked on a result
- **clicked_movie_id**: ID of the movie clicked
- **clicked_movie_title**: Title of the movie clicked
- **time_to_click_ms**: Time from search to click in milliseconds
- **ip_address**: User's IP address
- **user_agent**: User's browser information
- **session_data**: Additional session and performance data

## API Endpoints

### Search Endpoints

#### 1. Real-time Search
```http
GET /api/movies/search?q={query}&limit={limit}
```

**Parameters:**
- `q` (required): Search query string (minimum 2 characters)
- `limit` (optional): Maximum number of results (default: 10)

**Response:**
```json
{
    "success": true,
    "results": [
        {
            "id": 123,
            "title": "Movie Title",
            "original_name": "Original Title",
            "slug": "movie-slug",
            "poster_path": "/path/to/poster.jpg",
            "poster_url": "https://image.tmdb.org/t/p/w300/path/to/poster.jpg",
            "release_date": "2023-01-01",
            "vote_average": 8.5,
            "overview": "Movie description...",
            "tagline": "Movie tagline",
            "is_watch_later": false,
            "has_subtitles": true,
            "subtitle_languages": ["en", "es", "fr"]
        }
    ],
    "query": "search term",
    "total": 5
}
```

#### 2. Track Search Click
```http
POST /api/movies/search/track-click
```

**Request Body:**
```json
{
    "query": "search term",
    "movie_id": 123,
    "movie_title": "Movie Title",
    "search_timestamp": "2023-12-15T10:30:00.000Z"
}
```

**Response:**
```json
{
    "success": true
}
```

### Analytics Endpoints

#### 1. Popular Search Terms
```http
GET /api/movies/search/popular-terms
```

**Response:**
```json
[
    {
        "query": "action movies",
        "search_count": 45,
        "unique_users": 23,
        "avg_results": 12.5,
        "click_rate": 0.67
    }
]
```

#### 2. No-Result Searches
```http
GET /api/movies/search/no-results
```

**Response:**
```json
[
    {
        "query": "obscure movie title",
        "search_count": 8,
        "unique_users": 6,
        "last_searched": "2023-12-15T10:30:00.000Z"
    }
]
```

#### 3. Analytics Summary
```http
GET /api/movies/search/analytics-summary
```

**Response:**
```json
{
    "total_searches": 1250,
    "unique_users": 89,
    "avg_results_per_search": 8.3,
    "searches_with_results": 1180,
    "searches_with_clicks": 756,
    "overall_click_rate": 0.64,
    "avg_time_to_click_ms": 2340,
    "top_search_terms": [...],
    "no_result_searches": [...],
    "search_trends": [...]
}
```

## Model Methods

### SearchQuery Model

The `SearchQuery` model provides several static methods for analytics:

#### Popular Search Terms
```php
SearchQuery::getPopularSearchTerms($limit = 10, $days = 30)
```
Returns the most popular search terms with statistics.

#### No-Result Searches
```php
SearchQuery::getNoResultSearches($limit = 20, $days = 30)
```
Returns searches that returned no results, useful for content gap analysis.

#### Analytics Summary
```php
SearchQuery::getAnalyticsSummary($days = 30)
```
Returns comprehensive analytics summary including:
- Total searches and unique users
- Average results per search
- Click-through rates
- Average time to click
- Top search terms
- Trending searches

#### Query Scopes
```php
// Get searches with results
SearchQuery::withResults()

// Get searches with clicks
SearchQuery::withClicks()

// Get searches from specific time period
SearchQuery::inLastDays(30)

// Get searches by specific user
SearchQuery::byUser($userId)
```

## Available Analytics Functions

### Controller Methods (MovieController)

#### 1. `getPopularSearchTerms()`
```php
Route: GET /api/movies/search/popular-terms
Method: MovieController@getPopularSearchTerms
```
Returns the top 10 most popular search terms from the last 30 days with statistics.

#### 2. `getNoResultSearches()`
```php
Route: GET /api/movies/search/no-results  
Method: MovieController@getNoResultSearches
```
Returns the top 20 searches that returned no results from the last 30 days.

#### 3. `getAnalyticsSummary()`
```php
Route: GET /api/movies/search/analytics-summary
Method: MovieController@getAnalyticsSummary
```
Returns comprehensive analytics summary for the last 30 days.

#### 4. `getCustomQueries()`
```php
Route: GET /api/movies/search/custom-queries
Method: MovieController@getCustomQueries
```
Returns count of searches with both results and clicks.

### Model Static Methods (SearchQuery)

#### 1. `getPopularSearchTerms($limit, $days)`
```php
SearchQuery::getPopularSearchTerms(10, 30);
```
**Returns:** Array of popular search terms with:
- `query`: The search term
- `search_count`: Number of times searched
- `unique_users`: Number of unique users who searched
- `avg_results`: Average number of results returned
- `click_rate`: Percentage of searches that resulted in clicks

#### 2. `getNoResultSearches($limit, $days)`
```php
SearchQuery::getNoResultSearches(20, 30);
```
**Returns:** Array of searches with no results:
- `query`: The search term
- `search_count`: Number of times searched
- `unique_users`: Number of unique users
- `last_searched`: Most recent search timestamp

#### 3. `getAnalyticsSummary($days)`
```php
SearchQuery::getAnalyticsSummary(30);
```
**Returns:** Comprehensive analytics object:
- `total_searches`: Total number of searches
- `unique_users`: Number of unique users who searched
- `avg_results_per_search`: Average results per search
- `searches_with_results`: Number of searches that returned results
- `searches_with_clicks`: Number of searches that resulted in clicks
- `overall_click_rate`: Overall click-through rate
- `avg_time_to_click_ms`: Average time from search to click
- `top_search_terms`: Top 10 search terms
- `no_result_searches`: Top 10 no-result searches
- `search_trends`: Daily search counts for trend analysis

### Query Scopes

#### 1. `withResults()`
```php
SearchQuery::withResults()->get();
```
Filters searches that returned at least one result.

#### 2. `withClicks()`
```php
SearchQuery::withClicks()->get();
```
Filters searches where user clicked on a result.

#### 3. `inLastDays($days)`
```php
SearchQuery::inLastDays(7)->get();
```
Filters searches from the last N days.

#### 4. `byUser($userId)`
```php
SearchQuery::byUser(123)->get();
```
Filters searches by specific user ID.

### Custom Analytics Queries

#### High-Performing Searches
```php
$highPerformingSearches = SearchQuery::withResults()
    ->withClicks()
    ->selectRaw('query, COUNT(*) as total_searches, 
                 COUNT(clicked_result_at) as clicks,
                 (COUNT(clicked_result_at) / COUNT(*)) as click_rate')
    ->groupBy('query')
    ->having('click_rate', '>', 0.8)
    ->orderByDesc('click_rate')
    ->get();
```

#### User Search Behavior
```php
$userBehavior = SearchQuery::selectRaw('
        user_id,
        COUNT(*) as total_searches,
        COUNT(CASE WHEN has_results = 1 THEN 1 END) as successful_searches,
        COUNT(clicked_result_at) as clicks,
        AVG(time_to_click_ms) as avg_time_to_click
    ')
    ->groupBy('user_id')
    ->having('total_searches', '>', 5)
    ->get();
```

#### Search Performance by Time
```php
$performanceByHour = SearchQuery::selectRaw('
        HOUR(created_at) as hour,
        COUNT(*) as searches,
        AVG(JSON_EXTRACT(session_data, "$.search_time_ms")) as avg_response_time
    ')
    ->groupBy('hour')
    ->orderBy('hour')
    ->get();
```

## Frontend Components

### MovieSearch Component
Located: `resources/js/components/movie-search.tsx`

**Features:**
- Real-time search with debouncing
- Keyboard navigation
- Loading states
- Error handling
- Click tracking
- Responsive design

**Props:**
```typescript
interface MovieSearchProps {
    className?: string;
    placeholder?: string;
    onResultClick?: (movie: Movie) => void;
}
```

### MovieSearchModal Component
Located: `resources/js/components/movie-search-modal.tsx`

**Features:**
- Modal wrapper for header integration
- Conditional display logic
- Accessibility compliance
- Keyboard shortcuts (Ctrl+K to open)

## Usage Examples

### Backend Usage

#### Get Popular Search Terms
```php
// In a controller
public function getPopularTerms()
{
    $terms = SearchQuery::getPopularSearchTerms(10, 30);
    return response()->json($terms);
}
```

#### Custom Analytics Query
```php
// Get searches with high click rates
$highPerformingSearches = SearchQuery::withResults()
    ->withClicks()
    ->selectRaw('query, COUNT(*) as total_searches, 
                 COUNT(clicked_result_at) as clicks,
                 (COUNT(clicked_result_at) / COUNT(*)) as click_rate')
    ->groupBy('query')
    ->having('click_rate', '>', 0.8)
    ->orderByDesc('click_rate')
    ->get();
```

### Frontend Usage

#### Basic Search Implementation
```tsx
import { MovieSearch } from '@/components/movie-search';

function Header() {
    return (
        <div className="header">
            <MovieSearch 
                placeholder="Search movies..."
                onResultClick={(movie) => {
                    // Handle movie selection
                    window.location.href = `/movies/${movie.slug}`;
                }}
            />
        </div>
    );
}
```

#### Modal Search Implementation
```tsx
import { MovieSearchModal } from '@/components/movie-search-modal';

function App() {
    return (
        <div>
            {/* Other components */}
            <MovieSearchModal />
        </div>
    );
}
```

## Performance Considerations

### Database Optimization
- **Indexes**: Created on frequently queried fields (user_id, query, created_at)
- **JSON Searching**: Uses CAST operations for MySQL compatibility
- **Query Limits**: Default limit of 10 results for performance
- **Relevance Ranking**: CASE statements prioritize exact matches

### Frontend Optimization
- **Debouncing**: 300ms delay prevents excessive API calls
- **Caching**: Results cached during user session
- **Lazy Loading**: Search component loads only when needed
- **Error Boundaries**: Graceful error handling

### Analytics Optimization
- **Async Logging**: Search logging doesn't block search results
- **Batch Processing**: Consider implementing for high-volume sites
- **Data Retention**: Implement cleanup for old search data

## Security Considerations

### Input Validation
- Query length limited to 500 characters
- SQL injection prevention through parameterized queries
- XSS prevention through proper escaping

### Privacy
- IP addresses stored for analytics (consider GDPR compliance)
- User agents logged for debugging
- Personal data anonymization options available

### Rate Limiting
Consider implementing rate limiting for search endpoints:
```php
// In routes/web.php
Route::middleware(['throttle:60,1'])->group(function () {
    Route::get('/api/movies/search', [MovieController::class, 'search']);
});
```

## Monitoring & Maintenance

### Key Metrics to Monitor
- Search response times
- Click-through rates
- Popular search terms
- No-result search frequency
- User engagement patterns

### Maintenance Tasks
- Regular cleanup of old search logs
- Index optimization
- Performance monitoring
- Content gap analysis based on no-result searches

### Troubleshooting

#### Common Issues
1. **Slow Search Performance**
   - Check database indexes
   - Optimize JSON field queries
   - Consider search result caching

2. **Missing Search Results**
   - Verify field indexing
   - Check JSON field formatting
   - Review search query logic

3. **Analytics Not Recording**
   - Check database permissions
   - Verify model relationships
   - Review error logs

## Future Enhancements

### Planned Features
- **Search Suggestions**: Auto-complete based on popular terms
- **Advanced Filters**: Genre, year, rating filters
- **Search History**: Personal search history for users
- **Machine Learning**: Personalized search results
- **Full-Text Search**: Elasticsearch integration for better performance

### Analytics Enhancements
- **Real-time Dashboard**: Live analytics dashboard
- **A/B Testing**: Search algorithm testing
- **Conversion Tracking**: Track from search to movie watch
- **Export Capabilities**: CSV/Excel export of analytics data

## Conclusion

This search engine provides a comprehensive solution for movie discovery with detailed analytics capabilities. The system is designed for scalability, performance, and user experience while providing valuable insights into user behavior and content gaps.

For technical support or feature requests, please refer to the development team or create an issue in the project repository. 