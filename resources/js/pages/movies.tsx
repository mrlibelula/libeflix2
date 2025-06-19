import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem, SharedData } from "@/types";
import { Head, usePage } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { useState, useRef, useEffect, useCallback } from "react";

export default function Movies({ movies, imgBaseUrl, recentlyAddedMovies, searchQuery }: { movies: Array<any>, imgBaseUrl: string, recentlyAddedMovies: Array<any>, searchQuery?: string }) {
  const { auth } = usePage<SharedData>().props;
  const [allMovies, setAllMovies] = useState(movies);
  const [recentlyAddedMoviesList, setRecentlyAddedMoviesList] = useState(recentlyAddedMovies);
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

  // Restore focus after state changes - only when specifically needed, not on every movie data change
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
          } else {
            // console.log('Found carousel element to focus');
          }
          
          if (carouselElement) {
            (carouselElement as HTMLElement).focus();
          }
        } else {
          console.log('Could not find ribbon container with data-ribbon:', lastFocusedRibbonRef.current);
        }
      }, 100); // Increased delay
    }
  }, []);

  const handleWatchLaterToggle = useCallback((movieId: number, newStatus: boolean) => {

    // Update the is_watch_later status in all lists
    setAllMovies(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    );

    setRecentlyAddedMoviesList(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
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
      title: searchQuery ? `Search Results for "${searchQuery}" (${allMovies.length})` : `Movies (${allMovies.length})`,
      href: '/movies',
    },
  ];
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Movies`} />

        <MovieRibbon
          movies={allMovies}
          imgBaseUrl={imgBaseUrl}
          ribbonId="now-streaming"
          onWatchLaterToggle={isAuthenticated ? handleWatchLaterToggle : undefined}
        />

        <MovieRibbon
          movies={recentlyAddedMoviesList}
          imgBaseUrl={imgBaseUrl}
          title={`Recently Added (${recentlyAddedMoviesList.length})`}
          ribbonId="recently-added"
          onWatchLaterToggle={isAuthenticated ? handleWatchLaterToggle : undefined}
        />
        
    </AppLayout>
  );
}