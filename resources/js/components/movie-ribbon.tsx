import { useState, useEffect, useMemo } from "react";
import { ChevronDownIcon, ArrowUpIcon, ArrowDownIcon, TypeIcon, CalendarIcon, StarIcon } from "lucide-react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { MoviePoster } from "@/components/movie-poster";
import { EmptyRibbonState } from "@/components/ui/empty-ribbon-state";

// Interface for sidebar state event
interface SidebarStateDetail {
  state: 'expanded' | 'collapsed';
  width: string;
  isMobile: boolean;
}

interface MovieRibbonProps {
  movies: Array<any>;
  imgBaseUrl: string;
  title?: string;
  ribbonId?: string;
  onWatchLaterToggle?: (movieId: number, newStatus: boolean) => void;
}

type SortField = 'name' | 'year' | 'rating';
type SortDirection = 'asc' | 'desc';

interface SortOption {
  field: SortField;
  direction: SortDirection;
  icon: React.ComponentType<any>;
  label: string;
}

export function MovieRibbon({ 
  movies, 
  imgBaseUrl, 
  title = "Now Streaming" + (movies.length > 0 ? ` (${movies.length})` : ""),
  ribbonId,
  onWatchLaterToggle,
}: MovieRibbonProps) {

  const [isRibbonOpen, setIsRibbonOpen] = useState(true);
  const [currentSort, setCurrentSort] = useState<{ field: SortField; direction: SortDirection } | null>(null);

  // Sort options configuration
  const sortOptions: SortOption[] = [
    { field: 'rating', direction: 'desc', icon: StarIcon, label: 'Rating' },
    { field: 'year', direction: 'desc', icon: CalendarIcon, label: 'Year' },
    { field: 'name', direction: 'asc', icon: TypeIcon, label: 'Name' },
  ];

  // Helper function to get initial sidebar width from cookie
  const getInitialSidebarWidth = () => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const sidebarCookie = cookies.find(cookie => cookie.trim().startsWith('sidebar_state='));
      if (sidebarCookie) {
        const isExpanded = sidebarCookie.split('=')[1] === 'true';
        return isExpanded ? '12rem' : '3rem';
      }
    }
    return '12rem'; // Default to expanded if no cookie found
  };

  // State to track sidebar width for dynamic CSS calculations
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth());

  // Listen for sidebar state changes
  useEffect(() => {
    const handleSidebarStateChange = (event: CustomEvent<SidebarStateDetail>) => {
      const { state, width, isMobile } = event.detail;
      if (!isMobile) {
        setSidebarWidth(width);
      }
    };

    window.addEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    
    return () => {
      window.removeEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    };
  }, []);

  // Shuffle function
  const shuffleArray = (array: Array<any>) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Memoized shuffled movies for "Now Streaming" - only shuffle once on mount or when movie IDs change
  const shuffledMovies = useMemo(() => {
    if (title.toLowerCase().includes('now streaming')) {
      return shuffleArray(movies);
    }
    return movies;
  }, [movies.map(m => m.id).join(','), title]); // Only re-shuffle if movie IDs change or title changes

  // Sort movies based on current sort settings
  const sortMovies = (moviesToSort: Array<any>, sortField: SortField, sortDirection: SortDirection) => {
    return [...moviesToSort].sort((a, b) => {
      let aValue: any;
      let bValue: any;

      switch (sortField) {
        case 'name':
          aValue = a.title?.toLowerCase() || '';
          bValue = b.title?.toLowerCase() || '';
          break;
        case 'year':
          aValue = a.release_date ? new Date(a.release_date).getFullYear() : 0;
          bValue = b.release_date ? new Date(b.release_date).getFullYear() : 0;
          break;
        case 'rating':
          aValue = a.vote_average || 0;
          bValue = b.vote_average || 0;
          break;
        default:
          return 0;
      }

      if (sortDirection === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
      }
    });
  };

  // Get sorted or base movies (shuffled for "Now Streaming", original for others)
  const processedMovies = currentSort 
    ? sortMovies(shuffledMovies, currentSort.field, currentSort.direction)
    : shuffledMovies;

  const toggleRibbon = () => {
    setIsRibbonOpen(!isRibbonOpen);
  };

  const handleSortToggle = (field: SortField) => {
    if (currentSort?.field === field) {
      // Toggle direction if same field
      const newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      setCurrentSort({ field, direction: newDirection });
    } else {
      // Set new field with default direction
      const defaultDirection = sortOptions.find(opt => opt.field === field)?.direction || 'asc';
      setCurrentSort({ field, direction: defaultDirection });
    }
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

  // Get current sort option for display
  const getCurrentSortDirection = (field: SortField) => {
    if (currentSort?.field === field) {
      return currentSort.direction;
    }
    return null;
  };

  return (
    <div 
      className="relative px-4 mx-auto w-full max-w-[calc(100vw-10px)] md:max-w-[calc(100vw-var(--dynamic-sidebar-width)-30px)] focus:outline-none"
      data-ribbon={ribbonId || title}
      tabIndex={movies.length === 0 ? 0 : -1}
      style={{
        '--dynamic-sidebar-width': sidebarWidth,
        outline: 'none', // Remove default focus outline, rely on custom styling if needed
      } as React.CSSProperties}
    >
      {/* ribbon header */}
      <div className="flex w-full justify-between items-center pr-2 mb-3 mt-5">
        <div 
          onClick={toggleRibbon} 
          className="flex justify-start items-center select-none gap-x-2 text-zinc-900 dark:text-zinc-200 text-xl font-semibold z-10 cursor-pointer hover:text-black dark:hover:text-zinc-100 transition-colors duration-200 ease-in-out"
        >
          <div>
            {title}
          </div>
          <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ease-in-out ${!isRibbonOpen ? 'rotate-[270deg]' : 'rotate-0'}`} />
        </div>

                 {/* Sort Controls */}
         {movies.length > 0 && (
           <div className="flex items-center gap-1">
             {sortOptions.map((option) => {
               const isActive = getCurrentSortDirection(option.field) !== null;
               const direction = getCurrentSortDirection(option.field);
               
               return (
                 <button
                   key={option.field}
                   onClick={() => handleSortToggle(option.field)}
                   className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition-colors duration-200 text-sm font-medium ${
                     isActive
                       ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50'
                       : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700 hover:text-zinc-900 dark:hover:text-zinc-100'
                   }`}
                   title={`Sort by ${option.label}${isActive ? ` (${direction === 'asc' ? 'ascending' : 'descending'})` : ''}`}
                 >
                   <option.icon className="w-4 h-4" />
                   {isActive && (
                     direction === 'asc' ? (
                       <ArrowUpIcon className="w-3 h-3" />
                     ) : (
                       <ArrowDownIcon className="w-3 h-3" />
                     )
                   )}
                 </button>
               );
             })}
           </div>
         )}
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
            {processedMovies.map((movie: any, index: number) => {
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