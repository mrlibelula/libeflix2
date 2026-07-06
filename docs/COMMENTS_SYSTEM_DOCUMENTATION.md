# Comments System Documentation

## Overview

The comments system is a polymorphic solution that allows users to comment on any model in the application. This system supports nested comments (replies) and is designed to be easily extensible to any model.

## Database Structure

### Comments Table

The `comments` table uses polymorphic relationships to associate comments with any model:

```sql
- id (bigint)
- user_id (foreign key to users table)
- content (text)
- commentable_id (bigint) - ID of the commentable model
- commentable_type (string) - Class name of the commentable model
- parent_id (nullable foreign key to comments table) - For nested comments
- created_at (timestamp)
- updated_at (timestamp)
```

### Indexes

- `commentable_id`, `commentable_type` (for efficient polymorphic queries)
- `user_id` (for user-specific queries)
- `parent_id` (for nested comments)
- `created_at` (for ordering)

## Models

### Comment Model

**Location:** `app/Models/Comment.php`

**Relationships:**
- `user()` - Belongs to User
- `commentable()` - Polymorphic relationship to any commentable model
- `parent()` - Belongs to Comment (for nested comments)
- `replies()` - Has many Comments (child comments)
- `allReplies()` - Has many Comments with recursive replies

**Methods:**
- `isReply()` - Check if comment is a reply
- `scopeParents($query)` - Scope to get only parent comments

### Commentable Trait

**Location:** `app/Traits/Commentable.php`

Add this trait to any model you want to make commentable:

```php
use App\Traits\Commentable;

class Movie extends Model 
{
    use Commentable;
}
```

**Methods provided by the trait:**
- `comments()` - Get parent comments only (excluding replies)
- `allComments()` - Get all comments including replies
- `commentsWithReplies()` - Get comments with nested replies loaded
- `commentsCount()` - Count of all comments (including replies)
- `parentCommentsCount()` - Count of parent comments only
- `addComment($user, $content, $parentId = null)` - Add a comment
- `hasCommentBy($user)` - Check if user has commented
- `latestComments($limit = 5)` - Get latest comments

## API Endpoints

### Authenticated Routes

#### Get Comments for a Model
```
GET /api/comments
```

**Parameters:**
- `commentable_type` (required) - Model type (e.g., "movie", "tvshow")
- `commentable_id` (required) - Model ID
- `per_page` (optional) - Number of comments per page (default: 10, max: 50)

**Response:**
```json
{
    "comments": {
        "data": [...],
        "links": {...},
        "meta": {...}
    },
    "total_comments": 25
}
```

#### Create Comment
```
POST /api/comments
```

**Parameters:**
- `content` (required) - Comment content (max: 1000 characters)
- `commentable_type` (required) - Model type
- `commentable_id` (required) - Model ID
- `parent_id` (optional) - Parent comment ID for replies

**Response:**
```json
{
    "message": "Comment created successfully",
    "comment": {
        "id": 1,
        "content": "Great movie!",
        "user": {...},
        "created_at": "2024-01-01T00:00:00.000000Z",
        "parent_id": null
    }
}
```

#### Update Comment
```
PUT /api/comments/{id}
```

**Parameters:**
- `content` (required) - Updated comment content

**Authorization:** User must own the comment

#### Delete Comment
```
DELETE /api/comments/{id}
```

**Authorization:** User must own the comment

#### Get Comment Details
```
GET /api/comments/{id}
```

#### Get Comment Replies
```
GET /api/comments/{id}/replies
```

### Public Routes (No Authentication Required)

#### Get Comments (Public)
```
GET /api/comments/public
```

Same parameters as authenticated version, but doesn't require authentication.

#### Get Comment Details (Public)
```
GET /api/comments/{id}/public
```

## Usage Examples

### Adding Comments to a Model

1. **Apply the Commentable trait to your model:**

```php
<?php

namespace App\Models;

use App\Traits\Commentable;
use Illuminate\Database\Eloquent\Model;

class Movie extends Model
{
    use Commentable;
    
    // Your existing model code...
}
```

2. **Create a comment via the API:**

```javascript
// Create a comment on a movie
fetch('/api/comments', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({
        content: 'This is a great movie!',
        commentable_type: 'movie',
        commentable_id: 123
    })
});

// Reply to a comment
fetch('/api/comments', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'X-CSRF-TOKEN': csrfToken,
    },
    body: JSON.stringify({
        content: 'I agree!',
        commentable_type: 'movie',
        commentable_id: 123,
        parent_id: 1 // ID of the comment being replied to
    })
});
```

3. **Get comments for a model:**

```javascript
// Get comments for a movie
fetch('/api/comments?commentable_type=movie&commentable_id=123')
    .then(response => response.json())
    .then(data => {
        console.log('Comments:', data.comments.data);
        console.log('Total comments:', data.total_comments);
    });
```

### Using in Laravel Controllers

```php
<?php

namespace App\Http\Controllers;

use App\Models\Movie;

class MovieController extends Controller
{
    public function show(Movie $movie)
    {
        // Get comments with replies
        $comments = $movie->commentsWithReplies()->paginate(10);
        
        // Get comment count
        $totalComments = $movie->commentsCount();
        
        // Add a comment
        $comment = $movie->addComment(
            auth()->user(),
            'This is a great movie!',
            null // or parent comment ID for replies
        );
        
        return view('movie.show', compact('movie', 'comments', 'totalComments'));
    }
}
```

### Using in Blade Templates

```php
<!-- Display comments count -->
<p>{{ $movie->commentsCount() }} comments</p>

<!-- Display comments -->
@foreach($movie->comments as $comment)
    <div class="comment">
        <h4>{{ $comment->user->name }}</h4>
        <p>{{ $comment->content }}</p>
        <small>{{ $comment->created_at->diffForHumans() }}</small>
        
        <!-- Display replies -->
        @foreach($comment->replies as $reply)
            <div class="reply" style="margin-left: 20px;">
                <h5>{{ $reply->user->name }}</h5>
                <p>{{ $reply->content }}</p>
                <small>{{ $reply->created_at->diffForHumans() }}</small>
            </div>
        @endforeach
    </div>
@endforeach
```

## Security Features

1. **Authorization:** Users can only edit/delete their own comments
2. **Validation:** Content is limited to 1000 characters
3. **Parent Comment Validation:** Replies must reference valid parent comments for the same model
4. **CSRF Protection:** All write operations require CSRF tokens

## Performance Considerations

1. **Indexes:** Proper database indexes for efficient queries
2. **Eager Loading:** Comments can be loaded with users to avoid N+1 queries
3. **Pagination:** Comments are paginated to avoid loading too many at once
4. **Scopes:** Separate scopes for parent comments vs all comments

## Future Extensions

The system is designed to be easily extended:

1. **Add to other models:** Simply add the `Commentable` trait
2. **Comment likes:** Can be extended with a like system for comments
3. **Comment moderation:** Can add approval/moderation features
4. **Rich text:** Can support markdown or HTML content
5. **Attachments:** Can add file attachments to comments

## Testing

To test the comments system:

1. **Create a movie** (or use existing)
2. **Authenticate a user**
3. **Use the API endpoints** to create, read, update, and delete comments
4. **Test nested comments** by creating replies
5. **Test permissions** by trying to edit/delete other users' comments

## Currently Applied To

- ✅ Movie model

## Ready to Apply To

You can easily add comments to any other model by applying the `Commentable` trait:

- Episode model
- Tvshow model  
- Season model
- User model (for user profiles)

Simply add `use Commentable;` to the model class and the comments system will work automatically. 