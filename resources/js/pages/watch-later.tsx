import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { useState, useRef, useEffect, useCallback } from "react";

export default function WatchLater({ watchLaterMovies, imgBaseUrl }: { watchLaterMovies: Array<any>, imgBaseUrl: string }) {
  const [watchLaterMoviesList, setWatchLaterMoviesList] = useState(watchLaterMovies);
  const lastFocusedRibbonRef = useRef<string | null>(null);
  const restoreFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Track which ribbon has focus
  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const ribbonContainer = activeElement.closest('[data-ribbon]');
        if (ribbonContainer) {
          const ribbonTitle = ribbonContainer.getAttribute('data-ribbon');
          if (ribbonTitle) {
            lastFocusedRibbonRef.current = ribbonTitle;
          }
        }
      }
    };

    // Listen for focus changes globally
    document.addEventListener('focusin', handleFocusChange);
    
    return () => {
      document.removeEventListener('focusin', handleFocusChange);
    };
  }, []);

  const handleWatchLaterToggle = useCallback((movieId: number, newStatus: boolean) => {
    if (newStatus) {
      // This shouldn't happen in this context, but handle it just in case
      setWatchLaterMoviesList(prev => {
        const movieToAdd = prev.find(movie => movie.id === movieId);
        if (movieToAdd) {
          return prev.map(movie => 
            movie.id === movieId 
              ? { ...movie, is_watch_later: true }
              : movie
          );
        }
        return prev;
      });
    } else {
      // Remove from watch later list
      setWatchLaterMoviesList(prev => prev.filter(movie => movie.id !== movieId));
    }
  }, []);

  const handleLikeToggle = useCallback((movieId: number, newStatus: boolean, newCount: number) => {
    // Update the like status and count in the watch later list
    setWatchLaterMoviesList(prev => 
      prev.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_liked: newStatus, likes_count: newCount }
          : movie
      )
    );
  }, []);

  // Restore focus after state changes
  useEffect(() => {
    if (lastFocusedRibbonRef.current) {
      
      // Clear any existing timeout
      if (restoreFocusTimeoutRef.current) {
        clearTimeout(restoreFocusTimeoutRef.current);
      }

      // Set a delay to ensure DOM has updated
      restoreFocusTimeoutRef.current = setTimeout(() => {
        const ribbonContainer = document.querySelector(`[data-ribbon="${lastFocusedRibbonRef.current}"]`);
        
        if (ribbonContainer) {
          // Try different selectors for the carousel element in order of preference
          let carouselElement = ribbonContainer.querySelector('[tabindex="0"]');
          if (!carouselElement) {
            carouselElement = ribbonContainer.querySelector('[role="region"][aria-roledescription="carousel"]');
          }
          if (!carouselElement) {
            carouselElement = ribbonContainer.querySelector('[data-slot="carousel"]');
          }
          
          // If no carousel found (e.g., empty state), focus on the ribbon container itself
          if (!carouselElement) {
            // Make the ribbon container focusable if it isn't already
            if (!ribbonContainer.hasAttribute('tabindex')) {
              ribbonContainer.setAttribute('tabindex', '0');
            }
            carouselElement = ribbonContainer;
          }
          
          if (carouselElement) {
            (carouselElement as HTMLElement).focus();
          }
        }
      }, 100);
    }

    return () => {
      if (restoreFocusTimeoutRef.current) {
        clearTimeout(restoreFocusTimeoutRef.current);
      }
    };
  }, [watchLaterMoviesList]);

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Watch Later Movies and TV Shows`,
      href: '/watch-later',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Watch Later Movies and TV Shows" />

      <MovieRibbon
        movies={watchLaterMoviesList}
        imgBaseUrl={imgBaseUrl}
        title={`Watch Later Movies (${watchLaterMoviesList.length})`}
        ribbonId="watch-later"
        onWatchLaterToggle={handleWatchLaterToggle}
        onLikeToggle={handleLikeToggle}
      />
        
    </AppLayout>
  );
} 