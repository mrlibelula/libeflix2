import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';
import { toast } from 'sonner';
import { Film, Loader2, RefreshCw, Tv } from 'lucide-react';

import MovieImportDialog, {
  importReadyFolder,
  type PendingFolder,
} from '@/components/admin/movie-import-dialog';
import TvshowImportDialog, {
  importReadyTvshowFolder,
  type PendingTvshowFolder,
} from '@/components/admin/tvshow-import-dialog';
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import AppLayout from '@/layouts/app-layout';
import AdminLayout from '@/layouts/admin/layout';
import { type BreadcrumbItem } from '@/types';

interface ReadyFolder {
  folder: string;
  video_file: string;
  metadata: {
    name: string;
    release_year: number;
    pick: number;
    dir: string;
    id: number;
  };
}

interface MovieScanResult {
  pending: PendingFolder[];
  ready: ReadyFolder[];
  stats: {
    pending: number;
    ready: number;
  };
}

interface ReadyTvshowFolder {
  folder: string;
  suggested_title: string;
  parsed_release_year: number | null;
  season_count: number;
  episode_file_count: number;
  needs_numbering: boolean;
  sample_episode: string | null;
  metadata: {
    name: string;
    release_year: number;
    pick: number;
    dir: string;
    id: number;
  };
}

interface TvshowScanResult {
  pending: PendingTvshowFolder[];
  ready: ReadyTvshowFolder[];
  stats: {
    pending: number;
    ready: number;
  };
}

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Content Management',
    href: '/admin/content-management',
  },
];

