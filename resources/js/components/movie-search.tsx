import { useState, useRef, useEffect, useCallback } from 'react';
import { Search, X, Film, Star, Calendar, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import axios from 'axios';
import { Link } from '@inertiajs/react';
import { LazyImage } from '@/components/ui/lazy-image';

interface MovieSearchResult {
  id: number;
  title: string;
  original_name: string;
  slug: string;
  poster_path?: string;
  poster_url?: string;
  release_date: string;
  vote_average: number;
  overview?: string;
  tagline?: string;
  is_watch_later: boolean;
  has_subtitles: boolean;
  subtitle_languages: string[];
}

interface MovieSearchProps {
  onClose?: () => void;
}

export function MovieSearch({ onClose }: MovieSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MovieSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [searchTimestamp, setSearchTimestamp] = useState<string | null>(null);
  const [resultTimestamps, setResultTimestamps] = useState<Map<string, string>>(new Map());
  
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Debounced search function
  const debouncedSearch = useCallback(async (searchQuery: string) => {
    if (searchQuery.length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.get('/api/movies/search', {
        params: { q: searchQuery, limit: 8 }
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

  // Handle input change with debounce
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setQuery(value);

    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    timeoutRef.current = setTimeout(() => {
      debouncedSearch(value);
    }, 300);
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
            trackClick(results[selectedIndex]);
            window.location.href = `/movie/${results[selectedIndex].slug}`;
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
  const trackClick = async (movie: MovieSearchResult) => {
    // Use the timestamp for the current query, fallback to general timestamp
    const relevantTimestamp = resultTimestamps.get(query) || searchTimestamp;
    if (!relevantTimestamp) return;
    
    try {
      await axios.post('/api/movies/search/track-click', {
        query: query,
        movie_id: movie.id,
        movie_title: movie.title,
        search_timestamp: relevantTimestamp,
      });
    } catch (error) {
      console.error('Failed to track search click:', error);
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-md">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          placeholder="Search movies..."
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
          {results.map((movie, index) => (
            <Link
              key={movie.id}
              href={`/movie/${movie.slug}`}
              className={`flex items-start gap-3 rounded-sm px-3 py-2 text-sm transition-colors ${
                index === selectedIndex
                  ? 'bg-accent text-accent-foreground'
                  : 'hover:bg-accent hover:text-accent-foreground'
              }`}
              onMouseEnter={() => setSelectedIndex(index)}
              onClick={() => {
                trackClick(movie);
                onClose && onClose();
              }}
            >
              {/* Movie Poster */}
              <div className="flex-shrink-0">
                {movie.poster_url ? (
                  <LazyImage
                    src={movie.poster_url}
                    alt={movie.title}
                    className="h-12 w-8 rounded object-cover"
                  />
                ) : (
                  <div className="flex h-12 w-8 items-center justify-center rounded bg-muted">
                    <Film className="h-4 w-4 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Movie Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{movie.title}</p>
                    {movie.original_name && movie.original_name !== movie.title && (
                      <p className="text-xs text-muted-foreground truncate">
                        {movie.original_name}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground flex-shrink-0">
                    {movie.vote_average > 0 && (
                      <>
                        <Star className="h-3 w-3 fill-current text-yellow-500" />
                        <span>{getRatingPercentage(movie.vote_average)}%</span>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                  {movie.release_date && (
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {getYear(movie.release_date)}
                    </span>
                  )}
                  {movie.has_subtitles && (
                    <span className="text-xs bg-muted px-1.5 py-0.5 rounded">CC</span>
                  )}
                </div>

                {movie.tagline && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                    {movie.tagline}
                  </p>
                )}
              </div>
            </Link>
          ))}

          {/* View All Results */}
          {results.length >= 8 && (
            <div className="border-t mt-1 pt-1">
              <Link
                href={`/movies?search=${encodeURIComponent(query)}`}
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
          <Film className="mx-auto h-8 w-8 mb-2 opacity-50" />
          <p>No movies found for "<span className="font-medium">{query}</span>"</p>
          <p className="text-xs mt-1">Try searching with a different term</p>
        </div>
      )}
    </div>
  );
} 