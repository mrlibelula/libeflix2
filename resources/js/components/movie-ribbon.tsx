import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ChevronDownIcon, ArrowUpIcon, ArrowDownIcon, TypeIcon, CalendarIcon, StarIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon } from "lucide-react";
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
  onLikeToggle?: (movieId: number, newStatus: boolean, newCount: number) => void;
  hideSortOptions?: SortField[];
}

type SortField = 'name' | 'year' | 'rating' | 'added';
type SortDirection = 'asc' | 'desc';

interface SortOption {
  field: SortField;
  direction: SortDirection;
  icon: React.ComponentType<any>;
  label: string;
}

// Configuration for pagination
const ITEMS_PER_PAGE = 30; // Show 30 items per page
const PAGINATION_THRESHOLD = 30; // Use pagination if more than 30 items

export function MovieRibbon({ 
  movies, 
  imgBaseUrl, 
  title = "Now Streaming" + (movies.length > 0 ? ` (${movies.length})` : ""),
  ribbonId,
  onWatchLaterToggle,
  onLikeToggle,
  hideSortOptions = [],
}: MovieRibbonProps) {

  const [isRibbonOpen, setIsRibbonOpen] = useState(true);
  const [currentSort, setCurrentSort] = useState<{ field: SortField; direction: SortDirection } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
  // Ref for the ribbon container to control scroll position
  const ribbonContainerRef = useRef<HTMLDivElement>(null);
  // Carousel API for controlling scroll position
  const [carouselApi, setCarouselApi] = useState<any>(null);
  
  // Sort options configuration
  const allSortOptions: SortOption[] = [
    { field: 'added', direction: 'desc', icon: ClockIcon, label: 'Added' },
    { field: 'rating', direction: 'desc', icon: StarIcon, label: 'Rating' },
    { field: 'year', direction: 'desc', icon: CalendarIcon, label: 'Year' },
    { field: 'name', direction: 'asc', icon: TypeIcon, label: 'Name' },
  ];

  // Filter out hidden sort options
  const sortOptions = allSortOptions.filter(option => !hideSortOptions.includes(option.field));

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
        case 'added':
          // For "added" sorting, use the original array index to maintain default order
          // This preserves the order items were loaded from the backend
          aValue = moviesToSort.indexOf(a);
          bValue = moviesToSort.indexOf(b);
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

  // Determine if we should use pagination
  const shouldPaginate = processedMovies.length > PAGINATION_THRESHOLD;
  
  // Calculate pagination values
  const totalPages = shouldPaginate ? Math.ceil(processedMovies.length / ITEMS_PER_PAGE) : 1;
  const startIndex = shouldPaginate ? (currentPage - 1) * ITEMS_PER_PAGE : 0;
  const endIndex = shouldPaginate ? startIndex + ITEMS_PER_PAGE : processedMovies.length;
  
  // Get the currently visible movies
  const visibleMovies = processedMovies.slice(startIndex, endIndex);

  // Reset to page 1 when movies change or sort changes
  useEffect(() => {
    setCurrentPage(1);
  }, [processedMovies.length, currentSort]);

  // Reset ribbon scroll position when page changes
  useEffect(() => {
    if (carouselApi) {
      // Use carousel API to scroll to the beginning
      carouselApi.scrollTo(0);
    }
  }, [currentPage, carouselApi]);

  // Restore focus to ribbon after pagination
  const restoreFocusToRibbon = useCallback(() => {
    // Add a small delay to ensure DOM has updated
    setTimeout(() => {
      if (ribbonContainerRef.current) {
        // Try to find the carousel element using multiple selectors
        let carouselElement = ribbonContainerRef.current.querySelector('[tabindex="0"]');
        if (!carouselElement) {
          carouselElement = ribbonContainerRef.current.querySelector('[role="region"][aria-roledescription="carousel"]');
        }
        if (!carouselElement) {
          carouselElement = ribbonContainerRef.current.querySelector('[data-slot="carousel"]');
        }
        
        if (carouselElement) {
          (carouselElement as HTMLElement).focus();
        }
      }
    }, 100);
  }, []);

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
    
    // Restore focus to ribbon after sorting
    restoreFocusToRibbon();
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(prev => prev - 1);
      restoreFocusToRibbon();
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(prev => prev + 1);
      restoreFocusToRibbon();
    }
  };

  const handlePageJump = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      restoreFocusToRibbon();
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

  // Generate page numbers for pagination display
  const getVisiblePageNumbers = () => {
    const pages = [];
    // Responsive max pages: 3 on mobile, 5 on desktop
    const isMobile = window.innerWidth < 768;
    const maxVisiblePages = isMobile ? 3 : 5;
    const sidePages = isMobile ? 1 : 2; // Pages around current page
    
    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Show current page and surrounding pages
      const start = Math.max(1, currentPage - sidePages);
      const end = Math.min(totalPages, currentPage + sidePages);
      
      // Always show first page
      if (start > 1) {
        pages.push(1);
        if (start > 2) pages.push('...');
      }
      
      // Show middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }
      
      // Always show last page
      if (end < totalPages) {
        if (end < totalPages - 1) pages.push('...');
        pages.push(totalPages);
      }
    }
    
    return pages;
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
            {shouldPaginate && (
              <span className="text-sm font-normal ml-2 text-zinc-600 dark:text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>
            )}
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
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition-colors duration-200 text-sm font-medium cursor-pointer ${
                    isActive
                      ? 'bg-rose-100_ _dark:bg-rose-900/30 text-rose-700 dark:text-rose-300 hover:bg-rose-200_ _dark:hover:bg-rose-900/50'
                      : 'bg-zinc-100_ _dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200_ dark:hover:bg-zinc-700_ hover:text-zinc-900 dark:hover:text-zinc-100'
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
          <>
            <div ref={ribbonContainerRef}>
              <Ribbon
                align="start"
                dragFree={true}
                onApiInitialized={setCarouselApi}
              >
              {visibleMovies.map((movie: any, index: number) => {
                // Only prioritize the first 6-8 items (typical viewport on desktop)
                // This provides good initial load performance while still lazy loading the rest
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
                      onLikeToggle={onLikeToggle}
                    />
                  </RibbonItem>
                );
              })}
            </Ribbon>
            </div>

            {/* Pagination Controls */}
            {shouldPaginate && (
              <div className="flex items-center justify-center mt-4 md:mt-6 pb-2">
                {/* Fixed width container to keep arrow buttons in consistent positions */}
                <div className="flex items-center gap-1 md:gap-2 w-[380px] md:w-[500px] justify-center">
                  {/* Previous Button */}
                  <button
                    onClick={handlePreviousPage}
                    disabled={currentPage === 1}
                    className={`flex items-center justify-center w-8 h-8 md:w-9_ md:h-9_ rounded-md transition-colors duration-200 ${
                      currentPage === 1
                        ? 'bg-zinc-100_ dark:bg-zinc-800_ text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-100_ dark:bg-zinc-800_ text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200_ dark:hover:bg-zinc-700_ hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer'
                    }`}
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>

                  {/* Page Numbers - centered within fixed space */}
                  <div className="flex items-center justify-center gap-1 flex-1 min-w-0">
                    {getVisiblePageNumbers().map((page, index) => (
                      <button
                        key={index}
                        onClick={() => typeof page === 'number' ? handlePageJump(page) : undefined}
                        disabled={page === '...'}
                        className={`min-w-[2rem] w-8 h-8 md:min-w-[2.5rem] md:w-9_ md:h-9_ rounded-md text-xs md:text-sm font-medium transition-colors duration-200 ${
                          page === currentPage
                            ? 'bg-rose-600 text-white hover:bg-rose-700 cursor-default'
                            : page === '...'
                            ? 'bg-transparent text-zinc-500 dark:text-zinc-400 cursor-default'
                            : 'bg-zinc-100_ _dark:bg-zinc-800 text-zinc-700 dark:text-zinc-500 hover:bg-zinc-200_ dark:hover:bg-zinc-700_ hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer'
                        }`}
                        title={typeof page === 'number' ? `Go to page ${page}` : undefined}
                        aria-label={typeof page === 'number' ? `Go to page ${page}` : undefined}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  {/* Next Button */}
                  <button
                    onClick={handleNextPage}
                    disabled={currentPage === totalPages}
                    className={`flex items-center justify-center w-8 h-8 md:w-9_ md:h-9_ rounded-md transition-colors duration-200 ${
                      currentPage === totalPages
                        ? 'bg-zinc-100_ _dark:bg-zinc-800 text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                        : 'bg-zinc-100_ _dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200_ dark:hover:bg-zinc-700_ hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer'
                    }`}
                    title="Next page"
                    aria-label="Next page"
                  >
                    <ChevronRightIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
} 