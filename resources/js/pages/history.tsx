import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { EpisodeRibbon } from "@/components/episode-ribbon";
import { HistoryRibbon, type HistoryItem } from "@/components/history-ribbon";
import { useState, useRef, useEffect, useCallback } from "react";
import { SummaryCard } from "@/components/ui/summary-card";
import { Clapperboard, PlaySquare, History as HistoryIcon, Repeat2, PlayCircle } from "lucide-react";
import { api } from "@/lib/api";
import type { HistoryPagePayload, HistoryStats } from "@/types/history";

type HistorySection = "continue" | "movies" | "episodes" | "rewatched";

export default function HistoryPage({
  continueWatching,
  historyMovies,
  historyEpisodes,
  mostRewatched,
  stats,
  imgBaseUrl,
  pageSize = 12,
}: {
  continueWatching: HistoryPagePayload<HistoryItem>;
  historyMovies: HistoryPagePayload<any>;
  historyEpisodes: HistoryPagePayload<any>;
  mostRewatched: HistoryPagePayload<HistoryItem>;
  stats: HistoryStats;
  imgBaseUrl: string;
  pageSize?: number;
}) {
  const [continuePage, setContinuePage] = useState(continueWatching);
  const [moviesPage, setMoviesPage] = useState(historyMovies);
  const [episodesPage, setEpisodesPage] = useState(historyEpisodes);
  const [rewatchedPage, setRewatchedPage] = useState(mostRewatched);
  const [statsState, setStatsState] = useState(stats);
  const [loadingSection, setLoadingSection] = useState<HistorySection | null>(null);

  const lastFocusedRibbonRef = useRef<string | null>(null);
  const restoreFocusTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const continueRibbonRef = useRef<HTMLDivElement>(null);
  const moviesRibbonRef = useRef<HTMLDivElement>(null);
  const episodesRibbonRef = useRef<HTMLDivElement>(null);
  const rewatchedRibbonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleFocusChange = () => {
      const activeElement = document.activeElement;
      if (activeElement) {
        const ribbonContainer = activeElement.closest("[data-ribbon]");
        if (ribbonContainer) {
          const ribbonTitle = ribbonContainer.getAttribute("data-ribbon");
          if (ribbonTitle) {
            lastFocusedRibbonRef.current = ribbonTitle;
          }
        }
      }
    };

    document.addEventListener("focusin", handleFocusChange);
    return () => {
      document.removeEventListener("focusin", handleFocusChange);
    };
  }, []);

  const handleSmoothScrollTo = (targetRef: React.RefObject<HTMLDivElement | null>) => {
    if (!targetRef.current) return;

    const target = targetRef.current;
    const targetPosition = target.getBoundingClientRect().top + window.pageYOffset - 100;
    const startPosition = window.pageYOffset;
    const distance = targetPosition - startPosition;
    const duration = 800;
    let start: number | null = null;

    const easeInOutQuad = (t: number): number => {
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    };

    const animation = (currentTime: number) => {
      if (start === null) start = currentTime;
      const timeElapsed = currentTime - start;
      const progress = Math.min(timeElapsed / duration, 1);
      const ease = easeInOutQuad(progress);

      window.scrollTo(0, startPosition + distance * ease);

      if (progress < 1) {
        requestAnimationFrame(animation);
      }
    };

    requestAnimationFrame(animation);
  };

  const fetchSectionPage = useCallback(
    async (section: HistorySection, page: number) => {
      setLoadingSection(section);
      try {
        const response = await api.get<{
          success: boolean;
          items: any[];
          total: number;
          page: number;
          per_page: number;
          last_page: number;
        }>(`/api/history/${section}?page=${page}&per_page=${pageSize}`);

        if (!response.ok || !response.data) {
          throw new Error(response.error || "Failed to load history page");
        }

        const payload: HistoryPagePayload = {
          items: response.data.items,
          total: response.data.total,
          page: response.data.page,
          per_page: response.data.per_page,
          last_page: response.data.last_page,
        };

        switch (section) {
          case "continue":
            setContinuePage(payload);
            break;
          case "movies":
            setMoviesPage(payload);
            break;
          case "episodes":
            setEpisodesPage(payload);
            break;
          case "rewatched":
            setRewatchedPage(payload);
            break;
        }
      } catch (error) {
        console.error("Error loading history section page:", error);
      } finally {
        setLoadingSection(null);
      }
    },
    [pageSize]
  );

  const removeFromSectionLists = useCallback((type: "movie" | "episode", id: number) => {
    const filterItems = <T extends { id: number; history_type?: string }>(
      page: HistoryPagePayload<T>
    ): HistoryPagePayload<T> => {
      const nextItems = page.items.filter((item) => {
        if (item.id !== id) return true;
        if (item.history_type) return item.history_type !== type;
        // movies/episodes typed lists may omit history_type
        return false;
      });

      if (nextItems.length === page.items.length) {
        return page;
      }

      const total = Math.max(0, page.total - 1);
      return {
        ...page,
        items: nextItems,
        total,
        last_page: Math.max(1, Math.ceil(total / page.per_page)),
      };
    };

    setContinuePage((prev) => filterItems(prev));
    setRewatchedPage((prev) => filterItems(prev));

    if (type === "movie") {
      setMoviesPage((prev) => filterItems(prev));
      setStatsState((s) => ({
        ...s,
        titles: Math.max(0, s.titles - 1),
        movies: Math.max(0, s.movies - 1),
      }));
    } else {
      setEpisodesPage((prev) => filterItems(prev));
      setStatsState((s) => ({
        ...s,
        titles: Math.max(0, s.titles - 1),
        episodes: Math.max(0, s.episodes - 1),
      }));
    }
  }, []);

  const handleRemoveFromHistory = useCallback(
    async (type: "movie" | "episode", id: number) => {
      removeFromSectionLists(type, id);

      try {
        const response = await api.delete(`/api/views/progress?type=${type}&id=${id}`);
        if (!response.ok) {
          throw new Error(response.error || `HTTP error! status: ${response.status}`);
        }
      } catch (error) {
        console.error("Error removing from history:", error);
        window.location.reload();
      }
    },
    [removeFromSectionLists]
  );

  const handleMovieRemoveFromHistory = useCallback(
    (movieId: number) => {
      void handleRemoveFromHistory("movie", movieId);
    },
    [handleRemoveFromHistory]
  );

  const handleEpisodeRemoveFromHistory = useCallback(
    (episodeId: number) => {
      void handleRemoveFromHistory("episode", episodeId);
    },
    [handleRemoveFromHistory]
  );

  const handleWatchLaterToggle = useCallback((movieId: number, newStatus: boolean) => {
    const updater = (item: any) =>
      item.id === movieId && (item.history_type === "movie" || !item.history_type)
        ? { ...item, is_watch_later: newStatus }
        : item;

    setMoviesPage((prev) => ({ ...prev, items: prev.items.map(updater) }));
    setContinuePage((prev) => ({ ...prev, items: prev.items.map(updater) }));
    setRewatchedPage((prev) => ({ ...prev, items: prev.items.map(updater) }));
  }, []);

  const handleLikeToggle = useCallback((movieId: number, newStatus: boolean, newCount: number) => {
    const updater = (item: any) =>
      item.id === movieId && (item.history_type === "movie" || !item.history_type)
        ? { ...item, is_liked: newStatus, likes_count: newCount }
        : item;

    setMoviesPage((prev) => ({ ...prev, items: prev.items.map(updater) }));
    setContinuePage((prev) => ({ ...prev, items: prev.items.map(updater) }));
    setRewatchedPage((prev) => ({ ...prev, items: prev.items.map(updater) }));
  }, []);

  useEffect(() => {
    if (lastFocusedRibbonRef.current) {
      if (restoreFocusTimeoutRef.current) {
        clearTimeout(restoreFocusTimeoutRef.current);
      }

      restoreFocusTimeoutRef.current = setTimeout(() => {
        const ribbonContainer = document.querySelector(
          `[data-ribbon="${lastFocusedRibbonRef.current}"]`
        );

        if (ribbonContainer) {
          let carouselElement = ribbonContainer.querySelector('[tabindex="0"]');
          if (!carouselElement) {
            carouselElement = ribbonContainer.querySelector(
              '[role="region"][aria-roledescription="carousel"]'
            );
          }
          if (!carouselElement) {
            carouselElement = ribbonContainer.querySelector('[data-slot="carousel"]');
          }

          if (!carouselElement) {
            if (!ribbonContainer.hasAttribute("tabindex")) {
              ribbonContainer.setAttribute("tabindex", "0");
            }
            carouselElement = ribbonContainer;
          }

          if (carouselElement) {
            (carouselElement as HTMLElement).focus();
          }
        }
      }, 100);
    }

    return () => {
      if (restoreFocusTimeoutRef.current) {
        clearTimeout(restoreFocusTimeoutRef.current);
      }
    };
  }, [continuePage, moviesPage, episodesPage, rewatchedPage]);

  const isEmpty = statsState.titles === 0;

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: "Watch History",
      href: "/history",
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Watch History" />

      <div className="flex flex-col gap-y-10 py-5">
        <div className="px-5">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <SummaryCard
              title="Titles"
              count={statsState.titles}
              iconNode={HistoryIcon}
              onClick={() => handleSmoothScrollTo(continueRibbonRef)}
              className="bg-gradient-to-br from-zinc-100 to-zinc-100 hover:from-zinc-300 hover:to-zinc-200 dark:from-zinc-500/20 dark:to-zinc-700/30 dark:hover:from-zinc-600/60 dark:hover:to-zinc-800/60"
            />
            <SummaryCard
              title="Movies"
              count={statsState.movies}
              iconNode={Clapperboard}
              onClick={() => handleSmoothScrollTo(moviesRibbonRef)}
              className="bg-gradient-to-br dark:from-zinc-500/20 dark:to-zinc-700/30 dark:hover:from-zinc-600/60 dark:hover:to-zinc-800/60"
            />
            <SummaryCard
              title="Episodes"
              count={statsState.episodes}
              iconNode={PlaySquare}
              onClick={() => handleSmoothScrollTo(episodesRibbonRef)}
              className="bg-gradient-to-br dark:from-zinc-500/20 dark:to-zinc-700/30 dark:hover:from-zinc-600/60 dark:hover:to-zinc-800/60"
            />
            <SummaryCard
              title="Total Plays"
              count={statsState.total_plays}
              iconNode={Repeat2}
              onClick={() => handleSmoothScrollTo(rewatchedRibbonRef)}
              className="bg-gradient-to-br dark:from-zinc-500/20 dark:to-zinc-700/30 dark:hover:from-zinc-600/60 dark:hover:to-zinc-800/60"
            />
          </div>
        </div>

        {!isEmpty && (
          <>
            {continuePage.total > 0 && (
              <div ref={continueRibbonRef}>
                <HistoryRibbon
                  items={continuePage.items}
                  imgBaseUrl={imgBaseUrl}
                  title={`Continue Watching (${continuePage.total})`}
                  ribbonId="history-continue"
                  uniformLandscape
                  serverPagination={{
                    total: continuePage.total,
                    page: continuePage.page,
                    perPage: continuePage.per_page,
                    lastPage: continuePage.last_page,
                    isLoading: loadingSection === "continue",
                    onPageChange: (page) => void fetchSectionPage("continue", page),
                  }}
                  onRemoveFromHistory={handleRemoveFromHistory}
                  onWatchLaterToggle={handleWatchLaterToggle}
                  onLikeToggle={handleLikeToggle}
                />
              </div>
            )}

            {moviesPage.total > 0 && (
              <div ref={moviesRibbonRef}>
                <MovieRibbon
                  movies={moviesPage.items}
                  imgBaseUrl={imgBaseUrl}
                  title={`Movies (${moviesPage.total})`}
                  ribbonId="history-movies"
                  onWatchLaterToggle={handleWatchLaterToggle}
                  onLikeToggle={handleLikeToggle}
                  onRemoveFromHistory={handleMovieRemoveFromHistory}
                  hideSortOptions={["added", "name", "year", "rating"]}
                  serverPagination={{
                    total: moviesPage.total,
                    page: moviesPage.page,
                    perPage: moviesPage.per_page,
                    lastPage: moviesPage.last_page,
                    isLoading: loadingSection === "movies",
                    onPageChange: (page) => void fetchSectionPage("movies", page),
                  }}
                />
              </div>
            )}

            {episodesPage.total > 0 && (
              <div ref={episodesRibbonRef}>
                <EpisodeRibbon
                  episodes={episodesPage.items}
                  imgBaseUrl={imgBaseUrl}
                  title={`Episodes (${episodesPage.total})`}
                  ribbonId="history-episodes"
                  onRemoveFromHistory={handleEpisodeRemoveFromHistory}
                  serverPagination={{
                    total: episodesPage.total,
                    page: episodesPage.page,
                    perPage: episodesPage.per_page,
                    lastPage: episodesPage.last_page,
                    isLoading: loadingSection === "episodes",
                    onPageChange: (page) => void fetchSectionPage("episodes", page),
                  }}
                />
              </div>
            )}

            {rewatchedPage.total > 0 && (
              <div ref={rewatchedRibbonRef}>
                <HistoryRibbon
                  items={rewatchedPage.items}
                  imgBaseUrl={imgBaseUrl}
                  title={`Most Rewatched (${rewatchedPage.total})`}
                  ribbonId="history-rewatched"
                  serverPagination={{
                    total: rewatchedPage.total,
                    page: rewatchedPage.page,
                    perPage: rewatchedPage.per_page,
                    lastPage: rewatchedPage.last_page,
                    isLoading: loadingSection === "rewatched",
                    onPageChange: (page) => void fetchSectionPage("rewatched", page),
                  }}
                  onRemoveFromHistory={handleRemoveFromHistory}
                  onWatchLaterToggle={handleWatchLaterToggle}
                  onLikeToggle={handleLikeToggle}
                />
              </div>
            )}
          </>
        )}

        {isEmpty && (
          <div className="flex items-center justify-center py-32 text-zinc-500 dark:text-zinc-400">
            <div className="text-center max-w-md px-4">
              <div className="flex justify-center mb-4">
                <PlayCircle className="w-16 h-16 text-zinc-400 dark:text-zinc-500" />
              </div>
              <h2 className="text-2xl font-bold mb-2 text-zinc-800 dark:text-zinc-200">
                No watch history yet
              </h2>
              <p className="text-lg">
                Start watching movies and episodes — your progress, timestamps, and replays will show
                up here.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
