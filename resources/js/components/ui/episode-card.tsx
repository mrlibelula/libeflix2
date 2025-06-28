import React from 'react';
import { CheckIcon, PlayIcon } from 'lucide-react';
import { LazyImage } from '@/components/ui/lazy-image';

interface EpisodeCardProps {
  episode: {
    id: number;
    name: string;
    season_number: number;
    episode_number: number;
    still_path?: string;
    overview?: string;
    runtime?: number;
    is_watch_later?: boolean;
    likes_count?: number;
    is_in_storage?: boolean;
    encFilePath?: string;
    tvshow?: {
      name: string;
      slug: string;
    };
  };
  imgBaseUrl: string;
  isPriority?: boolean;
  onWatchLaterToggle?: (episodeId: number, newStatus: boolean) => void;
  onEpisodeClick?: (episode: any) => void;
  showCheckIcon?: boolean;
}

export function EpisodeCard({ 
  episode, 
  imgBaseUrl, 
  isPriority = false, 
  onWatchLaterToggle,
  onEpisodeClick,
  showCheckIcon = false 
}: EpisodeCardProps) {
  const handleRemoveFromWatchLater = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onWatchLaterToggle) {
      onWatchLaterToggle(episode.id, false);
    }
  };

  const handleClick = () => {
    if (episode.is_in_storage && episode.encFilePath && onEpisodeClick) {
      onEpisodeClick(episode);
    } else if (episode.tvshow?.slug) {
      // Navigate to the TV show page with the specific season and episode
      window.location.href = `/tvshow/${episode.tvshow.slug}?season=${episode.season_number}&episode=${episode.episode_number}&autoplay=true`;
    }
  };

  // Episode is playable if it can be navigated to the TV show page
  const isPlayable = !!(episode.tvshow?.slug);

  return (
    <div 
      className={`group block w-[280px] flex-shrink-0 ${isPlayable ? 'cursor-pointer' : ''}`}
      onClick={handleClick}
    >
      <div className="relative w-full h-[157px] rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-md hover:shadow-lg transition-shadow duration-200">
        <LazyImage
          src={episode.still_path ? `${imgBaseUrl}${episode.still_path}` : '/images/default-backdrop.jpg'}
          alt={episode.name}
          className="w-full h-full object-cover group-hover:brightness-110 transition-all duration-300"
          priority={isPriority}
        />
        
        {/* Check icon for removal from watch later */}
        {showCheckIcon && (
          <div className="absolute top-2 right-2 z-20">
            <button
              onClick={handleRemoveFromWatchLater}
              className="p-1.5 bg-green-600 hover:bg-green-700 rounded-full text-white transition-colors duration-200 shadow-lg"
              title="Remove from watch later"
            >
              <CheckIcon className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Play button overlay for playable episodes */}
        {isPlayable && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 z-10">
            <div className="p-3 bg-rose-600 rounded-full text-white">
              <PlayIcon className="w-6 h-6 fill-white" />
            </div>
          </div>
        )}

        {/* Episode info overlay */}
        <div className="absolute bottom-2 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
          S{episode.season_number}E{episode.episode_number}
        </div>

        {/* Runtime overlay */}
        {episode.runtime && episode.runtime > 0 && (
          <div className="absolute bottom-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
            {episode.runtime}m
          </div>
        )}
      </div>

      {/* Episode info */}
      <div className="mt-3 px-1">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200">
          {episode.name}
        </h3>
        {episode.tvshow && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            from {episode.tvshow.name}
          </p>
        )}
        <div className="flex items-center justify-between mt-1">
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            {episode.is_in_storage && episode.encFilePath ? 'Direct streaming' : 'Available to watch'}
          </p>
          {episode.likes_count !== null && episode.likes_count !== undefined && Number(episode.likes_count) > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {episode.likes_count} {Number(episode.likes_count) === 1 ? 'like' : 'likes'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
} 