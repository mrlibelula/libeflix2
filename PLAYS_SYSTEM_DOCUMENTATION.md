# Times Played System Documentation

## 📊 Overview

The **Times Played** system tracks total engagement with media content by recording every completed playback that meets the minimum threshold. Unlike the Views system (which counts unique viewers), Plays allows duplicate entries to measure replay engagement and total watch count.

## 🎯 Key Differences: Views vs Plays

| Feature | Views | Plays |
|---------|-------|-------|
| **Purpose** | Unique reach | Total engagement |
| **Duplicates** | ❌ One per user per content | ✅ Unlimited per user |
| **Threshold** | 70% OR 10min (short content) | 80% watched + video ended |
| **When Recorded** | During playback | When video ends |
| **Analytics Use** | Unique viewer count | Replay count, total engagement |

## 🏗️ Database Schema

### `plays` Table

```sql
CREATE TABLE plays (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    user_id BIGINT NULL,                    -- Nullable for guest tracking
    playable_id BIGINT NOT NULL,            -- Polymorphic: Movie/Episode ID
    playable_type VARCHAR(255) NOT NULL,    -- Polymorphic: 'App\Models\Movie' or 'App\Models\Episode'
    watch_duration INT DEFAULT 0,           -- How long they watched (seconds)
    media_duration INT DEFAULT 0,           -- Total media length (seconds)
    completion_percentage FLOAT DEFAULT 0,  -- Percentage completed
    created_at TIMESTAMP,
    updated_at TIMESTAMP,
    INDEX (playable_id, playable_type),
    INDEX (user_id),
    INDEX (created_at)
);
```

**No unique constraint** - Allows same user to generate multiple play records.

## 🧮 Algorithm

### Recording Logic

A **play** is recorded when:
1. Video reaches the **ended** event
2. User watched **≥80%** of the content
3. Both conditions must be met

```php
// ViewService::recordPlay()
$completionPercentage = ($watchDuration / $mediaDuration) * 100;

if ($completionPercentage >= 80.0) {
    Play::create([
        'user_id' => $user?->id,
        'playable_id' => $playable->id,
        'playable_type' => get_class($playable),
        'watch_duration' => $watchDuration,
        'media_duration' => $mediaDuration,
        'completion_percentage' => $completionPercentage,
    ]);
}
```

### Why 80%?

- **Views**: 70% threshold (earlier engagement signal)
- **Plays**: 80% threshold (committed viewing, reached the end)

The higher threshold for plays ensures only meaningful, complete viewing sessions are counted.

## 🔧 Backend Implementation

### Models

**Play Model** (`app/Models/Play.php`):
```php
class Play extends Model
{
    protected $fillable = [
        'user_id',
        'playable_id',
        'playable_type',
        'watch_duration',
        'media_duration',
        'completion_percentage',
    ];

    public function user(): BelongsTo;
    public function playable(): MorphTo;
}
```

**Playable Trait** (`app/Traits/Playable.php`):
```php
trait Playable
{
    public function plays(): MorphMany;
    public function playsCount(): int;
    public function uniquePlayersCount(): int;
    public function averageCompletionPercentage(): float;
}
```

### API Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/api/plays/record` | Record a play when video ends | Optional |
| GET | `/api/plays/count` | Get total plays count | No |

#### Record Play

**Request:**
```json
POST /api/plays/record
{
  "type": "episode",       // or "movie"
  "id": 123,
  "watch_duration": 2400,  // seconds watched
  "media_duration": 2580   // total seconds
}
```

**Response:**
```json
{
  "success": true,
  "play_recorded": true,   // false if below 80% threshold
  "plays_count": 42        // Updated total
}
```

#### Get Plays Count

**Request:**
```json
GET /api/plays/count?type=episode&id=123
```

**Response:**
```json
{
  "success": true,
  "plays_count": 42
}
```

### Service Methods

**ViewService** (`app/Services/ViewService.php`):

```php
// Record a play
ViewService::recordPlay($playable, $user, $watchDuration, $mediaDuration);

// Get plays count
ViewService::getPlaysCount($playable);

// Get popular content by plays
ViewService::getPopularByPlays('App\\Models\\Movie', $limit = 10, $days = 30);
```

## 🎨 Frontend Implementation

### Episode Player

The episode dialog (`play-episode-dialog.tsx`) automatically records plays:

```typescript
const handleEnded = async () => {
  stopProgressTracking();
  updateWatchProgress();
  
  // Record play if 80%+ watched
  if (video.duration > 0) {
    try {
      await axios.post(route('api.plays.record'), {
        type: 'episode',
        id: episode.id,
        watch_duration: Math.floor(video.currentTime),
        media_duration: Math.floor(video.duration),
      });
    } catch (error) {
      console.error('Error recording play:', error);
    }
  }
};
```

### Movie Player

Same logic in `play-movie-player.tsx` with `type: 'movie'`.

### Display

Both episode and movie dialogs show plays count:

```tsx
<span>
  {playsCount || 0} {(playsCount || 0) === 1 ? 'play' : 'plays'}
</span>
```

## 📈 Analytics Use Cases

### 1. Replay Rate
```php
$plays = $episode->playsCount();
$views = $episode->viewsCount();
$replayRate = $plays / max(1, $views); // Average replays per viewer
```

### 2. Popular Content (by engagement)
```php
$popularByPlays = ViewService::getPopularByPlays(
    'App\\Models\\Movie', 
    $limit = 10, 
    $days = 30
);
```

### 3. Completion Quality
```php
$avgCompletion = $episode->averageCompletionPercentage();
// High completion = engaging content
```

### 4. Binge-Watching Detection
```php
$userPlays = Play::where('user_id', $userId)
    ->whereDate('created_at', today())
    ->count();
// High plays in short time = binge-watching
```

## 🧪 Testing

Run migrations:
```bash
php artisan migrate
```

Test the system:
1. Play an episode/movie to **completion** (80%+)
2. Check the `plays` table for new record
3. Replay the same content → new record created
4. Check plays count in UI

## 🔄 Data Flow

```
Video Plays → "ended" event fires → Frontend checks 80% threshold
                                   ↓
                            POST /api/plays/record
                                   ↓
                          ViewService::recordPlay()
                                   ↓
                          Check completion % ≥ 80%
                                   ↓
                           Create Play record
                                   ↓
                    Update playsCount in UI (optional)
```

## 📊 Example Scenario

**User watches "Breaking Bad S01E01"**:

| Action | Views Table | Plays Table |
|--------|-------------|-------------|
| Watches 72% (pauses) | ✅ 1 view recorded | ❌ No play (didn't end) |
| Later: Watches from 50% to end (85% total) | (Already exists) | ✅ 1 play recorded |
| Next day: Rewatches entire episode | (Already exists) | ✅ 2nd play recorded |

**Result**:
- Views count: **1** (unique viewer)
- Plays count: **2** (watched twice to completion)

## 🎯 Benefits

1. **Replay Insights**: Identify content that users rewatch
2. **Engagement Depth**: Total engagement beyond unique views
3. **Content Value**: High plays = high rewatchability
4. **Binge Analytics**: Track marathon viewing sessions
5. **Completion Quality**: Average completion percentage shows content quality

## 🚀 Future Enhancements

- **Streak Detection**: Identify consecutive episodes played
- **Time-Based Analytics**: Peak playing times
- **Device Tracking**: Which devices drive most replays
- **Session Analytics**: Average session duration
- **Completion Heatmaps**: Where users typically stop watching

---

**Status**: ✅ Fully Implemented & Production Ready

