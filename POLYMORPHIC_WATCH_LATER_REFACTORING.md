# Polymorphic Watch Later System Refactoring

## Overview

This refactoring converts the existing `movie_user` table to a polymorphic `watchlists` table that supports watch later functionality for multiple content types: Movies, TV Shows, Seasons, and Episodes.

## Benefits

- **DRY Code**: Single table and service for all watch later functionality
- **Scalability**: Easy to add new content types in the future
- **Consistency**: Unified API across all content types
- **Maintainability**: Single source of truth for watch later logic

## Changes Made

### 1. Database Schema Changes

#### New Migration: `2025_06_05_231436_create_movie_user_table.php` (Modified)
- Renamed table from `movie_user` to `watchlists`
- Added polymorphic columns: `watchable_id`, `watchable_type`
- Removed specific `movie_id` foreign key
- Added proper indexing for polymorphic relationships

#### Data Migration: `2025_01_15_000000_migrate_movie_user_to_watchlists.php`
- Migrates existing `movie_user` data to new `watchlists` table
- Handles rollback scenario
- Preserves existing timestamps

### 2. Models Updated

#### New Models
- **`Watchlist`**: Main model for polymorphic relationship
- **`Watchable` trait**: Provides watch later functionality to all content models

#### Updated Models
- **`User`**: Added polymorphic relationships for all content types
- **`Movie`**: Uses Watchable trait, removed old methods
- **`Tvshow`**: Added Watchable trait
- **`Season`**: Added Watchable trait  
- **`Episode`**: Added Watchable trait

### 3. Services

#### New Service: `WatchLaterService`
- Unified API for all watch later operations
- Methods for add, remove, check, toggle, bulk operations
- Backward compatibility methods for existing code

#### Updated Service: `MovieService`
- Delegates watch later operations to `WatchLaterService`
- Maintains backward compatibility

### 4. Controllers Updated

#### `MovieController`
- Uses `WatchLaterService` instead of direct database queries
- Updated watch later page to support all content types
- Maintains existing API endpoints

#### `TvshowController`
- Added watch later status to show method
- Added `toggleWatchLater` and `toggleWatchLaterById` methods
- Integrated with `WatchLaterService`

### 5. Routes Added

```php
// TV Show watch later routes
Route::post('tvshows/{tvshow}/toggle-watch-later', [TvshowController::class, 'toggleWatchLater']);
Route::post('api/tvshows/{tvshowId}/toggle-watch-later', [TvshowController::class, 'toggleWatchLaterById']);
```

## API Endpoints

### Movies (Existing - Updated)
- `POST /movies/{movie}/toggle-watch-later` - Toggle movie watch later
- `POST /api/movies/{movieId}/toggle-watch-later` - Toggle movie watch later by ID

### TV Shows (New)
- `POST /tvshows/{tvshow}/toggle-watch-later` - Toggle tvshow watch later
- `POST /api/tvshows/{tvshowId}/toggle-watch-later` - Toggle tvshow watch later by ID

### Watch Later Page
- `GET /watch-later` - View all watch later items (movies, tvshows, seasons, episodes)

## Usage Examples

### Adding Items to Watch Later

```php
// Any content type
WatchLaterService::addWatchLater($movie, $user);
WatchLaterService::addWatchLater($tvshow, $user);
WatchLaterService::addWatchLater($season, $user);
WatchLaterService::addWatchLater($episode, $user);

// Using model methods
$movie->addWatchLater($user);
$tvshow->addWatchLater($user);
```

### Checking Watch Later Status

```php
// Service method
WatchLaterService::isWatchLater($movie, $user);

// Model method
$movie->isWatchLater($user);

// User relationships
$user->watchLaterMovies;
$user->watchLaterTvshows;
$user->watchLaterSeasons;
$user->watchLaterEpisodes;
```

### Bulk Operations

```php
// Get all watch later items grouped by type
$items = WatchLaterService::getWatchLaterItems($user);
// Returns: ['movies' => [...], 'tvshows' => [...], 'seasons' => [...], 'episodes' => [...]]

// Get IDs for specific content type
$movieIds = WatchLaterService::getUserWatchLaterIds($user, 'App\\Models\\Movie');
```

## Database Schema

### watchlists Table
```sql
CREATE TABLE watchlists (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id BIGINT UNSIGNED NOT NULL,
    watchable_id BIGINT UNSIGNED NOT NULL,
    watchable_type VARCHAR(255) NOT NULL,
    created_at TIMESTAMP NULL,
    updated_at TIMESTAMP NULL,
    
    UNIQUE KEY unique_user_watchable (user_id, watchable_id, watchable_type),
    KEY watchable_index (watchable_id, watchable_type),
    
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
```

## Migration Instructions

### Running the Migration

1. **Backup your database** before running migrations
2. Run migrations:
   ```bash
   php artisan migrate
   ```
3. The system will:
   - Create new `watchlists` table
   - Migrate existing `movie_user` data
   - Drop old `movie_user` table

### Rollback (if needed)

```bash
php artisan migrate:rollback --step=2
```

This will:
- Recreate `movie_user` table
- Migrate movie data back
- Remove `watchlists` table

## Frontend Integration

### Watch Later Page (Updated)
The watch later page now receives:
```javascript
{
  watchLaterMovies: [...],
  watchLaterTvshows: [...],
  watchLaterSeasons: [...],
  watchLaterEpisodes: [...]
}
```

### API Responses
All content items now include:
```javascript
{
  id: 123,
  title: "Content Title",
  is_watch_later: true,
  // ... other properties
}
```

## Backward Compatibility

- All existing movie watch later functionality remains unchanged
- Existing API endpoints continue to work
- Frontend components that use movie watch later work without changes
- Database queries are optimized for performance

## Performance Considerations

- Polymorphic relationships are properly indexed
- Bulk operations available for efficient querying
- Direct database queries used where appropriate for performance
- Caching strategies maintained from original implementation

## Future Enhancements

This polymorphic system makes it easy to:
- Add watch later for new content types
- Implement watch later categories/playlists
- Add watch later analytics
- Implement watch progress tracking
- Add social features (sharing watch later lists)

## Testing

### Manual Testing Steps

1. **Verify existing movies still work**:
   - Add/remove movies to/from watch later
   - Check watch later page shows movies
   - Verify API endpoints respond correctly

2. **Test new TV show functionality**:
   - Add/remove TV shows to/from watch later
   - Check API responses include correct status
   - Verify watch later page shows TV shows

3. **Test data migration**:
   - Ensure all existing movie watch later data preserved
   - Verify no data loss during migration

4. **Test rollback scenario**:
   - Test migration rollback works correctly
   - Ensure data integrity maintained

### Automated Testing (Recommended)

Create tests for:
- WatchLaterService methods
- Model trait functionality
- Controller endpoints
- Migration data integrity

## Troubleshooting

### Common Issues

1. **Migration fails**: Check database permissions and backup status
2. **Foreign key errors**: Ensure user and content records exist
3. **Performance issues**: Verify indexes are created properly
4. **Frontend errors**: Check API response format matches expected structure

### Debug Methods

```php
// Check watch later items for user
$items = WatchLaterService::getWatchLaterItems($user);
dd($items);

// Verify polymorphic relationships
$watchlist = Watchlist::with('watchable')->first();
dd($watchlist->watchable);

// Check specific model watch later status
$isWatchLater = $movie->isWatchLater($user);
dd($isWatchLater);
``` 