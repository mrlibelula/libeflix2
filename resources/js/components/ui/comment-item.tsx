import React, { useState, useRef, useEffect } from 'react';
import { Comment, CommentContextMenuAction } from '@/types/comments';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { HeartIcon, MessageCircleIcon, Share2Icon, MoreHorizontalIcon, EditIcon, TrashIcon, ReplyIcon } from 'lucide-react';
import { useWebShare } from '@/hooks/use-web-share';
import { CommentsApi } from '@/services/comments-api';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface CommentItemProps {
  comment: Comment;
  isAuthenticated: boolean;
  currentUserId?: number;
  level?: number;
  onCommentUpdate: (comment: Comment) => void;
  onCommentDelete: (commentId: number) => void;
  onReply: (parentId: number, content: string) => Promise<void>;
  className?: string;
}

export function CommentItem({
  comment,
  isAuthenticated,
  currentUserId,
  level = 0,
  onCommentUpdate,
  onCommentDelete,
  onReply,
  className
}: CommentItemProps) {
  const [isLiked, setIsLiked] = useState(comment.is_liked || false);
  const [likesCount, setLikesCount] = useState(comment.likes_count || 0);
  const [isLikeToggling, setIsLikeToggling] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(comment.content);
  const [isSubmittingEdit, setIsSubmittingEdit] = useState(false);
  
  const [showReplyForm, setShowReplyForm] = useState(false);
  const [replyContent, setReplyContent] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  
  const [showReplies, setShowReplies] = useState(true);
  
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const commentRef = useRef<HTMLDivElement>(null);
  const isOwner = currentUserId === comment.user.id;
  
  const { share, isSharing } = useWebShare();
  
  // Format the timestamp
  const timeAgo = formatDistanceToNow(new Date(comment.created_at), { addSuffix: true });
  
  // Sync like state with prop changes (important for polling updates)
  useEffect(() => {
    setIsLiked(comment.is_liked || false);
    setLikesCount(comment.likes_count || 0);
  }, [comment.is_liked, comment.likes_count]);
  
  // Handle like toggle
  const handleLikeToggle = async () => {
    if (!isAuthenticated) {
      // You could show a login prompt here
      return;
    }
    
    if (isLikeToggling) return;
    
    setIsLikeToggling(true);
    setIsLikeAnimating(true);
    
    try {
      const response = await CommentsApi.toggleCommentLike(comment.id);
      
      // Change status at the midpoint of animation
      setTimeout(() => {
        setIsLiked(response.is_liked);
        setLikesCount(response.likes_count);
      }, 150);
      
      // Complete animation cycle
      setTimeout(() => {
        setIsLikeAnimating(false);
      }, 300);
    } catch (error) {
      console.error('Error toggling comment like:', error);
      setIsLikeAnimating(false);
    } finally {
      setIsLikeToggling(false);
    }
  };
  
  // Handle edit save
  const handleEditSave = async () => {
    if (isSubmittingEdit || !editContent.trim()) return;
    
    setIsSubmittingEdit(true);
    try {
      const response = await CommentsApi.updateComment(comment.id, {
        content: editContent.trim()
      });
      
      onCommentUpdate({
        ...comment,
        content: response.content,
        updated_at: response.updated_at
      });
      
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating comment:', error);
    } finally {
      setIsSubmittingEdit(false);
    }
  };
  
  // Handle delete
  const handleDeleteClick = () => {
    setShowDeleteDialog(true);
  };
  
  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await CommentsApi.deleteComment(comment.id);
      onCommentDelete(comment.id);
      setShowDeleteDialog(false);
    } catch (error) {
      console.error('Error deleting comment:', error);
    } finally {
      setIsDeleting(false);
    }
  };
  
  // Handle reply
  const handleReplySubmit = async () => {
    if (isSubmittingReply || !replyContent.trim()) return;
    
    setIsSubmittingReply(true);
    try {
      await onReply(comment.id, replyContent.trim());
      setReplyContent('');
      setShowReplyForm(false);
    } catch (error) {
      console.error('Error submitting reply:', error);
    } finally {
      setIsSubmittingReply(false);
    }
  };
  
  // Handle share
  const handleShare = async () => {
    const response = await CommentsApi.shareComment(comment.id);
    await share({
      title: `Comment by ${comment.user.name}`,
      text: comment.content.length > 100 ? `${comment.content.slice(0, 100)}...` : comment.content,
      url: response.share_url,
    });
  };
  
  // Context menu actions
  const contextMenuActions: CommentContextMenuAction[] = [
    {
      label: 'Share',
      icon: <Share2Icon className="w-4 h-4" />,
      onClick: handleShare,
      disabled: isSharing,
    },
    ...(isOwner ? [
      {
        label: 'Edit',
        icon: <EditIcon className="w-4 h-4" />,
        onClick: () => setIsEditing(true),
      },
      {
        label: 'Delete',
        icon: <TrashIcon className="w-4 h-4" />,
        onClick: handleDeleteClick,
        destructive: true,
      },
    ] : []),
  ];
  
  // Note: Removed auto-scroll animation to prevent performance issues
  
  const maxNestingLevel = 3; // Prevent infinite nesting
  const canReply = level < maxNestingLevel && isAuthenticated;
  
  return (
    <div
      ref={commentRef}
      id={`comment-${comment.id}`}
      className={cn(
        "animate-in fade-in-0 slide-in-from-left-1 duration-300",
        level > 0 ? `ml-${Math.min(level * 4, 12)} pl-4 border-l-2 border-gray-200 dark:border-gray-700` : '',
        className
      )}
    >
      <div className="flex space-x-3 p-3 rounded-lg hover:bg-gray-200/50 dark:hover:bg-[#171717] transition-colors duration-200">
        <div className="flex-shrink-0">
          <Avatar className="w-8 h-8">
            {comment.user.avatar ? (
              <img 
                src={comment.user.avatar} 
                alt={comment.user.name}
                className="w-full h-full object-cover rounded-full"
              />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-medium text-sm">
                {comment.user.name.charAt(0).toUpperCase()}
              </div>
            )}
          </Avatar>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
                {comment.user.name}
              </h4>
              <span className="text-xs text-gray-500 dark:text-gray-400">
                {timeAgo}
              </span>
              {comment.updated_at !== comment.created_at && (
                <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                  (edited)
                </span>
              )}
            </div>
            
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <MoreHorizontalIcon className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                {contextMenuActions.map((action, index) => (
                  <React.Fragment key={action.label}>
                    <DropdownMenuItem
                      onClick={action.onClick}
                      disabled={action.disabled}
                      className={cn(
                        action.destructive && "text-red-600 dark:text-red-400 focus:text-red-600 dark:focus:text-red-400"
                      )}
                    >
                      {action.icon}
                      <span className="ml-2">{action.label}</span>
                    </DropdownMenuItem>
                    {index === 0 && contextMenuActions.length > 1 && (
                      <DropdownMenuSeparator />
                    )}
                  </React.Fragment>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          
          {isEditing ? (
            <div className="mt-2 space-y-2">
              <Textarea
                value={editContent}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setEditContent(e.target.value)}
                className="min-h-[60px]"
                placeholder="Edit your comment..."
              />
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={handleEditSave}
                  disabled={isSubmittingEdit || !editContent.trim()}
                >
                  {isSubmittingEdit ? 'Saving...' : 'Save'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setIsEditing(false);
                    setEditContent(comment.content);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-1">
              <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                {comment.content}
              </p>
            </div>
          )}
          
          {/* Action buttons */}
          <div className="flex items-center space-x-4 mt-2">
            <button
              onClick={handleLikeToggle}
              disabled={isLikeToggling || !isAuthenticated}
              className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 hover:text-red-500 dark:hover:text-red-400 transition-colors duration-200 disabled:opacity-50"
            >
              <div
                className={cn(
                  "transition-all duration-300 ease-in-out",
                  isLikeAnimating && "animate-spin"
                )}
              >
                <HeartIcon 
                  className={cn(
                    "w-4 h-4 transition-colors duration-200",
                    isLiked 
                      ? "text-red-500 fill-red-500" 
                      : "text-gray-500 dark:text-gray-400"
                  )}
                />
              </div>
              <span>{likesCount}</span>
            </button>
            
            {canReply && (
              <button
                onClick={() => setShowReplyForm(!showReplyForm)}
                className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 transition-colors duration-200"
              >
                <ReplyIcon className="w-4 h-4" />
                <span>Reply</span>
              </button>
            )}
            
            <button
              onClick={handleShare}
              disabled={isSharing}
              className="flex items-center space-x-1 text-sm text-gray-500 dark:text-gray-400 hover:text-green-500 dark:hover:text-green-400 transition-colors duration-200 disabled:opacity-50"
            >
              <Share2Icon className="w-4 h-4" />
              <span>Share</span>
            </button>
          </div>
          
          {/* Reply form */}
          {showReplyForm && (
            <div className="mt-3 space-y-2 animate-in fade-in-0 slide-in-from-top-1 duration-200">
              <Textarea
                value={replyContent}
                                 onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setReplyContent(e.target.value)}
                className="min-h-[60px]"
                placeholder={`Reply to ${comment.user.name}...`}
              />
              <div className="flex space-x-2">
                <Button
                  size="sm"
                  onClick={handleReplySubmit}
                  disabled={isSubmittingReply || !replyContent.trim()}
                >
                  {isSubmittingReply ? 'Replying...' : 'Reply'}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setShowReplyForm(false);
                    setReplyContent('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Replies */}
      {comment.replies && comment.replies.length > 0 && (
        <div className="mt-2">
          {comment.replies.length > 1 && (
            <button
              onClick={() => setShowReplies(!showReplies)}
              className="text-xs text-blue-500 dark:text-blue-400 hover:text-blue-600 dark:hover:text-blue-300 mb-2 ml-11"
            >
              {showReplies ? 'Hide' : 'Show'} {comment.replies.length} {comment.replies.length === 1 ? 'reply' : 'replies'}
            </button>
          )}
          
          {showReplies && (
            <div className="space-y-1">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  isAuthenticated={isAuthenticated}
                  currentUserId={currentUserId}
                  level={level + 1}
                  onCommentUpdate={onCommentUpdate}
                  onCommentDelete={onCommentDelete}
                  onReply={onReply}
                />
              ))}
            </div>
          )}
        </div>
      )}
      
      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Comment</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this comment? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={isDeleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
} 