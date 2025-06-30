import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Tv, Star, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { Link, usePage } from '@inertiajs/react';
import { LazyImage } from '@/components/ui/lazy-image';
import { type SharedData } from '@/types';

interface TvshowSearchResult {
  type: 'tvshow' | 'episode' | 'season';
  id: number;
  name: string;
  original_name?: string;
  slug?: string;
  poster_path?: string;
  poster_url?: string;
  first_air_date?: string;
  vote_average?: number;
  overview?: string;
  tagline?: string;
  logo_url?: string;
  seasons_count?: number;
  
  // Episode specific fields
  episode_number?: number;
  still_path?: string;
  still_url?: string;
  air_date?: string;
  season_id?: number;
  season_name?: string;
  season_number?: number;
  display_text?: string;
  context_text?: string;
  
  // Season specific fields
  episode_count?: number;
  
  // Common parent TV show fields for episodes and seasons
  tvshow_id?: number;
  tvshow_name?: string;
  tvshow_slug?: string;
  tvshow_poster_url?: string;
  tvshow_logo_url?: string;
}

interface TvshowSearchProps {
  onClose?: () => void;
}

export function TvshowSearch({ onClose }: TvshowSearchProps) {
  const { auth } = usePage<SharedData>().props;
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TvshowSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchTimestamp, setSearchTimestamp] = useState<string | null>(null);
  const [resultTimestamps, setResultTimestamps] = useState<Map<string, string>>(new Map());
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loggingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Fast search function (no logging)
  const performSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get('/api/tvshows/search', {
        params: { q: searchQuery, limit: 8, log: 'false' } // Don't log this search
      });
      
      if (response.data.success) {
        setResults(response.data.results);
        setIsOpen(true);
        setSelectedIndex(-1);
        const timestamp = new Date().toISOString();
        setSearchTimestamp(timestamp);
        
        // Store timestamp for each result based on the query
        const newTimestamps = new Map(resultTimestamps);
        newTimestamps.set(searchQuery, timestamp);
        setResultTimestamps(newTimestamps);
      }
    } catch (error) {
      console.error('Search error:', error);
      setResults([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Log search after user stops typing (separate from search)
  const logSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 3 || !auth?.user) return; // Only log meaningful searches for authenticated users
    
    try {
      await axios.post('/api/tvshows/search/log', {
        query: searchQuery,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Failed to log search:', error);
    }
  }, [auth?.user]);

  // Handle input change with dual debounce (fast search + delayed logging)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    // Clear existing timeouts
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (loggingTimeoutRef.current) {
      clearTimeout(loggingTimeoutRef.current);
    }

    // Fast search for UI responsiveness (300ms)
    timeoutRef.current = setTimeout(() => {
      performSearch(value);
    }, 300);

    // Delayed logging when user stops typing (1500ms)
    loggingTimeoutRef.current = setTimeout(() => {
      logSearch(value);
    }, 1500);
  };

  // Handle keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) return;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        setSelectedIndex(prev => (prev < results.length - 1 ? prev + 1 : -1));
        break;
      case 'ArrowUp':
        e.preventDefault();
        setSelectedIndex(prev => (prev > -1 ? prev - 1 : results.length - 1));
        break;
      case 'Enter':
        e.preventDefault();
        if (selectedIndex >= 0 && results[selectedIndex]) {
          const selectedResult = results[selectedIndex];
          trackClick(selectedResult);
          window.location.href = getLinkUrl(selectedResult);
        }
        break;
      case 'Escape':
        setIsOpen(false);
        setSelectedIndex(-1);
        inputRef.current?.blur();
        break;
    }
  };

  // Clear search
  const handleClear = () => {
    setQuery('');
    setResults([]);
    setIsOpen(false);
    setSelectedIndex(-1);
    inputRef.current?.focus();
  };

  // Handle click outside to close
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      if (loggingTimeoutRef.current) {
        clearTimeout(loggingTimeoutRef.current);
      }
    };
  }, []);

  // Format release year
  const getYear = (dateString: string) => {
    return dateString ? new Date(dateString).getFullYear() : '';
  };

  // Format rating percentage
  const getRatingPercentage = (rating: number) => {
    return Math.round(rating * 10);
  };

  // Track click on search result
  const trackClick = async (result: TvshowSearchResult) => {
    // Only track clicks for authenticated users
    if (!auth?.user) return;
    
    // Use the timestamp for the current query, fallback to general timestamp
    const relevantTimestamp = resultTimestamps.get(query) || searchTimestamp;
    if (!relevantTimestamp) {
      console.warn('No search timestamp available for click tracking');
      return;
    }
    
    console.log('Tracking TV show search click:', {
      query: query,
      result_type: result.type,
      result_id: result.id,
      result_name: result.name,
      search_timestamp: relevantTimestamp,
    });
    
    try {
      const response = await axios.post('/api/tvshows/search/track-click', {
        query: query,
        result_type: result.type,
        result_data: result, // Send the full result object
        search_timestamp: relevantTimestamp,
      });
      
      console.log('Click tracking response:', response.data);
    } catch (error) {
      console.error('Failed to track search click:', error);
      // Log additional details for debugging
      if (axios.isAxiosError(error)) {
        console.error('Response data:', error.response?.data);
        console.error('Response status:', error.response?.status);
      }
    }
  };

  // Get the appropriate link URL for different result types
  const getLinkUrl = (result: TvshowSearchResult) => {
    switch (result.type) {
      case 'tvshow':
        return `/tvshow/${result.slug}`;
      case 'episode':
        return `/tvshow/${result.tvshow_slug}?season=${result.season_number}&episode=${result.episode_number}`;
      case 'season':
        return `/tvshow/${result.tvshow_slug}?season=${result.season_number}`;
      default:
        return '#';
    }
  };

  // Get the poster URL for different result types
  const getPosterUrl = (result: TvshowSearchResult) => {
    switch (result.type) {
      case 'tvshow':
        return result.poster_url;
      case 'episode':
        return result.still_url || result.tvshow_poster_url;
      case 'season':
        return result.poster_url || result.tvshow_poster_url;
      default:
        return null;
    }
  };

  // Get display name for different result types
  const getDisplayName = (result: TvshowSearchResult) => {
    switch (result.type) {
      case 'tvshow':
        return result.name;
      case 'episode':
        return result.display_text || result.name;
      case 'season':
        return result.display_text || result.name;
      default:
        return result.name;
    }
  };

  // Get the context text for episodes and seasons
  const getContextText = (result: TvshowSearchResult) => {
    if (result.type === 'episode' || result.type === 'season') {
      return result.context_text;
    }
    return null;
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search TV shows, episodes & seasons..."
          value={query}
          onChange={handleInputChange}
          onKeyDown={handleKeyDown}
          className="pl-9 pr-9 h-9"
          autoComplete="off"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            onClick={handleClear}
            className="absolute right-1 top-1/2 h-7 w-7 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3" />
          </Button>
        )}
        {isLoading && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-foreground"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {isOpen && results.length > 0 && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-96 overflow-y-auto rounded-md border bg-popover p-1 text-popover-foreground shadow-md">
          {results.map((result, index) => {
            const posterUrl = getPosterUrl(result);
            const displayName = getDisplayName(result);
            const contextText = getContextText(result);
            const linkUrl = getLinkUrl(result);
            
            return (
              <Link
                key={`${result.type}-${result.id}`}
                href={linkUrl}
                className={`flex items-start gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                  index === selectedIndex
                    ? 'bg-accent text-accent-foreground'
                    : 'hover:bg-accent hover:text-accent-foreground'
                }`}
                onMouseEnter={() => setSelectedIndex(index)}
                onClick={async (e) => {
                  e.preventDefault();
                  
                  // Track the click first
                  await trackClick(result);
                  
                  // Then navigate
                  window.location.href = linkUrl;
                  
                  // Close the search if callback provided
                  onClose && onClose();
                }}
              >
                {/* Result Image/Poster */}
                <div className="flex-shrink-0">
                  {posterUrl ? (
                    <LazyImage
                      src={posterUrl}
                      alt={displayName}
                      className={`${result.type === 'episode' ? 'h-8 w-12' : 'h-12 w-8'} rounded object-cover`}
                    />
                  ) : (
                    <div className={`flex ${result.type === 'episode' ? 'h-8 w-12' : 'h-12 w-8'} items-center justify-center rounded bg-muted`}>
                      <Tv className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>

                {/* Result Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm truncate">{displayName}</p>
                        {result.type !== 'tvshow' && (
                          <span className="text-xs bg-muted px-1.5 py-0.5 rounded capitalize">
                            {result.type}
                          </span>
                        )}
                      </div>
                      
                      {contextText && (
                        <p className="text-xs text-muted-foreground truncate">
                          {contextText}
                        </p>
                      )}
                      
                      {result.type === 'tvshow' && result.original_name && result.original_name !== result.name && (
                        <p className="text-xs text-muted-foreground truncate">
                          {result.original_name}
                        </p>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                      {result.vote_average && result.vote_average > 0 && (
                        <>
                          <Star className="h-3 w-3 fill-current text-yellow-500" />
                          <span>{getRatingPercentage(result.vote_average)}%</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    {result.type === 'tvshow' && result.first_air_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {getYear(result.first_air_date)}
                      </span>
                    )}
                    
                    {result.type === 'episode' && result.air_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {getYear(result.air_date)}
                      </span>
                    )}
                    
                    {result.type === 'season' && result.air_date && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {getYear(result.air_date)}
                      </span>
                    )}
                    
                    {result.type === 'tvshow' && result.seasons_count && result.seasons_count > 0 && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {result.seasons_count} {result.seasons_count === 1 ? 'Season' : 'Seasons'}
                      </span>
                    )}
                    
                    {result.type === 'season' && result.episode_count && result.episode_count > 0 && (
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">
                        {result.episode_count} {result.episode_count === 1 ? 'Episode' : 'Episodes'}
                      </span>
                    )}
                  </div>

                  {result.type === 'tvshow' && result.tagline && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {result.tagline}
                    </p>
                  )}
                  
                  {(result.type === 'episode' || result.type === 'season') && result.overview && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                      {result.overview}
                    </p>
                  )}
                </div>
              </Link>
            );
          })}

          {/* View All Results */}
          {results.length >= 8 && (
            <div className="border-t mt-1 pt-1">
              <Link
                href={`/search?q=${encodeURIComponent(query)}`}
                className="flex items-center justify-center gap-2 rounded-sm px-3 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                onClick={() => onClose && onClose()}
              >
                <Search className="h-3 w-3" />
                View all results for "<span className="font-medium">{query}</span>"
              </Link>
            </div>
          )}
        </div>
      )}

      {/* No Results */}
      {isOpen && results.length === 0 && query.length >= 2 && !isLoading && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border bg-popover p-4 text-center text-sm text-muted-foreground shadow-md">
          <Tv className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No TV shows, episodes, or seasons found for "<span className="font-medium">{query}</span>"</p>
          <p className="text-xs mt-1">Try searching with a different term</p>
        </div>
      )}
    </div>
  );
} 