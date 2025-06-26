<?php

namespace App\Http\Controllers;

use App\Models\Comment;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;

class CommentController extends Controller
{
    /**
     * Display a listing of the comments for a specific commentable model.
     */
    public function index(Request $request): JsonResponse
    {
        $request->validate([
            'commentable_type' => 'required|string',
            'commentable_id' => 'required|integer',
            'per_page' => 'sometimes|integer|min:1|max:50',
        ]);

        $commentableType = $request->commentable_type;
        $commentableId = $request->commentable_id;
        $perPage = $request->get('per_page', 10);

        // Get the commentable model class
        $modelClass = 'App\\Models\\' . ucfirst($commentableType);
        
        if (!class_exists($modelClass)) {
            return response()->json(['error' => 'Invalid commentable type'], 400);
        }

        $commentable = $modelClass::findOrFail($commentableId);
        
        // Use direct Comment query to ensure proper ordering
        $comments = Comment::where('commentable_type', $modelClass)
            ->where('commentable_id', $commentableId)
            ->whereNull('parent_id')
            ->with(['user', 'replies.user', 'replies.replies.user'])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
        
        // Add like information for each comment if user is authenticated
        if (Auth::check()) {
            $user = Auth::user();
            $comments->getCollection()->transform(function ($comment) use ($user) {
                $this->addLikeInfoToComment($comment, $user);
                return $comment;
            });
        } else {
            // For public, non-authenticated users
            $comments->getCollection()->transform(function ($comment) {
                $this->addPublicLikeInfoToComment($comment);
                return $comment;
            });
        }

        return response()->json([
            'comments' => $comments,
            'total_comments' => $commentable->commentsCount(),
        ]);
    }

    /**
     * Store a newly created comment.
     */
    public function store(Request $request): JsonResponse
    {
        $request->validate([
            'content' => 'required|string|max:1000',
            'commentable_type' => 'required|string',
            'commentable_id' => 'required|integer',
            'parent_id' => 'sometimes|nullable|integer|exists:comments,id',
        ]);

        $commentableType = $request->commentable_type;
        $commentableId = $request->commentable_id;

        // Get the commentable model class
        $modelClass = 'App\\Models\\' . ucfirst($commentableType);
        
        if (!class_exists($modelClass)) {
            return response()->json(['error' => 'Invalid commentable type'], 400);
        }

        $commentable = $modelClass::findOrFail($commentableId);

        // If this is a reply, validate the parent comment exists for the same commentable
        if ($request->parent_id) {
            $parentComment = Comment::where('id', $request->parent_id)
                ->where('commentable_type', $modelClass)
                ->where('commentable_id', $commentableId)
                ->first();

            if (!$parentComment) {
                return response()->json(['error' => 'Invalid parent comment'], 400);
            }
        }

        $comment = $commentable->addComment(
            Auth::user(),
            $request->content,
            $request->parent_id
        );

        $comment->load('user');

        return response()->json([
            'message' => 'Comment created successfully',
            'comment' => $comment,
        ], 201);
    }

    /**
     * Display the specified comment.
     */
    public function show(Comment $comment): JsonResponse
    {
        $comment->load(['user', 'replies.user']);
        
        return response()->json(['comment' => $comment]);
    }

