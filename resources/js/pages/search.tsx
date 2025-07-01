import { useState, useEffect, useCallback, useRef } from 'react';
import { Head, router } from '@inertiajs/react';
import AppLayout from '@/layouts/app-layout';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search as SearchIcon, X, Film, Tv, Loader2 } from 'lucide-react';
import { MovieRibbon } from '@/components/movie-ribbon';
import { TvshowRibbon } from '@/components/tvshow-ribbon';
import { SeasonRibbon } from '@/components/season-ribbon';
import { EpisodeRibbon } from '@/components/episode-ribbon';
import { api } from '@/lib/api';

interface Movie {
  id: number;
  title: string;
  original_name: string;
  slug: string;
  poster_path: string;
  poster_url: string;
  release_date: string;
  vote_average: number;
  overview: string;
  tagline: string;
  is_watch_later: boolean;
  is_liked: boolean;
  likes_count: number;
  has_subtitles: boolean;
  subtitle_languages: string[];
}

interface TvShow {
  id: number;
  name: string;
  original_name: string;
  slug: string;
  poster_path: string;
  poster_url: string;
  first_air_date: string;
  vote_average: number;
  overview: string;
  tagline: string;
  logo_url: string;
  seasons_count: number;
  likes_count: number;
  is_liked: boolean;
  is_watch_later: boolean;
}

interface Episode {
  type: 'episode';
  id: number;
  name: string;
  slug?: string;
  poster_url?: string;
  still_url?: string;
  overview?: string;
  air_date?: string;
  vote_average?: number;
  episode_number?: number;
  season_number?: number;
  tvshow_name?: string;
  tvshow_slug?: string;
  tvshow_poster_url?: string;
  display_text?: string;
  context_text?: string;
  relevance_score?: number;
  likes_count?: number;
  is_liked?: boolean;
  is_watch_later?: boolean;
}

interface Season {
  type: 'season';
  id: number;
  name: string;
  slug?: string;
  poster_url?: string;
  overview?: string;
  air_date?: string;
  vote_average?: number;
  season_number?: number;
  episode_count?: number;
  tvshow_id?: number;
  tvshow_name?: string;
  tvshow_slug?: string;
  tvshow_poster_url?: string;
  relevance_score?: number;
  likes_count?: number;
  is_liked?: boolean;
  is_watch_later?: boolean;
}

interface SearchState {
  query: string;
  movies: Movie[];
  tvshows: TvShow[];
  episodes: Episode[];
  seasons: Season[];
  isLoading: boolean;
  hasSearched: boolean;
  movieCount: number;
  tvshowCount: number;
  episodeCount: number;
  seasonCount: number;
}

