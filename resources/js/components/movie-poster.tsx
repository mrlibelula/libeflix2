import { Link, router, usePage } from "@inertiajs/react";
import { LazyImage } from "@/components/ui/lazy-image";
import { CheckIcon, ClapperboardIcon, HeartIcon, PlusIcon, StarIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { TrailerModal } from "@/components/trailer-modal";

interface Movie {
  id: number;
  slug?: string;
  title: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
  is_watch_later?: boolean;
  is_local?: boolean;
  is_free?: boolean;
  google_drive_file_id?: string;
  trailer_count?: number;
  subtitles?: {
    languageCode: string;
    languageName: string;
    path: string;
  }[];
}

interface MoviePosterProps {
  movie: Movie;
  imgBaseUrl: string;
  isPriority?: boolean;
  onWatchLaterToggle?: (movieId: number, newStatus: boolean) => void;
}

export function MoviePoster({ movie, imgBaseUrl, isPriority = false, onWatchLaterToggle }: MoviePosterProps) {
  const [isWatchLater, setIsWatchLater] = useState(movie.is_watch_later || false);
  const [isToggling, setIsToggling] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const { props } = usePage<{ csrf_token: string; isProduction?: boolean }>();

  // Sync local state with movie prop changes
  useEffect(() => {
    setIsWatchLater(movie.is_watch_later || false);
  }, [movie.is_watch_later]);

  // Ensure component is ready before allowing interactions
  useEffect(() => {
    const timer = setTimeout(() => setIsReady(true), 100);
    return () => clearTimeout(timer);
  }, []);

  const handleToggleWatchLater = async (e: React.MouseEvent) => {
    e.preventDefault(); // Prevent navigation
    e.stopPropagation();
    
    // Only allow watch later toggle for local movies
    if (!isLocalMovie || isToggling || !isReady) return;
    
    setIsToggling(true);
    setIsAnimating(true);
    
    try {
      // Get CSRF token from Inertia shared data or meta tag
      const csrfToken = props.csrf_token || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (!csrfToken) {
        console.error('CSRF token not found');
        setIsAnimating(false);
        return;
      }
      
      const response = await fetch(`/movies/${movie.id}/toggle-watch-later`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'Accept': 'application/json',
        },
        credentials: 'same-origin', // Include cookies for CSRF
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Change icon at the midpoint of animation (when rotated 90deg and not visible)
        setTimeout(() => {
          setIsWatchLater(data.is_watch_later);
        }, 150);
        
        // Complete animation cycle
        setTimeout(() => {
          setIsAnimating(false);
        }, 300);
        
        onWatchLaterToggle?.(movie.id, data.is_watch_later);
      } else {
        console.error('HTTP error:', response.status, response.statusText);
        if (response.status === 419) {
          console.error('CSRF token mismatch. Please refresh the page.');
          // You could show a toast notification here or handle it differently
        }
        setIsAnimating(false);
      }
    } catch (error) {
      console.error('Error toggling watch later:', error);
      setIsAnimating(false);
    } finally {
      setIsToggling(false);
    }
  };

  const handleTrailerClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsTrailerModalOpen(true);
  };

  const handlePosterClick = (e: React.MouseEvent) => {
    // Only allow navigation for local movies
    if (!isLocalMovie || !movie.slug) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
  };

  // Determine if we should render as clickable
  // A movie is considered local if:
  // 1. Explicitly marked as is_local: true (for external API movies)
  // 2. Has a slug (traditional local movies from database)
  // 3. is_local is undefined (backward compatibility - assume local)
  const isLocalMovie = movie.is_local !== false && (movie.is_local === true || movie.slug || movie.is_local === undefined);
  
  // In production, also check if the movie has a google_drive_file_id to be clickable
  const isProductionEnvironment = props.isProduction;
  const hasGoogleDriveFile = movie.google_drive_file_id && movie.google_drive_file_id.trim() !== '';
  
  const isClickable = isLocalMovie && movie.slug && (!isProductionEnvironment || hasGoogleDriveFile);
  
  // Check if movie is not clickable specifically due to missing google_drive_file_id in production
  const isUnavailableInProduction = isProductionEnvironment && isLocalMovie && movie.slug && !hasGoogleDriveFile;
  
  const posterContent = (
    <div className={`flex-none w-fit ${isClickable ? 'cursor-pointer' : 'cursor-default'}`}>
      <div className={`relative w-[11rem] h-[17rem] overflow-hidden transition duration-150 ease-in-out rounded-[10px] ${
        isUnavailableInProduction 
          ? 'opacity-[60%] group-hover:opacity-[70%]' 
          : 'opacity-[90%] group-hover:opacity-100 group-hover:brightness-[105%]'
      }`}>
        <LazyImage
          src={movie.poster_path ? `${imgBaseUrl}${movie.poster_path}` : '/images/default-poster.jpg'}
          alt={movie.title}
          className="w-full h-full object-cover"
          priority={isPriority}
        />
        
        {/* FREE label for movies from database that are tagged as free */}
        {isLocalMovie && movie.is_free && (
          <div className="absolute top-2 left-2 z-10">
            <div className="bg-green-500 text-white text-[0.65rem] font-semibold px-1 rounded shadow-lg border-2 border-green-400 animate-pulse">
              FREE TO WATCH
            </div>
          </div>
        )}
        
        {/* Coming Soon overlay for movies without google_drive_file_id in production */}
        {isUnavailableInProduction && (
          <div className="absolute inset-0 bg-black/40 flex items-center justify-center z-20">
            <div className="bg-gray-600/90 text-white text-[0.6rem] font-semibold px-2 py-1 rounded shadow-lg">
              COMING SOON
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Conditionally wrap with Link only for local movies */}
      {isClickable ? (
        <Link href={`/movie/${movie.slug}`}>
          {posterContent}
        </Link>
      ) : (
        <div onClick={handlePosterClick}>
          {posterContent}
        </div>
      )}
      
      <div className="flex flex-col gap-y-2 w-[11rem] py-4 mb-1 mt-1">
        <div className={`text-zinc-600 dark:text-zinc-300 truncate text-[0.92rem] _text-lg font-semibold leading-tight line-clamp-2 transition-colors duration-150 ease-in-out ${
          isClickable ? 'group-hover:text-black dark:group-hover:text-zinc-100' : ''
        }`}>
          {movie.title}
        </div>
        <div className="flex items-center justify-between gap-x-2">
          <div className="text-zinc-500 truncate text-xs group-hover:text-zinc-400 transition-colors duration-150 ease-in-out">
            {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
          </div>
          <div className="flex items-center gap-x-4">
            <div className="flex items-center gap-x-2">
              {/* Watch Later button - Only show for local movies and authenticated users */}
              {isLocalMovie && onWatchLaterToggle && (
                <button
                  onClick={handleToggleWatchLater}
                  disabled={isToggling || !isReady}
                  className="transition-all duration-200 ease-in-out hover:scale-110 disabled:opacity-50 cursor-pointer"
                  title={isWatchLater ? "Remove from watch later" : "Add to watch later"}
                >
                  <div 
                    className={`transition-all duration-300 ease-in-out ${
                      isAnimating ? 'rotate-180 scale-110_' : 'rotate-0 _scale-100'
                    }`}
                    style={{
                      transform: isAnimating 
                        ? 'rotate(180deg)' 
                        : 'rotate(0deg)',
                    }}
                  >
                    {isWatchLater ? (
                      <CheckIcon className="text-green-400 w-[1rem] h-[1rem] transition-colors duration-200" />
                    ) : (
                      <PlusIcon className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-200 w-[1rem] h-[1rem] transition-colors duration-200" />
                    )}
                  </div>
                </button>
              )}

              {/* Heart button - Only show for local movies */}
              {isLocalMovie && (
                <button
                  className="transition-all duration-200 ease-in-out hover:scale-110 cursor-pointer"
                  title="Like movie"
                >
                  <HeartIcon className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-200 w-[1rem] h-[1rem] transition-colors duration-200" />
                </button>
              )}
              
              {/* Trailer button - Always show (for both local and external movies) */}
              <button
                onClick={handleTrailerClick}
                className="hover:scale-110 transition-transform duration-200 cursor-pointer"
                title="Watch trailers"
              >
                <ClapperboardIcon className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-200 w-[1rem] h-[1rem] transition-colors duration-200" />
              </button>
              
            </div>
            <div className="flex items-center gap-x-1 text-amber-600 dark:text-amber-400 truncate text-xs group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors duration-150 ease-in-out">
              <StarIcon className="w-3 h-3" />
              {movie.vote_average ? Math.round(movie.vote_average * 10) + '%' : 'N/A'}
            </div>
          </div>
        </div>
        {/* subtitles - Only show for local movies */}
        {isLocalMovie && (
          <div className="w-full h-full flex items-end justify-start gap-x-0.5 pt-1">
            {movie.subtitles && movie.subtitles.length > 0 && (
              <div className="dark:text-zinc-900 text-zinc-100 text-[0.55rem] px-0.5 bg-zinc-400 font-bold border border-zinc-400">
                CC
              </div>
            )}
            {Array.isArray(movie.subtitles) && movie.subtitles.map((subtitle) => (
              <div key={subtitle.languageCode} className="text-zinc-500 dark:text-zinc-300 text-[0.55rem] px-0.5 border border-zinc-400 font-bold">
                {subtitle.languageCode}
              </div>
            ))}
          </div>
        )}
      </div>

      <TrailerModal
        isOpen={isTrailerModalOpen}
        onOpenChange={setIsTrailerModalOpen}
        movieTitle={movie.title}
        movieId={movie.id}
      />
    </>
  );
} 