import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Link } from '@inertiajs/react';
import { toast } from 'sonner';
import { Loader2, Sparkles, Search } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface PendingTvshowFolder {
  folder: string;
  suggested_title: string;
  parsed_release_year: number | null;
  season_count: number;
  episode_file_count: number;
  needs_numbering: boolean;
  sample_episode: string | null;
}

export interface TmdbTvResult {
  pick: number;
  id: number;
  title: string;
  original_title: string | null;
  release_date: string | null;
  overview: string;
  poster_url: string | null;
  vote_average: number | null;
}

interface TvshowImportDialogProps {
  folder: PendingTvshowFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export interface TvshowImportRunResult {
  folder: string;
  success: boolean;
  tvshow_id?: number;
  slug?: string;
  title?: string;
  error?: string;
}

const IMPORT_REQUEST_TIMEOUT_MS = 600_000;

export async function runTvshowImport(folders: string[]): Promise<TvshowImportRunResult[]> {
  const response = await axios.post<{ results: TvshowImportRunResult[] }>(
    '/admin/api/tvshows/import/run',
    { folders },
    { timeout: IMPORT_REQUEST_TIMEOUT_MS },
  );

  return response.data.results ?? [];
}

export default function TvshowImportDialog({
  folder,
  open,
  onOpenChange,
  onImported,
}: TvshowImportDialogProps) {
  const [title, setTitle] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [yearSource, setYearSource] = useState<string | null>(null);
  const [results, setResults] = useState<TmdbTvResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TmdbTvResult | null>(null);
  const [searching, setSearching] = useState(false);
  const [suggestingAi, setSuggestingAi] = useState(false);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    if (!folder || !open) {
      return;
    }

    setTitle(folder.suggested_title);
    setReleaseYear(folder.parsed_release_year ? String(folder.parsed_release_year) : '');
    setYearSource(folder.parsed_release_year ? 'folder' : null);
    setResults([]);
    setSelectedResult(null);
  }, [folder, open]);

  const suggestFromFolder = useCallback(() => {
    if (!folder?.parsed_release_year) {
      toast.error('No year found in folder name');
      return;
    }
    setReleaseYear(String(folder.parsed_release_year));
    setYearSource('folder');
  }, [folder]);

  const suggestFromAi = useCallback(async () => {
    if (!folder) {
      return;
    }

    setSuggestingAi(true);
    try {
      const response = await axios.post('/admin/api/tvshows/import/suggest-year', {
        folder: folder.folder,
        use_openai: true,
      });
      const { openai, suggested } = response.data;
      if (openai) {
        setReleaseYear(String(openai));
        setYearSource('ai');
        toast.success(`AI suggested release year: ${openai}`);
      } else if (suggested) {
        setReleaseYear(String(suggested));
        setYearSource('parsed');
      } else {
        toast.error('Could not determine release year');
      }
    } catch {
      toast.error('Failed to get AI suggestion');
    } finally {
      setSuggestingAi(false);
    }
  }, [folder]);

  const searchTmdb = useCallback(async () => {
    if (!title.trim()) {
      toast.error('Enter a TV show title first');
      return;
    }

    setSearching(true);
    setSelectedResult(null);
    try {
      const response = await axios.get('/admin/api/tvshows/import/search', {
        params: {
          name: title.trim(),
          year: releaseYear ? Number(releaseYear) : undefined,
        },
      });
      setResults(response.data.results ?? []);
      if (!response.data.results?.length) {
        toast.error('No TMDB results found');
      }
    } catch {
      toast.error('TMDB search failed');
    } finally {
      setSearching(false);
    }
  }, [title, releaseYear]);

  const handleImport = useCallback(async () => {
    if (!folder || !selectedResult || !releaseYear) {
      return;
    }

    setImporting(true);
    try {
      await axios.post('/admin/api/tvshows/import/metadata', {
        folder: folder.folder,
        name: title.trim(),
        release_year: Number(releaseYear),
        pick: selectedResult.pick,
        id: selectedResult.id,
      });

      const importResults = await runTvshowImport([folder.folder]);
      const result = importResults[0];

      if (result?.success) {
        toast.success(
          <span>
            Imported &quot;{result.title}&quot;{' '}
            {result.slug && (
              <Link href={`/tvshow/${result.slug}`} className="underline">
                View
              </Link>
            )}
          </span>,
        );
        onOpenChange(false);
        onImported();
      } else {
        toast.error(result?.error ?? 'Import failed');
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        toast.error(
          'Import timed out — full catalog TMDB fetch may be slow. Check if the show was added, then scan again.',
        );
        return;
      }
      if (axios.isAxiosError(error)) {
        const data = error.response?.data as { message?: string; results?: TvshowImportRunResult[] } | string | undefined;
        const fromResults = typeof data === 'object' && data?.results?.[0]?.error;
        const fromMessage = typeof data === 'object' ? data?.message : undefined;
        const fromString = typeof data === 'string' && data.trim() ? data.trim().slice(0, 200) : undefined;
        toast.error(fromResults || fromMessage || fromString || error.message || 'Import failed');
        return;
      }
      const message = error instanceof Error ? error.message : 'Import failed';
      toast.error(message);
    } finally {
      setImporting(false);
    }
  }, [folder, selectedResult, releaseYear, title, onOpenChange, onImported]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Configure TV show import</DialogTitle>
          <DialogDescription>
            {folder ? (
              <>
                Folder: <span className="font-medium">{folder.folder}</span>
                {' · '}
                {folder.season_count} season{folder.season_count === 1 ? '' : 's'},{' '}
                {folder.episode_file_count} episode file
                {folder.episode_file_count === 1 ? '' : 's'}
              </>
            ) : (
              'Select a folder to import'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {folder?.needs_numbering && (
            <p className="rounded-md border border-dashed bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
              Episode files will be numbered automatically from filename patterns
              (e.g. <code className="text-xs">S07E04</code>) before linking.
              {folder.sample_episode && (
                <>
                  {' '}
                  Sample: <span className="font-medium">{folder.sample_episode}</span>
                </>
              )}
            </p>
          )}

          <div className="space-y-2">
            <Label htmlFor="tvshow-title">Title</Label>
            <Input
              id="tvshow-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="TV show title"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="tvshow-release-year">First air year</Label>
              {yearSource && (
                <Badge variant="secondary" className="text-xs">
                  from {yearSource}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="tvshow-release-year"
                type="number"
                min={1900}
                max={2100}
                value={releaseYear}
                onChange={(e) => {
                  setReleaseYear(e.target.value);
                  setYearSource('manual');
                }}
                placeholder="2011"
                className="flex-1"
              />
              <Button type="button" variant="outline" size="sm" onClick={suggestFromFolder}>
                Parse folder
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={suggestFromAi}
                disabled={suggestingAi}
              >
                {suggestingAi ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="mr-1 h-4 w-4" />
                    Ask AI
                  </>
                )}
              </Button>
            </div>
          </div>

          <div>
            <Button type="button" onClick={searchTmdb} disabled={searching || !title.trim()}>
              {searching ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Search className="mr-2 h-4 w-4" />
              )}
              Find on TMDB
            </Button>
          </div>

          {results.length > 0 && (
            <div className="space-y-2">
              <Label>Select TMDB match</Label>
              <div className="grid max-h-64 gap-2 overflow-y-auto sm:grid-cols-2">
                {results.map((result) => (
                  <button
                    key={`${result.id}-${result.pick}`}
                    type="button"
                    onClick={() => setSelectedResult(result)}
                    className={cn(
                      'flex gap-3 rounded-lg border p-3 text-left transition-colors hover:bg-muted/50',
                      selectedResult?.id === result.id && 'border-primary bg-muted/50 ring-1 ring-primary',
                    )}
                  >
                    {result.poster_url ? (
                      <img
                        src={result.poster_url}
                        alt=""
                        className="h-20 w-14 shrink-0 rounded object-cover"
                      />
                    ) : (
                      <div className="flex h-20 w-14 shrink-0 items-center justify-center rounded bg-muted text-xs text-muted-foreground">
                        No img
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{result.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {result.release_date?.slice(0, 4) ?? 'Unknown year'}
                        {result.vote_average != null && ` · ★ ${result.vote_average.toFixed(1)}`}
                      </p>
                      <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{result.overview}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleImport}
            disabled={importing || !selectedResult || !releaseYear}
          >
            {importing && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {importing ? 'Importing…' : 'Import TV show'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function importReadyTvshowFolder(folder: string, onSuccess: () => void): Promise<void> {
  try {
    const results = await runTvshowImport([folder]);
    const result = results[0];

    if (result?.success) {
      toast.success(
        <span>
          Imported &quot;{result.title}&quot;{' '}
          {result.slug && (
            <Link href={`/tvshow/${result.slug}`} className="underline">
              View
            </Link>
          )}
        </span>,
      );
      onSuccess();
    } else {
      toast.error(result?.error ?? 'Import failed');
    }
  } catch (error: unknown) {
    if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
      toast.error(
        'Import timed out — full catalog TMDB fetch may be slow. Check if the show was added, then scan again.',
      );
      return;
    }
    if (axios.isAxiosError(error)) {
      const data = error.response?.data as { message?: string; results?: TvshowImportRunResult[] } | string | undefined;
      const fromResults = typeof data === 'object' && data?.results?.[0]?.error;
      const fromMessage = typeof data === 'object' ? data?.message : undefined;
      toast.error(fromResults || fromMessage || error.message || 'Import failed');
      return;
    }
    const message = error instanceof Error ? error.message : 'Import failed';
    toast.error(message);
  }
}