export default function Search() {
  const [searchState, setSearchState] = useState<SearchState>({
    query: '',
    movies: [],
    tvshows: [],
    episodes: [],
    seasons: [],
    isLoading: false,
    hasSearched: false,
    movieCount: 0,
    tvshowCount: 0,
    episodeCount: 0,
    seasonCount: 0,
  });

  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchTimestampRef = useRef<string | null>(null);
  const searchStateRef = useRef(searchState);

  // Update the search state ref whenever search state changes
  useEffect(() => {
    searchStateRef.current = searchState;
  }, [searchState]);

  // Get initial query from URL params
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q') || '';
    if (query && query.length >= 2) {
      setSearchState(prev => ({ ...prev, query }));
      performSearch(query);
    }
  }, []);

  const performSearch = useCallback(async (query: string) => {
    if (query.length < 2) {
      setSearchState(prev => ({
        ...prev,
        movies: [],
        tvshows: [],
        episodes: [],
        seasons: [],
        hasSearched: false,
        movieCount: 0,
        tvshowCount: 0,
        episodeCount: 0,
        seasonCount: 0,
      }));
      return;
    }

    setSearchState(prev => ({ ...prev, isLoading: true }));

    // Store search timestamp for click tracking
    const searchTimestamp = new Date().toISOString();
    searchTimestampRef.current = searchTimestamp;
    
    try {
      // Search both movies and tvshows simultaneously
      const [movieResponse, tvshowResponse] = await Promise.all([
        api.get(`/api/movies/search?q=${encodeURIComponent(query)}&limit=50&log=false`),
        api.get(`/api/tvshows/search?q=${encodeURIComponent(query)}&limit=50&log=false`)
      ]);

      if (movieResponse.ok && tvshowResponse.ok) {
        const movies = movieResponse.data.results || [];
        const tvshowResults = tvshowResponse.data.results || [];

        // Separate tvshow results by type and transform data structure
        const tvshows = tvshowResults.filter((item: any) => item.type === 'tvshow');

        // Transform episodes to match EpisodeCard expected structure
        const episodes = tvshowResults
          .filter((item: any) => item.type === 'episode')
          .map((episode: any) => ({
            ...episode,
            tvshow: episode.tvshow_slug ? {
              name: episode.tvshow_name,
              slug: episode.tvshow_slug
            } : undefined,
            still_path: episode.still_url ? episode.still_url.replace('https://image.tmdb.org/t/p/w300', '') : null,
          }));

        // Transform seasons to match SeasonCard expected structure  
        const seasons = tvshowResults
          .filter((item: any) => item.type === 'season')
          .map((season: any) => ({
            ...season,
            tvshow: season.tvshow_slug ? {
              name: season.tvshow_name,
              slug: season.tvshow_slug
            } : undefined,
            poster_path: season.poster_url ? season.poster_url.replace('https://image.tmdb.org/t/p/w300', '') : null,
          }));

        setSearchState(prev => ({
          ...prev,
          movies,
          tvshows,
          episodes,
          seasons,
          hasSearched: true,
          movieCount: movies.length,
          tvshowCount: tvshows.length,
          episodeCount: episodes.length,
          seasonCount: seasons.length,
        }));

        // Log the search immediately with the same timestamp used for click tracking
        // This ensures search records exist when users click quickly
        if (query.length >= 3) {
          logSearch(query, searchTimestamp);
        }

        // Update URL without causing a page reload
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.set('q', query);
        window.history.replaceState({}, '', newUrl.toString());
      }
    } catch (error) {
      console.error('Search error:', error);
      setSearchState(prev => ({
        ...prev,
        movies: [],
        tvshows: [],
        episodes: [],
        seasons: [],
        hasSearched: true,
        movieCount: 0,
        tvshowCount: 0,
        episodeCount: 0,
        seasonCount: 0,
      }));
    } finally {
      setSearchState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  const logSearch = useCallback(async (query: string, timestamp?: string) => {
    if (query.length < 3) return;

    const searchTimestamp = timestamp || new Date().toISOString();

    try {
      // Log searches for both movies and tvshows with the same timestamp
      await Promise.all([
        api.post('/api/movies/search/log', {
          query,
          timestamp: searchTimestamp
        }),
        api.post('/api/tvshows/search/log', {
          query,
          timestamp: searchTimestamp
        })
      ]);
    } catch (error) {
      console.error('Failed to log search:', error);
    }
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchState(prev => ({ ...prev, query: value }));

    // Clear existing timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    // Fast search for UI responsiveness (300ms)
    // Logging will happen immediately when search results are returned
    searchTimeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);
  };

  const handleClear = () => {
    setSearchState({
      query: '',
      movies: [],
      tvshows: [],
      episodes: [],
      seasons: [],
      isLoading: false,
      hasSearched: false,
      movieCount: 0,
      tvshowCount: 0,
      episodeCount: 0,
      seasonCount: 0,
    });
    inputRef.current?.focus();

    // Clear URL params
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete('q');
    window.history.replaceState({}, '', newUrl.toString());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      handleClear();
    }
  };

  // Handle movie watch later toggle
  const handleMovieWatchLaterToggle = (movieId: number, newStatus: boolean) => {
    setSearchState(prev => ({
      ...prev,
      movies: prev.movies.map(movie =>
        movie.id === movieId
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    }));
  };

  // Handle movie like toggle
  const handleMovieLikeToggle = (movieId: number, newStatus: boolean, newCount: number) => {
    setSearchState(prev => ({
      ...prev,
      movies: prev.movies.map(movie =>
        movie.id === movieId
          ? { ...movie, is_liked: newStatus, likes_count: newCount }
          : movie
      )
    }));
  };

  // Handle tvshow watch later toggle
  const handleTvshowWatchLaterToggle = (tvshowId: number, newStatus: boolean) => {
    setSearchState(prev => ({
      ...prev,
      tvshows: prev.tvshows.map(tvshow =>
        tvshow.id === tvshowId
          ? { ...tvshow, is_watch_later: newStatus }
          : tvshow
      )
    }));
  };

  // Handle tvshow like toggle
  const handleTvshowLikeToggle = (tvshowId: number, newStatus: boolean, newCount: number) => {
    setSearchState(prev => ({
      ...prev,
      tvshows: prev.tvshows.map(tvshow =>
        tvshow.id === tvshowId
          ? { ...tvshow, is_liked: newStatus, likes_count: newCount }
          : tvshow
      )
    }));
  };

  // Handle episode watch later toggle
  const handleEpisodeWatchLaterToggle = (episodeId: number, newStatus: boolean) => {
    setSearchState(prev => ({
      ...prev,
      episodes: prev.episodes.map(episode =>
        episode.id === episodeId
          ? { ...episode, is_watch_later: newStatus }
          : episode
      )
    }));
  };

  // Handle season watch later toggle
  const handleSeasonWatchLaterToggle = (seasonId: number, newStatus: boolean) => {
    setSearchState(prev => ({
      ...prev,
      seasons: prev.seasons.map(season =>
        season.id === seasonId
          ? { ...season, is_watch_later: newStatus }
          : season
      )
    }));
  };

  // Unified click tracking with cross-table cleanup
  const trackSearchClickWithData = async (resultType: 'movie' | 'tvshow' | 'episode' | 'season', resultData: any, query: string, timestamp: string) => {

    if (!timestamp || !query) {
      console.error('❌ Missing timestamp or query:', { 
        timestamp, 
        query 
      });
      return;
    }

    try {
      if (resultType === 'movie') {
        console.log('🎬 Tracking movie click');
        // Track movie click and cleanup tvshow search record
        const requests = [
          api.post('/api/movies/search/track-click', {
            query: query,
            movie_id: resultData.id,
            movie_title: resultData.title,
            search_timestamp: timestamp,
          }),
          // Remove the unused tvshow search record
          api.delete(`/api/tvshows/search/cleanup?query=${encodeURIComponent(query)}&timestamp=${timestamp}`)
        ];
        
        const results = await Promise.all(requests);
        console.log('✅ Movie tracking completed:', results);
      } else {
        
        // Track tvshow/episode/season click and cleanup movie search record
        const requests = [
          api.post('/api/tvshows/search/track-click', {
            query: query,
            result_type: resultType,
            result_data: resultData,
            search_timestamp: timestamp,
          }),
          // Remove the unused movie search record
          api.delete(`/api/movies/search/cleanup?query=${encodeURIComponent(query)}&timestamp=${timestamp}`)
        ];
        
        const results = await Promise.all(requests);
      }
    } catch (error) {
      console.error('❌ Failed to track search click:', error);
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as any;
        console.error('📋 Error response:', axiosError.response?.data);
        console.error('📊 Error status:', axiosError.response?.status);
      }
    }
  };

  // Direct click handlers that bypass global listener issues
  const handleDirectEpisodeClick = async (episode: any) => {
    
    if (!searchState.query || !searchTimestampRef.current) {
      // Use a more modern notification system if available, like Sonner
      // toast.error('Missing search context. Please search again.');
      alert('❌ Missing search context - please search again first');
      return;
    }

    try {
      // Show a loading indicator
      // toast.loading('Tracking click...');
      
      await trackSearchClickWithData('episode', episode, searchState.query, searchTimestampRef.current);
      
      // toast.success('Click tracked successfully! Navigating...');
      
      // Navigate to the episode using Inertia's router for SPA navigation
      if (episode.tvshow_slug) {
        const url = `/tvshow/${episode.tvshow_slug}?season=${episode.season_number}&episode=${episode.episode_number}&autoplay=true`;
        router.visit(url);
      }
    } catch (error) {
      // toast.error('Failed to track episode click: ' + (error as Error).message);
      console.error('Episode click tracking error:', error);
      alert('❌ Failed to track episode click: ' + (error as Error).message);
    }
  };

  const handleDirectSeasonClick = async (season: any) => {
    console.log('🎯 Direct season click handler called', { season, query: searchState.query, timestamp: searchTimestampRef.current });
    
    if (!searchState.query || !searchTimestampRef.current) {
      // Use a more modern notification system if available, like Sonner
      // toast.error('Missing search context. Please search again.');
      alert('❌ Missing search context - please search again first');
      return;
    }

    try {
      // Show a loading indicator
      // toast.loading('Tracking click...');
      
      await trackSearchClickWithData('season', season, searchState.query, searchTimestampRef.current);
      
      // toast.success('Click tracked successfully! Navigating...');
      
      // Navigate to the season using Inertia's router
      if (season.tvshow_slug) {
        const url = `/tvshow/${season.tvshow_slug}?season=${season.season_number}`;
        router.visit(url);
      }
    } catch (error) {
      // toast.error('Failed to track season click: ' + (error as Error).message);
      console.error('Season click tracking error:', error);
      alert('❌ Failed to track season click: ' + (error as Error).message);
    }
  };

  const handleDirectMovieClick = async (movie: any) => {
    if (!searchState.query || !searchTimestampRef.current) {
      alert('❌ Missing search context - please search again first');
      return;
    }

    try {
      await trackSearchClickWithData('movie', movie, searchState.query, searchTimestampRef.current);
      
      if (movie.slug) {
        router.visit(`/movie/${movie.slug}`);
      }
    } catch (error) {
      console.error('Movie click tracking error:', error);
      alert('❌ Failed to track movie click: ' + (error as Error).message);
    }
  };

  // Cleanup timeouts
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, []);

  const totalResults = searchState.movieCount + searchState.tvshowCount + searchState.episodeCount + searchState.seasonCount;

  return (
    <AppLayout>
      <Head title="Search" />

      <div className="container mx-auto px-4 py-8 max-w-7xl">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-4">
            <SearchIcon className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Search Movies & TV Shows</h1>
          </div>
          <p className="text-muted-foreground">
            Search through our extensive collection of movies and TV shows
          </p>
        </div>

        {/* Search Input */}
        <div className="relative mb-8">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search for movies, TV shows, episodes, seasons..."
              value={searchState.query}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              className="pl-10 pr-12 h-12 text-lg"
              autoFocus
            />
            {searchState.query && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleClear}
                className="absolute right-2 top-1/2 transform -translate-y-1/2 h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
          {searchState.isLoading && (
            <div className="absolute right-12 top-1/2 transform -translate-y-1/2">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}
        </div>

        {/* Search Results Summary */}
        {searchState.hasSearched && searchState.query && (
          <div className="mb-6">
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>
                Search results for "<span className="font-medium text-foreground">{searchState.query}</span>"
              </span>
              <span>•</span>
              <span>{totalResults} total results</span>
              {searchState.movieCount > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Film className="h-4 w-4" />
                    <span>{searchState.movieCount} movies</span>
                  </div>
                </>
              )}
              {searchState.tvshowCount > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Tv className="h-4 w-4" />
                    <span>{searchState.tvshowCount} TV shows</span>
                  </div>
                </>
              )}
              {searchState.episodeCount > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Film className="h-4 w-4" />
                    <span>{searchState.episodeCount} episodes</span>
                  </div>
                </>
              )}
              {searchState.seasonCount > 0 && (
                <>
                  <span>•</span>
                  <div className="flex items-center gap-1">
                    <Tv className="h-4 w-4" />
                    <span>{searchState.seasonCount} seasons</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* No Results Message */}
        {searchState.hasSearched && searchState.query && totalResults === 0 && !searchState.isLoading && (
          <div className="text-center py-12">
            <SearchIcon className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-xl font-semibold mb-2">No results found</h3>
            <p className="text-muted-foreground mb-4">
              No movies or TV shows found for "<span className="font-medium">{searchState.query}</span>"
            </p>
            <p className="text-sm text-muted-foreground">
              Try different keywords or check your spelling
            </p>
          </div>
        )}

        {/* Search Results */}
        {searchState.hasSearched && (
          <div className="space-y-8">
            {/* Movies Results */}
            {searchState.movieCount > 0 && (
              <div>
                <MovieRibbon
                  movies={searchState.movies}
                  imgBaseUrl="https://image.tmdb.org/t/p/w300"
                  title={`Movies (${searchState.movieCount})`}
                  ribbonId="search-movies"
                  onWatchLaterToggle={handleMovieWatchLaterToggle}
                  onLikeToggle={handleMovieLikeToggle}
                  onMovieClick={handleDirectMovieClick}
                  hideSortOptions={['added']} // Hide 'added' sort for search results
                />
              </div>
            )}

            {/* TV Shows Results */}
            {searchState.tvshowCount > 0 && (
              <div>
                <TvshowRibbon
                  tvshows={searchState.tvshows}
                  imgBaseUrl="https://image.tmdb.org/t/p/w300"
                  title={`TV Shows (${searchState.tvshowCount})`}
                  ribbonId="search-tvshows"
                  onWatchLaterToggle={handleTvshowWatchLaterToggle}
                  onLikeToggle={handleTvshowLikeToggle}
                  hideSortOptions={['added']} // Hide 'added' sort for search results
                />
              </div>
            )}

                         {/* Episodes Results */}
             {searchState.episodeCount > 0 && (
               <div>
                 <EpisodeRibbon
                   episodes={searchState.episodes}
                   imgBaseUrl="https://image.tmdb.org/t/p/w300"
                   title={`Episodes (${searchState.episodeCount})`}
                   ribbonId="search-episodes"
                   onWatchLaterToggle={handleEpisodeWatchLaterToggle}
                   onEpisodeClick={handleDirectEpisodeClick}
                 />
               </div>
             )}

            {/* Seasons Results */}
            {searchState.seasonCount > 0 && (
              <div>
                <SeasonRibbon
                  seasons={searchState.seasons}
                  imgBaseUrl="https://image.tmdb.org/t/p/w300"
                  title={`Seasons (${searchState.seasonCount})`}
                  ribbonId="search-seasons"
                  onWatchLaterToggle={handleSeasonWatchLaterToggle}
                />
              </div>
            )}
          </div>
        )}

        {/* Initial State - Show helpful message when no search has been performed */}
        {!searchState.hasSearched && !searchState.query && (
          <div className="text-center py-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <Film className="h-12 w-12 text-muted-foreground" />
              <Tv className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-xl font-semibold mb-2">Start searching</h3>
            <p className="text-muted-foreground">
              Enter a search term above to find movies and TV shows
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}