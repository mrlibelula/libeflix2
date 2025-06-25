# Likes API Endpoints Documentation

## Overview

This document describes the API endpoints for the polymorphic likes system in Libeflix2.

## Authentication

- Like/Unlike endpoints require authentication
- View likes count endpoints are public (no authentication required)

## Endpoints

### Movies

#### Like a Movie
```
POST /api/movies/{movie}/like
```

**Authentication:** Required

**Parameters:**
- `movie` (path): Movie ID or slug

**Response:**
```json
{
  "success": true,
  "message": "Movie liked successfully",
  "likes_count": 15,
  "is_liked": true
}
```

**Error Response (409 - Already Liked):**
```json
{
  "success": false,
  "message": "Movie already liked"
}
```

#### Unlike a Movie
```
DELETE /api/movies/{movie}/like
```

**Authentication:** Required

**Parameters:**
- `movie` (path): Movie ID or slug

**Response:**
```json
{
  "success": true,
  "message": "Movie unliked successfully",
  "likes_count": 14,
  "is_liked": false
}
```

**Error Response (409 - Not Liked):**
```json
{
  "success": false,
  "message": "Movie not liked yet"
}
```

#### Get Movie Likes
```
GET /api/movies/{movie}/likes
```

**Authentication:** Optional (returns `is_liked: false` for unauthenticated users)

**Parameters:**
- `movie` (path): Movie ID or slug

**Response:**
```json
{
  "likes_count": 15,
  "is_liked": true
}
```

### TV Shows

#### Like a TV Show
```
POST /api/tvshows/{tvshow}/like
```

**Authentication:** Required

**Parameters:**
- `tvshow` (path): TV Show ID or slug

**Response:**
```json
{
  "success": true,
  "message": "TV show liked successfully",
  "likes_count": 8,
  "is_liked": true
}
```

**Error Response (409 - Already Liked):**
```json
{
  "success": false,
  "message": "TV show already liked"
}
```

#### Unlike a TV Show
```
DELETE /api/tvshows/{tvshow}/like
```

**Authentication:** Required

**Parameters:**
- `tvshow` (path): TV Show ID or slug

**Response:**
```json
{
  "success": true,
  "message": "TV show unliked successfully",
  "likes_count": 7,
  "is_liked": false
}
```

**Error Response (409 - Not Liked):**
```json
{
  "success": false,
  "message": "TV show not liked yet"
}
```

#### Get TV Show Likes
```
GET /api/tvshows/{tvshow}/likes
```

**Authentication:** Optional (returns `is_liked: false` for unauthenticated users)

**Parameters:**
- `tvshow` (path): TV Show ID or slug

**Response:**
```json
{
  "likes_count": 8,
  "is_liked": true
}
```

### Episodes

#### Like an Episode
```
POST /api/episodes/{episode}/like
```

**Authentication:** Required

**Parameters:**
- `episode` (path): Episode ID

**Response:**
```json
{
  "success": true,
  "message": "Episode liked successfully",
  "likes_count": 12,
  "is_liked": true
}
```

**Error Response (409 - Already Liked):**
```json
{
  "success": false,
  "message": "Episode already liked"
}
```

#### Unlike an Episode
```
DELETE /api/episodes/{episode}/like
```

**Authentication:** Required

**Parameters:**
- `episode` (path): Episode ID

**Response:**
```json
{
  "success": true,
  "message": "Episode unliked successfully",
  "likes_count": 11,
  "is_liked": false
}
```

**Error Response (409 - Not Liked):**
```json
{
  "success": false,
  "message": "Episode not liked yet"
}
```

#### Get Episode Likes
```
GET /api/episodes/{episode}/likes
```

**Authentication:** Optional (returns `is_liked: false` for unauthenticated users)

**Parameters:**
- `episode` (path): Episode ID

**Response:**
```json
{
  "likes_count": 12,
  "is_liked": true
}
```

### Seasons

#### Like a Season
```
POST /api/seasons/{season}/like
```

**Authentication:** Required

**Parameters:**
- `season` (path): Season ID

**Response:**
```json
{
  "success": true,
  "message": "Season liked successfully",
  "likes_count": 6,
  "is_liked": true
}
```

**Error Response (409 - Already Liked):**
```json
{
  "success": false,
  "message": "Season already liked"
}
```

#### Unlike a Season
```
DELETE /api/seasons/{season}/like
```

**Authentication:** Required

**Parameters:**
- `season` (path): Season ID

**Response:**
```json
{
  "success": true,
  "message": "Season unliked successfully",
  "likes_count": 5,
  "is_liked": false
}
```

**Error Response (409 - Not Liked):**
```json
{
  "success": false,
  "message": "Season not liked yet"
}
```

#### Get Season Likes
```
GET /api/seasons/{season}/likes
```

**Authentication:** Optional (returns `is_liked: false` for unauthenticated users)

**Parameters:**
- `season` (path): Season ID

**Response:**
```json
{
  "likes_count": 6,
  "is_liked": true
}
```

## Frontend Integration Examples

### React/TypeScript Hook

```tsx
import { useState, useEffect } from 'react';

interface LikesData {
  likes_count: number;
  is_liked: boolean;
}

export const useLikes = (itemType: 'movies' | 'tvshows' | 'episodes' | 'seasons', itemId: string | number) => {
  const [likesData, setLikesData] = useState<LikesData>({ likes_count: 0, is_liked: false });
  const [loading, setLoading] = useState(false);

  // Fetch initial likes data
  useEffect(() => {
    const fetchLikes = async () => {
      try {
        const response = await fetch(`/api/${itemType}/${itemId}/likes`);
        const data = await response.json();
        setLikesData(data);
      } catch (error) {
        console.error('Error fetching likes:', error);
      }
    };

    fetchLikes();
  }, [itemType, itemId]);

  const toggleLike = async () => {
    setLoading(true);
    try {
      const method = likesData.is_liked ? 'DELETE' : 'POST';
      const response = await fetch(`/api/${itemType}/${itemId}/like`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setLikesData({
          likes_count: data.likes_count,
          is_liked: data.is_liked
        });
      } else {
        const errorData = await response.json();
        console.error('Error toggling like:', errorData.message);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLoading(false);
    }
  };

  return {
    likes_count: likesData.likes_count,
    is_liked: likesData.is_liked,
    toggleLike,
    loading
  };
};
```

### Usage Example

```tsx
import React from 'react';
import { useLikes } from './hooks/useLikes';

interface LikeButtonProps {
  itemType: 'movies' | 'tvshows' | 'episodes' | 'seasons';
  itemId: string | number;
}

export const LikeButton: React.FC<LikeButtonProps> = ({ itemType, itemId }) => {
  const { likes_count, is_liked, toggleLike, loading } = useLikes(itemType, itemId);

  return (
    <button 
      onClick={toggleLike} 
      disabled={loading}
      className={`like-button ${is_liked ? 'liked' : ''}`}
    >
      ❤️ {likes_count} {likes_count === 1 ? 'Like' : 'Likes'}
    </button>
  );
};
```

## Error Handling

All endpoints return appropriate HTTP status codes:

- `200` - Success
- `401` - Unauthorized (for protected endpoints)
- `404` - Movie/TV Show not found
- `409` - Conflict (already liked/not liked)
- `500` - Server error

## Rate Limiting

Consider implementing rate limiting on like/unlike endpoints to prevent spam.

## Security Notes

- CSRF protection is implemented for POST/DELETE requests
- User authentication is verified before allowing likes/unlikes
- Input validation prevents SQL injection and other attacks 