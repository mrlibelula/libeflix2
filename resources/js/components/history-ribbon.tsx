import { useState, useEffect, useRef, useCallback } from "react";
import {
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ArrowUpIcon,
  ArrowDownIcon,
  ClockIcon,
  TypeIcon,
  PercentIcon,
  Repeat2Icon,
} from "lucide-react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { MoviePoster } from "@/components/movie-poster";
import { EpisodeCard } from "@/components/ui/episode-card";
import { HistoryLandscapeMovieCard } from "@/components/ui/history-landscape-movie-card";
import { EmptyRibbonState } from "@/components/ui/empty-ribbon-state";
import type { HistorySortState, ServerPaginationProps } from "@/types/history";

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

type HistorySortField = "watched" | "name" | "progress" | "plays";
type SortDirection = "asc" | "desc";

interface SortOption {
  field: HistorySortField;
  direction: SortDirection;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}

interface HistoryRibbonProps {
  items: HistoryItem[];
  imgBaseUrl: string;
  title?: string;
  ribbonId?: string;
  /** When true, movies use the same 16:9 tile size as episodes (Continue Watching). */
  uniformLandscape?: boolean;
  /** Which sort buttons to show (defaults to watched + name). */
  sortFields?: HistorySortField[];
  /** Client-side page size when not using serverPagination. */
  itemsPerPage?: number;
  /** Lazy server-side pagination — `items` is the current page only. */
  serverPagination?: ServerPaginationProps;
  onRemoveFromHistory?: (type: "movie" | "episode", id: number) => void;
  onWatchLaterToggle?: (movieId: number, newStatus: boolean) => void;
  onLikeToggle?: (movieId: number, newStatus: boolean, newCount: number) => void;
}

const DEFAULT_ITEMS_PER_PAGE = 12;

const ALL_SORT_OPTIONS: SortOption[] = [
  { field: "watched", direction: "desc", icon: ClockIcon, label: "Watched" },
  { field: "plays", direction: "desc", icon: Repeat2Icon, label: "Plays" },
  { field: "progress", direction: "desc", icon: PercentIcon, label: "Progress" },
  { field: "name", direction: "asc", icon: TypeIcon, label: "Name" },
];

