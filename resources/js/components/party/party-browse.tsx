import { useCallback, useEffect, useRef, useState } from 'react';
import axios from 'axios';
import { ArrowLeft, ChevronRight, ChevronsLeft, ChevronsRight, Clapperboard, LoaderCircle, Plus } from 'lucide-react';
import { TrailerModal } from '@/components/trailer-modal';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { LazyImage } from '@/components/ui/lazy-image';
import { Tooltip } from '@/components/ui/tooltip';
import { PARTY_COMPACT_QUERY, useMediaQuery } from '@/hooks/use-media-query';

const BROWSE_PER_PAGE = 24;
/** How many neighbor pages to warm ahead of the current page */
const PREFETCH_AHEAD = 2;

type BrowseKind = 'movies' | 'tvshows';

type BrowseItem = {
  type: 'movie' | 'tvshow';
  id: number;
  title: string;
  poster: string | null;
  caption: string | null;
  is_free: boolean;
  has_trailer: boolean;
  slug?: string;
  trailer_key?: string | null;
};

type BrowsePagePayload = {
  items: BrowseItem[];
  has_more: boolean;
  total: number;
  per_page: number;
  page: number;
};

function cacheKey(kind: BrowseKind, page: number): string {
  return `${kind}:${page}`;
}

function preloadPosters(items: BrowseItem[]) {
  if (typeof window === 'undefined') return;
  // Compact (mobile) browse is text-only — don't spend bandwidth on posters
  if (window.matchMedia(PARTY_COMPACT_QUERY).matches) return;
  for (const item of items) {
    if (!item.poster) continue;
    const img = new Image();
    img.decoding = 'async';
    img.src = item.poster;
  }
}

type SeasonItem = {
  id: number;
  name: string;
  season_number: number;
  poster: string | null;
  playable_count: number;
};

type EpisodeItem = {
  type: 'episode';
  id: number;
  title: string;
  episode_number: number;
  poster: string | null;
  caption: string;
  is_free: boolean;
  subtitle: string;
};

type Props = {
  onAdd: (type: 'movie' | 'episode', id: number) => Promise<void>;
};

