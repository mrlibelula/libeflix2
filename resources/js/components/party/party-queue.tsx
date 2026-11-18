import { useEffect, useState } from 'react';
import axios from 'axios';
import { LayoutGrid, Plus, Search, Trash2 } from 'lucide-react';
import type { PartyQueueItem } from '@/types/party';
import { PartyBrowse } from '@/components/party/party-browse';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tooltip } from '@/components/ui/tooltip';

type SearchResult = {
  type: 'movie' | 'episode';
  id: number;
  title: string;
  poster: string | null;
  subtitle: string;
  is_free: boolean;
};

function fullSearchLabel(result: SearchResult): string {
  if (result.type === 'movie') {
    return result.title;
  }

  return `${result.title} · ${result.subtitle}`;
}

type AddMethod = 'search' | 'browse';

type Props = {
  queue: PartyQueueItem[];
  currentId: number | null;
  canControl: boolean;
  onAdd: (type: 'movie' | 'episode', id: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onPlayItem: (id: number) => Promise<void>;
  /** When true, omit the section title (used inside party side-panel tabs). */
  embedded?: boolean;
};

export function PartyQueue({
  queue,
  currentId,
  canControl,
  onAdd,
  onRemove,
  onPlayItem,
  embedded = false,
}: Props) {
  const [method, setMethod] = useState<AddMethod>('search');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!canControl || method !== 'search' || query.trim().length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const { data } = await axios.get(route('api.party.content.search'), {
          params: { q: query.trim() },
        });
        setResults(data.results || []);
      } finally {
        setSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [canControl, method, query]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 max-w-full flex-col gap-3 overflow-x-hidden">
      {!embedded && (
        <h3 className="shrink-0 text-sm font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Room Playlist
        </h3>
      )}

      {/* Playlist stays visible while Search / Browse is open */}
      <ul className="min-w-0 max-w-full shrink-0 space-y-1 overflow-x-hidden rounded-lg border border-zinc-200 bg-zinc-50/70 p-1 lg:max-h-36 lg:overflow-y-auto lg:overscroll-contain dark:border-zinc-800 dark:bg-zinc-950/40">
        {queue.length === 0 && (
          <li className="px-2 py-2 text-sm text-zinc-500">Queue is empty</li>
        )}
        {queue.map((item) => {
          const active = item.id === currentId;
          return (
            <li
              key={item.id}
              className={`flex min-w-0 max-w-full items-center gap-2 overflow-hidden rounded px-2 py-2 text-sm ${
                active ? 'bg-zinc-100 dark:bg-zinc-800' : 'hover:bg-zinc-50 dark:hover:bg-zinc-900'
              }`}
            >
              <Tooltip
                text={item.title}
                onlyWhenTruncated
                delayMs={400}
                position="top"
                triggerClassName="flex min-w-0 flex-1 overflow-hidden"
              >
                <button
                  type="button"
                  className="block w-full truncate text-left disabled:cursor-default"
                  disabled={!canControl}
                  onClick={() => canControl && onPlayItem(item.id)}
                >
                  <span className="font-medium">{item.title}</span>
                  {!item.can_play && (
                    <span className="ml-2 text-xs text-amber-500">premium</span>
                  )}
                </button>
              </Tooltip>
              {canControl && (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  className="size-7"
                  onClick={() => onRemove(item.id)}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </li>
          );
        })}
      </ul>

      {canControl && (
        <div className="flex min-h-0 min-w-0 max-w-full flex-1 flex-col gap-2 overflow-hidden">
          <div className="flex shrink-0 items-center gap-1 rounded-lg bg-zinc-100 p-0.5 dark:bg-zinc-900">
            <button
              type="button"
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                method === 'search'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              onClick={() => setMethod('search')}
            >
              <Search className="size-3.5" />
              Search
            </button>
            <button
              type="button"
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs font-medium transition-colors ${
                method === 'browse'
                  ? 'bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-zinc-50'
                  : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200'
              }`}
              onClick={() => setMethod('browse')}
            >
              <LayoutGrid className="size-3.5" />
              Browse
            </button>
          </div>

          {method === 'search' ? (
            <div className="min-h-0 min-w-0 max-w-full flex-1 space-y-2 overflow-x-hidden lg:overflow-y-auto lg:overscroll-contain">
              <Input
                type="search"
                enterKeyHint="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search movies or TV shows…"
                className="min-w-0 max-w-full"
              />
              {searching && <p className="text-xs text-zinc-500">Searching…</p>}
              {!searching && query.trim().length >= 2 && results.length === 0 && (
                <p className="text-xs text-zinc-500">No playable titles matched that search.</p>
              )}
              {results.length > 0 && (
                <ul className="w-full min-w-0 max-w-full divide-y divide-zinc-200 overflow-hidden rounded-lg border border-zinc-200 lg:space-y-1 lg:divide-y-0 lg:rounded lg:p-1 dark:divide-zinc-800 dark:border-zinc-800">
                  {results.map((r) => (
                    <li key={`${r.type}-${r.id}`} className="min-w-0 max-w-full overflow-hidden">
                      <button
                        type="button"
                        className="flex w-full min-w-0 max-w-full items-center gap-2 overflow-hidden px-3 py-2.5 text-left text-sm active:bg-zinc-100 lg:rounded lg:px-2 lg:py-1.5 lg:hover:bg-zinc-100 dark:active:bg-zinc-800 lg:dark:hover:bg-zinc-800"
                        onClick={async () => {
                          await onAdd(r.type, r.id);
                          setQuery('');
                          setResults([]);
                        }}
                      >
                        <Plus className="size-3.5 shrink-0" />
                        <Tooltip
                          text={fullSearchLabel(r)}
                          onlyWhenTruncated
                          delayMs={400}
                          position="top"
                          triggerClassName="flex min-w-0 flex-1 overflow-hidden"
                        >
                          <span className="block w-full min-w-0 overflow-hidden lg:truncate">
                            <span className="block w-full truncate font-medium lg:inline">{r.title}</span>
                            <span className="block w-full truncate text-xs text-zinc-500 lg:ml-2 lg:inline">
                              {r.subtitle}
                            </span>
                          </span>
                        </Tooltip>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <div className="min-h-0 min-w-0 max-w-full flex-1 overflow-hidden">
              <PartyBrowse onAdd={onAdd} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
