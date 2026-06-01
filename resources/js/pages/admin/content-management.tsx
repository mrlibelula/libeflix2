import { useCallback, useEffect, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';
import { toast } from 'sonner';
import { Film, Loader2, RefreshCw } from 'lucide-react';

import MovieImportDialog, {
  importReadyFolder,
  type PendingFolder,
} from '@/components/admin/movie-import-dialog';
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

interface ScanResult {
  pending: PendingFolder[];
  ready: ReadyFolder[];
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
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [importingFolder, setImportingFolder] = useState<string | null>(null);
  const [configureFolder, setConfigureFolder] = useState<PendingFolder | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const scanDisk = useCallback(async () => {
    setLoading(true);
    try {
      const response = await axios.get<ScanResult>('/admin/api/movies/import/scan');
      setScanResult(response.data);
    } catch {
      toast.error('Failed to scan movies disk');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    scanDisk();
  }, [scanDisk]);

  const openConfigure = (folder: PendingFolder) => {
    setConfigureFolder(folder);
    setDialogOpen(true);
  };

  const handleReadyImport = async (folder: string) => {
    setImportingFolder(folder);
    await importReadyFolder(folder, scanDisk);
    setImportingFolder(null);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Content Management" />

      <AdminLayout>
        <div className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <HeadingSmall
              title="Content Management"
              description="Import movies from disk folders. Drop a video folder on the movies drive, then configure and import it here."
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

          {scanResult && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="secondary">{scanResult.stats.pending} pending</Badge>
              <Badge variant="outline">{scanResult.stats.ready} ready to import</Badge>
            </div>
          )}

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
                Folders with a video file but no metadata.json. Configure each one to search TMDB and import.
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
                    <p className="font-medium">Scanning pending movies to be imported…</p>
                    <p className="max-w-sm text-sm text-muted-foreground">
                      This may take a moment
                    </p>
                  </div>
                  <div className="w-full max-w-md space-y-2 pt-2">
                    <Skeleton className="h-10 w-full opacity-60" />
                    <Skeleton className="h-10 w-full opacity-40" />
                  </div>
                </div>
              ) : scanResult?.pending.length ? (
                <div className="divide-y rounded-md border">
                  {scanResult.pending.map((item) => (
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
                      <Button size="sm" onClick={() => openConfigure(item)}>
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
              ) : scanResult?.ready.length ? (
                <div className="divide-y rounded-md border">
                  {scanResult.ready.map((item) => (
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
                        onClick={() => handleReadyImport(item.folder)}
                        disabled={importingFolder === item.folder}
                      >
                        {importingFolder === item.folder && (
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
        </div>

        <MovieImportDialog
          folder={configureFolder}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onImported={scanDisk}
        />
      </AdminLayout>
    </AppLayout>
  );
}
