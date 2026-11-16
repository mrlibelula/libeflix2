import { useState, useEffect, useRef, useCallback } from "react";
import { ChevronDownIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { MoviePoster } from "@/components/movie-poster";
import { EpisodeCard } from "@/components/ui/episode-card";
import { HistoryLandscapeMovieCard } from "@/components/ui/history-landscape-movie-card";
import { EmptyRibbonState } from "@/components/ui/empty-ribbon-state";

interface SidebarStateDetail {
  state: "expanded" | "collapsed";
  width: string;
  isMobile: boolean;
}

export type HistoryItem = {
  id: number;
  history_type: "movie" | "episode";
  [key: string]: any;
};

interface HistoryRibbonProps {
  items: HistoryItem[];
  imgBaseUrl: string;
  title?: string;
  ribbonId?: string;
  /** When true, movies use the same 16:9 tile size as episodes (Continue Watching). */
  uniformLandscape?: boolean;
  /** Carousel page size — keep small for smoother history browsing. */
  itemsPerPage?: number;
  onRemoveFromHistory?: (type: "movie" | "episode", id: number) => void;
  onWatchLaterToggle?: (movieId: number, newStatus: boolean) => void;
  onLikeToggle?: (movieId: number, newStatus: boolean, newCount: number) => void;
}

const DEFAULT_ITEMS_PER_PAGE = 12;

export function HistoryRibbon({
  items,
  imgBaseUrl,
  title = "History",
  ribbonId,
  uniformLandscape = false,
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  onRemoveFromHistory,
  onWatchLaterToggle,
  onLikeToggle,
}: HistoryRibbonProps) {
  const [isRibbonOpen, setIsRibbonOpen] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const ribbonContainerRef = useRef<HTMLDivElement>(null);

  const getInitialSidebarWidth = () => {
    if (typeof document !== "undefined") {
      const cookies = document.cookie.split(";");
      const sidebarCookie = cookies.find((cookie) => cookie.trim().startsWith("sidebar_state="));
      if (sidebarCookie) {
        const isExpanded = sidebarCookie.split("=")[1] === "true";
        return isExpanded ? "12rem" : "3rem";
      }
    }
    return "12rem";
  };

  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth());

  useEffect(() => {
    const handleSidebarStateChange = (event: CustomEvent<SidebarStateDetail>) => {
      const { width, isMobile } = event.detail;
      if (!isMobile) {
        setSidebarWidth(width);
      }
    };

    window.addEventListener("sidebarStateChange", handleSidebarStateChange as EventListener);
    return () => {
      window.removeEventListener("sidebarStateChange", handleSidebarStateChange as EventListener);
    };
  }, []);

  const shouldPaginate = items.length > itemsPerPage;
  const totalPages = shouldPaginate ? Math.ceil(items.length / itemsPerPage) : 1;
  const startIndex = shouldPaginate ? (currentPage - 1) * itemsPerPage : 0;
  const endIndex = shouldPaginate ? startIndex + itemsPerPage : items.length;
  const visibleItems = items.slice(startIndex, endIndex);

  useEffect(() => {
    setCurrentPage(1);
  }, [items.length, itemsPerPage]);

  useEffect(() => {
    if (carouselApi) {
      carouselApi.scrollTo(0);
    }
  }, [currentPage, carouselApi, visibleItems.length]);

  const restoreFocusToRibbon = useCallback(() => {
    setTimeout(() => {
      if (ribbonContainerRef.current) {
        let carouselElement = ribbonContainerRef.current.querySelector('[tabindex="0"]');
        if (!carouselElement) {
          carouselElement = ribbonContainerRef.current.querySelector(
            '[role="region"][aria-roledescription="carousel"]'
          );
        }
        if (carouselElement) {
          (carouselElement as HTMLElement).focus();
        }
      }
    }, 100);
  }, []);

  const getVisiblePageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
      return pages;
    }

    pages.push(1);
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    if (start > 2) pages.push("...");
    for (let i = start; i <= end; i++) pages.push(i);
    if (end < totalPages - 1) pages.push("...");
    pages.push(totalPages);
    return pages;
  };

  return (
    <div
      className="relative px-4 mx-auto w-full max-w-[calc(100vw-15px)] md:max-w-[calc(100vw-var(--dynamic-sidebar-width)-50px)] focus:outline-none"
      data-ribbon={ribbonId || title}
      tabIndex={items.length === 0 ? 0 : -1}
      style={{
        "--dynamic-sidebar-width": sidebarWidth,
        outline: "none",
      } as React.CSSProperties}
    >
      <div className="flex w-full justify-between items-center pr-2 mb-3 mt-5">
        <button
          type="button"
          onClick={() => setIsRibbonOpen((open) => !open)}
          className="flex items-center gap-x-2 text-left select-none text-zinc-900 dark:text-zinc-200 text-xl font-semibold z-10 cursor-pointer hover:text-black dark:hover:text-zinc-100 transition-colors duration-200 ease-in-out"
        >
          <span>
            {title}
            {shouldPaginate && (
              <span className="text-sm font-normal ml-2 text-zinc-600 dark:text-zinc-400">
                Page {currentPage} of {totalPages}
              </span>
            )}
          </span>
          <ChevronDownIcon
            className={`w-5 h-5 text-zinc-500 transition-transform duration-200 ${
              isRibbonOpen ? "rotate-0" : "-rotate-90"
            }`}
          />
        </button>
      </div>

      <div
        className={`transition-all duration-500 ease-in-out transform-gpu overflow-hidden ${
          isRibbonOpen
            ? "opacity-100 translate-y-0 scale-100 h-auto pt-4"
            : "opacity-0 -translate-y-4 scale-95 pointer-events-none h-0 pt-0"
        }`}
      >
        {items.length === 0 ? (
          <EmptyRibbonState
            title="Nothing here yet"
            description="Watch something to see it show up in this section."
            icon="clapper"
          />
        ) : (
          <>
            <div ref={ribbonContainerRef}>
              <Ribbon align="start" dragFree={true} onApiInitialized={setCarouselApi}>
                {visibleItems.map((item, index) => {
                  const isPriority = index < 6;
                  const key = `${item.history_type}-${item.id}`;

                  if (item.history_type === "episode") {
                    return (
                      <RibbonItem key={key}>
                        <EpisodeCard
                          episode={item as any}
                          imgBaseUrl={imgBaseUrl}
                          isPriority={isPriority}
                          onRemoveFromHistory={
                            onRemoveFromHistory
                              ? (episodeId) => onRemoveFromHistory("episode", episodeId)
                              : undefined
                          }
                        />
                      </RibbonItem>
                    );
                  }

                  if (uniformLandscape) {
                    return (
                      <RibbonItem key={key}>
                        <HistoryLandscapeMovieCard
                          movie={item as any}
                          imgBaseUrl={imgBaseUrl}
                          isPriority={isPriority}
                          onRemoveFromHistory={
                            onRemoveFromHistory
                              ? (movieId) => onRemoveFromHistory("movie", movieId)
                              : undefined
                          }
                        />
                      </RibbonItem>
                    );
                  }

                  return (
                    <RibbonItem key={key}>
                      <MoviePoster
                        movie={item as any}
                        imgBaseUrl={imgBaseUrl}
                        isPriority={isPriority}
                        onWatchLaterToggle={onWatchLaterToggle}
                        onLikeToggle={onLikeToggle}
                        onRemoveFromHistory={
                          onRemoveFromHistory
                            ? (movieId) => onRemoveFromHistory("movie", movieId)
                            : undefined
                        }
                      />
                    </RibbonItem>
                  );
                })}
              </Ribbon>
            </div>

            {shouldPaginate && (
              <div className="flex items-center justify-center mt-4 md:mt-6 pb-2">
                <div className="flex items-center gap-1 md:gap-2 w-[380px] md:w-[500px] justify-center">
                  <button
                    type="button"
                    onClick={() => {
                      if (currentPage > 1) {
                        setCurrentPage((prev) => prev - 1);
                        restoreFocusToRibbon();
                      }
                    }}
                    disabled={currentPage === 1}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-200 ${
                      currentPage === 1
                        ? "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                        : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                    }`}
                    title="Previous page"
                    aria-label="Previous page"
                  >
                    <ChevronLeftIcon className="w-4 h-4" />
                  </button>

                  <div className="flex items-center justify-center gap-1 flex-1 min-w-0">
                    {getVisiblePageNumbers().map((page, index) => (
                      <button
                        type="button"
                        key={index}
                        onClick={() => {
                          if (typeof page === "number") {
                            setCurrentPage(page);
                            restoreFocusToRibbon();
                          }
                        }}
                        disabled={page === "..."}
                        className={`min-w-[2rem] w-8 h-8 rounded-md text-xs md:text-sm font-medium transition-colors duration-200 ${
                          page === currentPage
                            ? "bg-rose-600 text-white hover:bg-rose-700 cursor-default"
                            : page === "..."
                              ? "bg-transparent text-zinc-500 dark:text-zinc-400 cursor-default"
                              : "text-zinc-700 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (currentPage < totalPages) {
                        setCurrentPage((prev) => prev + 1);
                        restoreFocusToRibbon();
                      }
                    }}
                    disabled={currentPage === totalPages}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-200 ${
                      currentPage === totalPages
                        ? "text-zinc-400 dark:text-zinc-600 cursor-not-allowed"
                        : "text-zinc-700 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-zinc-100 cursor-pointer"
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
