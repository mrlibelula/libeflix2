import { useState, useEffect, useRef } from "react";
import { ChevronDownIcon } from "lucide-react";
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
  onRemoveFromHistory?: (type: "movie" | "episode", id: number) => void;
  onWatchLaterToggle?: (movieId: number, newStatus: boolean) => void;
  onLikeToggle?: (movieId: number, newStatus: boolean, newCount: number) => void;
}

export function HistoryRibbon({
  items,
  imgBaseUrl,
  title = "History",
  ribbonId,
  uniformLandscape = false,
  onRemoveFromHistory,
  onWatchLaterToggle,
  onLikeToggle,
}: HistoryRibbonProps) {
  const [isRibbonOpen, setIsRibbonOpen] = useState(true);
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

  useEffect(() => {
    if (carouselApi) {
      carouselApi.scrollTo(0);
    }
  }, [items.length, carouselApi]);

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
          <span>{title}</span>
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
          <div ref={ribbonContainerRef}>
            <Ribbon align="start" dragFree={true} onApiInitialized={setCarouselApi}>
              {items.map((item, index) => {
                const isPriority = index < 8;
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
        )}
      </div>
    </div>
  );
}
