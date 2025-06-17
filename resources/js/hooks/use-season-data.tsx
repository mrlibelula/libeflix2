import { useState, useCallback, useRef } from 'react';

interface Episode {
  id: number;
  name: string;
  overview: string;
  episode_number: number;
  still_path: string;
  stillUrl: string;
  vote_average: number;
  vote_count: number;
  voteAverageStars: number;
  runtime: number;
  is_in_storage: boolean | string;
  encFilePath?: string;
  subtitles: any[];
}

interface Season {
  id: number;
  name: string;
  overview: string;
  season_number: number;
  poster_path: string;
  posterPathUrl: string;
  air_date: string;
  episode_count: number;
  seasonFolderExists: boolean;
  episodes?: Episode[];
}

interface Credits {
  cast: any[];
  crew: any[];
  guestStars: any[];
}

interface CacheData {
  episodes: Record<number, Episode[]>;
  credits: Record<number, Credits>;
}

// Get CSRF token from the page
function getCSRFToken(): string {
  const token = document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
  return token || '';
}

export function useSeasonData(tvshowSlug: string) {
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [creditsLoading, setCreditsLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  
  // Use refs for caching to avoid re-renders when cache updates
  const cache = useRef<CacheData>({
    episodes: {},
    credits: {}
  });

  const loadSeasonEpisodes = useCallback(async (seasonNumber: number): Promise<Episode[]> => {
    // Return cached data if available
    if (cache.current.episodes[seasonNumber]) {
      return cache.current.episodes[seasonNumber];
    }

    // Return early if already loading
    if (loading[seasonNumber]) {
      return [];
    }

    setLoading(prev => ({ ...prev, [seasonNumber]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/tvshows/${tvshowSlug}/seasons/${seasonNumber}/episodes`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': getCSRFToken(),
        },
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`Failed to load episodes: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the episodes
      cache.current.episodes[seasonNumber] = data.episodes;
      
      return data.episodes;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load episodes';
      setError(errorMessage);
      console.error('Error loading season episodes:', err);
      return [];
    } finally {
      setLoading(prev => ({ ...prev, [seasonNumber]: false }));
    }
  }, [tvshowSlug]);

  const loadSeasonCredits = useCallback(async (seasonNumber: number): Promise<Credits> => {
    // Return cached data if available
    if (cache.current.credits[seasonNumber]) {
      return cache.current.credits[seasonNumber];
    }

    // Return early if already loading
    if (creditsLoading[seasonNumber]) {
      return { cast: [], crew: [], guestStars: [] };
    }

    setCreditsLoading(prev => ({ ...prev, [seasonNumber]: true }));
    setError(null);

    try {
      const response = await fetch(`/api/tvshows/${tvshowSlug}/seasons/${seasonNumber}/credits`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json',
          'X-Requested-With': 'XMLHttpRequest',
          'X-CSRF-TOKEN': getCSRFToken(),
        },
        credentials: 'same-origin'
      });

      if (!response.ok) {
        throw new Error(`Failed to load credits: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      
      // Cache the credits
      cache.current.credits[seasonNumber] = {
        cast: data.cast || [],
        crew: data.crew || [],
        guestStars: data.guestStars || []
      };
      
      return cache.current.credits[seasonNumber];
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load credits';
      setError(errorMessage);
      console.error('Error loading season credits:', err);
      return { cast: [], crew: [], guestStars: [] };
    } finally {
      setCreditsLoading(prev => ({ ...prev, [seasonNumber]: false }));
    }
  }, [tvshowSlug]);

  const getCachedEpisodes = useCallback((seasonNumber: number): Episode[] | null => {
    return cache.current.episodes[seasonNumber] || null;
  }, []);

  const getCachedCredits = useCallback((seasonNumber: number): Credits | null => {
    return cache.current.credits[seasonNumber] || null;
  }, []);

  const clearCache = useCallback(() => {
    cache.current = {
      episodes: {},
      credits: {}
    };
  }, []);

  return {
    loadSeasonEpisodes,
    loadSeasonCredits,
    getCachedEpisodes,
    getCachedCredits,
    clearCache,
    loading,
    creditsLoading,
    error,
    isLoading: (seasonNumber: number) => loading[seasonNumber] || false,
    isCreditsLoading: (seasonNumber: number) => creditsLoading[seasonNumber] || false,
  };
} 