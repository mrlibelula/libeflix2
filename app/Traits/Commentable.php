<?php

namespace App\Traits;

use App\Models\Comment;
use App\Models\User;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait Commentable
{
    /**
     * Get all the comments for this model.
     */
    public function comments(): MorphMany
    {
        return $this->morphMany(Comment::class, 'commentable')->whereNull('parent_id')->orderBy('created_at', 'desc');
    }

    /**
     * Get all comments including replies.
     */
    public function allComments(): MorphMany
    {
        return $this->morphMany(Comment::class, 'commentable')->orderBy('created_at', 'desc');
    }

    /**
     * Get comments with their replies loaded.
     */
    public function commentsWithReplies(): MorphMany
    {
        return $this->morphMany(Comment::class, 'commentable')
            ->with(['user', 'replies.user', 'replies.replies.user'])
            ->whereNull('parent_id')
            ->orderBy('created_at', 'desc');
    }

    /**
     * Get the count of comments for this model (including replies).
     */
    public function commentsCount(): int
    {
        return $this->allComments()->count();
    }

    /**
     * Get the count of parent comments only (excluding replies).
     */
    public function parentCommentsCount(): int
    {
        return $this->comments()->count();
    }

    /**
     * Add a comment to this model.
     */
    public function addComment(User $user, string $content, ?int $parentId = null): Comment
    {
        return $this->allComments()->create([
            'user_id' => $user->id,
            'content' => $content,
            'parent_id' => $parentId,
        ]);
    }

    /**
     * Check if a user has commented on this model.
     */
    public function hasCommentBy(User $user): bool
    {
        return $this->allComments()->where('user_id', $user->id)->exists();
    }

    /**
     * Get latest comments for this model.
     */
    public function latestComments(int $limit = 5): MorphMany
    {
        return $this->comments()->with('user')->limit($limit);
    }
} 