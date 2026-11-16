import { Link } from "@inertiajs/react";
import { PlayIcon, XIcon } from "lucide-react";
import { LazyImage } from "@/components/ui/lazy-image";
import { formatAbsoluteDateTime, formatRelativeTime } from "@/lib/format-relative-time";

type HistoryLandscapeMovie = {
  id: number;
  slug?: string;
  title: string;
  poster_path?: string;
  backdrop_path?: string;
  release_date?: string;
  progress_percentage?: number;
  last_watched_at?: string;
  plays_count?: number;
};

interface HistoryLandscapeMovieCardProps {
  movie: HistoryLandscapeMovie;
  imgBaseUrl: string;
  isPriority?: boolean;
  onRemoveFromHistory?: (movieId: number) => void;
}

/**
 * 16:9 continue-watching card for movies.
 * Prefers backdrop; otherwise crops the poster with CSS object-cover
 * (does not modify or replace the original poster asset).
 */
export function HistoryLandscapeMovieCard({
  movie,
  imgBaseUrl,
  isPriority = false,
  onRemoveFromHistory,
}: HistoryLandscapeMovieCardProps) {
  const handleRemoveFromHistory = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onRemoveFromHistory?.(movie.id);
  };

  const progressPercentage = Math.min(100, Math.max(0, Number(movie.progress_percentage) || 0));
  const showProgressBar = progressPercentage > 0;
  const relativeWatched = formatRelativeTime(movie.last_watched_at);
  const absoluteWatched = formatAbsoluteDateTime(movie.last_watched_at);
  const playsCount = Number(movie.plays_count) || 0;

  const landscapeSrc = movie.backdrop_path
    ? `${imgBaseUrl}${movie.backdrop_path}`
    : movie.poster_path
      ? `${imgBaseUrl}${movie.poster_path}`
      : "/images/default-backdrop.jpg";

  const year = movie.release_date ? new Date(movie.release_date).getFullYear() : null;
  const isClickable = !!movie.slug;
  const href = isClickable ? `/movie/${movie.slug}` : "#";

  return (
    <Link
      href={href}
      className={`group block w-[280px] flex-shrink-0 ${isClickable ? "cursor-pointer" : "cursor-default"}`}
      as="div"
      onClick={(e) => {
        if (!isClickable) {
          e.preventDefault();
        }
      }}
    >
      <div className="relative w-full h-[157px] rounded-lg overflow-hidden bg-zinc-200 dark:bg-zinc-800 shadow-md hover:shadow-lg transition-shadow duration-200">
        <LazyImage
          src={landscapeSrc}
          alt={movie.title}
          className="w-full h-full object-cover object-center group-hover:brightness-110 transition-all duration-300"
          priority={isPriority}
        />

        {onRemoveFromHistory && (
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

        {playsCount >= 1 && (
          <div className="absolute top-2 left-2 z-20">
            <div className="bg-black/75 text-white text-[0.65rem] font-semibold px-1.5 py-0.5 rounded shadow-lg">
              Played {playsCount}×
            </div>
          </div>
        )}

        {isClickable && (
          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-black/30 z-10">
            <div className="p-3 bg-rose-600 rounded-full text-white">
              <PlayIcon className="w-6 h-6 fill-white" />
            </div>
          </div>
        )}

        <div className="absolute bottom-3 left-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
          Movie
        </div>

        {year && (
          <div className="absolute bottom-3 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded z-10">
            {year}
          </div>
        )}

        {showProgressBar && (
          <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-black/50 z-20">
            <div
              className="h-full bg-rose-500 transition-[width] duration-300"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        )}
      </div>

      <div className="mt-3 px-1 flex flex-col min-h-[4.75rem]">
        <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 group-hover:text-rose-600 dark:group-hover:text-rose-400 transition-colors duration-200">
          {movie.title}
        </h3>
        <p
          className="mt-auto text-xs text-zinc-600 dark:text-zinc-400 truncate pt-1"
          title={absoluteWatched || undefined}
        >
          {relativeWatched ? `Watched ${relativeWatched}` : "In progress"}
        </p>
      </div>
    </Link>
  );
}
