import { useEffect, useMemo, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import {
  buildVtt,
  cueAt,
  formatOffset,
  formatVttTime,
  shiftCues,
  stripLibeflixBranding,
  type SubtitleCue,
  type SubtitleDraft,
} from '@/lib/vtt';

type LanguageOption = {
  code: string;
  name: string;
};

export type SubtitleCandidate = {
  file_id: number;
  file_name: string;
  release: string;
  downloads: number;
  hash_match: boolean;
  release_match: boolean;
  hearing_impaired: boolean;
  ai_translated: boolean;
  cam: boolean;
};

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  videoUrl: string | null;
  title: string;
  drafts: SubtitleDraft[];
  onDraftsChange: (drafts: SubtitleDraft[]) => void;
  languages: LanguageOption[];
  saving: boolean;
  onSave: () => void;
  candidates?: Record<string, SubtitleCandidate[]>;
  onSwapCandidate?: (language: string, fileId: number) => void;
  swappingLanguage?: string | null;
};

function candidateLabel(candidate: SubtitleCandidate): string {
  const tags = [
    candidate.hash_match ? 'Perfect sync' : null,
    candidate.release_match ? 'Release match' : null,
    candidate.hearing_impaired ? 'HI' : null,
    candidate.ai_translated ? 'AI' : null,
    candidate.cam ? 'Cam/TS' : null,
  ].filter(Boolean);
  const name = candidate.release || candidate.file_name;

  return tags.length ? `${name} · ${tags.join(' · ')}` : name;
}

const ROW_HEIGHT = 84;

