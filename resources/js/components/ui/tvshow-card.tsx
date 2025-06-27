import React from 'react';
import { StarIcon, CheckIcon } from 'lucide-react';
import { Link } from '@inertiajs/react';
import { LazyImage } from '@/components/ui/lazy-image';

interface TvshowCardProps {
  tvshow: {
    id: number;
    name: string;
    slug: string;
    poster_path?: string;
    vote_average: number;
    first_air_date: string;
    overview?: string;
    is_watch_later?: boolean;
    likes_count?: number;
  };
  imgBaseUrl: string;
  isPriority?: boolean;
  onWatchLaterToggle?: (tvshowId: number, newStatus: boolean) => void;
  showCheckIcon?: boolean;
}

export function TvshowCard({ 
  tvshow, 
  imgBaseUrl, 
  isPriority = false, 
  onWatchLaterToggle,
  showCheckIcon = false 
}: TvshowCardProps) {
  const handleRemoveFromWatchLater = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onWatchLaterToggle) {
      onWatchLaterToggle(tvshow.id, false);
    }
  };

  return (
    <Link 
      href={`/tvshow/${tvshow.slug}`}
      className="group block w-[180px] flex-shrink-0"
    >
      <div className="relative w-full h-[270px] rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-md hover:shadow-lg transition-shadow duration-200">
        <LazyImage
          src={tvshow.poster_path ? `${imgBaseUrl}${tvshow.poster_path}` : '/images/default-backdrop.jpg'}
          alt={tvshow.name}
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

        {/* Rating overlay */}
        {tvshow.vote_average > 0 && (
          <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded flex items-center gap-1">
            <StarIcon className="w-3 h-3 fill-yellow-400 text-yellow-400" />
            <span>{tvshow.vote_average.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* TV Show info */}
      <div className="mt-3 px-1">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200">
          {tvshow.name}
        </h3>
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {tvshow.first_air_date ? new Date(tvshow.first_air_date).getFullYear() : 'N/A'}
          </p>
          {tvshow.likes_count !== null && tvshow.likes_count !== undefined && Number(tvshow.likes_count) > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {tvshow.likes_count} {Number(tvshow.likes_count) === 1 ? 'like' : 'likes'}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
} 