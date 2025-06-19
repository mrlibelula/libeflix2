import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem, SharedData } from "@/types";
import { Head, usePage } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { useState, useRef, useEffect, useCallback } from "react";
import { AlertCircle } from "lucide-react";

interface Movie {
  id: number;
  title: string;
  poster_path?: string;
  poster_url?: string;
  backdrop_path?: string;
  backdrop_url?: string;
  vote_average: number;
  release_date: string;
  overview?: string;
  genre_ids?: number[];
  is_local?: boolean;
  slug?: string;
  is_watch_later?: boolean;
  has_subtitles?: boolean;
  subtitle_languages?: string[];
}

interface PopularTopProps {
  popularMovies: Movie[];
  topRatedMovies: Movie[];
  imgBaseUrl: string;
  error?: string;
}

export default function PopularTop({ popularMovies, topRatedMovies, imgBaseUrl, error }: PopularTopProps) {
  const { auth } = usePage<SharedData>().props;
  const [popularMoviesList, setPopularMoviesList] = useState(popularMovies);
  const [topRatedMoviesList, setTopRatedMoviesList] = useState(topRatedMovies);
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

  const handleWatchLaterToggle = useCallback((movieId: number, newStatus: boolean) => {
    // Update the is_watch_later status in both lists
    setPopularMoviesList(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    );

    setTopRatedMoviesList(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    );
  }, []);

  // Restore focus after state changes - only when specifically needed
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
          // Try different selectors for the carousel element
          let carouselElement = ribbonContainer.querySelector('[tabindex="0"]');
          if (!carouselElement) {
            carouselElement = ribbonContainer.querySelector('[role="region"][aria-roledescription="carousel"]');
          }
          if (!carouselElement) {
            carouselElement = ribbonContainer.querySelector('[data-slot="carousel"]');
          }
          
          // If no carousel found (e.g., empty state), focus on the ribbon container itself
          if (!carouselElement) {
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
      title: 'Popular/Top Movies',
      href: '/popular-top',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Popular & Top Rated Movies" />

      {/* Error message if API failed */}
      {error && (
        <div className="mx-4 mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <div className="flex items-center gap-2 text-red-800 dark:text-red-200">
            <AlertCircle className="h-5 w-5" />
            <span className="font-medium">Error loading movies</span>
          </div>
          <p className="mt-1 text-red-700 dark:text-red-300 text-sm">{error}</p>
        </div>
      )}

      {/* Popular Movies Ribbon */}
      <MovieRibbon
        movies={popularMoviesList}
        imgBaseUrl={imgBaseUrl}
        title={`Popular Movies (${popularMoviesList.length})`}
        ribbonId="popular-movies"
        onWatchLaterToggle={isAuthenticated ? handleWatchLaterToggle : undefined}
      />

      {/* Top Rated Movies Ribbon */}
      <MovieRibbon
        movies={topRatedMoviesList}
        imgBaseUrl={imgBaseUrl}
        title={`Top Rated Movies (${topRatedMoviesList.length})`}
        ribbonId="top-rated-movies"
        onWatchLaterToggle={isAuthenticated ? handleWatchLaterToggle : undefined}
      />
        
    </AppLayout>
  );
} 