export default function SubtitlePreviewDialog({
  open,
  onOpenChange,
  videoUrl,
  title,
  drafts,
  onDraftsChange,
  languages,
  saving,
  onSave,
  candidates = {},
  onSwapCandidate,
  swappingLanguage = null,
}: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [activeLanguage, setActiveLanguage] = useState(drafts[0]?.language ?? '');
  const [compareLanguage, setCompareLanguage] = useState<string>('');
  const [compare, setCompare] = useState(false);
  const [currentMs, setCurrentMs] = useState(0);
  const [scrollTop, setScrollTop] = useState(0);
  const [previewDrafts, setPreviewDrafts] = useState(drafts);
  const urlsRef = useRef<string[]>([]);

  useEffect(() => {
    if (drafts.length && !drafts.some((draft) => draft.language === activeLanguage)) {
      setActiveLanguage(drafts[0].language);
    }
  }, [drafts, activeLanguage]);

  // Debounce Blob rebuilds so typing cue edits does not constantly reset the track.
  useEffect(() => {
    const timer = window.setTimeout(() => setPreviewDrafts(drafts), 250);
    return () => window.clearTimeout(timer);
  }, [drafts]);

  const blobs = useMemo(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    const next = previewDrafts.map((draft) => {
      const vtt = buildVtt(shiftCues(draft.cues, draft.offsetMs));
      return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
    });
    urlsRef.current = next;
    return next;
  }, [previewDrafts]);

  useEffect(() => {
    return () => {
      urlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !open || !activeLanguage) {
      return;
    }

    const matchesActive = (track: TextTrack) => {
      const language = (track.language || '').toUpperCase();
      const label = (track.label || '').toUpperCase();
      const wanted = activeLanguage.toUpperCase();
      return language === wanted || label === wanted || label.startsWith(`${wanted} `);
    };

    const apply = () => {
      Array.from(video.textTracks).forEach((track) => {
        track.mode = matchesActive(track) ? 'showing' : 'disabled';
      });
    };

    apply();
    const timers = [0, 50, 150, 400].map((delay) => window.setTimeout(apply, delay));
    video.addEventListener('loadedmetadata', apply);
    video.addEventListener('loadeddata', apply);
    video.textTracks.addEventListener('addtrack', apply);

    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      video.removeEventListener('loadedmetadata', apply);
      video.removeEventListener('loadeddata', apply);
      video.textTracks.removeEventListener('addtrack', apply);
    };
  }, [activeLanguage, blobs, open]);

  // Programmatic video.focus() alone is unreliable for browser media keys after a dialog
  // opens, so also handle seeking at the dialog level while preview is open.
  const focusPlayer = () => {
    const video = videoRef.current;
    if (!video || !open) {
      return;
    }
    video.focus({ preventScroll: true });
  };

  useEffect(() => {
    if (!open || !videoUrl) {
      return;
    }
    const timers = [0, 50, 150, 400, 800].map((delay) => window.setTimeout(focusPlayer, delay));
    const video = videoRef.current;
    const onReady = () => focusPlayer();
    video?.addEventListener('loadeddata', onReady);
    return () => {
      timers.forEach((timer) => window.clearTimeout(timer));
      video?.removeEventListener('loadeddata', onReady);
    };
  }, [open, videoUrl]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }
      const tag = target.tagName;
      return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingTarget(event.target)) {
        return;
      }

      const video = videoRef.current;
      if (!video) {
        return;
      }

      const step = event.shiftKey ? 10 : 5;

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault();
        event.stopPropagation();
        const delta = event.key === 'ArrowLeft' ? -step : step;
        const candidate = video.currentTime + delta;
        const next = Math.max(
          0,
          Number.isFinite(video.duration) ? Math.min(video.duration, candidate) : candidate,
        );
        video.currentTime = next;
        setCurrentMs(next * 1000);
        focusPlayer();
        return;
      }

      if (event.key === ' ' || event.code === 'Space') {
        if (event.target instanceof HTMLElement) {
          const tag = event.target.tagName;
          if (tag === 'BUTTON' || tag === 'A' || event.target.getAttribute('role') === 'button') {
            return;
          }
        }
        event.preventDefault();
        if (video.paused) {
          video.play().catch(() => undefined);
        } else {
          video.pause();
        }
        focusPlayer();
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [open]);

  const active = drafts.find((draft) => draft.language === activeLanguage) ?? drafts[0];
  const compareDraft = drafts.find((draft) => draft.language === compareLanguage);
  const compareCue = compare && compareDraft
    ? cueAt(shiftCues(compareDraft.cues, compareDraft.offsetMs), currentMs)
    : null;
  const activeIndex = active
    ? active.cues.findIndex((cue) => {
      const start = Math.max(0, cue.start + active.offsetMs);
      const end = cue.end + active.offsetMs;
      return currentMs >= start && currentMs < end && end > start;
    })
    : -1;

  const visibleStart = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - 4);
  const visibleEnd = Math.min(active?.cues.length ?? 0, visibleStart + 14);

  const updateDraft = (language: string, patch: Partial<SubtitleDraft>) => {
    onDraftsChange(drafts.map((draft) => (draft.language === language ? { ...draft, ...patch } : draft)));
  };

  const updateCueText = (index: number, text: string) => {
    if (!active) {
      return;
    }
    const cues = active.cues.map((cue, cueIndex) => (cueIndex === index ? { ...cue, text } : cue));
    updateDraft(active.language, { cues });
  };

  const removeCue = (index: number) => {
    if (!active) {
      return;
    }
    updateDraft(active.language, {
      cues: active.cues.filter((_, cueIndex) => cueIndex !== index),
    });
  };

  const nudge = (delta: number) => {
    if (!active) {
      return;
    }
    const next = Math.max(-10000, Math.min(10000, active.offsetMs + delta));
    updateDraft(active.language, { offsetMs: next });
  };

  const applyOffsetToAll = () => {
    if (!active) {
      return;
    }
    onDraftsChange(drafts.map((draft) => ({ ...draft, offsetMs: active.offsetMs })));
    toast.success(`Applied ${formatOffset(active.offsetMs)} to every language`);
  };

  const changeLanguage = (from: string, to: string) => {
    if (drafts.some((draft) => draft.language === to)) {
      toast.error(`${to} is already in this preview`);
      return;
    }
    onDraftsChange(drafts.map((draft) => (draft.language === from ? { ...draft, language: to } : draft)));
    if (activeLanguage === from) {
      setActiveLanguage(to);
    }
  };

  const duplicateLanguages = drafts.filter((draft, index) => drafts.findIndex((other) => other.language === draft.language) !== index);
  const included = drafts.filter((draft) => draft.included);
  const blocked = included.some((draft) => draft.replaces && !draft.replaceConfirmed) || included.length === 0 || duplicateLanguages.length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[92vh] flex-col overflow-hidden sm:max-w-6xl"
        onOpenAutoFocus={(event) => {
          if (!videoUrl) {
            return;
          }
          event.preventDefault();
          // Defer past Radix focus setup so the player keeps keyboard control.
          requestAnimationFrame(() => focusPlayer());
        }}
        onCloseAutoFocus={(event) => {
          // Avoid jumping focus back to the Try button under the dialog.
          event.preventDefault();
        }}
      >
        <DialogHeader>
          <DialogTitle>Preview subtitles</DialogTitle>
          <DialogDescription>{title}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap gap-2">
          {drafts.map((draft) => {
            const warning = draft.warnings.length > 0;
            return (
              <button
                key={draft.language}
                type="button"
                onClick={() => setActiveLanguage(draft.language)}
                className={`flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm ${active?.language === draft.language ? 'border-primary bg-primary/10' : 'border-border'}`}
              >
                <span className={`h-2 w-2 rounded-full ${warning ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                {draft.language}
                {draft.replaces && <Badge variant="outline">replaces</Badge>}
              </button>
            );
          })}
        </div>

        <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <div className="relative min-h-[220px] overflow-hidden rounded-md bg-black">
            {videoUrl ? (
              <video
                ref={videoRef}
                key={videoUrl}
                src={videoUrl}
                controls
                tabIndex={0}
                className="h-full max-h-[420px] w-full outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
                onTimeUpdate={(event) => setCurrentMs(event.currentTarget.currentTime * 1000)}
              >
                {drafts.map((draft, index) => (
                  <track
                    key={`${draft.language}-${draft.fileId ?? 'local'}-${draft.offsetMs}`}
                    kind="subtitles"
                    src={blobs[index]}
                    srcLang={draft.language.toLowerCase()}
                    label={draft.language}
                    default={draft.language.toUpperCase() === activeLanguage.toUpperCase()}
                  />
                ))}
              </video>
            ) : (
              <div className="flex h-48 items-center justify-center text-sm text-neutral-300">
                No video file to preview against.
              </div>
            )}
            {compareCue && (
              <div className="pointer-events-none absolute inset-x-0 top-3 px-6 text-center">
                <span className="inline-block rounded bg-black/75 px-3 py-1 text-sm text-white">
                  {compareDraft?.language}: {compareCue.text}
                </span>
              </div>
            )}
          </div>

          <div className="flex min-h-0 flex-col gap-3">
            {active && (
              <>
                {onSwapCandidate && (candidates[active.language]?.length ?? 0) > 1 && (
                  <div className="flex flex-col gap-1">
                    <span className="text-xs text-muted-foreground">
                      Candidate · switching keeps your offset, and re-trying a file within 3 hours is free
                    </span>
                    <Select
                      value={active.fileId ? String(active.fileId) : undefined}
                      onValueChange={(value) => onSwapCandidate(active.language, Number(value))}
                      disabled={swappingLanguage !== null}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Choose another subtitle" />
                      </SelectTrigger>
                      <SelectContent>
                        {candidates[active.language].map((candidate) => (
                          <SelectItem key={candidate.file_id} value={String(candidate.file_id)}>
                            {candidateLabel(candidate)} · {candidate.downloads} downloads
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {swappingLanguage === active.language && (
                      <span className="text-xs text-muted-foreground">Downloading…</span>
                    )}
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2">
                  <Select value={active.language} onValueChange={(value) => changeLanguage(active.language, value)}>
                    <SelectTrigger className="w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {languages.map((language) => (
                        <SelectItem key={language.code} value={language.code}>
                          {language.code} · {language.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button type="button" size="sm" variant="outline" onClick={() => nudge(-1000)}>-1s</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => nudge(-100)}>-100ms</Button>
                  <span className="min-w-16 text-center text-sm tabular-nums">{formatOffset(active.offsetMs)}</span>
                  <Button type="button" size="sm" variant="outline" onClick={() => nudge(100)}>+100ms</Button>
                  <Button type="button" size="sm" variant="outline" onClick={() => nudge(1000)}>+1s</Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={active.offsetMs === 0}
                    onClick={() => updateDraft(active.language, { offsetMs: 0 })}
                  >
                    Reset
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={applyOffsetToAll}>
                    Apply offset to all
                  </Button>
                </div>

                {active.warnings.length > 0 && (
                  <ul className="space-y-1 text-sm text-amber-700 dark:text-amber-400">
                    {active.warnings.map((warning) => (
                      <li key={warning.message}>{warning.message}</li>
                    ))}
                  </ul>
                )}

                <p className="text-xs text-muted-foreground">
                  Edit cue text to remove ads or URLs. Click the time to seek. Empty cues are removed when you leave the field.
                </p>

                <div
                  ref={listRef}
                  className="min-h-[220px] flex-1 overflow-y-auto rounded-md border"
                  onScroll={(event) => setScrollTop(event.currentTarget.scrollTop)}
                >
                  <div style={{ height: active.cues.length * ROW_HEIGHT, position: 'relative' }}>
                    {active.cues.slice(visibleStart, visibleEnd).map((cue, offset) => {
                      const index = visibleStart + offset;
                      const selected = index === activeIndex;
                      const displayStart = Math.max(0, cue.start + active.offsetMs);
                      return (
                        <div
                          key={`${cue.start}-${cue.end}-${index}`}
                          className={`absolute inset-x-0 flex gap-2 px-2 py-1.5 ${selected ? 'bg-primary/10' : ''}`}
                          style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                        >
                          <button
                            type="button"
                            className="w-24 shrink-0 self-start pt-2 text-left text-xs tabular-nums text-muted-foreground hover:text-foreground"
                            title="Seek to this cue"
                            onClick={() => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = displayStart / 1000;
                                videoRef.current.play().catch(() => undefined);
                              }
                            }}
                          >
                            {formatVttTime(displayStart)}
                          </button>
                          <Textarea
                            value={cue.text}
                            rows={2}
                            className="min-h-[60px] flex-1 resize-none py-1.5 text-sm leading-snug"
                            onChange={(event) => updateCueText(index, event.target.value)}
                            onBlur={(event) => {
                              if (event.target.value.trim() === '') {
                                removeCue(index);
                              }
                            }}
                            onFocus={() => {
                              if (videoRef.current) {
                                videoRef.current.currentTime = displayStart / 1000;
                              }
                            }}
                          />
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="mt-1 h-8 w-8 shrink-0"
                            title="Remove cue"
                            onClick={() => removeCue(index)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        <DialogFooter className="flex-col items-stretch gap-3 sm:flex-col">
          <div className="flex flex-wrap items-center gap-4">
            {drafts.map((draft) => (
              <label key={draft.language} className="flex items-center gap-2 text-sm">
                <Checkbox
                  checked={draft.included}
                  onCheckedChange={(checked) => updateDraft(draft.language, { included: checked === true })}
                />
                Save {draft.language}
                {draft.replaces && (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Checkbox
                      checked={draft.replaceConfirmed}
                      onCheckedChange={(checked) => updateDraft(draft.language, { replaceConfirmed: checked === true })}
                    />
                    Replace existing {draft.language} track
                  </span>
                )}
              </label>
            ))}
            {drafts.length > 1 && (
              <label className="ml-auto flex items-center gap-2 text-sm">
                <Checkbox
                  checked={compare}
                  onCheckedChange={(checked) => setCompare(checked === true)}
                />
                Compare
                <Select value={compareLanguage || 'none'} onValueChange={(value) => setCompareLanguage(value === 'none' ? '' : value)}>
                  <SelectTrigger className="w-28">
                    <SelectValue placeholder="Language" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {drafts.filter((draft) => draft.language !== active?.language).map((draft) => (
                      <SelectItem key={draft.language} value={draft.language}>{draft.language}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </label>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="button" onClick={onSave} disabled={saving || blocked}>
              {saving ? 'Saving…' : `Save ${included.length} ${included.length === 1 ? 'track' : 'tracks'}`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function draftsFromItems(
  items: Array<{
    language: string | null;
    file_id?: number | null;
    source: string;
    cues: SubtitleCue[];
    warnings: SubtitleDraft['warnings'];
  }>,
  existing: string[],
): SubtitleDraft[] {
  return items
    .filter((item): item is typeof item & { language: string } => Boolean(item.language))
    .map((item) => ({
      language: item.language,
      fileId: item.file_id ?? null,
      source: item.source,
      cues: stripLibeflixBranding(item.cues),
      warnings: item.warnings,
      offsetMs: 0,
      included: true,
      replaces: existing.includes(item.language),
      replaceConfirmed: false,
    }));
}
