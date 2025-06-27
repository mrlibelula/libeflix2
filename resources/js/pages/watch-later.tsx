import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { TvshowRibbon } from "@/components/tvshow-ribbon";
import { SeasonRibbon } from "@/components/season-ribbon";
import { EpisodeRibbon } from "@/components/episode-ribbon";
import { useState, useRef, useEffect, useCallback } from "react";

export default function WatchLater({ 
  watchLaterMovies, 
  watchLaterTvshows,
  watchLaterSeasons,
  watchLaterEpisodes,
  imgBaseUrl 
}: { 
  watchLaterMovies: Array<any>,
  watchLaterTvshows: Array<any>,
  watchLaterSeasons: Array<any>,
  watchLaterEpisodes: Array<any>,
  imgBaseUrl: string 
}) {
  const [watchLaterMoviesList, setWatchLaterMoviesList] = useState(watchLaterMovies);
  const [watchLaterTvshowsList, setWatchLaterTvshowsList] = useState(watchLaterTvshows);
  const [watchLaterSeasonsList, setWatchLaterSeasonsList] = useState(watchLaterSeasons);
  const [watchLaterEpisodesList, setWatchLaterEpisodesList] = useState(watchLaterEpisodes);
  const lastFocusedRibbonRef = useRef<string | null>(null);
  const restoreFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Refs for each ribbon section for smooth scrolling
  const moviesRibbonRef = useRef<HTMLDivElement>(null);
  const tvshowsRibbonRef = useRef<HTMLDivElement>(null);
  const seasonsRibbonRef = useRef<HTMLDivElement>(null);
  const episodesRibbonRef = useRef<HTMLDivElement>(null);

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

  // Function to handle smooth scrolling to a target element
  const handleSmoothScrollTo = (targetRef: React.RefObject<HTMLDivElement | null>) => {
    if (!targetRef.current) return;
    
    const target = targetRef.current;
    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - 100; // 100px offset from top
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    const duration = 800; // 800ms for smooth animation
    let start: number | null = null;
    
    const easeInOutQuad = (t: number): number => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };
    
    const animation = (currentTime: number) => {
      if (start === null) start = currentTime;
      const timeElapsed = currentTime - start;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = easeInOutQuad(progress);
      
      window.scrollTo(0, startPosition + distance * ease);
      
      if (progress < 1) {
        requestAnimationFrame(animation);
      }
    };
    
    requestAnimationFrame(animation);
  };

  // Specific scroll handlers for each ribbon
  const handleScrollToMovies = () => handleSmoothScrollTo(moviesRibbonRef);
  const handleScrollToTvshows = () => handleSmoothScrollTo(tvshowsRibbonRef);
  const handleScrollToSeasons = () => handleSmoothScrollTo(seasonsRibbonRef);
  const handleScrollToEpisodes = () => handleSmoothScrollTo(episodesRibbonRef);

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

  const handleTvshowWatchLaterToggle = useCallback((tvshowId: number, newStatus: boolean) => {
    if (!newStatus) {
      // Remove from watch later list
      setWatchLaterTvshowsList(prev => prev.filter(tvshow => tvshow.id !== tvshowId));
    }
  }, []);

  const handleSeasonWatchLaterToggle = useCallback((seasonId: number, newStatus: boolean) => {
    if (!newStatus) {
      // Remove from watch later list
      setWatchLaterSeasonsList(prev => prev.filter(season => season.id !== seasonId));
    }
  }, []);

  const handleEpisodeWatchLaterToggle = useCallback((episodeId: number, newStatus: boolean) => {
    if (!newStatus) {
      // Remove from watch later list
      setWatchLaterEpisodesList(prev => prev.filter(episode => episode.id !== episodeId));
    }
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
  }, [watchLaterMoviesList, watchLaterTvshowsList, watchLaterSeasonsList, watchLaterEpisodesList]);

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Watch Later Movies and TV Shows`,
      href: '/watch-later',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Watch Later Movies and TV Shows" />

      <div className="flex flex-col gap-y-10 py-5">
        {/* Content Summary */}
        <div className="px-5">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div 
              onClick={handleScrollToMovies}
              className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800 cursor-pointer hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors duration-200"
            >
              <h3 className="font-semibold text-blue-800 dark:text-blue-200">Movies</h3>
              <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{watchLaterMoviesList.length}</p>
            </div>
            
            <div 
              onClick={handleScrollToTvshows}
              className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800 cursor-pointer hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors duration-200"
            >
              <h3 className="font-semibold text-green-800 dark:text-green-200">TV Shows</h3>
              <p className="text-2xl font-bold text-green-600 dark:text-green-300">{watchLaterTvshowsList.length}</p>
            </div>
            
            <div 
              onClick={handleScrollToSeasons}
              className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800 cursor-pointer hover:bg-yellow-100 dark:hover:bg-yellow-900/30 transition-colors duration-200"
            >
              <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Seasons</h3>
              <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">{watchLaterSeasonsList.length}</p>
            </div>
            
            <div 
              onClick={handleScrollToEpisodes}
              className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800 cursor-pointer hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors duration-200"
            >
              <h3 className="font-semibold text-purple-800 dark:text-purple-200">Episodes</h3>
              <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">{watchLaterEpisodesList.length}</p>
            </div>
          </div>
        </div>

        {/* Movies */}
        {watchLaterMoviesList.length > 0 && (
          <div ref={moviesRibbonRef}>
            <MovieRibbon
              movies={watchLaterMoviesList}
              imgBaseUrl={imgBaseUrl}
              title={`Movies (${watchLaterMoviesList.length})`}
              ribbonId="watch-later-movies"
              onWatchLaterToggle={handleWatchLaterToggle}
              onLikeToggle={handleLikeToggle}
            />
          </div>
        )}

        {/* TV Shows */}
        {watchLaterTvshowsList.length > 0 && (
          <div ref={tvshowsRibbonRef}>
            <TvshowRibbon
              tvshows={watchLaterTvshowsList}
              imgBaseUrl={imgBaseUrl}
              title={`TV Shows (${watchLaterTvshowsList.length})`}
              ribbonId="watch-later-tvshows"
              onWatchLaterToggle={handleTvshowWatchLaterToggle}
              showCheckIcon={true}
            />
          </div>
        )}

        {/* Seasons */}
        {watchLaterSeasonsList.length > 0 && (
          <div ref={seasonsRibbonRef}>
            <SeasonRibbon
              seasons={watchLaterSeasonsList}
              imgBaseUrl={imgBaseUrl}
              title={`Seasons (${watchLaterSeasonsList.length})`}
              ribbonId="watch-later-seasons"
              onWatchLaterToggle={handleSeasonWatchLaterToggle}
              showCheckIcon={true}
            />
          </div>
        )}

        {/* Episodes */}
        {watchLaterEpisodesList.length > 0 && (
          <div ref={episodesRibbonRef}>
            <EpisodeRibbon
              episodes={watchLaterEpisodesList}
              imgBaseUrl={imgBaseUrl}
              title={`Episodes (${watchLaterEpisodesList.length})`}
              ribbonId="watch-later-episodes"
              onWatchLaterToggle={handleEpisodeWatchLaterToggle}
              showCheckIcon={true}
            />
          </div>
        )}

        {/* Empty state when no items */}
        {watchLaterMoviesList.length === 0 && 
        watchLaterTvshowsList.length === 0 && 
        watchLaterSeasonsList.length === 0 && 
        watchLaterEpisodesList.length === 0 && (
          <div className="flex items-center justify-center py-32 text-zinc-500 dark:text-zinc-400">
            <div className="text-center">
              <div className="text-6xl mb-4">📺</div>
              <h2 className="text-2xl font-bold mb-2">Your Watch Later List is Empty</h2>
              <p className="text-lg">Add movies, TV shows, seasons, or episodes to watch them later!</p>
            </div>
          </div>
        )}

      </div>
        
    </AppLayout>
  );
} 