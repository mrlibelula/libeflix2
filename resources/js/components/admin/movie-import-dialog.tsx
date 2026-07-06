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

export interface PendingFolder {
  folder: string;
  video_file: string;
  suggested_title: string;
  parsed_release_year: number | null;
}

export interface TmdbResult {
  pick: number;
  id: number;
  title: string;
  original_title: string | null;
  release_date: string | null;
  overview: string;
  poster_url: string | null;
  vote_average: number | null;
}

interface MovieImportDialogProps {
  folder: PendingFolder | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

export interface ImportRunResult {
  folder: string;
  success: boolean;
  movie_id?: number;
  slug?: string;
  title?: string;
  error?: string;
}

const IMPORT_REQUEST_TIMEOUT_MS = 120_000;

export async function runMovieImport(folders: string[]): Promise<ImportRunResult[]> {
  const response = await axios.post<{ results: ImportRunResult[] }>(
    '/admin/api/movies/import/run',
    { folders },
    { timeout: IMPORT_REQUEST_TIMEOUT_MS },
  );

  return response.data.results ?? [];
}

export default function MovieImportDialog({ folder, open, onOpenChange, onImported }: MovieImportDialogProps) {
  const [title, setTitle] = useState('');
  const [releaseYear, setReleaseYear] = useState('');
  const [yearSource, setYearSource] = useState<string | null>(null);
  const [results, setResults] = useState<TmdbResult[]>([]);
  const [selectedResult, setSelectedResult] = useState<TmdbResult | null>(null);
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
      const response = await axios.post('/admin/api/movies/import/suggest-year', {
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
      toast.error('Enter a movie title first');
      return;
    }

    setSearching(true);
    setSelectedResult(null);
    try {
      const response = await axios.get('/admin/api/movies/import/search', {
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
      await axios.post('/admin/api/movies/import/metadata', {
        folder: folder.folder,
        name: title.trim(),
        release_year: Number(releaseYear),
        pick: selectedResult.pick,
        id: selectedResult.id,
      });

      const results = await runMovieImport([folder.folder]);
      const result = results[0];

      if (result?.success) {
        toast.success(`Imported "${result.title}"`);
        onOpenChange(false);
        onImported();
      } else {
        toast.error(result?.error ?? 'Import failed');
      }
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.code === 'ECONNABORTED') {
        toast.error('Import timed out — TMDB or disk may be slow. Check if the movie was added, then scan again.');
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
          <DialogTitle>Configure movie import</DialogTitle>
          <DialogDescription>
            {folder ? (
              <>
                Folder: <span className="font-medium">{folder.folder}</span>
                {folder.video_file && (
                  <> · Video: <span className="font-medium">{folder.video_file}</span></>
                )}
              </>
            ) : (
              'Select a folder to import'
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="movie-title">Title</Label>
            <Input
              id="movie-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Movie title"
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="release-year">Release year</Label>
              {yearSource && (
                <Badge variant="secondary" className="text-xs">
                  from {yearSource}
                </Badge>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                id="release-year"
                type="number"
                min={1900}
                max={2100}
                value={releaseYear}
                onChange={(e) => {
                  setReleaseYear(e.target.value);
                  setYearSource('manual');
                }}
                placeholder="2004"
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
            {importing ? 'Importing…' : 'Import movie'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export async function importReadyFolder(folder: string, onSuccess: () => void): Promise<void> {
  try {
    const results = await runMovieImport([folder]);
    const result = results[0];

    if (result?.success) {
      toast.success(
        <span>
          Imported &quot;{result.title}&quot;{' '}
          {result.slug && (
            <Link href={`/movie/${result.slug}`} className="underline">
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
      toast.error('Import timed out — TMDB or disk may be slow. Check if the movie was added, then scan again.');
      return;
    }
    const message = error instanceof Error ? error.message : 'Import failed';
    toast.error(message);
  }
}