export default function ContentManagement() {
  const [movieScan, setMovieScan] = useState<MovieScanResult | null>(null);
  const [tvshowScan, setTvshowScan] = useState<TvshowScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [importingMovieFolder, setImportingMovieFolder] = useState<string | null>(null);
  const [importingTvshowFolder, setImportingTvshowFolder] = useState<string | null>(null);
  const [configureMovieFolder, setConfigureMovieFolder] = useState<PendingFolder | null>(null);
  const [configureTvshowFolder, setConfigureTvshowFolder] = useState<PendingTvshowFolder | null>(null);
  const [movieDialogOpen, setMovieDialogOpen] = useState(false);
  const [tvshowDialogOpen, setTvshowDialogOpen] = useState(false);

  const scanDisk = useCallback(async () => {
    setLoading(true);
    try {
      const [moviesResponse, tvshowsResponse] = await Promise.all([
        axios.get<MovieScanResult>('/admin/api/movies/import/scan'),
        axios.get<TvshowScanResult>('/admin/api/tvshows/import/scan'),
      ]);
      setMovieScan(moviesResponse.data);
      setTvshowScan(tvshowsResponse.data);
    } catch {
      toast.error('Failed to scan media disks');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scanDisk();
  }, [scanDisk]);

  const openMovieConfigure = (folder: PendingFolder) => {
    setConfigureMovieFolder(folder);
    setMovieDialogOpen(true);
  };

  const openTvshowConfigure = (folder: PendingTvshowFolder) => {
    setConfigureTvshowFolder(folder);
    setTvshowDialogOpen(true);
  };

  const handleReadyMovieImport = async (folder: string) => {
    setImportingMovieFolder(folder);
    await importReadyFolder(folder, scanDisk);
    setImportingMovieFolder(null);
  };

  const handleReadyTvshowImport = async (folder: string) => {
    setImportingTvshowFolder(folder);
    await importReadyTvshowFolder(folder, scanDisk);
    setImportingTvshowFolder(null);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Content Management" />

      <AdminLayout>
        <div className="space-y-10">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <HeadingSmall
              title="Content Management"
              description="Import movies and TV shows from disk folders. Drop media on the movies or tvshows drive, then configure and import here."
            />
            <Button variant="outline" onClick={scanDisk} disabled={loading}>
              {loading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <RefreshCw className="mr-2 h-4 w-4" />
              )}
              Scan now
            </Button>
          </div>

          <section className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">Movies</h2>
              {movieScan && (
                <>
                  <Badge variant="secondary">{movieScan.stats.pending} pending</Badge>
                  <Badge variant="outline">{movieScan.stats.ready} ready</Badge>
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Film className="h-5 w-5" />
                  Pending — no metadata.json
                  {loading && (
                    <Badge variant="secondary" className="ml-1 font-normal">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                      Scanning…
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Folders with a video file but no metadata.json. Configure each one to search TMDB and
                  import.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div
                    className="flex flex-col items-center justify-center gap-4 rounded-md border border-dashed bg-muted/30 px-6 py-12 text-center"
                    role="status"
                    aria-live="polite"
                    aria-busy="true"
                  >
                    <Loader2 className="h-9 w-9 animate-spin text-primary" aria-hidden="true" />
                    <div className="space-y-1">
                      <p className="font-medium">Scanning pending movies…</p>
                      <p className="max-w-sm text-sm text-muted-foreground">This may take a moment</p>
                    </div>
                    <div className="w-full max-w-md space-y-2 pt-2">
                      <Skeleton className="h-10 w-full opacity-60" />
                      <Skeleton className="h-10 w-full opacity-40" />
                    </div>
                  </div>
                ) : movieScan?.pending.length ? (
                  <div className="divide-y rounded-md border">
                    {movieScan.pending.map((item) => (
                      <div
                        key={item.folder}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.folder}</p>
                          <p className="text-sm text-muted-foreground">{item.video_file}</p>
                          {item.parsed_release_year && (
                            <p className="text-xs text-muted-foreground">
                              Parsed year: {item.parsed_release_year}
                            </p>
                          )}
                        </div>
                        <Button size="sm" onClick={() => openMovieConfigure(item)}>
                          Configure
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No pending folders. Add a movie folder with an .mp4 file to the movies disk.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ready to import</CardTitle>
                <CardDescription>
                  Folders that already have metadata.json but are not yet in the database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : movieScan?.ready.length ? (
                  <div className="divide-y rounded-md border">
                    {movieScan.ready.map((item) => (
                      <div
                        key={item.folder}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.metadata.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.folder} · {item.metadata.release_year} · TMDB #{item.metadata.id}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleReadyMovieImport(item.folder)}
                          disabled={importingMovieFolder === item.folder}
                        >
                          {importingMovieFolder === item.folder && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Import
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No movies ready for one-click import.</p>
                )}
              </CardContent>
            </Card>
          </section>

          <section className="space-y-6">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-base font-semibold">TV shows</h2>
              {tvshowScan && (
                <>
                  <Badge variant="secondary">{tvshowScan.stats.pending} pending</Badge>
                  <Badge variant="outline">{tvshowScan.stats.ready} ready</Badge>
                </>
              )}
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Tv className="h-5 w-5" />
                  Pending — no metadata.json
                  {loading && (
                    <Badge variant="secondary" className="ml-1 font-normal">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" aria-hidden="true" />
                      Scanning…
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Show folders with season/episode videos but no metadata.json. Episode files are
                  numbered from patterns like S07E04 during import.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : tvshowScan?.pending.length ? (
                  <div className="divide-y rounded-md border">
                    {tvshowScan.pending.map((item) => (
                      <div
                        key={item.folder}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.folder}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.season_count} season{item.season_count === 1 ? '' : 's'} ·{' '}
                            {item.episode_file_count} file
                            {item.episode_file_count === 1 ? '' : 's'}
                            {item.needs_numbering ? ' · needs numbering' : ''}
                          </p>
                          {item.sample_episode && (
                            <p className="truncate text-xs text-muted-foreground">
                              {item.sample_episode}
                            </p>
                          )}
                        </div>
                        <Button size="sm" onClick={() => openTvshowConfigure(item)}>
                          Configure
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No pending TV show folders. Add a show folder with season subfolders on the
                    tvshows disk.
                  </p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ready to import</CardTitle>
                <CardDescription>
                  Show folders that already have metadata.json but are not yet in the database.
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <Skeleton className="h-12 w-full" />
                ) : tvshowScan?.ready.length ? (
                  <div className="divide-y rounded-md border">
                    {tvshowScan.ready.map((item) => (
                      <div
                        key={item.folder}
                        className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-0">
                          <p className="truncate font-medium">{item.metadata.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {item.folder} · {item.metadata.release_year} · TMDB #{item.metadata.id}
                          </p>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleReadyTvshowImport(item.folder)}
                          disabled={importingTvshowFolder === item.folder}
                        >
                          {importingTvshowFolder === item.folder && (
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          )}
                          Import
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    No TV shows ready for one-click import.
                  </p>
                )}
              </CardContent>
            </Card>
          </section>
        </div>

        <MovieImportDialog
          folder={configureMovieFolder}
          open={movieDialogOpen}
          onOpenChange={setMovieDialogOpen}
          onImported={scanDisk}
        />
        <TvshowImportDialog
          folder={configureTvshowFolder}
          open={tvshowDialogOpen}
          onOpenChange={setTvshowDialogOpen}
          onImported={scanDisk}
        />
      </AdminLayout>
    </AppLayout>
  );
}
