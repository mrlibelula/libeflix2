import { Link, router, usePage } from "@inertiajs/react";
import { LazyImage } from "@/components/ui/lazy-image";
import { CheckIcon, ClapperboardIcon, HeartIcon, PlusIcon, StarIcon } from "lucide-react";
import { useState, useEffect } from "react";
import { TrailerModal } from "@/components/trailer-modal";

interface Movie {
  id: number;
  slug: string;
  title: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
  is_watch_later?: boolean;
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
  const { props } = usePage<{ csrf_token: string }>();

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
    
    if (isToggling || !isReady) return;
    
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

  return (
    <>
      <Link href={`/movie/${movie.slug}`}>
        <div className="flex-none w-fit">
          <div className="relative w-[11rem] h-[17rem] overflow-hidden transition duration-150 ease-in-out rounded-[10px] opacity-[90%] group-hover:opacity-100 group-hover:brightness-[105%]">
            <LazyImage
              src={movie.poster_path ? `${imgBaseUrl}${movie.poster_path}` : '/images/default-poster.jpg'}
              alt={movie.title}
              className="w-full h-full object-cover"
              priority={isPriority}
            />
            
          </div>
        </div>
      </Link>
      <div className="flex flex-col gap-y-2 w-[11rem] py-4 mb-1 mt-1">
        <div className="text-zinc-600 dark:text-zinc-300 truncate text-[0.92rem] _text-lg font-semibold leading-tight line-clamp-2 group-hover:text-black dark:group-hover:text-zinc-100 transition-colors duration-150 ease-in-out">
          {movie.title}
        </div>
        <div className="flex items-center justify-between gap-x-2">
          <div className="text-zinc-500 truncate text-xs group-hover:text-zinc-400 transition-colors duration-150 ease-in-out">
            {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
          </div>
          <div className="flex items-center gap-x-4">
            <div className="flex items-center gap-x-2">
              {/* if movie is in watch later list, show check icon */}
              <button
                onClick={handleToggleWatchLater}
                disabled={isToggling || !isReady}
                className="transition-all duration-200 ease-in-out hover:scale-110 disabled:opacity-50 cursor-pointer"
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

              <HeartIcon className=" text-zinc-400 w-[1rem] h-[1rem]" />
              
              {(movie.trailer_count ?? 0) > 0 && (
                <button
                  onClick={handleTrailerClick}
                  className="hover:scale-110 transition-transform duration-200 cursor-pointer"
                  title="Watch trailers"
                >
                  <ClapperboardIcon className="text-zinc-400 hover:text-zinc-500 dark:hover:text-zinc-200 w-[1rem] h-[1rem] transition-colors duration-200" />
                </button>
              )}
              
            </div>
            <div className="flex items-center gap-x-1 text-amber-600 dark:text-amber-400 truncate text-xs group-hover:text-amber-700 dark:group-hover:text-amber-300 transition-colors duration-150 ease-in-out">
              <StarIcon className="w-3 h-3" />
              {movie.vote_average ? Math.round(movie.vote_average * 10) + '%' : 'N/A'}
            </div>
          </div>
        </div>
        {/* subtitles */}
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