import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
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

      {/* Content Summary */}
      <div className="px-5 py-3">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200">Movies</h3>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-300">{watchLaterMoviesList.length}</p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg border border-green-200 dark:border-green-800">
            <h3 className="font-semibold text-green-800 dark:text-green-200">TV Shows</h3>
            <p className="text-2xl font-bold text-green-600 dark:text-green-300">{watchLaterTvshowsList.length}</p>
          </div>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Seasons</h3>
            <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-300">{watchLaterSeasonsList.length}</p>
          </div>
          
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg border border-purple-200 dark:border-purple-800">
            <h3 className="font-semibold text-purple-800 dark:text-purple-200">Episodes</h3>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-300">{watchLaterEpisodesList.length}</p>
          </div>
        </div>
      </div>

      {/* Movies */}
      {watchLaterMoviesList.length > 0 && (
        <MovieRibbon
          movies={watchLaterMoviesList}
          imgBaseUrl={imgBaseUrl}
          title={`Watch Later Movies (${watchLaterMoviesList.length})`}
          ribbonId="watch-later-movies"
          onWatchLaterToggle={handleWatchLaterToggle}
          onLikeToggle={handleLikeToggle}
        />
      )}

      {/* TV Shows - Simple List for Now */}
      {watchLaterTvshowsList.length > 0 && (
        <div className="px-5 py-3">
          <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
            Watch Later TV Shows ({watchLaterTvshowsList.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {watchLaterTvshowsList.map((tvshow: any) => (
              <div key={tvshow.id} className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="font-semibold text-sm mb-2">{tvshow.name}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  {tvshow.first_air_date ? new Date(tvshow.first_air_date).getFullYear() : 'N/A'}
                </p>
                {tvshow.vote_average > 0 && (
                  <p className="text-xs text-yellow-600">★ {tvshow.vote_average.toFixed(1)}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Seasons - Simple List for Now */}
      {watchLaterSeasonsList.length > 0 && (
        <div className="px-5 py-3">
          <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
            Watch Later Seasons ({watchLaterSeasonsList.length})
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {watchLaterSeasonsList.map((season: any) => (
              <div key={season.id} className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="font-semibold text-sm mb-2">{season.name}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">Season {season.season_number}</p>
                {season.tvshow && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">from {season.tvshow.name}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Episodes - Simple List for Now */}
      {watchLaterEpisodesList.length > 0 && (
        <div className="px-5 py-3">
          <h2 className="text-xl font-bold mb-4 text-zinc-900 dark:text-zinc-100">
            Watch Later Episodes ({watchLaterEpisodesList.length})
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {watchLaterEpisodesList.map((episode: any) => (
              <div key={episode.id} className="bg-white dark:bg-zinc-800 rounded-lg p-4 shadow">
                <h3 className="font-semibold text-sm mb-2">{episode.name}</h3>
                <p className="text-xs text-zinc-600 dark:text-zinc-400">
                  S{episode.season_number}E{episode.episode_number}
                </p>
                {episode.tvshow && (
                  <p className="text-xs text-blue-600 dark:text-blue-400">from {episode.tvshow.name}</p>
                )}
              </div>
            ))}
          </div>
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
        
    </AppLayout>
  );
} 