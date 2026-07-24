import { useEffect, useState } from 'react';
import axios from 'axios';
import { Plus, Trash2 } from 'lucide-react';
import type { PartyQueueItem } from '@/types/party';
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

type Props = {
  queue: PartyQueueItem[];
  currentId: number | null;
  canControl: boolean;
  onAdd: (type: 'movie' | 'episode', id: number) => Promise<void>;
  onRemove: (id: number) => Promise<void>;
  onPlayItem: (id: number) => Promise<void>;
};

export function PartyQueue({ queue, currentId, canControl, onAdd, onRemove, onPlayItem }: Props) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!canControl || query.trim().length < 2) {
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
  }, [canControl, query]);

  return (
    <div className="flex h-full flex-col gap-3">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-zinc-400">Queue</h3>

      {canControl && (
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search movies or TV shows…"
          />
          {searching && <p className="text-xs text-zinc-500">Searching…</p>}
          {!searching && query.trim().length >= 2 && results.length === 0 && (
            <p className="text-xs text-zinc-500">No playable titles matched that search.</p>
          )}
          {results.length > 0 && (
            <ul className="max-h-56 space-y-1 overflow-y-auto rounded border border-zinc-800 p-1">
              {results.map((r) => (
                <li key={`${r.type}-${r.id}`}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-zinc-800"
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
                      triggerClassName="min-w-0 flex-1 overflow-hidden"
                    >
                      <span className="block truncate">
                        <span className="font-medium">{r.title}</span>
                        <span className="ml-2 text-xs text-zinc-500">{r.subtitle}</span>
                      </span>
                    </Tooltip>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <ul className="flex-1 space-y-1 overflow-y-auto">
        {queue.length === 0 && (
          <li className="text-sm text-zinc-500">Queue is empty</li>
        )}
        {queue.map((item) => {
          const active = item.id === currentId;
          return (
            <li
              key={item.id}
              className={`flex items-center gap-2 rounded px-2 py-2 text-sm ${
                active ? 'bg-zinc-800' : 'hover:bg-zinc-900'
              }`}
            >
              <Tooltip
                text={item.title}
                onlyWhenTruncated
                delayMs={400}
                position="top"
                triggerClassName="min-w-0 flex-1 overflow-hidden"
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
    </div>
  );
}
