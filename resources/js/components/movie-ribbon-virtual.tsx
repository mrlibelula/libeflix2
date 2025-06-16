import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { ChevronDownIcon, ArrowUpIcon, ArrowDownIcon, TypeIcon, CalendarIcon, StarIcon } from "lucide-react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { MoviePoster } from "@/components/movie-poster";
import { EmptyRibbonState } from "@/components/ui/empty-ribbon-state";
import { type CarouselApi } from "@/components/ui/carousel";

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

// Virtual scrolling constants
const ITEM_WIDTH = 176; // 11rem in pixels
const ITEM_GAP = 32; // 2rem in pixels (pl-8)
const CONTAINER_PADDING = 16; // 1rem in pixels
const OVERSCAN = 3; // Extra items to render outside viewport

export function MovieRibbonVirtual({ 
  movies, 
  imgBaseUrl, 
  title = "Now Streaming" + (movies.length > 0 ? ` (${movies.length})` : ""),
  ribbonId,
  onWatchLaterToggle,
}: MovieRibbonProps) {

  const [isRibbonOpen, setIsRibbonOpen] = useState(true);
  const [currentSort, setCurrentSort] = useState<{ field: SortField; direction: SortDirection } | null>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi | null>(null);
  
  // Virtual scrolling state
  const [containerWidth, setContainerWidth] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Sort options
  const sortOptions: SortOption[] = [
    { field: 'rating', direction: 'desc', icon: StarIcon, label: 'Rating' },
    { field: 'year', direction: 'desc', icon: CalendarIcon, label: 'Year' },
    { field: 'name', direction: 'asc', icon: TypeIcon, label: 'Name' },
  ];

  // Calculate sidebar width (simplified)
  const [sidebarWidth, setSidebarWidth] = useState('12rem');

  // Process movies (shuffle, sort)
  const shuffleArray = (array: Array<any>) => {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  const shuffledMovies = useMemo(() => {
    if (title.toLowerCase().includes('now streaming')) {
      return shuffleArray(movies);
    }
    return movies;
  }, [movies.map(m => m.id).join(','), title]);

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

  const processedMovies = currentSort 
    ? sortMovies(shuffledMovies, currentSort.field, currentSort.direction)
    : shuffledMovies;

  // Virtual scrolling calculations
  const totalWidth = processedMovies.length * (ITEM_WIDTH + ITEM_GAP);
  const visibleItemsCount = Math.ceil(containerWidth / (ITEM_WIDTH + ITEM_GAP));
  const startIndex = Math.max(0, Math.floor(scrollLeft / (ITEM_WIDTH + ITEM_GAP)) - OVERSCAN);
  const endIndex = Math.min(processedMovies.length, startIndex + visibleItemsCount + OVERSCAN * 2);
  const visibleMovies = processedMovies.slice(startIndex, endIndex);

  // Calculate offset for virtual positioning
  const offsetLeft = startIndex * (ITEM_WIDTH + ITEM_GAP);

  // Update container width on resize
  useEffect(() => {
    const updateContainerWidth = () => {
      if (containerRef.current) {
        setContainerWidth(containerRef.current.offsetWidth);
      }
    };

    updateContainerWidth();
    window.addEventListener('resize', updateContainerWidth);
    return () => window.removeEventListener('resize', updateContainerWidth);
  }, []);

  // Handle carousel scroll
  const handleScroll = useCallback(() => {
    if (!carouselApi) return;
    
    // This is a simplified approach - in a real implementation,
    // you'd need to work with the Embla carousel's scroll position
    const scrollContainer = carouselApi.containerNode();
    if (scrollContainer) {
      setScrollLeft(scrollContainer.scrollLeft);
    }
  }, [carouselApi]);

  useEffect(() => {
    if (!carouselApi) return;

    carouselApi.on('scroll', handleScroll);
    return () => carouselApi.off('scroll', handleScroll);
  }, [carouselApi, handleScroll]);

  const toggleRibbon = () => {
    setIsRibbonOpen(!isRibbonOpen);
  };

  const handleSortToggle = (field: SortField) => {
    if (currentSort?.field === field) {
      const newDirection = currentSort.direction === 'asc' ? 'desc' : 'asc';
      setCurrentSort({ field, direction: newDirection });
    } else {
      const defaultDirection = sortOptions.find(opt => opt.field === field)?.direction || 'asc';
      setCurrentSort({ field, direction: defaultDirection });
    }
  };

  const getCurrentSortDirection = (field: SortField) => {
    if (currentSort?.field === field) {
      return currentSort.direction;
    }
    return null;
  };

  return (
    <div 
      ref={containerRef}
      className="relative px-4 mx-auto w-full max-w-[calc(100vw-10px)] md:max-w-[calc(100vw-var(--dynamic-sidebar-width)-30px)] focus:outline-none"
      data-ribbon={ribbonId || title}
      tabIndex={movies.length === 0 ? 0 : -1}
      style={{
        '--dynamic-sidebar-width': sidebarWidth,
        outline: 'none',
      } as React.CSSProperties}
    >
      {/* Header */}
      <div className="flex w-full justify-between items-center pr-2 mb-3 mt-5">
        <div 
          onClick={toggleRibbon} 
          className="flex justify-start items-center select-none gap-x-2 text-zinc-900 dark:text-zinc-200 text-xl font-semibold z-10 cursor-pointer hover:text-black dark:hover:text-zinc-100 transition-colors duration-200 ease-in-out"
        >
          <div>
            {title}
            <span className="text-sm text-zinc-500 dark:text-zinc-400 ml-2">
              (Virtual: {visibleMovies.length}/{processedMovies.length})
            </span>
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
                      ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                      : 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400'
                  }`}
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

      {/* Content */}
      <div className={`transition-all duration-500 ease-in-out transform-gpu overflow-hidden ${
        isRibbonOpen 
          ? 'opacity-100 translate-y-0 scale-100 h-auto pt-4' 
          : 'opacity-0 -translate-y-4 scale-95 pointer-events-none h-0 pt-0'
      }`}>
        {movies.length === 0 ? (
          <EmptyRibbonState
            title="No movies available"
            description="There are no movies to display at the moment."
            icon="clapper"
          />
        ) : (
          <Ribbon
            align="start"
            dragFree={true}
            onApiInitialized={setCarouselApi}
          >
            {/* Virtual container with proper width */}
            <div 
              style={{ 
                width: totalWidth,
                height: '17rem',
                position: 'relative'
              }}
            >
              {/* Rendered items */}
              <div 
                style={{
                  position: 'absolute',
                  left: offsetLeft,
                  top: 0,
                  display: 'flex',
                  gap: '2rem'
                }}
              >
                {visibleMovies.map((movie: any, index: number) => {
                  const actualIndex = startIndex + index;
                  const isPriority = actualIndex < 8;

                  return (
                    <div key={movie.id} style={{ width: ITEM_WIDTH }}>
                      <MoviePoster
                        movie={movie}
                        imgBaseUrl={imgBaseUrl}
                        isPriority={isPriority}
                        onWatchLaterToggle={onWatchLaterToggle}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </Ribbon>
        )}
      </div>
    </div>
  );
} 