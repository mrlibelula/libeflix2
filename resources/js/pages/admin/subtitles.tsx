import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Head } from '@inertiajs/react';
import { Captions, Loader2, Search, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';

import OpenSubtitlesQuotaCard, {
  type DownloadHistory,
  type OpenSubtitlesQuota,
} from '@/components/admin/opensubtitles-quota-card';
import SubtitlePreviewDialog, { draftsFromItems, type SubtitleCandidate } from '@/components/admin/subtitle-preview-dialog';
import HeadingSmall from '@/components/heading-small';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import AppLayout from '@/layouts/app-layout';
import AdminFullWidthLayout from '@/layouts/admin/full-width-layout';
import { buildVtt, type SubtitleDraft } from '@/lib/vtt';
import { type BreadcrumbItem } from '@/types';

type LanguageOption = { code: string; name: string };

type MovieTitle = {
  id: number;
  title: string;
  year: string | null;
  languages: string[];
  has_video: boolean;
};

type ShowTitle = {
  id: number;
  title: string;
  year: string | null;
  tmdb_id: number;
};

type EpisodeRow = {
  id: number;
  name: string | null;
  episode_number: number | null;
  in_storage: boolean;
  languages: string[];
};

type SeasonRow = {
  id: number;
  season_number: number | null;
  name: string;
  coverage: Array<{ language: string; count: number; total: number }>;
  episodes: EpisodeRow[];
};

type Track = {
  language: string;
  language_name: string;
  file_name: string;
  cue_count: number;
  subtitle_url: string;
};

type Detail = {
  type: 'movie' | 'episode';
  id: number;
  title: string;
  subtitle: string | null;
  video_file_name: string;
  video_path: string;
  video_url: string;
  tracks: Track[];
  languages: string[];
};

type OnlineResult = {
  file_id: number;
  file_name: string;
  language: string;
  release: string;
  downloads: number;
  fps: number | null;
  hearing_impaired: boolean;
  forced: boolean;
  hash_match: boolean;
  ai_translated: boolean;
  release_match: boolean;
  cam: boolean;
};

type DownloadItem = {
  file_id: number;
  cached: boolean;
  language: string;
  source: string;
  cues: SubtitleDraft['cues'];
  warnings: SubtitleDraft['warnings'];
};

type DownloadResponse = {
  items: DownloadItem[];
  quota: Quota;
  quota_exceeded: { message?: string } | null;
};

type OnlineGroup = {
  language: string;
  language_name: string;
  results: OnlineResult[];
};

type UploadItem = {
  filename: string;
  language: string | null;
  source: string;
  cues: SubtitleDraft['cues'];
  warnings: SubtitleDraft['warnings'];
};

type ReviewItem = {
  episode_id: number;
  episode_number: number | null;
  name: string | null;
  language: string;
  source: string | null;
  cues: SubtitleDraft['cues'];
  warnings: SubtitleDraft['warnings'];
  hash_match: boolean;
};

type Quota = OpenSubtitlesQuota;

const breadcrumbs: BreadcrumbItem[] = [
  { title: 'Subtitles', href: '/admin/subtitles' },
];

const LANGUAGE_STORAGE_KEY = 'libeflix.subtitle-languages';

function errorMessage(error: unknown, fallback: string): string {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.message || fallback;
  }
  return fallback;
}