    /**
     * Update the specified comment.
     */
    public function update(Request $request, Comment $comment): JsonResponse
    {
        // Check if the user owns the comment
        if ($comment->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $request->validate([
            'content' => 'required|string|max:1000',
        ]);

        $comment->update([
            'content' => $request->content,
        ]);

        $comment->load('user');

        return response()->json([
            'message' => 'Comment updated successfully',
            'comment' => $comment,
        ]);
    }

    /**
     * Remove the specified comment.
     */
    public function destroy(Comment $comment): JsonResponse
    {
        // Check if the user owns the comment
        if ($comment->user_id !== Auth::id()) {
            return response()->json(['error' => 'Unauthorized'], 403);
        }

        $comment->delete();

        return response()->json([
            'message' => 'Comment deleted successfully',
        ]);
    }

    /**
     * Get replies for a specific comment.
     */
    public function replies(Comment $comment): JsonResponse
    {
        $replies = $comment->replies()
            ->with('user')
            ->orderBy('created_at', 'asc')
            ->get();

        return response()->json([
            'replies' => $replies,
        ]);
    }

    /**
     * Toggle like for a comment.
     */
    public function toggleLike(Comment $comment): JsonResponse
    {
        $user = Auth::user();
        
        if ($user->hasLiked($comment)) {
            $user->unlike($comment);
            $isLiked = false;
            $message = 'Comment unliked successfully';
        } else {
            $user->like($comment);
            $isLiked = true;
            $message = 'Comment liked successfully';
        }
        
        return response()->json([
            'message' => $message,
            'likes_count' => $comment->likesCount(),
            'is_liked' => $isLiked,
        ]);
    }

    /**
     * Add like information to a comment and its replies recursively for an authenticated user.
     */
    private function addLikeInfoToComment(Comment $comment, $user): void
    {
        $comment->setAttribute('likes_count', $comment->likesCount());
        $comment->setAttribute('is_liked', $user->hasLiked($comment));
        $comment->setAttribute('is_owner', $comment->user_id === $user->id);
        
        // Add like info to replies recursively (handles nested replies)
        if ($comment->replies && $comment->replies->count() > 0) {
            foreach ($comment->replies as $reply) {
                $this->addLikeInfoToComment($reply, $user);
            }
        }
    }

    /**
     * Add public like information to a comment and its replies recursively.
     */
    private function addPublicLikeInfoToComment(Comment $comment): void
    {
        $comment->setAttribute('likes_count', $comment->likesCount());
        $comment->setAttribute('is_liked', false); // Unauthenticated user cannot have liked it
        $comment->setAttribute('is_owner', false); // Unauthenticated user cannot be an owner

        // Add like info to replies recursively
        if ($comment->replies && $comment->replies->count() > 0) {
            foreach ($comment->replies as $reply) {
                $this->addPublicLikeInfoToComment($reply);
            }
        }
    }

    /**
     * Public endpoint to get comments without authentication.
     */
    public function publicIndex(Request $request): JsonResponse
    {
        $request->validate([
            'commentable_type' => 'required|string',
            'commentable_id' => 'required|integer',
            'per_page' => 'sometimes|integer|min:1|max:50',
        ]);

        $commentableType = $request->commentable_type;
        $commentableId = $request->commentable_id;
        $perPage = $request->get('per_page', 10);

        // Get the commentable model class
        $modelClass = 'App\\Models\\' . ucfirst($commentableType);
        
        if (!class_exists($modelClass)) {
            return response()->json(['error' => 'Invalid commentable type'], 400);
        }

        $commentable = $modelClass::findOrFail($commentableId);
        
        // Use direct Comment query to ensure proper ordering
        $comments = Comment::where('commentable_type', $modelClass)
            ->where('commentable_id', $commentableId)
            ->whereNull('parent_id')
            ->with(['user', 'replies.user', 'replies.replies.user'])
            ->orderBy('created_at', 'desc')
            ->paginate($perPage);
        
        // Add public like information (no user authentication)
        $comments->getCollection()->transform(function ($comment) {
            $this->addPublicLikeInfoToComment($comment);
            return $comment;
        });

        return response()->json([
            'comments' => $comments,
            'total_comments' => $commentable->commentsCount(),
        ]);
    }

    /**
     * Public endpoint to show a specific comment without authentication.
     */
    public function publicShow(Comment $comment): JsonResponse
    {
        $comment->load(['user', 'replies.user']);
        $this->addPublicLikeInfoToComment($comment);
        
        return response()->json(['comment' => $comment]);
    }

    /**
     * Generate a shareable URL for a comment.
     */
    public function share(Comment $comment): JsonResponse
    {
        // Get the commentable (movie, tvshow, etc.)
        $commentable = $comment->commentable;
        
        // Generate the share URL based on the commentable type
        $baseUrl = url('/');
        $shareUrl = '';
        
        if ($commentable instanceof \App\Models\Movie) {
            $shareUrl = "{$baseUrl}/movie/{$commentable->slug}#comment-{$comment->id}";
        } elseif ($commentable instanceof \App\Models\Tvshow) {
            $shareUrl = "{$baseUrl}/tvshow/{$commentable->slug}#comment-{$comment->id}";
        } else {
            // Fallback for other commentable types
            $shareUrl = "{$baseUrl}#comment-{$comment->id}";
        }
        
        return response()->json([
            'share_url' => $shareUrl,
            'comment_id' => $comment->id,
            'comment_content' => $comment->content,
            'user_name' => $comment->user->name,
        ]);
    }
}
