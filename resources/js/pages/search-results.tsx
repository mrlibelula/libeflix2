import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { LazyImage } from '@/components/ui/lazy-image';
import { LoveCircleButton } from '@/components/ui/love-circle-button';
import { AddCircleButton } from '@/components/ui/add-circle-button';
import { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { Star, Calendar, Tv, PlayCircle, Film } from 'lucide-react';

interface SearchResult {
  type: 'tvshow' | 'episode' | 'season';
  id: number;
  name: string;
  slug?: string;
  poster_url?: string;
  still_url?: string;
  overview?: string;
  first_air_date?: string;
  air_date?: string;
  vote_average?: number;
  episode_number?: number;
  season_number?: number;
  tvshow_name?: string;
  tvshow_slug?: string;
  tvshow_poster_url?: string;
  display_text?: string;
  context_text?: string;
  seasons_count?: number;
  episode_count?: number;
  relevance_score?: number;
  // TV show specific fields for likes/watch later
  likes_count?: number;
  is_liked?: boolean;
  is_watch_later?: boolean;
}

interface SearchResultsProps {
  results: SearchResult[];
  searchQuery: string;
  totalCount: number;
  breakdown: {
    tvshows: number;
    episodes: number;
    seasons: number;
  };
}

export default function SearchResults({ results, searchQuery, totalCount, breakdown }: SearchResultsProps) {
  const { props } = usePage<{ 
    csrf_token?: string;
    auth?: {
      user?: any;
    };
  }>();
  
  const isAuthenticated = !!props.auth?.user;
  
  // State for tracking likes and watch later status for TV shows
  const [tvshowStates, setTvshowStates] = useState<Record<number, {
    isLiked: boolean;
    likesCount: number;
    isLikeToggling: boolean;
    isLikeAnimating: boolean;
    isWatchLater: boolean;
    isWatchLaterToggling: boolean;
    isWatchLaterAnimating: boolean;
  }>>({});
  
  // Initialize states from tvshow props
  useEffect(() => {
    const initialStates: typeof tvshowStates = {};
    results.forEach((result) => {
      if (result.type === 'tvshow') {
        initialStates[result.id] = {
          isLiked: result.is_liked || false,
          likesCount: result.likes_count || 0,
          isLikeToggling: false,
          isLikeAnimating: false,
          isWatchLater: result.is_watch_later || false,
          isWatchLaterToggling: false,
          isWatchLaterAnimating: false,
        };
      }
    });
    setTvshowStates(initialStates);
  }, [results]);
  
  // Function to handle like toggle for TV shows
  const handleLikeToggle = async (result: SearchResult, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      const currentUrl = window.location.pathname + window.location.search;
      router.visit('/login' + '?redirect=' + encodeURIComponent(currentUrl));
      return;
    }
    
    const currentState = tvshowStates[result.id];
    if (!currentState || currentState.isLikeToggling) return;
    
    setTvshowStates(prev => ({
      ...prev,
      [result.id]: {
        ...prev[result.id],
        isLikeToggling: true,
        isLikeAnimating: true,
      }
    }));
    
    try {
      const response = currentState.isLiked 
        ? await api.delete(`/api/tvshows/${result.slug}/like`)
        : await api.post(`/api/tvshows/${result.slug}/like`);
      
      if (response.ok) {
        setTimeout(() => {
          setTvshowStates(prev => ({
            ...prev,
            [result.id]: {
              ...prev[result.id],
              isLiked: response.data.is_liked,
              likesCount: response.data.likes_count,
            }
          }));
        }, 150);
        
        setTimeout(() => {
          setTvshowStates(prev => ({
            ...prev,
            [result.id]: {
              ...prev[result.id],
              isLikeAnimating: false,
            }
          }));
        }, 300);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setTvshowStates(prev => ({
        ...prev,
        [result.id]: {
          ...prev[result.id],
          isLikeToggling: false,
        }
      }));
    }
  };
  
  // Function to handle watch later toggle for TV shows
  const handleWatchLaterToggle = async (result: SearchResult, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (!isAuthenticated) {
      const currentUrl = window.location.pathname + window.location.search;
      router.visit('/login' + '?redirect=' + encodeURIComponent(currentUrl));
      return;
    }
    
    const currentState = tvshowStates[result.id];
    if (!currentState || currentState.isWatchLaterToggling) return;
    
    setTvshowStates(prev => ({
      ...prev,
      [result.id]: {
        ...prev[result.id],
        isWatchLaterToggling: true,
        isWatchLaterAnimating: true,
      }
    }));
    
    try {
      const response = await api.post(`/api/tvshows/${result.slug}/toggle-watch-later`);
      
      if (response.ok) {
        setTimeout(() => {
          setTvshowStates(prev => ({
            ...prev,
            [result.id]: {
              ...prev[result.id],
              isWatchLater: response.data.is_watch_later,
            }
          }));
        }, 150);
        
        setTimeout(() => {
          setTvshowStates(prev => ({
            ...prev,
            [result.id]: {
              ...prev[result.id],
              isWatchLaterAnimating: false,
            }
          }));
        }, 300);
      }
    } catch (error) {
      console.error('Error toggling watch later:', error);
    } finally {
      setTvshowStates(prev => ({
        ...prev,
        [result.id]: {
          ...prev[result.id],
          isWatchLaterToggling: false,
        }
      }));
    }
  };

  // Format rating percentage
  const getRatingPercentage = (rating: number) => {
    return Math.round(rating * 10);
  };

  // Get year from date string
  const getYear = (dateString: string) => {
    return dateString ? new Date(dateString).getFullYear() : '';
  };

  // Get the appropriate link URL for different result types
  const getLinkUrl = (result: SearchResult) => {
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

  // Get the appropriate image URL for different result types
  const getImageUrl = (result: SearchResult) => {
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

  // Get result type icon
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'tvshow':
        return <Tv className="h-4 w-4" />;
      case 'episode':
        return <PlayCircle className="h-4 w-4" />;
      case 'season':
        return <Film className="h-4 w-4" />;
      default:
        return <Tv className="h-4 w-4" />;
    }
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Search Results (${totalCount}) - "${searchQuery}"`,
      href: `/search?q=${encodeURIComponent(searchQuery)}`,
    },
  ];

  if (!searchQuery || searchQuery.length < 2) {
    return (
      <AppLayout breadcrumbs={breadcrumbs}>
        <Head title="Search Results" />
        <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-5">
          <div className="text-center py-20">
            <Tv className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-2xl font-bold mb-2">Search TV Shows, Episodes & Seasons</h2>
            <p className="text-muted-foreground">Enter a search term to find content across our entire collection.</p>
          </div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Search: "${searchQuery}"`} />
      
      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-5">
        {/* Search Summary */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">
            Search results for: "<span className="text-rose-500">{searchQuery}</span>"
          </h1>
          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
            <span>Found {totalCount} total results</span>
            {breakdown.tvshows > 0 && <span>{breakdown.tvshows} TV shows</span>}
            {breakdown.episodes > 0 && <span>{breakdown.episodes} episodes</span>}
            {breakdown.seasons > 0 && <span>{breakdown.seasons} seasons</span>}
          </div>
        </div>

        {/* No Results */}
        {totalCount === 0 && (
          <div className="text-center py-20">
            <Tv className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
            <h2 className="text-xl font-semibold mb-2">No results found</h2>
            <p className="text-muted-foreground mb-4">
              We couldn't find any TV shows, episodes, or seasons matching "{searchQuery}".
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Try adjusting your search terms or browse all content:</p>
              <div className="flex gap-4 justify-center mt-3">
                <Link href="/tvshows" className="text-rose-500 hover:underline">
                  Browse TV Shows
                </Link>
                <Link href="/movies" className="text-rose-500 hover:underline">
                  Browse Movies
                </Link>
              </div>
            </div>
          </div>
        )}

        {/* Search Results Grid */}
        {totalCount > 0 && (
          <div className="grid gap-6">
            {results.map((result) => {
              const imageUrl = getImageUrl(result);
              const linkUrl = getLinkUrl(result);
              const currentState = result.type === 'tvshow' ? tvshowStates[result.id] : null;
              
              return (
                <div
                  key={`${result.type}-${result.id}`}
                  className="flex gap-4 p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                >
                  {/* Result Image */}
                  <div className="flex-shrink-0">
                    <Link href={linkUrl}>
                      {imageUrl ? (
                        <LazyImage
                          src={imageUrl}
                          alt={result.name}
                          className={`rounded object-cover ${
                            result.type === 'episode' ? 'w-24 h-14' : 'w-16 h-24'
                          }`}
                        />
                      ) : (
                        <div className={`flex items-center justify-center rounded bg-muted ${
                          result.type === 'episode' ? 'w-24 h-14' : 'w-16 h-24'
                        }`}>
                          {getTypeIcon(result.type)}
                        </div>
                      )}
                    </Link>
                  </div>

                  {/* Result Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <Link href={linkUrl} className="block group">
                          <div className="flex items-center gap-2 mb-1">
                            <h3 className="font-semibold text-lg group-hover:text-rose-500 transition-colors truncate">
                              {result.display_text || result.name}
                            </h3>
                            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-muted rounded-full capitalize">
                              {getTypeIcon(result.type)}
                              {result.type}
                            </span>
                          </div>
                          
                          {result.context_text && (
                            <p className="text-sm text-muted-foreground mb-1">
                              {result.context_text}
                            </p>
                          )}
                          
                          {result.overview && (
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                              {result.overview}
                            </p>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            {result.vote_average && result.vote_average > 0 && (
                              <span className="flex items-center gap-1">
                                <Star className="h-3 w-3 fill-current text-yellow-500" />
                                {getRatingPercentage(result.vote_average)}%
                              </span>
                            )}
                            
                            {(result.first_air_date || result.air_date) && (
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {getYear(result.first_air_date || result.air_date!)}
                              </span>
                            )}
                            
                            {result.seasons_count && result.seasons_count > 0 && (
                              <span className="px-2 py-1 bg-muted rounded">
                                {result.seasons_count} {result.seasons_count === 1 ? 'Season' : 'Seasons'}
                              </span>
                            )}
                            
                            {result.episode_count && result.episode_count > 0 && (
                              <span className="px-2 py-1 bg-muted rounded">
                                {result.episode_count} {result.episode_count === 1 ? 'Episode' : 'Episodes'}
                              </span>
                            )}
                          </div>
                        </Link>
                      </div>
                      
                      {/* Like and Watch Later buttons for TV shows */}
                      {result.type === 'tvshow' && isAuthenticated && currentState && (
                        <div className="flex gap-2">
                          <div
                            className={`transition-all duration-300 ease-in-out ${
                              currentState.isLikeAnimating ? 'rotate-180' : 'rotate-0'
                            }`}
                          >
                                                         <LoveCircleButton 
                               isLiked={currentState.isLiked}
                               onClick={(e) => handleLikeToggle(result, e)}
                               className={`${currentState.isLikeToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                             />
                          </div>
                          
                          <AddCircleButton 
                            isWatchLater={currentState.isWatchLater}
                            isToggling={currentState.isWatchLaterToggling}
                            onClick={(e) => handleWatchLaterToggle(result, e)}
                            className={`${currentState.isWatchLaterToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
} 