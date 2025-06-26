import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Comment, CommentsResponse, CreateCommentRequest } from '@/types/comments';
import { CommentItem } from '@/components/ui/comment-item';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { LoaderIcon, MessageSquareTextIcon } from 'lucide-react';
import { usePolling } from '@/hooks/use-polling';
import { CommentsApi } from '@/services/comments-api';
import { cn } from '@/lib/utils';

interface CommentsSectionProps {
  commentableType: string;
  commentableId: number;
  isAuthenticated: boolean;
  currentUserId?: number;
  initialCommentsCount?: number;
  className?: string;
  loginLink?: React.ReactNode;
}

export function CommentsSection({
  commentableType,
  commentableId,
  isAuthenticated,
  currentUserId,
  initialCommentsCount = 0,
  className,
  loginLink
}: CommentsSectionProps) {
  
  const [comments, setComments] = useState<Comment[]>([]);
  const [totalComments, setTotalComments] = useState(initialCommentsCount);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  
  const [newComment, setNewComment] = useState('');
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  
  const [newCommentIds, setNewCommentIds] = useState<Set<number>>(new Set());
  const commentsEndRef = useRef<HTMLDivElement>(null);
  const pollingEnabled = useRef(true);
  const hasScrolledToHash = useRef(false);
  const hasInitialLoad = useRef(false);
  
  // Function to fetch comments
  const fetchComments = useCallback(async (pageNum: number = 1, append: boolean = false, isBackgroundPoll: boolean = false) => {
    
    try {
      // Only show loading for initial loads and manual page loads, not background polling
      if (pageNum === 1 && !append && !isBackgroundPoll) {
        setLoading(true);
      } else if (pageNum > 1) {
        setLoadingMore(true);
      }
      
      setError(null);
      
      const response: CommentsResponse = isAuthenticated
        ? await CommentsApi.getComments(commentableType, commentableId, pageNum, 10)
        : await CommentsApi.getPublicComments(commentableType, commentableId, pageNum, 10);
      
      // Safety checks for response structure
      if (!response) {
        setError('Invalid response from server');
        return;
      }
      
      if (!response.comments) {
        setError('Invalid response structure');
        return;
      }
      
      if (!response.comments.data) {
        setError('Invalid response data structure');
        return;
      }
      
      const newComments = response.comments.data;
      
      if (append) {
        // Check for new comments to avoid duplicates
        setComments(prev => {
          const existingIds = new Set(prev.map(c => c.id));
          const filteredNewComments = newComments.filter(c => !existingIds.has(c.id));
          
          if (filteredNewComments.length > 0) {
            return [...prev, ...filteredNewComments];
          }
          return prev;
        });
      } else {
        // This block handles both initial load and background polling updates
        setComments(prev => {
          // For background polls, we want to update the state but also find what's new for animation.
          if (isBackgroundPoll && prev.length > 0) {
            const allExistingIds = new Set<number>();
            const collectIds = (commentsToScan: Comment[]) => {
              commentsToScan.forEach(c => {
                allExistingIds.add(c.id);
                if (c.replies) {
                  collectIds(c.replies);
                }
              });
            };
            collectIds(prev);

            const newItems = new Set<number>();
            const findNewItems = (commentsToScan: Comment[]) => {
              commentsToScan.forEach(c => {
                if (!allExistingIds.has(c.id)) {
                  newItems.add(c.id);
                }
                if (c.replies) {
                  findNewItems(c.replies);
                }
              });
            };
            findNewItems(newComments);

            if (newItems.size > 0) {
              setNewCommentIds(newItems);
              // Clear animation class after a bit
              setTimeout(() => setNewCommentIds(new Set()), 1000);
            }

            // Always return the fresh data from the server. It's the source of truth for order, likes, and replies.
            return newComments;
          }

          // For initial load, just set the comments.
          return newComments;
        });
      }
      
      setTotalComments(response.total_comments || 0);
      
      // Safety check for pagination metadata
      const meta = response.comments.meta;
      if (meta && typeof meta.current_page === 'number' && typeof meta.last_page === 'number') {
        setHasMore(meta.current_page < meta.last_page);
      } else {
        setHasMore(false);
      }
      
      // Scroll to specific comment if hash is present (only on initial load)
      if (!append && pageNum === 1 && !hasScrolledToHash.current && !isBackgroundPoll) {
        setTimeout(() => {
          const hash = window.location.hash;
          if (hash && hash.startsWith('#comment-')) {
            const commentId = hash.replace('#comment-', '');
            const commentElement = document.getElementById(`comment-${commentId}`);
            if (commentElement) {
              commentElement.scrollIntoView({ 
                behavior: 'smooth', 
                block: 'center' 
              });
              // Add a temporary highlight effect
              commentElement.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-75');
              setTimeout(() => {
                commentElement.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-75');
              }, 3000);
              hasScrolledToHash.current = true;
            }
          }
        }, 500);
      }
      
    } catch (err) {
      if (!append && !isBackgroundPoll) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load comments';
        setError(`Failed to load comments: ${errorMessage}`);
      }
    } finally {
      if (!isBackgroundPoll) {
        setLoading(false);
      }
      setLoadingMore(false);
    }
  }, [commentableType, commentableId, isAuthenticated]);
  
  // Use ref for fetchComments to avoid dependency issues
  const fetchCommentsRef = useRef(fetchComments);
  fetchCommentsRef.current = fetchComments;

  // Stable polling function
  const stablePollingFetch = useCallback(async () => {
    // Simple condition: poll if enabled and no error
    if (pollingEnabled.current && !error) {
      try {
        const isInitialLoad = !hasInitialLoad.current;
        hasInitialLoad.current = true;
        
        // Use background polling after first load
        await fetchCommentsRef.current(1, false, !isInitialLoad);
      } catch (err) {
        // Errors are handled inside fetchComments
      }
    }
  }, [error]); // No dependencies to prevent infinite loops

  usePolling(
    stablePollingFetch,
    {
      interval: 1000, // 1 second for testing
      enabled: true,
      immediate: true
    }
  );
  
  // Load more comments
  const loadMoreComments = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await fetchComments(page + 1, true);
    setPage(prev => prev + 1);
  }, [page, hasMore, loadingMore, fetchComments]);
  
  // Submit new comment
  const handleSubmitComment = useCallback(async () => {
    if (isSubmittingComment || !newComment.trim()) return;
    
    setIsSubmittingComment(true);
    try {
      const commentData: CreateCommentRequest = {
        content: newComment.trim(),
        commentable_type: commentableType,
        commentable_id: commentableId,
      };
      
      await CommentsApi.createComment(commentData);
      setNewComment('');
      
      // Refresh comments immediately to show the new comment
      await fetchComments(1, false);
      
    } catch (err) {
      setError('Failed to submit comment');
    } finally {
      setIsSubmittingComment(false);
    }
  }, [newComment, commentableType, commentableId, isSubmittingComment, fetchComments]);
  
  // Handle reply to comment
  const handleReply = useCallback(async (parentId: number, content: string) => {
    const replyData: CreateCommentRequest = {
      content: content.trim(),
      commentable_type: commentableType,
      commentable_id: commentableId,
      parent_id: parentId,
    };
    
    await CommentsApi.createComment(replyData);
    
    // Refresh comments to show the new reply
    await fetchComments(1, false);
  }, [commentableType, commentableId, fetchComments]);
  
  // Handle comment update
  const handleCommentUpdate = useCallback((updatedComment: Comment) => {
    const updateCommentInTree = (comments: Comment[]): Comment[] => {
      return comments.map(comment => {
        if (comment.id === updatedComment.id) {
          return updatedComment;
        }
        if (comment.replies && comment.replies.length > 0) {
          return {
            ...comment,
            replies: updateCommentInTree(comment.replies)
          };
        }
        return comment;
      });
    };
    
    setComments(prev => updateCommentInTree(prev));
  }, []);
  
  // Handle comment delete
  const handleCommentDelete = useCallback((commentId: number) => {
    const removeCommentFromTree = (comments: Comment[]): Comment[] => {
      return comments.filter(comment => {
        if (comment.id === commentId) {
          return false;
        }
        if (comment.replies && comment.replies.length > 0) {
          comment.replies = removeCommentFromTree(comment.replies);
        }
        return true;
      });
    };
    
    setComments(prev => removeCommentFromTree(prev));
    setTotalComments(prev => Math.max(0, prev - 1));
  }, []);
  
  const { startPolling, stopPolling } = usePolling(
    stablePollingFetch,
    {
      interval: 1000,
      enabled: true,
      immediate: true
    }
  );
  
  // Stop polling when component is not visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        pollingEnabled.current = false;
        stopPolling();
      } else {
        pollingEnabled.current = true;
        startPolling();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [startPolling, stopPolling]);
  
  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      pollingEnabled.current = false;
      stopPolling();
    };
  }, [stopPolling]);
  
  if (loading && comments.length === 0) {
    return (
      <div className={cn("flex items-center justify-center py-8", className)}>
        <LoaderIcon className="w-6 h-6 animate-spin text-gray-500" />
        <span className="ml-2 text-gray-500">Loading comments...</span>
      </div>
    );
  }
  
  return (
    <div className={cn("space-y-6", className)}>
      {/* Comments header */}
      <div className="flex items-center space-x-2">
        <MessageSquareTextIcon className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Comments ({totalComments})
        </h3>
      </div>
      
      {/* New comment form */}
      {isAuthenticated && (
        <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
          <Textarea
            value={newComment}
            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewComment(e.target.value)}
            placeholder="Share your thoughts about this movie..."
            className="min-h-[80px]"
          />
          <div className="flex justify-end">
            <Button
              onClick={handleSubmitComment}
              disabled={isSubmittingComment || !newComment.trim()}
              size="sm"
            >
              {isSubmittingComment ? (
                <>
                  <LoaderIcon className="w-4 h-4 animate-spin mr-2" />
                  Posting...
                </>
              ) : (
                'Post Comment'
              )}
            </Button>
          </div>
        </div>
      )}
      
      {/* Error message */}
      {error && (
        <div className="p-3 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 rounded-lg flex items-center justify-between">
          <span>{error}</span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setError(null);
              pollingEnabled.current = true;
              fetchComments(1, false);
            }}
            className="ml-3"
          >
            Retry
          </Button>
        </div>
      )}
      
      {/* Comments list */}
      {comments.length > 0 ? (
        <div className="space-y-2">
          {comments.map((comment) => (
            <CommentItem
              key={comment.id}
              comment={comment}
              isAuthenticated={isAuthenticated}
              currentUserId={currentUserId}
              onCommentUpdate={handleCommentUpdate}
              onCommentDelete={handleCommentDelete}
              onReply={handleReply}
              className={newCommentIds.has(comment.id) ? 'ring-2 ring-blue-500 ring-opacity-50 animate-pulse' : ''}
            />
          ))}
          
          {/* Load more button */}
          {hasMore && (
            <div className="flex justify-center pt-4">
              <Button
                variant="outline"
                onClick={loadMoreComments}
                disabled={loadingMore}
                size="sm"
              >
                {loadingMore ? (
                  <>
                    <LoaderIcon className="w-4 h-4 animate-spin mr-2" />
                    Loading...
                  </>
                ) : (
                  'Load More Comments'
                )}
              </Button>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
          <MessageSquareTextIcon className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
          <p className="text-lg font-medium">No comments yet</p>
          <p className="text-sm">
            {isAuthenticated 
              ? "Be the first to share your thoughts!" 
              : (loginLink || "Login to join the conversation")
            }
          </p>
        </div>
      )}
      
      {/* Scroll anchor for new comments */}
      <div ref={commentsEndRef} />
    </div>
  );
} 