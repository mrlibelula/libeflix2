# Views System Documentation

## Overview

The Views System is a comprehensive tracking solution for monitoring user engagement with movies and TV show episodes on Libeflix2. It implements intelligent view counting with smart algorithms that ensure views are only counted when users have genuinely watched content, not just clicked play.

## Architecture

### Database Schema

The system uses two polymorphic tables:

#### 1. `views` Table
Stores confirmed views when content meets view criteria.

```sql
- id (bigint, primary key)
- user_id (bigint, nullable, foreign key to users)
- viewable_id (bigint) - polymorphic ID
- viewable_type (string) - polymorphic type (Movie/Episode)
- viewed_at (timestamp)
- created_at, updated_at (timestamps)

Indexes:
- viewable_id + viewable_type
- user_id
- Unique constraint: user_id + viewable_id + viewable_type
```

#### 2. `watch_progress` Table
Tracks real-time playback progress for all users.

```sql
- id (bigint, primary key)
- user_id (bigint, foreign key to users)
- watchable_id (bigint) - polymorphic ID
- watchable_type (string) - polymorphic type (Movie/Episode)
- current_time (integer) - current playback position in seconds
- duration (integer) - total duration in seconds
- progress_percentage (decimal 5,2) - 0.00 to 100.00
- completed (boolean) - whether view has been recorded
- last_watched_at (timestamp)
- created_at, updated_at (timestamps)

Indexes:
- watchable_id + watchable_type
- user_id
- Unique constraint: user_id + watchable_id + watchable_type
```

### Models

#### View Model (`app/Models/View.php`)
```php
- Relationships: belongsTo User, morphTo viewable
- Fillable: user_id, viewable_id, viewable_type, viewed_at
- Casts: viewed_at as datetime
```

#### WatchProgress Model (`app/Models/WatchProgress.php`)
```php
- Relationships: belongsTo User, morphTo watchable
- Fillable: user_id, watchable_id, watchable_type, current_time, duration, 
           progress_percentage, completed, last_watched_at
- Methods:
  - updateProgress($currentTime, $duration)
  - markCompleted()
```

### Traits

#### Viewable Trait (`app/Traits/Viewable.php`)
Applied to Movie and Episode models to provide view functionality:

**Methods:**
- `views()` - MorphMany relationship to View model
- `watchProgresses()` - MorphMany relationship to WatchProgress model
- `viewsCount()` - Returns total view count
- `uniqueViewersCount()` - Returns count of unique users who viewed
- `isViewedBy(User $user)` - Check if user has viewed
- `recordView(User $user)` - Manually record a view
- `getOrCreateProgress(User $user)` - Get or create progress entry
- `getProgressForUser(User $user)` - Get user's watch progress

## View Counting Algorithm

### Smart View Detection

The system uses an intelligent algorithm to determine when a view should be counted:

```php
// ViewService::shouldCountAsView()

For SHORT content (< 15 minutes):
- Count as view if: watched >= 10 minutes OR watched >= 70%
- Whichever threshold is reached first

For LONG content (>= 15 minutes):
- Count as view if: watched >= 70%
```

### Algorithm Constants
```php
MIN_VIEW_PERCENTAGE = 70.0      // 70% of content
MIN_VIEW_TIME_SECONDS = 600     // 10 minutes
SHORT_CONTENT_THRESHOLD = 900   // 15 minutes
```

### Why This Approach?

1. **Short Content (< 15 min)**: 
   - 10-minute threshold prevents counting accidental plays
   - 70% ensures most of the content was watched
   - Flexible for different lengths (5min vs 14min episodes)

2. **Long Content (>= 15 min)**:
   - 70% requirement ensures significant engagement
   - For a 2-hour movie: ~84 minutes watched
   - For a 45-min episode: ~32 minutes watched

3. **One View Per User**:
   - Each user can only be counted once per content
   - Prevents view inflation from rewatching
   - Unique constraint enforced at database level

## Backend Implementation

### ViewService (`app/Services/ViewService.php`)

Main service handling view logic:

**Methods:**

```php
// Update watch progress and auto-detect views
updateProgress(Model $watchable, User $user, int $currentTime, ?int $duration)

// Check if progress qualifies as a view
shouldCountAsView(WatchProgress $progress): bool

// Manually record a view
recordView(Model $viewable, User $user): ?View

// Get user's watch progress
getProgress(Model $watchable, User $user): ?WatchProgress

// Check if user has viewed content
hasViewed(Model $viewable, User $user): bool

// Get total view count
getViewsCount(Model $viewable): int

// Reset user's watch progress
resetProgress(Model $watchable, User $user): bool

// Get popular content by views
getPopularByViews(string $modelType, int $limit, ?int $days)
```

### API Endpoints (`routes/web.php`)

All endpoints require authentication (`auth` middleware):

```php
POST   /api/views/progress        - Update watch progress
GET    /api/views/progress        - Get watch progress
DELETE /api/views/progress        - Reset watch progress
GET    /api/views/count           - Get view count
```

### ViewsController (`app/Http/Controllers/ViewsController.php`)

**Endpoints:**

1. **Update Progress** (`POST /api/views/progress`)
```json
Request:
{
  "type": "movie|episode",
  "id": 123,
  "current_time": 600,
  "duration": 7200
}

Response:
{
  "success": true,
  "progress": {
    "current_time": 600,
    "duration": 7200,
    "progress_percentage": 8.33,
    "completed": false
  },
  "view_recorded": false
}
```

2. **Get Progress** (`GET /api/views/progress`)
```json
Request Query: ?type=episode&id=456

Response:
{
  "success": true,
  "progress": {
    "current_time": 1200,
    "duration": 2400,
    "progress_percentage": 50.00,
    "completed": false,
    "last_watched_at": "2025-11-19T12:34:56Z"
  }
}
```

