import React from 'react';
import { CheckIcon } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { LazyImage } from '@/components/ui/lazy-image';

interface SeasonCardProps {
  season: {
    id: number;
    name: string;
    season_number: number;
    poster_path?: string;
    overview?: string;
    is_watch_later?: boolean;
    likes_count?: number;
    tvshow?: {
      name: string;
      slug: string;
    };
  };
  imgBaseUrl: string;
  isPriority?: boolean;
  onWatchLaterToggle?: (seasonId: number, newStatus: boolean) => void;
  showCheckIcon?: boolean;
}

export function SeasonCard({ 
  season, 
  imgBaseUrl, 
  isPriority = false, 
  onWatchLaterToggle,
  showCheckIcon = false 
}: SeasonCardProps) {
  const handleRemoveFromWatchLater = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onWatchLaterToggle) {
      onWatchLaterToggle(season.id, false);
    }
  };

  const getSeasonLink = () => {
    if (season.tvshow?.slug) {
      return `/tvshow/${season.tvshow.slug}?season=${season.season_number}`;
    }
    return '#';
  };

  return (
    <Link 
      href={getSeasonLink()}
      className="group block w-[160px] flex-shrink-0"
    >
      <div className="relative w-full h-[240px] rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-md hover:shadow-lg transition-shadow duration-200">
        <LazyImage
          src={season.poster_path ? `${imgBaseUrl}${season.poster_path}` : '/images/default-backdrop.jpg'}
          alt={season.name}
          className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
          priority={isPriority}
        />
        
        {/* Check icon for removal from watch later */}
        {showCheckIcon && (
          <div className="absolute top-2 right-2">
            <button
              onClick={handleRemoveFromWatchLater}
              className="p-1.5 bg-green-600 hover:bg-green-700 rounded-full text-white transition-colors duration-200 shadow-lg"
              title="Remove from watch later"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Season number overlay */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          Season {season.season_number}
        </div>
      </div>

      {/* Season info */}
      <div className="mt-3 px-1">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200">
          {season.name}
        </h3>
        {season.tvshow && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            from {season.tvshow.name}
          </p>
        )}
        {season.likes_count !== null && season.likes_count !== undefined && Number(season.likes_count) > 0 && (
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            {season.likes_count} {Number(season.likes_count) === 1 ? 'like' : 'likes'}
          </p>
        )}
      </div>
    </Link>
  );
} 