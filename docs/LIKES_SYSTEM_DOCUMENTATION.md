# Polymorphic Likes System Documentation

## Overview

This documentation explains the polymorphic likes system that allows users to like different types of content (movies, TV shows, episodes, seasons, and potentially other models) using a single, unified table structure.

## Database Structure

The `likes` table contains the following columns:
- `id`: Primary key
- `user_id`: Foreign key to the users table
- `likeable_id`: The ID of the model being liked
- `likeable_type`: The class name of the model being liked
- `created_at` and `updated_at`: Timestamps

## Usage Examples

### User Model Methods

```php
// Check if a user has liked a specific movie/tvshow
$user = User::find(1);
$movie = Movie::find(1);
$hasLiked = $user->hasLiked($movie);

// Like a movie/tvshow
$like = $user->like($movie);

// Unlike a movie/tvshow
$success = $user->unlike($movie);

// Get all likes by a user
$userLikes = $user->likes;
```

### Movie/Tvshow Model Methods

```php
// Get all likes for a movie
$movie = Movie::find(1);
$likes = $movie->likes;

// Get the count of likes
$likesCount = $movie->likesCount();

// Check if a specific user has liked this movie
$user = User::find(1);
$isLiked = $movie->isLikedBy($user);
```

### Direct Like Model Usage

```php
// Create a like directly
$like = Like::create([
    'user_id' => 1,
    'likeable_id' => 1,
    'likeable_type' => Movie::class,
]);

// Find likes for a specific model
$movieLikes = Like::where('likeable_type', Movie::class)
                  ->where('likeable_id', 1)
                  ->get();

// Get all likes by a user
$userLikes = Like::where('user_id', 1)->get();
```

## Controller Examples

### In a Movie Controller

```php
public function like(Request $request, Movie $movie)
{
    $user = $request->user();
    
    if ($user->hasLiked($movie)) {
        return response()->json(['message' => 'Already liked'], 409);
    }
    
    $user->like($movie);
    
    return response()->json([
        'message' => 'Movie liked successfully',
        'likes_count' => $movie->likesCount()
    ]);
}

public function unlike(Request $request, Movie $movie)
{
    $user = $request->user();
    
    if (!$user->hasLiked($movie)) {
        return response()->json(['message' => 'Not liked yet'], 409);
    }
    
    $user->unlike($movie);
    
    return response()->json([
        'message' => 'Movie unliked successfully',
        'likes_count' => $movie->likesCount()
    ]);
}
```

## Frontend Integration

### API Endpoints

```
POST /api/movies/{movie}/like      - Like a movie
DELETE /api/movies/{movie}/like    - Unlike a movie
GET /api/movies/{movie}/likes      - Get movie likes count and user's like status

POST /api/tvshows/{tvshow}/like    - Like a TV show
DELETE /api/tvshows/{tvshow}/like  - Unlike a TV show
GET /api/tvshows/{tvshow}/likes    - Get TV show likes count and user's like status

POST /api/episodes/{episode}/like    - Like an episode
DELETE /api/episodes/{episode}/like  - Unlike an episode
GET /api/episodes/{episode}/likes    - Get episode likes count and user's like status

POST /api/seasons/{season}/like    - Like a season
DELETE /api/seasons/{season}/like  - Unlike a season
GET /api/seasons/{season}/likes    - Get season likes count and user's like status
```

### React/TypeScript Example

```tsx
// Hook for managing likes
const useLikes = (item: Movie | Tvshow | Episode | Season, type: 'movie' | 'tvshow' | 'episode' | 'season') => {
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);

  const toggleLike = async () => {
    const method = isLiked ? 'DELETE' : 'POST';
    const response = await fetch(`/api/${type}s/${item.id}/like`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
      },
    });

    if (response.ok) {
      const data = await response.json();
      setIsLiked(!isLiked);
      setLikesCount(data.likes_count);
    }
  };

  return { isLiked, likesCount, toggleLike };
};
```

## Supported Models

The likes system currently supports the following models:

- **Movies** - Users can like individual movies
- **TV Shows** - Users can like entire TV shows
- **Episodes** - Users can like specific episodes
- **Seasons** - Users can like entire seasons

## Adding Likes to Additional Models

To add likes functionality to other models, simply add the morphMany relationship:

```php
// Example: In any model
public function likes(): \Illuminate\Database\Eloquent\Relations\MorphMany
{
    return $this->morphMany(Like::class, 'likeable');
}

public function likesCount(): int
{
    return $this->likes()->count();
}

public function isLikedBy(User $user): bool
{
    return $this->likes()->where('user_id', $user->id)->exists();
}
```

## Database Constraints

- Unique constraint on (`user_id`, `likeable_id`, `likeable_type`) prevents duplicate likes
- Foreign key constraint on `user_id` with cascade delete
- Indexes for optimal query performance

## Security Considerations

- Always validate that the user is authenticated before allowing likes
- Implement rate limiting to prevent spam
- Consider implementing soft deletes if you need to track historical data 