3. **Reset Progress** (`DELETE /api/views/progress`)
```json
Request:
{
  "type": "movie",
  "id": 789
}

Response:
{
  "success": true,
  "deleted": true
}
```

4. **Get Views Count** (`GET /api/views/count`)
```json
Request Query: ?type=movie&id=123

Response:
{
  "success": true,
  "views_count": 42
}
```

## Frontend Implementation

### Episode Dialog (`resources/js/components/ui/play-episode-dialog.tsx`)

**Features:**
- Displays view count in episode metadata
- Automatically tracks watch progress every 15 seconds
- Sends progress on play, pause, and end events
- Non-blocking - doesn't interrupt playback

**Implementation:**
```typescript
// State
const [viewsCount, setViewsCount] = useState(0);

// Display in UI
{viewsCount > 0 && (
  <><span> · </span><span>{viewsCount} {viewsCount === 1 ? 'view' : 'views'}</span></>
)}

// Progress tracking (useEffect)
- Tracks while video is playing
- Updates every 15 seconds
- Immediate updates on play/pause/end
- Automatically stops when paused
```

### Movie Player (`resources/js/components/ui/play-movie-player.tsx`)

Same implementation as Episode Dialog for consistency.

### Movie Page (`resources/js/pages/movie.tsx`)

**Features:**
- Displays views count in movie details
- Shows alongside likes and other metadata
- Updates from backend on page load

**Implementation:**
```typescript
const [viewsCount, setViewsCount] = useState(movie.views_count || 0);

// Display
{viewsCount > 0 && (
  <div className="flex items-center gap-x-1">
    <span>{viewsCount} {viewsCount === 1 ? 'view' : 'views'}</span>
  </div>
)}
```

## Integration Points

### Controllers Updated

1. **MovieController** (`app/Http/Controllers/MovieController.php`)
```php
// In show() method:
$movie->views_count = $movie->viewsCount();

// In index() method:
$movie->views_count = $movie->viewsCount();
```

2. **TvshowController** (`app/Http/Controllers/TvshowController.php`)
```php
// In getSeason() method:
$episode->views_count = $episode->viewsCount();
```

### User Model

Added relationships in `app/Models/User.php`:
```php
public function views(): HasMany
public function watchProgresses(): HasMany
```

## Usage Examples

### Check if User Viewed Content
```php
$movie = Movie::find(1);
$user = Auth::user();

if ($movie->isViewedBy($user)) {
    echo "You've already watched this!";
}
```

### Get View Count
```php
$episode = Episode::find(5);
$viewCount = $episode->viewsCount();
echo "This episode has {$viewCount} views";
```

### Get User's Progress
```php
$movie = Movie::find(10);
$progress = $movie->getProgressForUser($user);

if ($progress) {
    echo "Continue watching from " . $progress->current_time . " seconds";
    echo "You're " . $progress->progress_percentage . "% through";
}
```

### Get Popular Content
```php
// Most viewed movies in last 30 days
$popular = ViewService::getPopularByViews(
    Movie::class, 
    $limit = 10, 
    $days = 30
);
```

## Privacy & Data Considerations

1. **User Privacy**: Views are tied to user accounts only when authenticated
2. **Data Retention**: Watch progress persists for resume functionality
3. **One View Per User**: Prevents artificial inflation
4. **Anonymous Views**: System supports nullable user_id for potential guest tracking

## Performance Considerations

1. **Efficient Queries**: Uses indexes on polymorphic relationships
2. **Batched Updates**: Frontend sends updates every 15 seconds, not continuously
3. **Cached Counts**: View counts can be cached at application level
4. **Unique Constraints**: Database-level enforcement prevents duplicates

## Future Enhancements

Potential features to implement:

1. **Resume Playback**: Use watch_progress to allow users to continue where they left off
2. **Watch History**: Full viewing history page for users
3. **Analytics Dashboard**: Admin view of most popular content
4. **Viewing Trends**: Track view patterns over time
5. **Recommendations**: Use view data for personalized suggestions
6. **Completion Badges**: Award users for completing series/seasons
7. **Watch Time Stats**: Show users their total watch time
8. **Partial Credit**: Track multiple partial views differently

## Testing

To test the system:

1. **View Counting**:
```bash
# Watch a short video (< 15 min) for 10+ minutes
# OR watch 70%+ of any video
# Check views table for entry
```

2. **Progress Tracking**:
```bash
# Play video
# Check watch_progress table updates every 15 seconds
# Pause video - progress should save
```

3. **API Endpoints**:
```bash
# Test progress update
curl -X POST /api/views/progress \
  -H "Content-Type: application/json" \
  -d '{"type":"movie","id":1,"current_time":600,"duration":7200}'
```

## Migration Commands

```bash
# Run migrations
php artisan migrate

# Rollback if needed
php artisan migrate:rollback --step=2
```

## Troubleshooting

**Views not counting?**
- Check user is authenticated
- Verify video duration is being tracked
- Ensure progress meets threshold (70% or 10 minutes)

**Progress not saving?**
- Check API endpoint authentication
- Verify video events are firing (play/pause/timeupdate)
- Check browser console for errors

**Duplicate views?**
- Shouldn't happen due to unique constraint
- Check database for constraint violations

## Summary

The Views System provides:
- ✅ Accurate view tracking with smart detection
- ✅ Real-time watch progress monitoring
- ✅ Polymorphic support for movies and episodes
- ✅ Privacy-conscious design
- ✅ Performance-optimized implementation
- ✅ Easy-to-use API and UI integration
- ✅ Foundation for future analytics and recommendations

The system ensures that views represent genuine engagement while providing users with useful progress tracking capabilities.

