import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";

interface PaginatedRibbonProps {
  children: React.ReactNode[];
  itemsPerPage?: number;
  paginationThreshold?: number;
  align?: "start" | "center" | "end";
  dragFree?: boolean;
}

export function PaginatedRibbon({ 
  children, 
  itemsPerPage = 20,
  paginationThreshold = 20,
  align = "start",
  dragFree = true
}: PaginatedRibbonProps) {
  const [currentPage, setCurrentPage] = useState(1);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const ribbonContainerRef = useRef<HTMLDivElement>(null);

  // Determine if we should use pagination
  const shouldPaginate = children.length > paginationThreshold;
  
  // Calculate pagination values
  const totalPages = shouldPaginate ? Math.ceil(children.length / itemsPerPage) : 1;
  const startIndex = shouldPaginate ? (currentPage - 1) * itemsPerPage : 0;
  const endIndex = shouldPaginate ? startIndex + itemsPerPage : children.length;
  
  // Get the currently visible items
  const visibleChildren = children.slice(startIndex, endIndex);

  // Reset to page 1 when children change
  useEffect(() => {
    setCurrentPage(1);
  }, [children.length]);

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

  const handlePageJump = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      restoreFocusToRibbon();
    }
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

  // Generate page numbers for pagination display (simplified for cast/crew)
  const getVisiblePageNumbers = () => {
    const pages = [];
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;
    const maxVisiblePages = isMobile ? 3 : 5;
    const sidePages = isMobile ? 1 : 2;
    
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
    <div className="w-full">
      <div ref={ribbonContainerRef}>
        <Ribbon
          align={align}
          dragFree={dragFree}
          onApiInitialized={setCarouselApi}
        >
          {visibleChildren.map((child, index) => (
            <RibbonItem key={`page-${currentPage}-item-${index}`}>
              {child}
            </RibbonItem>
          ))}
        </Ribbon>
      </div>

      {/* Simple pagination with arrows */}
      {shouldPaginate && (
        <div className="flex items-center justify-center mt-4 gap-2">
          {/* Previous Button */}
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors duration-200 ${
              currentPage === 1
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer'
            }`}
            title="Previous page"
            aria-label="Previous page"
          >
            <ChevronLeftIcon className="w-4 h-4" />
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1">
            {getVisiblePageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === 'number' ? handlePageJump(page) : undefined}
                disabled={page === '...'}
                className={`min-w-[1.5rem] h-6 text-xs font-medium transition-colors duration-200 ${
                  page === currentPage
                    ? 'text-rose-600 dark:text-rose-400 font-bold cursor-default'
                    : page === '...'
                    ? 'text-zinc-500 dark:text-zinc-400 cursor-default'
                    : 'text-zinc-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer'
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
            className={`flex items-center justify-center w-6 h-6 rounded transition-colors duration-200 ${
              currentPage === totalPages
                ? 'text-zinc-400 dark:text-zinc-600 cursor-not-allowed'
                : 'text-zinc-600 dark:text-zinc-300 hover:text-rose-600 dark:hover:text-rose-400 cursor-pointer'
            }`}
            title="Next page"
            aria-label="Next page"
          >
            <ChevronRightIcon className="w-4 h-4" />
          </button>

          {/* Page indicator */}
          <div className="text-xs text-zinc-500 dark:text-zinc-400 ml-2">
            Page {currentPage} of {totalPages}
          </div>
        </div>
      )}
    </div>
  );
} 