export function PartyBrowse({ onAdd }: Props) {
  const compact = useMediaQuery(PARTY_COMPACT_QUERY);
  const [kind, setKind] = useState<BrowseKind>('movies');
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<BrowseItem[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [perPage, setPerPage] = useState(BROWSE_PER_PAGE);
  const [jumpValue, setJumpValue] = useState('1');
  const [loading, setLoading] = useState(false);
  const [addingId, setAddingId] = useState<string | null>(null);
  const resultsScrollRef = useRef<HTMLDivElement>(null);
  const pageCacheRef = useRef<Map<string, BrowsePagePayload>>(new Map());
  const inflightRef = useRef<Map<string, Promise<BrowsePagePayload>>>(new Map());
  const metaRef = useRef({ total: 0, perPage: BROWSE_PER_PAGE });

  const [selectedShow, setSelectedShow] = useState<BrowseItem | null>(null);
  const [seasons, setSeasons] = useState<SeasonItem[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number | null>(null);
  const [episodes, setEpisodes] = useState<EpisodeItem[]>([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const [movieTrailer, setMovieTrailer] = useState<{ id: number; title: string } | null>(null);
  const [youtubeTrailer, setYoutubeTrailer] = useState<{ title: string; key: string } | null>(null);

  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, perPage)));

  const scrollResultsToTop = useCallback(() => {
    const el = resultsScrollRef.current;
    if (!el) return;
    if (el.scrollHeight > el.clientHeight) {
      el.scrollTop = 0;
    } else {
      // Mobile: results don't scroll internally — bring the grid top into view in the room scroller
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
    }
  }, []);

  const applyPage = useCallback(
    (payload: BrowsePagePayload) => {
      setItems(payload.items);
      setHasMore(payload.has_more);
      setTotal(payload.total);
      setPerPage(payload.per_page);
      setPage(payload.page);
      setJumpValue(String(payload.page));
      metaRef.current = { total: payload.total, perPage: payload.per_page };
    },
    []
  );

  const fetchPage = useCallback(async (nextKind: BrowseKind, nextPage: number): Promise<BrowsePagePayload> => {
    const targetPage = Math.max(1, nextPage);
    const key = cacheKey(nextKind, targetPage);
    const cached = pageCacheRef.current.get(key);
    if (cached) {
      return cached;
    }

    const inflight = inflightRef.current.get(key);
    if (inflight) {
      return inflight;
    }

    const request = axios
      .get(route('api.party.content.browse'), {
        params: { type: nextKind, page: targetPage },
      })
      .then(({ data }) => {
        const payload: BrowsePagePayload = {
          items: data.items || [],
          has_more: Boolean(data.has_more),
          total: Number(data.total || metaRef.current.total || 0),
          per_page: Number(data.per_page || BROWSE_PER_PAGE),
          page: targetPage,
        };
        pageCacheRef.current.set(key, payload);
        preloadPosters(payload.items);
        return payload;
      })
      .finally(() => {
        inflightRef.current.delete(key);
      });

    inflightRef.current.set(key, request);
    return request;
  }, []);

  const prefetchNeighbors = useCallback(
    (nextKind: BrowseKind, currentPage: number, pagesTotal: number) => {
      const targets: Array<{ kind: BrowseKind; page: number }> = [];
      if (currentPage > 1) {
        targets.push({ kind: nextKind, page: currentPage - 1 });
      }
      for (let offset = 1; offset <= PREFETCH_AHEAD; offset += 1) {
        const ahead = currentPage + offset;
        if (ahead <= pagesTotal) {
          targets.push({ kind: nextKind, page: ahead });
        }
      }
      // Warm the other catalog's first page so Movies ↔ TV Shows feels instant
      if (currentPage === 1) {
        const otherKind: BrowseKind = nextKind === 'movies' ? 'tvshows' : 'movies';
        targets.push({ kind: otherKind, page: 1 });
      }
      for (const target of targets) {
        void fetchPage(target.kind, target.page).catch(() => {
          // Background warm — ignore; next click will retry
        });
      }
    },
    [fetchPage]
  );

  const loadBrowse = useCallback(
    async (nextKind: BrowseKind, nextPage: number) => {
      const targetPage = Math.max(1, nextPage);
      const key = cacheKey(nextKind, targetPage);
      const cached = pageCacheRef.current.get(key);

      if (cached) {
        applyPage(cached);
        const pagesTotal = Math.max(1, Math.ceil(cached.total / Math.max(1, cached.per_page)));
        prefetchNeighbors(nextKind, cached.page, pagesTotal);
        return;
      }

      setLoading(true);
      try {
        const payload = await fetchPage(nextKind, targetPage);
        applyPage(payload);
        const pagesTotal = Math.max(1, Math.ceil(payload.total / Math.max(1, payload.per_page)));
        prefetchNeighbors(nextKind, payload.page, pagesTotal);
      } finally {
        setLoading(false);
      }
    },
    [applyPage, fetchPage, prefetchNeighbors]
  );

  useEffect(() => {
    void loadBrowse(kind, 1);
  }, [kind, loadBrowse]);

  // Keep the results pane at the top whenever the page of posters changes
  useEffect(() => {
    if (selectedShow) return;
    scrollResultsToTop();
  }, [page, items, selectedShow, scrollResultsToTop]);

  const jumpToPage = () => {
    const parsed = Number.parseInt(jumpValue, 10);
    if (!Number.isFinite(parsed)) {
      setJumpValue(String(page));
      return;
    }
    const target = Math.min(totalPages, Math.max(1, parsed));
    setJumpValue(String(target));
    if (target !== page) {
      void loadBrowse(kind, target);
    }
  };

  const openShow = async (show: BrowseItem) => {
    setSelectedShow(show);
    setSelectedSeason(null);
    setEpisodes([]);
    setDrillLoading(true);
    try {
      const { data } = await axios.get(route('api.party.content.tvshow', { tvshowId: show.id }));
      const nextSeasons: SeasonItem[] = data.seasons || [];
      setSeasons(nextSeasons);
      if (nextSeasons.length > 0) {
        const first = nextSeasons[0].season_number;
        setSelectedSeason(first);
        await loadEpisodes(show.id, first);
      }
    } finally {
      setDrillLoading(false);
    }
  };

  const loadEpisodes = async (tvshowId: number, seasonNumber: number) => {
    setDrillLoading(true);
    try {
      const { data } = await axios.get(
        route('api.party.content.tvshow.season', { tvshowId, seasonNumber })
      );
      setEpisodes(data.episodes || []);
      setSelectedSeason(seasonNumber);
    } finally {
      setDrillLoading(false);
    }
  };

  const addItem = async (type: 'movie' | 'episode', id: number) => {
    const key = `${type}-${id}`;
    setAddingId(key);
    try {
      await onAdd(type, id);
    } finally {
      setAddingId(null);
    }
  };

  const backToGrid = () => {
    setSelectedShow(null);
    setSeasons([]);
    setSelectedSeason(null);
    setEpisodes([]);
  };

  const selectKind = (value: BrowseKind) => {
    if (value !== kind) {
      backToGrid();
      setKind(value);
      return;
    }
    if (selectedShow) {
      backToGrid();
    }
  };

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-2 overflow-hidden">
      <div className="flex shrink-0 items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
        {([
          ['movies', 'Movies'],
          ['tvshows', 'TV Shows'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`flex-1 rounded-md px-2 py-1 text-xs font-medium transition-colors ${
              kind === value
                ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
            }`}
            onClick={() => selectKind(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {selectedShow ? (
        <div className="min-h-0 min-w-0 max-w-full flex-1 space-y-2 overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain">
          <div className="flex min-w-0 items-center gap-2">
            <Button type="button" size="icon" variant="ghost" className="size-7" onClick={backToGrid}>
              <ArrowLeft className="size-3.5" />
            </Button>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900 dark:text-zinc-50">
                {selectedShow.title}
              </p>
              <p className="text-xs text-zinc-500">Pick an episode to add</p>
            </div>
            {selectedShow.has_trailer && selectedShow.trailer_key && (
              <Button
                type="button"
                size="icon"
                variant="ghost"
                className="size-7"
                onClick={() =>
                  setYoutubeTrailer({ title: selectedShow.title, key: selectedShow.trailer_key! })
                }
              >
                <Clapperboard className="size-3.5" />
              </Button>
            )}
          </div>

          {seasons.length > 0 && (
            <div className="w-full min-w-0 max-w-full overflow-x-auto overscroll-x-contain pb-1 [-webkit-overflow-scrolling:touch] [scrollbar-width:thin]">
              <div className="flex w-max gap-1" role="tablist" aria-label="Seasons">
                {seasons.map((season) => (
                  <button
                    key={season.id}
                    type="button"
                    className={`shrink-0 rounded-md px-2 py-1 text-xs ${
                      selectedSeason === season.season_number
                        ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                        : 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300'
                    }`}
                    onClick={() => void loadEpisodes(selectedShow.id, season.season_number)}
                  >
                    S{season.season_number}
                  </button>
                ))}
              </div>
            </div>
          )}

          {drillLoading && <p className="text-xs text-zinc-500">Loading…</p>}

          {!drillLoading && episodes.length === 0 && (
            <p className="text-xs text-zinc-500">No playable episodes in this season.</p>
          )}

          <ul className="space-y-1">
            {episodes.map((episode) => {
              const busy = addingId === `episode-${episode.id}`;
              return (
                <li key={episode.id}>
                  <button
                    type="button"
                    disabled={busy}
                    className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-left hover:bg-zinc-100 disabled:opacity-60 dark:hover:bg-zinc-800"
                    onClick={() => void addItem('episode', episode.id)}
                  >
                    {!compact && (
                      <div className="h-10 w-16 shrink-0 overflow-hidden rounded bg-zinc-200 dark:bg-zinc-800">
                        {episode.poster ? (
                          <LazyImage
                            src={episode.poster}
                            alt={episode.title}
                            className="h-full w-full object-cover"
                          />
                        ) : null}
                      </div>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium">{episode.title}</span>
                      <span className="block truncate text-xs text-zinc-500">{episode.subtitle}</span>
                    </span>
                    {busy ? (
                      <LoaderCircle className="size-3.5 shrink-0 animate-spin text-zinc-500" />
                    ) : (
                      <Plus className="size-3.5 shrink-0 text-zinc-500" />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <>
          <div
            ref={resultsScrollRef}
            className="min-h-0 flex-1 lg:overflow-y-auto lg:overscroll-contain"
          >
            {loading && items.length === 0 && <p className="text-xs text-zinc-500">Loading…</p>}
            {!loading && items.length === 0 && (
              <p className="text-xs text-zinc-500">No playable titles yet.</p>
            )}

            {compact ? (
              <ul className="divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                {items.map((item) => {
                  const busy = addingId === `movie-${item.id}`;
                  const isMovie = item.type === 'movie';
                  return (
                    <li key={`${item.type}-${item.id}`} className="flex items-center">
                      <button
                        type="button"
                        disabled={isMovie && busy}
                        className="flex min-w-0 flex-1 items-center gap-2 px-3 py-2.5 text-left active:bg-zinc-100 disabled:opacity-60 dark:active:bg-zinc-800"
                        onClick={() => {
                          if (isMovie) {
                            void addItem('movie', item.id);
                          } else {
                            void openShow(item);
                          }
                        }}
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-medium text-zinc-900 dark:text-zinc-100">
                            {item.title}
                          </span>
                          {item.caption && (
                            <span className="block truncate text-xs text-zinc-500">{item.caption}</span>
                          )}
                        </span>
                        {isMovie ? (
                          busy ? (
                            <LoaderCircle className="size-4 shrink-0 animate-spin text-zinc-500" />
                          ) : (
                            <Plus className="size-4 shrink-0 text-zinc-500" />
                          )
                        ) : (
                          <ChevronRight className="size-4 shrink-0 text-zinc-500" />
                        )}
                      </button>
                      {item.has_trailer && (
                        <button
                          type="button"
                          className="shrink-0 self-stretch border-l border-zinc-200 px-3 text-zinc-500 active:bg-zinc-100 dark:border-zinc-800 dark:active:bg-zinc-800"
                          aria-label={`Trailers for ${item.title}`}
                          onClick={() => {
                            if (isMovie) {
                              setMovieTrailer({ id: item.id, title: item.title });
                            } else if (item.trailer_key) {
                              setYoutubeTrailer({ title: item.title, key: item.trailer_key });
                            }
                          }}
                        >
                          <Clapperboard className="size-4" />
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>
            ) : (
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {items.map((item) => {
                  const busy = addingId === `movie-${item.id}`;
                  return (
                    <div key={`${item.type}-${item.id}`} className="group min-w-0">
                      <button
                        type="button"
                        disabled={item.type === 'movie' && busy}
                        className="block w-full overflow-hidden rounded-md bg-zinc-200 outline-none ring-offset-2 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-zinc-800"
                        onClick={() => {
                          if (item.type === 'movie') {
                            void addItem('movie', item.id);
                          } else {
                            void openShow(item);
                          }
                        }}
                      >
                        <div className="aspect-[2/3] w-full">
                          {item.poster ? (
                            <LazyImage
                              src={item.poster}
                              alt={item.title}
                              className="h-full w-full object-cover transition-opacity group-hover:opacity-90"
                            />
                          ) : (
                            <div className="flex h-full items-center justify-center px-1 text-center text-[10px] text-zinc-500">
                              No art
                            </div>
                          )}
                        </div>
                      </button>
                      <div className="mt-1 flex items-start gap-0.5">
                        <Tooltip
                          text={item.title}
                          onlyWhenTruncated
                          delayMs={400}
                          position="top"
                          triggerClassName="min-w-0 flex-1"
                        >
                          <button
                            type="button"
                            className="w-full text-left"
                            onClick={() => {
                              if (item.type === 'movie') {
                                void addItem('movie', item.id);
                              } else {
                                void openShow(item);
                              }
                            }}
                          >
                            <span className="line-clamp-2 break-words text-[11px] font-medium leading-tight text-zinc-800 dark:text-zinc-100">
                              {item.title}
                            </span>
                            {item.caption && (
                              <span className="block truncate text-[10px] text-zinc-500">{item.caption}</span>
                            )}
                          </button>
                        </Tooltip>
                        {item.has_trailer && (
                          <button
                            type="button"
                            className="mt-0.5 shrink-0 rounded p-0.5 text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800 dark:hover:bg-zinc-800 dark:hover:text-zinc-200"
                            aria-label={`Trailers for ${item.title}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              if (item.type === 'movie') {
                                setMovieTrailer({ id: item.id, title: item.title });
                              } else if (item.trailer_key) {
                                setYoutubeTrailer({ title: item.title, key: item.trailer_key });
                              }
                            }}
                          >
                            <Clapperboard className="size-3" />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {(page > 1 || hasMore || totalPages > 1) && (
            <div className="flex shrink-0 flex-col gap-1.5 border-t border-zinc-200 pt-1.5 dark:border-zinc-800">
              <div className="flex items-center justify-between gap-2">
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={page <= 1}
                  onClick={() => void loadBrowse(kind, page - 1)}
                >
                  <ChevronsLeft className="size-3.5" />
                </Button>
                <span className="text-[10px] tabular-nums text-zinc-500">
                  Page {page} of {totalPages}
                  {loading ? ' · …' : ''}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 px-2"
                  disabled={!hasMore}
                  onClick={() => void loadBrowse(kind, page + 1)}
                >
                  <ChevronsRight className="size-3.5" />
                </Button>
              </div>
              {totalPages > 1 && (
                <form
                  className="flex items-center gap-1.5"
                  onSubmit={(e) => {
                    e.preventDefault();
                    jumpToPage();
                  }}
                >
                  <label htmlFor="party-browse-page-jump" className="sr-only">
                    Jump to page
                  </label>
                  <Input
                    id="party-browse-page-jump"
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={totalPages}
                    value={jumpValue}
                    disabled={loading}
                    onChange={(e) => setJumpValue(e.target.value)}
                    onBlur={() => {
                      if (jumpValue.trim() === '' || jumpValue === String(page)) {
                        setJumpValue(String(page));
                      }
                    }}
                    className="h-7 w-16 px-2 text-center text-xs tabular-nums"
                    aria-label={`Jump to page (1–${totalPages})`}
                  />
                  <span className="shrink-0 text-[10px] text-zinc-500">of {totalPages}</span>
                  <Button
                    type="submit"
                    size="sm"
                    variant="secondary"
                    className="h-7 px-2 text-xs"
                    disabled={loading}
                  >
                    Go
                  </Button>
                </form>
              )}
            </div>
          )}
        </>
      )}

      {movieTrailer && (
        <TrailerModal
          isOpen={!!movieTrailer}
          onOpenChange={(open) => {
            if (!open) setMovieTrailer(null);
          }}
          movieTitle={movieTrailer.title}
          movieId={movieTrailer.id}
        />
      )}

      <Dialog
        open={!!youtubeTrailer}
        onOpenChange={(open) => {
          if (!open) setYoutubeTrailer(null);
        }}
      >
        <DialogContent className="max-w-3xl overflow-hidden p-0">
          <DialogTitle className="sr-only">{youtubeTrailer?.title} trailer</DialogTitle>
          <DialogDescription className="sr-only">Watch trailer for {youtubeTrailer?.title}</DialogDescription>
          {youtubeTrailer && (
            <div className="aspect-video w-full bg-black">
              <iframe
                key={youtubeTrailer.key}
                src={`https://www.youtube.com/embed/${youtubeTrailer.key}?autoplay=1&rel=0&modestbranding=1`}
                title={youtubeTrailer.title}
                className="h-full w-full border-0"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
