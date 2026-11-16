import React from 'react';
import { Link } from '@inertiajs/react';
import { CheckIcon, PlayIcon, XIcon } from 'lucide-react';
import { LazyImage } from '@/components/ui/lazy-image';
import { formatAbsoluteDateTime, formatRelativeTime } from '@/lib/format-relative-time';

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
    progress_percentage?: number;
    completed?: boolean;
    last_watched_at?: string;
    plays_count?: number;
    tvshow?: {
      name: string;
      slug: string;
    };
  };
  imgBaseUrl: string;
  isPriority?: boolean;
  onWatchLaterToggle?: (episodeId: number, newStatus: boolean) => void;
  onEpisodeClick?: (episode: any) => void;
  onRemoveFromHistory?: (episodeId: number) => void;
  showCheckIcon?: boolean;
}

export function EpisodeCard({
  episode,
  imgBaseUrl,
  isPriority = false,
  onWatchLaterToggle,
  onEpisodeClick,
  onRemoveFromHistory,
  showCheckIcon = false,
}: EpisodeCardProps) {
  const handleRemoveFromWatchLater = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (onWatchLaterToggle) {
      onWatchLaterToggle(episode.id, false);
    }
  };

  const handleRemoveFromHistory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveFromHistory?.(episode.id);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    // If we have a custom click handler (for search tracking), use it.
    if (onEpisodeClick) {
      // Prevent the Link's default navigation
      e.preventDefault();
      e.stopPropagation();
      onEpisodeClick(episode);
    }
    // If no custom handler, the Link will navigate normally.
  };

  // Episode is playable if it can be navigated to the TV show page
  const isPlayable = !!episode.tvshow?.slug;
  const episodeUrl = isPlayable && episode.tvshow ? `/tvshow/${episode.tvshow.slug}?season=${episode.season_number}&episode=${episode.episode_number}&autoplay=true` : '#';

  const progressPercentage = Math.min(100, Math.max(0, Number(episode.progress_percentage) || 0));
  const showProgressBar = progressPercentage > 0;
  const relativeWatched = formatRelativeTime(episode.last_watched_at);
  const absoluteWatched = formatAbsoluteDateTime(episode.last_watched_at);
  const playsCount = Number(episode.plays_count) || 0;

  return (
    <Link
      href={episodeUrl}
      onClick={handleCardClick}
      className={`group block w-[280px] flex-shrink-0 ${isPlayable ? 'cursor-pointer' : 'cursor-default'}`}
      as="div"
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

        {/* History remove control */}
        {onRemoveFromHistory && !showCheckIcon && (
          <div className="absolute top-2 right-2 z-20">
            <button
              type="button"
              onClick={handleRemoveFromHistory}
              className="p-1.5 bg-black/70 hover:bg-rose-600 rounded-full text-white transition-colors duration-200 shadow-lg cursor-pointer"
              title="Remove from history"
            >
              <XIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        )}

        {/* Plays badge */}
        {playsCount >= 1 && (
          <div className="absolute top-2 left-2 z-20">
            <div className="bg-black/75 text-white text-[0.65rem] font-semibold px-1.5 py-0.5 rounded shadow-lg">
              Played {playsCount}×
            </div>
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
        <div className="absolute bottom-3 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
          S{episode.season_number}E{episode.episode_number}
        </div>

        {/* Runtime overlay */}
        {episode.runtime && episode.runtime > 0 && (
          <div className="absolute bottom-3 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
            {episode.runtime}m
          </div>
        )}

        {/* Watch progress bar */}
        {showProgressBar && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-20">
            <div
              className="h-full bg-rose-500 transition-[width] duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      {/* Episode info — fixed height so "Watched" sits on a shared baseline */}
      <div className="mt-3 px-1 flex flex-col min-h-[4.75rem]">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200">
          {episode.name}
        </h3>
        {episode.tvshow && (
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 truncate">
            from {episode.tvshow.name}
          </p>
        )}
        <div className="mt-auto flex items-center justify-between gap-2 pt-1">
          <p
            className="text-xs text-zinc-600 dark:text-zinc-400 truncate"
            title={absoluteWatched || undefined}
          >
            {relativeWatched ? `Watched ${relativeWatched}` : 'Available to watch'}
          </p>
          {episode.likes_count !== null && episode.likes_count !== undefined && Number(episode.likes_count) > 0 && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 shrink-0">
              {episode.likes_count} {Number(episode.likes_count) === 1 ? 'like' : 'likes'}
            </p>
          )}
        </div>
      </div>
    </Link>
  );
}
