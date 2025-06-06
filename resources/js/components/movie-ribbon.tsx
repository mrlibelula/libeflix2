import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { MoviePoster } from "@/components/movie-poster";
import { EmptyRibbonState } from "@/components/ui/empty-ribbon-state";

interface MovieRibbonProps {
  movies: Array<any>;
  imgBaseUrl: string;
  title?: string;
  ribbonId?: string;
  onWatchLaterToggle?: (movieId: number, newStatus: boolean) => void;
}

export function MovieRibbon({ 
  movies, 
  imgBaseUrl, 
  title = "Now Streaming",
  ribbonId,
  onWatchLaterToggle,
}: MovieRibbonProps) {

  const [isRibbonOpen, setIsRibbonOpen] = useState(true);

  const toggleRibbon = () => {
    setIsRibbonOpen(!isRibbonOpen);
  };

  // Helper functions for empty state content
  const getEmptyStateTitle = (ribbonTitle: string) => {
    if (ribbonTitle.toLowerCase().includes("watch later")) {
      return "Your Watch Later list is empty";
    }
    return "No movies available";
  };

  const getEmptyStateDescription = (ribbonTitle: string) => {
    if (ribbonTitle.toLowerCase().includes("watch later")) {
      return "Start building your watchlist by clicking the + icon on movies you'd like to watch later.";
    }
    return "There are no movies to stream at the moment. Check back later for new releases!";
  };

  const getEmptyStateIcon = (ribbonTitle: string): "clapper" | "plus" | "search" | "star" => {
    if (ribbonTitle.toLowerCase().includes("watch later")) {
      return "plus";
    }
    return "clapper";
  };

  const getEmptyStateActionText = (ribbonTitle: string) => {
    if (ribbonTitle.toLowerCase().includes("watch later")) {
      return "Browse Movies";
    }
    return undefined;
  };

  const getEmptyStateAction = (ribbonTitle: string) => {
    if (ribbonTitle.toLowerCase().includes("watch later")) {
      return () => {
        // Scroll to the main movies ribbon
        const mainMoviesSection = document.querySelector('[data-ribbon="Now Streaming"]');
        if (mainMoviesSection) {
          mainMoviesSection.scrollIntoView({ behavior: 'smooth' });
        }
      };
    }
    return undefined;
  };

  return (
    <div 
      className="relative px-4 mx-auto w-full max-w-screen md:max-w-[calc(100vw-var(--sidebar-width,0px)-10px)] _md:group-data-[state=collapsed]/sidebar-wrapper:max-w-[calc(100vw-var(--sidebar-width-icon,0px))]"
      data-ribbon={ribbonId || title}
      tabIndex={movies.length === 0 ? 0 : -1}
      style={{
        outline: 'none', // Remove default focus outline, rely on custom styling if needed
      }}
    >
      {/* ribbon header */}
      <div onClick={toggleRibbon} className="flex w-full justify-start items-center select-none gap-x-4 px-2 mb-8 mt-5 text-zinc-900 dark:text-zinc-200 text-xl font-semibold z-10 cursor-pointer hover:text-black dark:hover:text-zinc-100 transition-colors duration-200 ease-in-out">
        <div>
          {title}
        </div>
        <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ease-in-out ${!isRibbonOpen ? 'rotate-[270deg]' : 'rotate-0'}`} />
      </div>
      {/* ribbon content */}
      <div className={`transition-all duration-500 ease-in-out transform-gpu overflow-hidden ${
        isRibbonOpen 
          ? 'opacity-100 translate-y-0 scale-100 h-auto pt-4' 
          : 'opacity-0 -translate-y-4 scale-95 pointer-events-none h-0 pt-0'
      }`}>
        {movies.length === 0 ? (
          <EmptyRibbonState
            title={getEmptyStateTitle(title)}
            description={getEmptyStateDescription(title)}
            icon={getEmptyStateIcon(title)}
            actionText={getEmptyStateActionText(title)}
            onAction={getEmptyStateAction(title)}
          />
        ) : (
          <Ribbon
            align="start"
            dragFree={true}
          >
            {movies.map((movie: any, index: number) => {
              // Prioritize the first 8 movies for better initial load
              const isPriority = index < 8;

              return (
                <RibbonItem
                  key={movie.id}
                >
                  <MoviePoster
                    movie={movie}
                    imgBaseUrl={imgBaseUrl}
                    isPriority={isPriority}
                    onWatchLaterToggle={onWatchLaterToggle}
                  />
                </RibbonItem>
              );
            })}
          </Ribbon>
        )}
      </div>
    </div>
  );
} 