export default function Subtitles() {
  const [library, setLibrary] = useState<'movie' | 'tvshow'>('movie');
  const [query, setQuery] = useState('');
  const [movies, setMovies] = useState<MovieTitle[]>([]);
  const [shows, setShows] = useState<ShowTitle[]>([]);
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [languages, setLanguages] = useState<LanguageOption[]>([]);
  const [chosen, setChosen] = useState<string[]>(['EN', 'ES']);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [openShowId, setOpenShowId] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<SeasonRow[]>([]);
  const [seasonsByShow, setSeasonsByShow] = useState<Record<number, SeasonRow[]>>({});
  const [loadingShowId, setLoadingShowId] = useState<number | null>(null);
  const [groups, setGroups] = useState<OnlineGroup[] | null>(null);
  const [picks, setPicks] = useState<Record<string, number>>({});
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [uploading, setUploading] = useState(false);
  const [drafts, setDrafts] = useState<SubtitleDraft[]>([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quota, setQuota] = useState<Quota>(null);
  const [history, setHistory] = useState<DownloadHistory | null>(null);
  const [refreshingQuota, setRefreshingQuota] = useState(false);
  const [autofillSeasonId, setAutofillSeasonId] = useState<number | null>(null);
  const [autofillCost, setAutofillCost] = useState<number | null>(null);
  const [autofillBusy, setAutofillBusy] = useState(false);
  const [reviews, setReviews] = useState<ReviewItem[]>([]);
  const [swappingLanguage, setSwappingLanguage] = useState<string | null>(null);
  const [tryingFileId, setTryingFileId] = useState<number | null>(null);

  const refreshQuota = useCallback(async () => {
    setRefreshingQuota(true);
    try {
      const response = await axios.get<{ quota: Quota; history: DownloadHistory }>('/admin/api/subtitles/quota');
      setQuota(response.data.quota);
      setHistory(response.data.history);
    } catch {
      // keep previous values
    } finally {
      setRefreshingQuota(false);
    }
  }, []);

  const applyQuotaPayload = (data: { quota?: Quota; history?: DownloadHistory }) => {
    if (data.quota) {
      setQuota(data.quota);
    }
    if (data.history) {
      setHistory(data.history);
    }
  };

  useEffect(() => {
    axios.get<{ languages: LanguageOption[] }>('/admin/api/subtitles/languages').then((response) => {
      setLanguages(response.data.languages);
    }).catch(() => undefined);

    refreshQuota();

    try {
      const stored = JSON.parse(localStorage.getItem(LANGUAGE_STORAGE_KEY) || 'null');
      if (Array.isArray(stored) && stored.length > 0) {
        setChosen(stored);
      }
    } catch {
      setChosen(['EN', 'ES']);
    }
  }, [refreshQuota]);

  const loadLibrary = useCallback(async (type: 'movie' | 'tvshow', q: string) => {
    setLoadingLibrary(true);
    try {
      const response = await axios.get(type === 'movie' ? '/admin/api/subtitles/titles' : '/admin/api/subtitles/titles', {
        params: { type, q },
      });
      if (type === 'movie') {
        setMovies(response.data.titles);
      } else {
        setShows(response.data.titles);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load titles'));
    } finally {
      setLoadingLibrary(false);
    }
  }, []);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      loadLibrary(library, query);
    }, 250);
    return () => window.clearTimeout(handle);
  }, [library, query, loadLibrary]);

  useEffect(() => {
    setOpenShowId(null);
    setSeasons([]);
  }, [library, query]);

  const toggleLanguage = (code: string) => {
    setChosen((current) => {
      const next = current.includes(code) ? current.filter((item) => item !== code) : [...current, code];
      localStorage.setItem(LANGUAGE_STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  };

  const loadDetail = async (type: 'movie' | 'episode', id: number) => {
    const response = await axios.get<Detail>(`/admin/api/subtitles/${type}/${id}`);
    setDetail(response.data);
    return response.data;
  };

  const openDetail = async (type: 'movie' | 'episode', id: number) => {
    setLoadingDetail(true);
    setGroups(null);
    setUploads([]);
    try {
      await loadDetail(type, id);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not open this title'));
    } finally {
      setLoadingDetail(false);
    }
  };

  const openShow = async (showId: number) => {
    if (openShowId === showId) {
      setOpenShowId(null);
      setSeasons([]);
      return;
    }

    setOpenShowId(showId);
    const cached = seasonsByShow[showId];
    if (cached) {
      setSeasons(cached);
      return;
    }

    setLoadingShowId(showId);
    setSeasons([]);
    try {
      const response = await axios.get<{ seasons: SeasonRow[] }>(`/admin/api/subtitles/tvshows/${showId}/episodes`);
      setSeasons(response.data.seasons);
      setSeasonsByShow((current) => ({ ...current, [showId]: response.data.seasons }));
    } catch (error) {
      toast.error(errorMessage(error, 'Could not load episodes'));
      setOpenShowId(null);
    } finally {
      setLoadingShowId(null);
    }
  };

  const refreshOpenShow = async () => {
    if (!openShowId) {
      return;
    }
    const response = await axios.get<{ seasons: SeasonRow[] }>(`/admin/api/subtitles/tvshows/${openShowId}/episodes`);
    setSeasons(response.data.seasons);
    setSeasonsByShow((current) => ({ ...current, [openShowId]: response.data.seasons }));
  };

  const syncLibraryLanguages = (next: Detail) => {
    if (next.type === 'movie') {
      setMovies((current) => current.map((movie) => (
        movie.id === next.id ? { ...movie, languages: next.languages } : movie
      )));
      return;
    }

    const patchSeasons = (rows: SeasonRow[]) => rows.map((season) => ({
      ...season,
      episodes: season.episodes.map((episode) => (
        episode.id === next.id ? { ...episode, languages: next.languages } : episode
      )),
    }));

    setSeasons((current) => patchSeasons(current));
    if (openShowId !== null) {
      setSeasonsByShow((current) => {
        const cached = current[openShowId];
        if (!cached) {
          return current;
        }
        return { ...current, [openShowId]: patchSeasons(cached) };
      });
    }
  };

  const searchOnline = async () => {
    if (!detail || chosen.length === 0) {
      toast.error('Choose at least one language');
      return;
    }
    setSearching(true);
    try {
      const response = await axios.get<{ groups: OnlineGroup[] }>(`/admin/api/subtitles/${detail.type}/${detail.id}/online`, {
        params: { languages: chosen.join(',') },
      });
      const nextPicks: Record<string, number> = {};
      response.data.groups.forEach((group) => {
        if (group.results[0]) {
          nextPicks[group.language] = group.results[0].file_id;
        }
      });
      setGroups(response.data.groups);
      setPicks(nextPicks);
    } catch (error) {
      toast.error(errorMessage(error, 'OpenSubtitles search failed'));
    } finally {
      setSearching(false);
    }
  };

  const pickedCount = Object.keys(picks).length;

  const candidates = useMemo(() => {
    const map: Record<string, SubtitleCandidate[]> = {};
    groups?.forEach((group) => {
      map[group.language] = group.results;
    });
    return map;
  }, [groups]);

  const fetchOnline = async (files: Array<{ language: string; file_id: number }>): Promise<DownloadItem[]> => {
    if (!detail) {
      return [];
    }
    const response = await axios.post<DownloadResponse & { history?: DownloadHistory }>(`/admin/api/subtitles/${detail.type}/${detail.id}/online/download`, { files });
    applyQuotaPayload(response.data);
    if (response.data.quota_exceeded) {
      toast.error(response.data.quota_exceeded.message || 'Download quota reached');
    }
    return response.data.items;
  };

  const downloadPicked = async () => {
    if (!detail) {
      return;
    }
    const files = Object.entries(picks).map(([language, fileId]) => ({ language, file_id: fileId }));
    if (files.length === 0) {
      return;
    }
    setDownloading(true);
    try {
      const items = await fetchOnline(files);
      setDrafts(draftsFromItems(items, detail.languages));
      if (items.length > 0) {
        setPreviewOpen(true);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download subtitles'));
    } finally {
      setDownloading(false);
    }
  };

  const tryResult = async (language: string, result: OnlineResult) => {
    if (!detail) {
      return;
    }
    setPicks((current) => ({ ...current, [language]: result.file_id }));
    setTryingFileId(result.file_id);
    try {
      const items = await fetchOnline([{ language, file_id: result.file_id }]);
      if (items.length === 0) {
        return;
      }
      setDrafts(draftsFromItems(items, detail.languages));
      setPreviewOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not download that subtitle'));
    } finally {
      setTryingFileId(null);
    }
  };

  const swapCandidate = async (language: string, fileId: number) => {
    const current = drafts.find((draft) => draft.language === language);
    if (!current || current.fileId === fileId) {
      return;
    }
    setSwappingLanguage(language);
    try {
      const items = await fetchOnline([{ language, file_id: fileId }]);
      const item = items[0];
      if (!item) {
        return;
      }
      setDrafts((existing) => existing.map((draft) => (draft.language === language ? {
        ...draft,
        fileId: item.file_id,
        source: item.source,
        cues: item.cues,
        warnings: item.warnings,
      } : draft)));
      setPicks((existing) => ({ ...existing, [language]: fileId }));
      if (item.cached) {
        toast.success(`Switched ${language} (cached, no download used)`);
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not switch subtitle'));
    } finally {
      setSwappingLanguage(null);
    }
  };

  const onDropFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) {
      return;
    }
    const body = new FormData();
    Array.from(fileList).forEach((file) => body.append('files[]', file));
    setUploading(true);
    try {
      const response = await axios.post('/admin/api/subtitles/preview', body);
      setUploads(response.data.items);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not read those subtitle files'));
    } finally {
      setUploading(false);
    }
  };

  const uploadLanguages = uploads.map((item) => item.language).filter((language): language is string => Boolean(language));
  const uploadDuplicates = uploadLanguages.filter((language, index) => uploadLanguages.indexOf(language) !== index);
  const uploadReady = uploads.length > 0 && uploads.every((item) => item.language) && uploadDuplicates.length === 0;

  const openUploadPreview = () => {
    if (!detail || !uploadReady) {
      return;
    }
    setDrafts(draftsFromItems(uploads.map((item) => ({
      language: item.language,
      source: item.source,
      cues: item.cues,
      warnings: item.warnings,
    })), detail.languages));
    setPreviewOpen(true);
  };

  const previewExisting = async (track: Track) => {
    try {
      const response = await axios.get<string>(track.subtitle_url, { responseType: 'text' });
      const preview = await axios.post('/admin/api/subtitles/preview', {
        sources: [{ source: response.data, filename: track.file_name, language: track.language }],
      });
      setDrafts(draftsFromItems(preview.data.items, detail?.languages ?? [track.language]));
      setPreviewOpen(true);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not preview this track'));
    }
  };

  const saveDrafts = async () => {
    if (!detail) {
      return;
    }
    const tracks = drafts
      .filter((draft) => draft.included)
      .map((draft) => ({
        language: draft.language,
        // Rebuild from edited cues so ads/URL removals and text fixes are saved.
        source: buildVtt(draft.cues),
        offset_ms: draft.offsetMs,
        overwrite: draft.replaces && draft.replaceConfirmed,
      }));
    setSaving(true);
    try {
      const response = await axios.post(`/admin/api/subtitles/${detail.type}/${detail.id}`, { tracks });
      if (response.data.conflicts?.length) {
        const codes = response.data.conflicts.map((conflict: { language: string }) => conflict.language).join(', ');
        toast.error(`Confirm replace for ${codes} before those tracks can be saved`);
      } else {
        toast.success(`Saved ${response.data.saved.length} ${response.data.saved.length === 1 ? 'track' : 'tracks'}`);
        setPreviewOpen(false);
        setUploads([]);
        setGroups(null);
      }
      const updated = await loadDetail(detail.type, detail.id);
      syncLibraryLanguages(updated);
      if (library === 'movie') {
        await loadLibrary('movie', query);
      } else {
        await refreshOpenShow();
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save subtitles'));
    } finally {
      setSaving(false);
    }
  };

  const deleteTrack = async (language: string) => {
    if (!detail) {
      return;
    }
    if (!window.confirm(`Delete the ${language} subtitle?`)) {
      return;
    }
    try {
      await axios.delete(`/admin/api/subtitles/${detail.type}/${detail.id}/${language}`);
      toast.success(`Deleted ${language}`);
      const updated = await loadDetail(detail.type, detail.id);
      syncLibraryLanguages(updated);
      if (library === 'movie') {
        await loadLibrary('movie', query);
      } else {
        await refreshOpenShow();
      }
    } catch (error) {
      toast.error(errorMessage(error, 'Could not delete that subtitle'));
    }
  };

  const runAutofill = async (showId: number, seasonId: number, dryRun: boolean) => {
    setAutofillBusy(true);
    try {
      const response = await axios.post(`/admin/api/subtitles/tvshows/${showId}/seasons/${seasonId}/autofill`, {
        languages: chosen,
        dry_run: dryRun,
      });
      applyQuotaPayload(response.data);
      if (dryRun) {
        setAutofillCost(response.data.missing);
        return;
      }
      const saved = response.data.saved?.length ?? 0;
      toast.success(`Saved ${saved} hash-matched ${saved === 1 ? 'track' : 'tracks'}`);
      if (response.data.quota_exceeded) {
        toast.error('Stopped early because the download quota was reached');
      }
      setReviews(response.data.needs_review ?? []);
      setAutofillSeasonId(null);
      setAutofillCost(null);
      await refreshOpenShow();
    } catch (error) {
      toast.error(errorMessage(error, 'Could not fetch season subtitles'));
    } finally {
      setAutofillBusy(false);
    }
  };

  const reviewEpisode = async (episodeId: number) => {
    const items = reviews.filter((item) => item.episode_id === episodeId && item.source);
    if (items.length === 0) {
      toast.error('Nothing to review for that episode');
      return;
    }
    await openDetail('episode', episodeId);
    setDrafts(items.map((item) => ({
      language: item.language,
      source: item.source || '',
      cues: item.cues,
      warnings: item.warnings,
      offsetMs: 0,
      included: true,
      replaces: false,
      replaceConfirmed: false,
    })));
    setPreviewOpen(true);
  };

  const existing = detail?.languages ?? [];
  const quotaLabel = useMemo(() => {
    if (!quota || quota.remaining === null) {
      return null;
    }
    if (quota.allowed) {
      return `${quota.remaining}/${quota.allowed} left today`;
    }
    return `${quota.remaining} left today`;
  }, [quota]);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Subtitles" />
      <AdminFullWidthLayout>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">
          <Card className="w-full lg:w-96 lg:shrink-0">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Captions className="h-5 w-5" />
                Library
              </CardTitle>
              <CardDescription>Movies and episodes that already have a video file.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Tabs value={library} onValueChange={(value) => setLibrary(value as 'movie' | 'tvshow')}>
                <TabsList>
                  <TabsTrigger value="movie">Movies</TabsTrigger>
                  <TabsTrigger value="tvshow">TV Shows</TabsTrigger>
                </TabsList>
                <div className="relative mt-3">
                  <Search className="absolute top-2.5 left-2.5 h-4 w-4 text-muted-foreground" />
                  <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search titles" className="pl-8" />
                </div>
                <TabsContent value="movie" className="max-h-[60vh] space-y-1 overflow-y-auto">
                  {loadingLibrary && <Loader2 className="h-4 w-4 animate-spin" />}
                  {movies.map((movie) => (
                    <button
                      key={movie.id}
                      type="button"
                      onClick={() => openDetail('movie', movie.id)}
                      className={`flex w-full flex-col items-start gap-1 rounded-md px-2 py-2 text-left text-sm hover:bg-muted ${detail?.type === 'movie' && detail.id === movie.id ? 'bg-muted' : ''}`}
                    >
                      <span className="font-medium">{movie.title}{movie.year ? ` (${movie.year})` : ''}</span>
                      <span className="flex flex-wrap gap-1">
                        {movie.languages.length === 0 && <Badge variant="outline">No subtitles</Badge>}
                        {movie.languages.map((language) => <Badge key={language} variant="secondary">{language}</Badge>)}
                        {!movie.has_video && <Badge variant="destructive">Missing video</Badge>}
                      </span>
                    </button>
                  ))}
                </TabsContent>
                <TabsContent value="tvshow" className="max-h-[60vh] space-y-2 overflow-y-auto">
                  {loadingLibrary && <Loader2 className="h-4 w-4 animate-spin" />}
                  {shows.map((show) => (
                    <div key={show.id} className="rounded-md border">
                      <button type="button" className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium" onClick={() => openShow(show.id)}>
                        <span>{show.title}{show.year ? ` (${show.year})` : ''}</span>
                        {loadingShowId === show.id && <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />}
                      </button>
                      {openShowId === show.id && seasons.map((season) => (
                        <div key={season.id} className="border-t px-3 py-2">
                          <div className="flex items-center justify-between gap-2">
                            <div className="text-xs text-muted-foreground">
                              Season {season.season_number}
                              {season.coverage.map((item) => (
                                <span key={item.language} className="ml-2">{item.count}/{item.total} {item.language}</span>
                              ))}
                            </div>
                            <Button type="button" size="sm" variant="outline" onClick={() => {
                              setAutofillSeasonId(season.id);
                              setAutofillCost(null);
                              runAutofill(show.id, season.id, true);
                            }}>
                              Fetch missing
                            </Button>
                          </div>
                          {autofillSeasonId === season.id && (
                            <div className="mt-2 space-y-2 rounded-md bg-muted p-2 text-xs">
                              <p>Languages: {chosen.join(', ') || 'none selected'}</p>
                              <p>
                                {autofillCost === null ? 'Checking…' : `${autofillCost} episode-language pairs missing`}
                                {quotaLabel ? ` · ${quotaLabel}` : ''}
                              </p>
                              <Button
                                type="button"
                                size="sm"
                                disabled={autofillBusy || !autofillCost}
                                onClick={() => runAutofill(show.id, season.id, false)}
                              >
                                {autofillBusy && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                Download missing
                              </Button>
                            </div>
                          )}
                          <div className="mt-1 space-y-1">
                            {season.episodes.map((episode) => (
                              <button
                                key={episode.id}
                                type="button"
                                onClick={() => openDetail('episode', episode.id)}
                                className={`flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm hover:bg-muted ${detail?.type === 'episode' && detail.id === episode.id ? 'bg-muted' : ''}`}
                              >
                                <span>E{episode.episode_number} {episode.name}</span>
                                <span className="flex gap-1">
                                  {episode.languages.length === 0 && <Badge variant="outline">No subtitles</Badge>}
                                  {episode.languages.map((language) => <Badge key={language} variant="secondary">{language}</Badge>)}
                                </span>
                              </button>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <div className="min-w-0 flex-1 space-y-4">
            <OpenSubtitlesQuotaCard
              quota={quota}
              history={history}
              refreshing={refreshingQuota}
              onRefresh={refreshQuota}
            />

            {!detail && (
              <Card>
                <CardContent className="py-10 text-sm text-muted-foreground">
                  {loadingDetail ? 'Loading…' : 'Select a movie or episode to add subtitles.'}
                </CardContent>
              </Card>
            )}

            {detail && (
              <>
                <HeadingSmall title={detail.title} description={detail.subtitle || 'Add one subtitle file per language.'} />
                <div className="rounded-md border bg-muted/40 px-3 py-2">
                  <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Video file</p>
                  <p className="mt-1 break-all font-mono text-sm leading-snug" title={detail.video_path}>
                    {detail.video_file_name}
                  </p>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Current tracks</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {detail.tracks.length === 0 && <p className="text-sm text-muted-foreground">No subtitle tracks yet.</p>}
                    {detail.tracks.map((track) => (
                      <div key={track.language} className="flex items-center justify-between gap-3 rounded-md border px-3 py-2">
                        <div>
                          <p className="text-sm font-medium">{track.language_name} ({track.language})</p>
                          <p className="text-xs text-muted-foreground">{track.file_name} · {track.cue_count} cues</p>
                        </div>
                        <div className="flex gap-2">
                          <Button type="button" size="sm" variant="outline" onClick={() => previewExisting(track)}>Preview</Button>
                          <Button type="button" size="sm" variant="ghost" onClick={() => deleteTrack(track.language)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Add subtitle</CardTitle>
                    <CardDescription>Search OpenSubtitles first. Upload an .srt or .vtt file if you already have one.</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Tabs defaultValue="online">
                      <TabsList>
                        <TabsTrigger value="online">Find online</TabsTrigger>
                        <TabsTrigger value="upload">Upload file</TabsTrigger>
                      </TabsList>
                      <TabsContent value="online" className="space-y-3">
                        <div className="flex flex-wrap gap-2">
                          {languages.map((language) => {
                            const selected = chosen.includes(language.code);
                            const exists = existing.includes(language.code);
                            return (
                              <button
                                key={language.code}
                                type="button"
                                onClick={() => toggleLanguage(language.code)}
                                className={`rounded-full border px-3 py-1 text-xs ${selected ? 'border-primary bg-primary/10' : 'border-border'}`}
                              >
                                {language.code}
                                {exists ? ' · exists' : ''}
                              </button>
                            );
                          })}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button type="button" onClick={searchOnline} disabled={searching || chosen.length === 0}>
                            {searching && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Search
                          </Button>
                          {quotaLabel && <Badge variant="outline">{quotaLabel}</Badge>}
                        </div>
                        {groups?.map((group) => (
                          <div key={group.language} className="rounded-md border">
                            <div className="flex items-center justify-between border-b px-3 py-2 text-sm font-medium">
                              <span>{group.language_name}</span>
                              {picks[group.language] && (
                                <button
                                  type="button"
                                  className="text-xs font-normal text-muted-foreground"
                                  onClick={() => setPicks((current) => {
                                    const next = { ...current };
                                    delete next[group.language];
                                    return next;
                                  })}
                                >
                                  Skip
                                </button>
                              )}
                            </div>
                            {group.results.length === 0 && <p className="px-3 py-2 text-sm text-muted-foreground">No matches.</p>}
                            {group.results.map((result) => (
                              <label key={result.file_id} className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted">
                                <input
                                  type="radio"
                                  name={`pick-${group.language}`}
                                  checked={picks[group.language] === result.file_id}
                                  onChange={() => setPicks((current) => ({ ...current, [group.language]: result.file_id }))}
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="font-medium">{result.release || result.file_name}</span>
                                  <span className="mt-1 flex flex-wrap gap-1">
                                    <Badge variant="secondary">{result.downloads} downloads</Badge>
                                    {result.fps ? <Badge variant="outline">{result.fps} fps</Badge> : null}
                                    {result.hash_match && <Badge>Perfect sync</Badge>}
                                    {result.release_match && !result.hash_match && <Badge>Release match</Badge>}
                                    {result.hearing_impaired && <Badge variant="outline">HI</Badge>}
                                    {result.forced && <Badge variant="outline">Forced</Badge>}
                                    {result.ai_translated && <Badge variant="outline">AI</Badge>}
                                    {result.cam && <Badge variant="destructive">Cam/TS</Badge>}
                                  </span>
                                </span>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={tryingFileId !== null}
                                  onClick={(event) => {
                                    event.preventDefault();
                                    tryResult(group.language, result);
                                  }}
                                >
                                  {tryingFileId === result.file_id && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                                  Try
                                </Button>
                              </label>
                            ))}
                          </div>
                        ))}
                        {groups && (
                          <div className="sticky bottom-0 flex items-center justify-between gap-3 bg-background/95 py-2">
                            <span className="text-sm">
                              Preview {pickedCount} {pickedCount === 1 ? 'language' : 'languages'} — uses {pickedCount} {pickedCount === 1 ? 'download' : 'downloads'}
                            </span>
                            <Button type="button" onClick={downloadPicked} disabled={downloading || pickedCount === 0}>
                              {downloading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                              Preview
                            </Button>
                          </div>
                        )}
                      </TabsContent>
                      <TabsContent value="upload" className="space-y-3">
                        <label
                          className="flex cursor-pointer flex-col items-center gap-2 rounded-md border border-dashed px-4 py-8 text-sm text-muted-foreground"
                          onDragOver={(event) => event.preventDefault()}
                          onDrop={(event) => {
                            event.preventDefault();
                            onDropFiles(event.dataTransfer.files);
                          }}
                        >
                          <Upload className="h-5 w-5" />
                          Drop .srt or .vtt files, or click to browse
                          <input
                            type="file"
                            accept=".srt,.vtt,text/vtt,application/x-subrip"
                            multiple
                            className="hidden"
                            onChange={(event) => {
                              onDropFiles(event.target.files);
                              event.target.value = '';
                            }}
                          />
                        </label>
                        {uploading && <Loader2 className="h-4 w-4 animate-spin" />}
                        {uploads.map((item, index) => {
                          const duplicate = item.language ? uploadDuplicates.includes(item.language) : false;
                          return (
                            <div key={`${item.filename}-${index}`} className={`flex flex-wrap items-center gap-3 rounded-md border px-3 py-2 ${duplicate ? 'border-amber-500' : ''}`}>
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-medium">{item.filename}</p>
                                <p className="text-xs text-muted-foreground">
                                  {item.warnings.length > 0 ? item.warnings.map((warning) => warning.message).join(' · ') : 'Converted'}
                                </p>
                              </div>
                              <select
                                className="h-9 rounded-md border bg-transparent px-2 text-sm"
                                value={item.language ?? ''}
                                onChange={(event) => {
                                  const language = event.target.value || null;
                                  setUploads((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, language } : row));
                                }}
                              >
                                <option value="">Language</option>
                                {languages.map((language) => (
                                  <option key={language.code} value={language.code}>{language.code} · {language.name}</option>
                                ))}
                              </select>
                              <Button type="button" size="sm" variant="ghost" onClick={() => setUploads((current) => current.filter((_, rowIndex) => rowIndex !== index))}>
                                Remove
                              </Button>
                            </div>
                          );
                        })}
                        <Button type="button" onClick={openUploadPreview} disabled={!uploadReady}>
                          Preview {uploads.length} {uploads.length === 1 ? 'file' : 'files'}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </CardContent>
                </Card>
              </>
            )}

            {reviews.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Needs review</CardTitle>
                  <CardDescription>These downloads were not a perfect hash match, or the converter flagged them.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {reviews.map((item) => (
                    <div key={`${item.episode_id}-${item.language}`} className="flex items-center justify-between gap-3 text-sm">
                      <span>
                        E{item.episode_number} {item.name} · {item.language}
                        {item.hash_match ? ' · hash match' : ''}
                        {item.warnings[0] ? ` · ${item.warnings[0].message}` : ''}
                      </span>
                      <Button type="button" size="sm" variant="outline" disabled={!item.source} onClick={() => reviewEpisode(item.episode_id)}>
                        Review
                      </Button>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        <SubtitlePreviewDialog
          open={previewOpen}
          onOpenChange={setPreviewOpen}
          videoUrl={detail?.video_url ?? null}
          title={detail?.title ?? ''}
          drafts={drafts}
          onDraftsChange={setDrafts}
          languages={languages}
          saving={saving}
          onSave={saveDrafts}
          candidates={candidates}
          onSwapCandidate={swapCandidate}
          swappingLanguage={swappingLanguage}
        />
      </AdminFullWidthLayout>
    </AppLayout>
  );
}
