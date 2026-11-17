export type SubtitleCue = {
  start: number;
  end: number;
  text: string;
};

export type SubtitleWarning = {
  code: string;
  message: string;
};

export type SubtitleDraft = {
  language: string;
  fileId?: number | null;
  source: string;
  cues: SubtitleCue[];
  warnings: SubtitleWarning[];
  offsetMs: number;
  included: boolean;
  replaces: boolean;
  replaceConfirmed: boolean;
};

export function shiftCues(cues: SubtitleCue[], offsetMs: number): SubtitleCue[] {
  const shifted: SubtitleCue[] = [];

  cues.forEach((cue) => {
    const start = Math.max(0, cue.start + offsetMs);
    const end = cue.end + offsetMs;
    if (end <= 0 || end <= start) {
      return;
    }
    shifted.push({ start, end, text: cue.text });
  });

  return shifted;
}

export function formatVttTime(ms: number): string {
  const clamped = Math.max(0, Math.round(ms));
  const hours = Math.floor(clamped / 3600000);
  const minutes = Math.floor((clamped % 3600000) / 60000);
  const seconds = Math.floor((clamped % 60000) / 1000);
  const millis = clamped % 1000;
  const pad = (value: number, width = 2) => String(value).padStart(width, '0');

  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(millis, 3)}`;
}

export const LIBEFLIX_BRANDING_CUE: SubtitleCue = {
  start: 1250,
  end: 10500,
  text: '<i>Libeflix</i>',
};

export function isLibeflixBrandingCue(cue: SubtitleCue): boolean {
  return cue.text.replace(/<[^>]+>/g, '').trim().toLowerCase() === 'libeflix';
}

export function stripLibeflixBranding(cues: SubtitleCue[]): SubtitleCue[] {
  return cues.filter((cue) => !isLibeflixBrandingCue(cue));
}

export function buildVtt(cues: SubtitleCue[]): string {
  const lines = ['WEBVTT', ''];
  const withBranding = [LIBEFLIX_BRANDING_CUE, ...stripLibeflixBranding(cues)];

  withBranding.forEach((cue, index) => {
    lines.push(String(index + 1));
    lines.push(`${formatVttTime(cue.start)} --> ${formatVttTime(cue.end)}`);
    lines.push(cue.text);
    lines.push('');
  });

  return lines.join('\n');
}

export function cueAt(cues: SubtitleCue[], timeMs: number): SubtitleCue | null {
  return cues.find((cue) => timeMs >= cue.start && timeMs < cue.end) ?? null;
}

export function formatOffset(ms: number): string {
  const sign = ms > 0 ? '+' : ms < 0 ? '-' : '';
  const abs = Math.abs(ms);
  const seconds = Math.floor(abs / 1000);
  const millis = abs % 1000;

  if (millis === 0) {
    return `${sign}${seconds}s`;
  }

  return `${sign}${(abs / 1000).toFixed(1)}s`;
}
