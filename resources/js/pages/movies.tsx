import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { useState, useRef, useEffect, useCallback } from "react";

// Interface for sidebar state event
interface SidebarStateDetail {
  state: 'expanded' | 'collapsed';
  width: string;
  isMobile: boolean;
}

export default function Movies({ movies, imgBaseUrl, watchLaterMovies }: { movies: Array<any>, imgBaseUrl: string, watchLaterMovies: Array<any> }) {
  const [allMovies, setAllMovies] = useState(movies);
  const [watchLaterMoviesList, setWatchLaterMoviesList] = useState(watchLaterMovies);
  const lastFocusedRibbonRef = useRef<string | null>(null);
  const restoreFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Helper function to get initial sidebar width from cookie
  const getInitialSidebarWidth = () => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const sidebarCookie = cookies.find(cookie => cookie.trim().startsWith('sidebar_state='));
      if (sidebarCookie) {
        const isExpanded = sidebarCookie.split('=')[1] === 'true';
        return isExpanded ? '12rem' : '3rem';
      }
    }
    return '12rem'; // Default to expanded if no cookie found
  };

  // State to track sidebar width for dynamic CSS calculations
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth());

  // Listen for sidebar state changes
  useEffect(() => {
    const handleSidebarStateChange = (event: CustomEvent<SidebarStateDetail>) => {
      const { state, width, isMobile } = event.detail;
      if (!isMobile) {
        setSidebarWidth(width);
      }
    };

    window.addEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    
    return () => {
      window.removeEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    };
  }, []);

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

    // Update the is_watch_later status in both lists
    setAllMovies(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    );

    if (newStatus) {
      // Add to watch later list if not already there (prepend to maintain DESC order)
      setWatchLaterMoviesList(prev => {
        const movieToAdd = allMovies.find(movie => movie.id === movieId);
        if (movieToAdd && !prev.find(movie => movie.id === movieId)) {
          return [{ ...movieToAdd, is_watch_later: true }, ...prev];
        }
        return prev;
      });
    } else {
      // Remove from watch later list
      setWatchLaterMoviesList(prev => prev.filter(movie => movie.id !== movieId));
    }
  }, [allMovies]);

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

    return () => {
      if (restoreFocusTimeoutRef.current) {
        clearTimeout(restoreFocusTimeoutRef.current);
      }
    };
  }, [allMovies, watchLaterMoviesList]);

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Movies (${allMovies.length})`,
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
          onWatchLaterToggle={handleWatchLaterToggle}
          sidebarWidth={sidebarWidth}
        />

        <MovieRibbon
          movies={watchLaterMoviesList}
          imgBaseUrl={imgBaseUrl}
          title={`Watch Later (${watchLaterMoviesList.length})`}
          ribbonId="watch-later"
          onWatchLaterToggle={handleWatchLaterToggle}
          sidebarWidth={sidebarWidth}
        />
        
    </AppLayout>
  );
}