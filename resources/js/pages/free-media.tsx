import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem, SharedData } from "@/types";
import { Head, usePage } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { TvshowRibbon } from "@/components/tvshow-ribbon";
import { useState, useRef, useEffect, useCallback } from "react";

export default function FreeMedia({ freeMovies, freeTvshows, imgBaseUrl }: { 
  freeMovies: Array<any>, 
  freeTvshows: Array<any>,
  imgBaseUrl: string 
}) {
  const { auth } = usePage<SharedData>().props;
  const [allFreeMovies, setAllFreeMovies] = useState(freeMovies);
  const [allFreeTvshows, setAllFreeTvshows] = useState(freeTvshows);
  const lastFocusedRibbonRef = useRef<string | null>(null);
  const restoreFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Check if user is authenticated
  const isAuthenticated = !!auth?.user;

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

  // Restore focus after state changes
  const restoreFocus = useCallback(() => {
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
            console.log('No carousel found, focusing on ribbon container itself');
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
  }, []);

  // Handle movie watch later toggle
  const handleMovieWatchLaterToggle = useCallback((movieId: number, newStatus: boolean) => {
    // Update the is_watch_later status in the movies list
    setAllFreeMovies(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    );

    // Restore focus to the last focused ribbon after state update
    restoreFocus();
  }, [restoreFocus]);

  // Handle movie like toggle
  const handleMovieLikeToggle = useCallback((movieId: number, newStatus: boolean, newCount: number) => {
    // Update the like status and count in the movies list
    setAllFreeMovies(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_liked: newStatus, likes_count: newCount }
          : movie
      )
    );

    // Restore focus to the last focused ribbon after state update
    restoreFocus();
  }, [restoreFocus]);

  // Handle TV show watch later toggle
  const handleTvshowWatchLaterToggle = useCallback((tvshowId: number, newStatus: boolean) => {
    // Update the is_watch_later status in the TV shows list
    setAllFreeTvshows(prevTvshows => 
      prevTvshows.map(tvshow => 
        tvshow.id === tvshowId 
          ? { ...tvshow, is_watch_later: newStatus }
          : tvshow
      )
    );

    // Restore focus to the last focused ribbon after state update
    restoreFocus();
  }, [restoreFocus]);

  // Handle TV show like toggle
  const handleTvshowLikeToggle = useCallback((tvshowId: number, newStatus: boolean, newCount: number) => {
    // Update the like status and count in the TV shows list
    setAllFreeTvshows(prevTvshows => 
      prevTvshows.map(tvshow => 
        tvshow.id === tvshowId 
          ? { ...tvshow, is_liked: newStatus, likes_count: newCount }
          : tvshow
      )
    );

    // Restore focus to the last focused ribbon after state update
    restoreFocus();
  }, [restoreFocus]);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (restoreFocusTimeoutRef.current) {
        clearTimeout(restoreFocusTimeoutRef.current);
      }
    };
  }, []);

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Free Media (${allFreeMovies.length + allFreeTvshows.length})`,
      href: '/free-media',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Free Movies & TV Shows" />

      {allFreeMovies.length > 0 && (
        <MovieRibbon
          movies={allFreeMovies}
          imgBaseUrl={imgBaseUrl}
          title={`Free Movies (${allFreeMovies.length})`}
          ribbonId="free-media-movies"
          onWatchLaterToggle={isAuthenticated ? handleMovieWatchLaterToggle : undefined}
          onLikeToggle={handleMovieLikeToggle}
          hideSortOptions={['added']}
        />
      )}

      {allFreeTvshows.length > 0 && (
        <TvshowRibbon
          tvshows={allFreeTvshows}
          imgBaseUrl={imgBaseUrl}
          title={`Free TV Shows (${allFreeTvshows.length})`}
          ribbonId="free-media-tvshows"
          onWatchLaterToggle={isAuthenticated ? handleTvshowWatchLaterToggle : undefined}
          onLikeToggle={handleTvshowLikeToggle}
          hideSortOptions={['added']}
        />
      )}

      {allFreeMovies.length === 0 && allFreeTvshows.length === 0 && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-center space-y-4">
            <div className="text-6xl mb-4">🎬</div>
            <h2 className="text-2xl font-semibold text-foreground">No Free Content Available</h2>
            <p className="text-muted-foreground max-w-md">
              There are currently no free movies or TV shows available. Check back later for new free content!
            </p>
          </div>
        </div>
      )}
        
    </AppLayout>
  );
} 