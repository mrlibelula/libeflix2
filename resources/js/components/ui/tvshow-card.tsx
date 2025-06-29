import React, { useState } from 'react';
import { StarIcon, CheckIcon, HeartIcon, PlusIcon } from 'lucide-react';
import { Link, router, usePage } from '@inertiajs/react';
import { LazyImage } from '@/components/ui/lazy-image';
import { AddCircleButton } from '@/components/ui/add-circle-button';
import { LoveCircleButton } from '@/components/ui/love-circle-button';

interface TvshowCardProps {
  tvshow: {
    id: number;
    name: string;
    slug: string;
    poster_path?: string;
    vote_average: number;
    first_air_date: string;
    overview?: string;
    is_watch_later?: boolean;
    is_liked?: boolean;
    likes_count?: number;
  };
  imgBaseUrl: string;
  isPriority?: boolean;
  onWatchLaterToggle?: (tvshowId: number, newStatus: boolean) => void;
  onLikeToggle?: (tvshowId: number, newStatus: boolean, newCount: number) => void;
  showCheckIcon?: boolean;
}

export function TvshowCard({ 
  tvshow, 
  imgBaseUrl, 
  isPriority = false, 
  onWatchLaterToggle,
  onLikeToggle,
  showCheckIcon = false 
}: TvshowCardProps) {
  const { props } = usePage<{ 
    auth?: {
      user?: any;
    };
  }>();

  // Check if user is authenticated
  const isAuthenticated = !!props.auth?.user;

  const handleRemoveFromWatchLater = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (isTogglingWatchLater) return;
    
    setIsTogglingWatchLater(true);
    
    try {
      // Optimistically update the parent state first
      if (onWatchLaterToggle) {
        onWatchLaterToggle(tvshow.id, false);
      }
      
      // Make API call to backend using fetch
      const response = await fetch(`/api/tvshows/${tvshow.id}/toggle-watch-later`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Verify the result matches our expectation (should be false since we're removing)
      if (result.is_watch_later !== false && onWatchLaterToggle) {
        onWatchLaterToggle(tvshow.id, result.is_watch_later);
      }
    } catch (error) {
      console.error('Error removing from watch later:', error);
      // Revert on error - restore to watch later since removal failed
      if (onWatchLaterToggle) {
        onWatchLaterToggle(tvshow.id, true);
      }
    } finally {
      setIsTogglingWatchLater(false);
    }
  };

  const [isTogglingWatchLater, setIsTogglingWatchLater] = useState(false);
  const [isTogglingLike, setIsTogglingLike] = useState(false);

  const handleWatchLaterToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Redirect to login page with current page as redirect parameter
      const currentUrl = window.location.pathname + window.location.search;
      router.visit('/login?redirect=' + encodeURIComponent(currentUrl));
      return;
    }
    
    if (isTogglingWatchLater) return;
    
    setIsTogglingWatchLater(true);
    
    try {
      const newStatus = !tvshow.is_watch_later;
      
      // Optimistically update the parent state first
      if (onWatchLaterToggle) {
        onWatchLaterToggle(tvshow.id, newStatus);
      }
      
      // Make API call to backend using fetch
      const response = await fetch(`/api/tvshows/${tvshow.id}/toggle-watch-later`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Verify the result matches our optimistic update
      if (result.is_watch_later !== newStatus && onWatchLaterToggle) {
        onWatchLaterToggle(tvshow.id, result.is_watch_later);
      }
    } catch (error) {
      console.error('Error toggling watch later:', error);
      // Revert on error
      if (onWatchLaterToggle) {
        onWatchLaterToggle(tvshow.id, !tvshow.is_watch_later);
      }
    } finally {
      setIsTogglingWatchLater(false);
    }
  };

  const handleLikeToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Redirect to login page with current page as redirect parameter
      const currentUrl = window.location.pathname + window.location.search;
      router.visit('/login?redirect=' + encodeURIComponent(currentUrl));
      return;
    }
    
    if (isTogglingLike) return;
    
    setIsTogglingLike(true);
    
    try {
      const newStatus = !tvshow.is_liked;
      const newCount = newStatus 
        ? (tvshow.likes_count || 0) + 1 
        : Math.max(0, (tvshow.likes_count || 0) - 1);
      
      // Optimistically update the parent state first
      if (onLikeToggle) {
        onLikeToggle(tvshow.id, newStatus, newCount);
      }
      
      // Make API call to backend using fetch
      const response = await fetch(`/api/tvshows/${tvshow.slug || tvshow.id}/like`, {
        method: newStatus ? 'POST' : 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Update with actual server response
      if (onLikeToggle) {
        onLikeToggle(tvshow.id, result.is_liked, result.likes_count);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      // Revert on error
      if (onLikeToggle) {
        onLikeToggle(tvshow.id, !tvshow.is_liked, tvshow.likes_count || 0);
      }
    } finally {
      setIsTogglingLike(false);
    }
  };

  return (
    <Link 
      href={`/tvshow/${tvshow.slug}`}
      className="group block w-[180px] flex-shrink-0"
    >
      <div className="relative w-full h-[270px] rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-md hover:shadow-lg transition-shadow duration-200">
        <LazyImage
          src={tvshow.poster_path ? `${imgBaseUrl}${tvshow.poster_path}` : '/images/default-backdrop.jpg'}
          alt={tvshow.name}
          className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
          priority={isPriority}
        />
        
        {/* Interactive buttons */}
        {showCheckIcon ? (
          /* Check icon for removal from watch later */
          <div className="absolute top-2 right-2">
            <button
              onClick={handleRemoveFromWatchLater}
              className="p-1.5 bg-green-600 hover:bg-green-700 rounded-full text-white transition-colors duration-200 shadow-lg"
              title="Remove from watch later"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          </div>
        ) : (
          /* Watch later and like buttons - Only show for authenticated users */
          <div className="absolute top-2 right-2 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            {onWatchLaterToggle && isAuthenticated && (
              <AddCircleButton
                isWatchLater={tvshow.is_watch_later || false}
                isToggling={isTogglingWatchLater}
                onClick={handleWatchLaterToggle}
              />
            )}
            {onLikeToggle && isAuthenticated && (
              <LoveCircleButton
                isLiked={tvshow.is_liked || false}
                onClick={handleLikeToggle}
                disabled={isTogglingLike}
              />
            )}
          </div>
        )}

        {/* Rating overlay */}
        {tvshow.vote_average > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <StarIcon className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>{tvshow.vote_average.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* TV Show info */}
      <div className="mt-3 px-1">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200">
          {tvshow.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {tvshow.first_air_date ? new Date(tvshow.first_air_date).getFullYear() : 'N/A'}
          </p>
          {tvshow.likes_count !== null && tvshow.likes_count !== undefined && Number(tvshow.likes_count) > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {tvshow.likes_count} {Number(tvshow.likes_count) === 1 ? 'like' : 'likes'}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
} 