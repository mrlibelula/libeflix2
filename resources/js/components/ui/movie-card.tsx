import React, { useState, useEffect } from 'react';
import { StarIcon, PlusIcon, CheckIcon, HeartIcon, ClapperboardIcon } from 'lucide-react';
import { usePage, router } from '@inertiajs/react';
import axios from 'axios';

interface MovieCardProps {
  movie: {
    id: number;
    title: string;
    poster_path?: string;
    poster_url?: string;
    backdrop_path?: string;
    backdrop_url?: string;
    vote_average: number;
    release_date: string;
    overview?: string;
    is_local?: boolean;
    slug?: string;
    google_drive_file_id?: string;
    is_watch_later?: boolean;
    has_subtitles?: boolean;
    subtitle_languages?: string[];
    is_liked?: boolean;
    likes_count?: number;
    is_free?: boolean;
  };
  onClick?: () => void;
  className?: string;
  onWatchLaterChange?: (movieId: number, isWatchLater: boolean) => void;
  onTrailerClick?: (movieId: number, movieTitle: string) => void;
  onLikeChange?: (movieId: number, isLiked: boolean, likesCount: number) => void;
}

export function MovieCard({ movie, onClick, className = '', onWatchLaterChange, onTrailerClick, onLikeChange }: MovieCardProps) {
  const [isWatchLater, setIsWatchLater] = useState(movie.is_watch_later || false);
  const [isTogglingWatchLater, setIsTogglingWatchLater] = useState(false);
  
  // Like-related state
  const [isLiked, setIsLiked] = useState(movie.is_liked || false);
  const [likesCount, setLikesCount] = useState(movie.likes_count || 0);
  const [isLikeToggling, setIsLikeToggling] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  
  const { props } = usePage<{ 
    isProduction?: boolean;
    csrf_token?: string;
    auth?: {
      user?: any;
    };
  }>();

  // Check if user is authenticated
  const isAuthenticated = !!props.auth?.user;

  // Sync local state with movie prop changes
  useEffect(() => {
    setIsWatchLater(movie.is_watch_later || false);
    setIsLiked(movie.is_liked || false);
    setLikesCount(movie.likes_count || 0);
  }, [movie.is_watch_later, movie.is_liked, movie.likes_count]);

  // Production environment logic - same as MoviePoster
  const isProductionEnvironment = props.isProduction;
  const hasGoogleDriveFile = movie.google_drive_file_id && movie.google_drive_file_id.trim() !== '';
  const isClickableInProduction = !isProductionEnvironment || hasGoogleDriveFile;
  
  const handleClick = (e: React.MouseEvent) => {
    // Don't navigate if clicking on action buttons or their container
    if ((e.target as Element).closest('.action-button') || 
        (e.target as Element).closest('.action-buttons-container')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }

    // Check if movie should be clickable based on production environment
    if (movie.is_local && movie.slug && isClickableInProduction) {
      if (onClick) {
        onClick();
      } else {
        // Navigate to local movie page
        window.location.href = `/movie/${movie.slug}`;
      }
    } else {
      // External movie or not clickable in production - prevent navigation
      e.preventDefault();
      e.stopPropagation();
      console.log('Movie not clickable:', movie.title);
    }
  };

  const handleWatchLaterToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!movie.is_local || isTogglingWatchLater) return;

    setIsTogglingWatchLater(true);
    try {
      const response = await axios.post(`/api/movies/${movie.slug}/toggle-watch-later`);
      if (response.data.success) {
        const newStatus = response.data.is_watch_later;
        setIsWatchLater(newStatus);
        if (onWatchLaterChange) {
          onWatchLaterChange(movie.id, newStatus);
        }
      }
    } catch (error) {
      console.error('Error toggling watch later:', error);
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
      router.visit('/login' + '?redirect=' + encodeURIComponent(currentUrl));
      return;
    }
    
    // Only allow like toggle for local movies
    if (!movie.is_local || isLikeToggling) return;
    
    setIsLikeToggling(true);
    setIsLikeAnimating(true);
    
    try {
      // Get CSRF token from Inertia shared data or meta tag
      const csrfToken = props.csrf_token || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (!csrfToken) {
        console.error('CSRF token not found');
        setIsLikeAnimating(false);
        return;
      }
      
      const method = isLiked ? 'DELETE' : 'POST';
      const response = await fetch(`/api/movies/${movie.slug}/like`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'Accept': 'application/json',
        },
        credentials: 'same-origin', // Include cookies for CSRF
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Change status at the midpoint of animation
        setTimeout(() => {
          setIsLiked(data.is_liked);
          setLikesCount(data.likes_count);
          if (onLikeChange) {
            onLikeChange(movie.id, data.is_liked, data.likes_count);
          }
        }, 150);
        
        // Complete animation cycle
        setTimeout(() => {
          setIsLikeAnimating(false);
        }, 300);
      } else {
        console.error('HTTP error:', response.status, response.statusText);
        if (response.status === 419) {
          console.error('CSRF token mismatch. Please refresh the page.');
        } else if (response.status === 401) {
          // User is not authenticated, redirect to login
          const currentUrl = window.location.pathname + window.location.search;
          router.visit('/login' + '?redirect=' + encodeURIComponent(currentUrl));
          return;
        }
        setIsLikeAnimating(false);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLikeAnimating(false);
    } finally {
      setIsLikeToggling(false);
    }
  };

  const handleTrailerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    e.nativeEvent.stopImmediatePropagation();
    
    if (onTrailerClick) {
      onTrailerClick(movie.id, movie.title);
    }
  };

  const imageUrl = movie.poster_url || movie.backdrop_url;
  const releaseYear = movie.release_date ? new Date(movie.release_date).getFullYear() : '';
  const rating = Math.round(movie.vote_average * 10);
  
  // Check if movie is not clickable specifically due to missing google_drive_file_id in production
  const isUnavailableInProduction = isProductionEnvironment && movie.is_local && movie.slug && !hasGoogleDriveFile;
  const shouldShowClickableCursor = (movie.is_local && movie.slug && isClickableInProduction) || onClick;

  return (
    <div 
      className={`group transition-all duration-300 ${shouldShowClickableCursor ? 'cursor-pointer' : 'cursor-default'} ${className}`}
      onClick={handleClick}
    >
      <div className={`relative overflow-hidden rounded-lg bg-gray-200 dark:bg-gray-800 ${
        isUnavailableInProduction ? 'opacity-60' : ''
      }`}>
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={movie.title}
            className={`w-full aspect-[2/3] object-cover transition-opacity duration-300 ${
              isUnavailableInProduction ? 'group-hover:opacity-60' : 'group-hover:opacity-80'
            }`}
            loading="lazy"
          />
        ) : (
          <div className="w-full aspect-[2/3] flex items-center justify-center bg-gray-300 dark:bg-gray-700">
            <span className="text-gray-500 dark:text-gray-400 text-sm text-center p-2">
              No Image
            </span>
          </div>
        )}
        
        {/* Coming Soon overlay for movies without google_drive_file_id in production */}
        {isUnavailableInProduction && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
            <div className="bg-gray-600/90 text-white text-xs font-semibold px-2 py-1 rounded shadow-lg">
              COMING SOON
            </div>
          </div>
        )}
        
        {/* FREE label for movies from database that are tagged as free */}
        {movie.is_local && movie.is_free === true && (
          <div className="absolute top-2 left-2 z-10">
            <div className="bg-green-500 text-white text-[0.65rem] font-semibold px-1 rounded shadow-lg border-2 border-green-400 animate-pulse">
              FREE TO WATCH
            </div>
          </div>
        )}
        
        {/* Rating overlay */}
        {rating > 0 && (
          <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
            <StarIcon className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>{rating}%</span>
          </div>
        )}

        {/* Movie action buttons overlay */}
        <div 
          className="absolute bottom-2 left-2 right-2 flex items-center justify-between"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
        >
          {/* Left side - CC indicator (only for local movies) */}
          <div className="flex items-center gap-1">
            {movie.is_local && movie.has_subtitles && (
              <div className="bg-black/70 text-white text-xs px-1.5 py-0.5 rounded font-bold">
                CC
              </div>
            )}
          </div>

            {/* Right side - Action buttons */}
            <div className="flex items-center gap-1 action-buttons-container">
            {/* Watch Later icon (only for local movies) */}
            {movie.is_local && (
              <button 
                className={`action-button p-1 rounded-full text-white transition-colors ${
                  isWatchLater 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-black/70 hover:bg-black/90'
                } ${isTogglingWatchLater ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleWatchLaterToggle}
                disabled={isTogglingWatchLater}
              >
                {isWatchLater ? (
                  <CheckIcon className="w-3 h-3" />
                ) : (
                  <PlusIcon className="w-3 h-3" />
                )}
              </button>
            )}

            {/* Heart icon (only for local movies) */}
            {movie.is_local && (
              <button 
                className={`action-button p-1 rounded-full text-white transition-all duration-200 ${
                  isLiked 
                    ? 'bg-red-600 hover:bg-red-700' 
                    : 'bg-black/70 hover:bg-black/90'
                } ${isLikeToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={handleLikeToggle}
                disabled={isLikeToggling}
                title={isAuthenticated 
                  ? (isLiked ? "Unlike this movie" : "Like this movie")
                  : "Login to like this movie"
                }
              >
                <div
                  className={`transition-all duration-300 ease-in-out ${
                    isLikeAnimating ? 'rotate-180' : 'rotate-0'
                  }`}
                  style={{
                    transform: isLikeAnimating 
                      ? 'rotate(180deg)' 
                      : 'rotate(0deg)',
                  }}
                >
                  <HeartIcon 
                    className={`w-3 h-3 transition-colors duration-200 ${
                      isLiked ? 'fill-white' : ''
                    }`}
                  />
                </div>
              </button>
            )}

            {/* Clapper icon (for all movies) */}
            <button 
              className="action-button p-1 bg-black/70 rounded-full text-white hover:bg-black/90 transition-colors"
              onClick={handleTrailerClick}
            >
              <ClapperboardIcon className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>
      
      <div className="mt-2 space-y-1">
        <h3 className="font-medium text-sm line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors whitespace-nowrap overflow-hidden text-ellipsis">
          {movie.title}
        </h3>
        {releaseYear && (
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {releaseYear}
          </p>
        )}
      </div>

    </div>
  );
} 