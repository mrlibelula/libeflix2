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

type HistoryStats = {
  titles: number;
  movies: number;
  episodes: number;
  total_plays: number;
};

export default function HistoryPage({
  continueWatching,
  historyMovies,
  historyEpisodes,
  mostRewatched,
  stats,
  imgBaseUrl,
}: {
  continueWatching: HistoryItem[];
  historyMovies: Array<any>;
  historyEpisodes: Array<any>;
  mostRewatched: HistoryItem[];
  stats: HistoryStats;
  imgBaseUrl: string;
}) {
  const [continueList, setContinueList] = useState(continueWatching);
  const [moviesList, setMoviesList] = useState(historyMovies);
  const [episodesList, setEpisodesList] = useState(historyEpisodes);
  const [rewatchedList, setRewatchedList] = useState(mostRewatched);
  const [statsState, setStatsState] = useState(stats);

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

  const removeItemLocally = useCallback((type: "movie" | "episode", id: number) => {
    const matches = (item: any) => item.id === id && (item.history_type === type || !item.history_type);

    setContinueList((prev) => prev.filter((item) => !(item.id === id && item.history_type === type)));
    setRewatchedList((prev) => prev.filter((item) => !(item.id === id && item.history_type === type)));

    if (type === "movie") {
      setMoviesList((prev) => {
        const next = prev.filter((item) => item.id !== id);
        setStatsState((s) => ({
          ...s,
          titles: Math.max(0, s.titles - (prev.length !== next.length ? 1 : 0)),
          movies: next.length,
        }));
        return next;
      });
    } else {
      setEpisodesList((prev) => {
        const next = prev.filter((item) => !matches(item) && item.id !== id);
        setStatsState((s) => ({
          ...s,
          titles: Math.max(0, s.titles - (prev.length !== next.length ? 1 : 0)),
          episodes: next.length,
        }));
        return next;
      });
    }
  }, []);

  const handleRemoveFromHistory = useCallback(
    async (type: "movie" | "episode", id: number) => {
      removeItemLocally(type, id);

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
    [removeItemLocally]
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
    setMoviesList((prev) =>
      prev.map((movie) => (movie.id === movieId ? { ...movie, is_watch_later: newStatus } : movie))
    );
    setContinueList((prev) =>
      prev.map((item) =>
        item.history_type === "movie" && item.id === movieId
          ? { ...item, is_watch_later: newStatus }
          : item
      )
    );
    setRewatchedList((prev) =>
      prev.map((item) =>
        item.history_type === "movie" && item.id === movieId
          ? { ...item, is_watch_later: newStatus }
          : item
      )
    );
  }, []);

  const handleLikeToggle = useCallback((movieId: number, newStatus: boolean, newCount: number) => {
    const updater = (item: any) =>
      item.id === movieId && (item.history_type === "movie" || !item.history_type)
        ? { ...item, is_liked: newStatus, likes_count: newCount }
        : item;

    setMoviesList((prev) => prev.map(updater));
    setContinueList((prev) => prev.map(updater));
    setRewatchedList((prev) => prev.map(updater));
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
  }, [continueList, moviesList, episodesList, rewatchedList]);

  const isEmpty =
    moviesList.length === 0 &&
    episodesList.length === 0 &&
    continueList.length === 0 &&
    rewatchedList.length === 0;

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
            {continueList.length > 0 && (
              <div ref={continueRibbonRef}>
                <HistoryRibbon
                  items={continueList}
                  imgBaseUrl={imgBaseUrl}
                  title={`Continue Watching (${continueList.length})`}
                  ribbonId="history-continue"
                  uniformLandscape
                  onRemoveFromHistory={handleRemoveFromHistory}
                  onWatchLaterToggle={handleWatchLaterToggle}
                  onLikeToggle={handleLikeToggle}
                />
              </div>
            )}

            {moviesList.length > 0 && (
              <div ref={moviesRibbonRef}>
                <MovieRibbon
                  movies={moviesList}
                  imgBaseUrl={imgBaseUrl}
                  title={`Movies (${moviesList.length})`}
                  ribbonId="history-movies"
                  onWatchLaterToggle={handleWatchLaterToggle}
                  onLikeToggle={handleLikeToggle}
                  onRemoveFromHistory={handleMovieRemoveFromHistory}
                  hideSortOptions={["added"]}
                />
              </div>
            )}

            {episodesList.length > 0 && (
              <div ref={episodesRibbonRef}>
                <EpisodeRibbon
                  episodes={episodesList}
                  imgBaseUrl={imgBaseUrl}
                  title={`Episodes (${episodesList.length})`}
                  ribbonId="history-episodes"
                  onRemoveFromHistory={handleEpisodeRemoveFromHistory}
                />
              </div>
            )}

            {rewatchedList.length > 0 && (
              <div ref={rewatchedRibbonRef}>
                <HistoryRibbon
                  items={rewatchedList}
                  imgBaseUrl={imgBaseUrl}
                  title={`Most Rewatched (${rewatchedList.length})`}
                  ribbonId="history-rewatched"
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