export function HistoryRibbon({
  items,
  imgBaseUrl,
  title = "History",
  ribbonId,
  uniformLandscape = false,
  sortFields = ["watched", "name"],
  itemsPerPage = DEFAULT_ITEMS_PER_PAGE,
  serverPagination,
  onRemoveFromHistory,
  onWatchLaterToggle,
  onLikeToggle,
}: HistoryRibbonProps) {
  const [isRibbonOpen, setIsRibbonOpen] = useState(true);
  const [clientPage, setClientPage] = useState(1);
  const [clientSort, setClientSort] = useState<HistorySortState | null>(null);
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

  const isServerPaged = !!serverPagination;
  const isServerSorted = isServerPaged && !!serverPagination.onSortChange;
  const currentSort = isServerSorted ? serverPagination.sort ?? null : clientSort;
  const currentPage = isServerPaged ? serverPagination.page : clientPage;
  const totalPages = isServerPaged
    ? Math.max(1, serverPagination.lastPage)
    : items.length > itemsPerPage
      ? Math.ceil(items.length / itemsPerPage)
      : 1;
  const shouldPaginate = totalPages > 1;
  const startIndex = isServerPaged ? 0 : (currentPage - 1) * itemsPerPage;
  const endIndex = isServerPaged ? items.length : startIndex + itemsPerPage;
  const isLoading = serverPagination?.isLoading ?? false;

  const sortOptions = ALL_SORT_OPTIONS.filter((option) => sortFields.includes(option.field));

  const sortItems = (itemsToSort: HistoryItem[], field: string, direction: SortDirection) => {
    return [...itemsToSort].sort((a, b) => {
      let aValue: string | number = 0;
      let bValue: string | number = 0;

      switch (field) {
        case "name":
          aValue = (a.title || a.name || a.tvshow?.name || "").toLowerCase();
          bValue = (b.title || b.name || b.tvshow?.name || "").toLowerCase();
          break;
        case "progress":
          aValue = a.progress_percentage || 0;
          bValue = b.progress_percentage || 0;
          break;
        case "plays":
          aValue = a.plays_count || 0;
          bValue = b.plays_count || 0;
          break;
        case "watched":
        default:
          aValue = a.last_watched_at ? new Date(a.last_watched_at).getTime() : 0;
          bValue = b.last_watched_at ? new Date(b.last_watched_at).getTime() : 0;
          break;
      }

      if (direction === "asc") {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
      }
      return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
    });
  };

  const processedItems =
    !isServerSorted && currentSort
      ? sortItems(items, currentSort.field, currentSort.direction)
      : items;
  const visibleItems = isServerPaged
    ? processedItems
    : processedItems.slice(startIndex, endIndex);

  useEffect(() => {
    if (!isServerPaged) {
      setClientPage(1);
    }
  }, [items.length, itemsPerPage, isServerPaged, clientSort]);

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

  const handleSortToggle = (field: HistorySortField) => {
    const nextSort: HistorySortState =
      currentSort?.field === field
        ? { field, direction: currentSort.direction === "asc" ? "desc" : "asc" }
        : {
            field,
            direction: sortOptions.find((opt) => opt.field === field)?.direction || "asc",
          };

    if (isServerSorted) {
      serverPagination.onSortChange?.(nextSort);
    } else {
      setClientSort(nextSort);
    }
    restoreFocusToRibbon();
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages || page === currentPage || isLoading) {
      return;
    }
    if (isServerPaged) {
      serverPagination.onPageChange(page);
    } else {
      setClientPage(page);
    }
    restoreFocusToRibbon();
  };

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

  const getCurrentSortDirection = (field: HistorySortField) => {
    if (currentSort?.field === field) {
      return currentSort.direction;
    }
    return null;
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

        {items.length > 0 && sortOptions.length > 0 && (
          <div className="flex items-center gap-1">
            {sortOptions.map((option) => {
              const isActive = getCurrentSortDirection(option.field) !== null;
              const direction = getCurrentSortDirection(option.field);

              return (
                <button
                  key={option.field}
                  type="button"
                  onClick={() => handleSortToggle(option.field)}
                  disabled={isLoading}
                  className={`flex items-center gap-1 px-2 py-1.5 rounded-md transition-colors duration-200 text-sm font-medium cursor-pointer ${
                    isActive
                      ? "text-rose-700 dark:text-rose-300"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
                  }`}
                  title={`Sort by ${option.label}${isActive ? ` (${direction === "asc" ? "ascending" : "descending"})` : ""}`}
                >
                  <option.icon className="w-4 h-4" />
                  {isActive &&
                    (direction === "asc" ? (
                      <ArrowUpIcon className="w-3 h-3" />
                    ) : (
                      <ArrowDownIcon className="w-3 h-3" />
                    ))}
                </button>
              );
            })}
          </div>
        )}
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
            <div
              ref={ribbonContainerRef}
              className={`transition-opacity duration-200 ${isLoading ? "opacity-50 pointer-events-none" : "opacity-100"}`}
            >
              <Ribbon align="start" dragFree={true} onApiInitialized={setCarouselApi}>
                {visibleItems.map((item, index) => {
                  const isPriority = index < 6;
                  const key = `${item.history_type}-${item.id}-${currentPage}`;

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
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1 || isLoading}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-200 ${
                      currentPage === 1 || isLoading
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
                            goToPage(page);
                          }
                        }}
                        disabled={page === "..." || isLoading}
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
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages || isLoading}
                    className={`flex items-center justify-center w-8 h-8 rounded-md transition-colors duration-200 ${
                      currentPage === totalPages || isLoading
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
