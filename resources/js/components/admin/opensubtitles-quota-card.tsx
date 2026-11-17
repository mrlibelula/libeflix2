import { useMemo, useState } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

export type OpenSubtitlesQuota = {
  remaining: number | null;
  allowed: number | null;
  used?: number | null;
  downloads_count?: number | null;
  level?: string | null;
  vip?: boolean;
  reset_time?: string | null;
  reset_time_utc?: string | null;
} | null;

export type DownloadHistoryItem = {
  id: number;
  title: string;
  target_type: string;
  target_id: number;
  language: string;
  file_id: number;
  file_name: string | null;
  was_cached: boolean;
  remaining_after: number | null;
  user_name: string | null;
  created_at: string | null;
  created_at_label: string | null;
};

export type DownloadHistory = {
  items: DownloadHistoryItem[];
  counted_today: number;
  cached_today: number;
};

type Props = {
  quota: OpenSubtitlesQuota;
  history: DownloadHistory | null;
  refreshing?: boolean;
  onRefresh?: () => void;
};

export default function OpenSubtitlesQuotaCard({ quota, history, refreshing = false, onRefresh }: Props) {
  const [open, setOpen] = useState(false);

  const used = useMemo(() => {
    if (!quota) {
      return null;
    }
    if (typeof quota.used === 'number') {
      return quota.used;
    }
    if (quota.remaining !== null && quota.allowed !== null) {
      return Math.max(0, quota.allowed - quota.remaining);
    }
    return null;
  }, [quota]);

  const percent = useMemo(() => {
    if (!quota || quota.allowed === null || quota.allowed <= 0 || used === null) {
      return 0;
    }
    return Math.min(100, Math.round((used / quota.allowed) * 100));
  }, [quota, used]);

  const barClass = percent >= 90 ? 'bg-rose-500' : percent >= 70 ? 'bg-amber-500' : 'bg-emerald-500';
  const hasQuota = quota && quota.remaining !== null && quota.allowed !== null;
  const resetLabel = quota?.reset_time || (quota?.reset_time_utc ? `at ${quota.reset_time_utc}` : null);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="relative z-20 rounded-md border px-3 py-2">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="font-medium">OpenSubtitles quota</span>
          {hasQuota ? (
            <>
              <span className="tabular-nums text-muted-foreground">
                <span className="font-semibold text-foreground">{quota.remaining}</span>
                /{quota.allowed} left
              </span>
              <span className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" title={`${used ?? 0} used today`}>
                <span className={`block h-full transition-all ${barClass}`} style={{ width: `${percent}%` }} />
              </span>
              {resetLabel && (
                <span className="text-xs text-muted-foreground">Resets {resetLabel}</span>
              )}
              {history && history.cached_today > 0 && (
                <span className="text-xs text-muted-foreground">{history.cached_today} free retries</span>
              )}
              {quota.level && <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{quota.level}</Badge>}
            </>
          ) : (
            <span className="text-muted-foreground">Unavailable — refresh after checking API login</span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {onRefresh && (
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onRefresh}
              disabled={refreshing}
              title="Refresh quota"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
          )}
          <CollapsibleTrigger asChild>
            <Button type="button" size="sm" variant="ghost" className="h-7 gap-1 px-2 text-xs">
              History
              {history ? ` (${history.items.length})` : ''}
              <ChevronDown className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </Button>
          </CollapsibleTrigger>
        </div>
      </div>

      <CollapsibleContent className="absolute inset-x-0 top-full z-50 mt-1 space-y-1 rounded-md border bg-background p-2 shadow-lg">
        {!history || history.items.length === 0 ? (
          <p className="px-1 py-1 text-xs text-muted-foreground">
            No downloads logged yet. Try or Preview a subtitle to start the history.
          </p>
        ) : (
          <div className="max-h-56 space-y-1 overflow-y-auto pr-1">
            {history.items.map((item) => (
              <div key={item.id} className="rounded-md border px-2 py-1.5 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 font-medium">
                    <span className="mr-2 text-muted-foreground">{item.created_at_label}</span>
                    {item.title}
                  </p>
                  <div className="flex gap-1">
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{item.language}</Badge>
                    {item.was_cached ? (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">Cached</Badge>
                    ) : (
                      <Badge className="h-5 px-1.5 text-[10px]">Counted</Badge>
                    )}
                  </div>
                </div>
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground" title={item.file_name || undefined}>
                  {item.file_name || `file #${item.file_id}`}
                  {item.user_name ? ` · ${item.user_name}` : ''}
                  {item.remaining_after !== null ? ` · ${item.remaining_after} left after` : ''}
                </p>
              </div>
            ))}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}
