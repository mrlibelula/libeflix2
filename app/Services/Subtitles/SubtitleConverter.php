<?php

namespace App\Services\Subtitles;

class SubtitleConverter
{
    public const BRANDING_START_MS = 1250;

    public const BRANDING_END_MS = 10500;

    public const BRANDING_TEXT = '<i>Libeflix</i>';

    /**
     * Parse subtitle text into cues plus diagnostics.
     * Cues are not shifted; pass them to toVtt() for an offset.
     * Existing Libeflix branding cues are stripped so re-imports do not duplicate them.
     *
     * @return array{cues: array<int, array{start: int, end: int, text: string}>, warnings: array<int, array{code: string, message: string}>, encoding: string, format: string}
     */
    public function parse(string $raw): array
    {
        $decoded = $this->decodeToUtf8($raw);
        $parsed = $this->parseText($decoded['text']);

        return [
            'cues' => $this->stripBrandingCues($parsed['cues']),
            'warnings' => array_merge($decoded['warnings'], $parsed['warnings']),
            'encoding' => $decoded['encoding'],
            'format' => $parsed['format'],
        ];
    }

    /**
     * @param  array<int, array{start: int, end: int, text: string}>  $cues
     */
    public function toVtt(array $cues, int $offsetMs = 0): string
    {
        $shifted = $this->shift($this->stripBrandingCues($cues), $offsetMs)['cues'];
        $withBranding = array_merge([$this->brandingCue()], $shifted);
        $lines = ['WEBVTT', ''];

        foreach ($withBranding as $index => $cue) {
            $lines[] = (string) ($index + 1);
            $lines[] = $this->formatMs($cue['start']).' --> '.$this->formatMs($cue['end']);
            $lines[] = $cue['text'];
            $lines[] = '';
        }

        return implode("\n", $lines);
    }

    /**
     * @return array{start: int, end: int, text: string}
     */
    public function brandingCue(): array
    {
        return [
            'start' => self::BRANDING_START_MS,
            'end' => self::BRANDING_END_MS,
            'text' => self::BRANDING_TEXT,
        ];
    }

    /**
     * True when the raw subtitle already contains a Libeflix branding cue
     * (plain text "libeflix" after tag strip), matching strip/dedup rules.
     */
    public function hasBranding(string $raw): bool
    {
        $decoded = $this->decodeToUtf8($raw);
        $parsed = $this->parseText($decoded['text']);

        foreach ($parsed['cues'] as $cue) {
            if ($this->isBrandingCueText($cue['text'])) {
                return true;
            }
        }

        return false;
    }

    public function isBrandingCueText(string $text): bool
    {
        return strtolower(trim(strip_tags($text))) === 'libeflix';
    }

    /**
     * @param  array<int, array{start: int, end: int, text: string}>  $cues
     * @return array<int, array{start: int, end: int, text: string}>
     */
    public function stripBrandingCues(array $cues): array
    {
        return array_values(array_filter($cues, function (array $cue) {
            return ! $this->isBrandingCueText($cue['text']);
        }));
    }

    /**
     * @return array{cues: array<int, array{start: int, end: int, text: string}>, warnings: array<int, array{code: string, message: string}>, encoding: string, format: string, vtt: string}
     */
    public function convert(string $raw, int $offsetMs = 0): array
    {
        $parsed = $this->parse($raw);
        $shifted = $this->shift($parsed['cues'], $offsetMs);
        $warnings = $parsed['warnings'];

        if ($shifted['dropped'] > 0) {
            $warnings[] = [
                'code' => 'offset',
                'message' => $shifted['dropped'].' '.($shifted['dropped'] === 1 ? 'cue' : 'cues').' removed by the offset',
            ];
        }

        return [
            'cues' => $shifted['cues'],
            'warnings' => $warnings,
            'encoding' => $parsed['encoding'],
            'format' => $parsed['format'],
            'vtt' => $this->toVtt($parsed['cues'], $offsetMs),
        ];
    }

    /**
     * Structural problems that should be reviewed before an automatic save.
     *
     * @param  array<int, array{code: string, message: string}>  $warnings
     */
    public function hasBlockingWarnings(array $warnings): bool
    {
        $blocking = ['empty', 'overlap', 'short', 'malformed', 'inverted', 'offset'];

        foreach ($warnings as $warning) {
            if (in_array($warning['code'], $blocking, true)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @return array{text: string, encoding: string, warnings: array<int, array{code: string, message: string}>}
     */
    private function decodeToUtf8(string $raw): array
    {
        if (str_starts_with($raw, "\xEF\xBB\xBF")) {
            return [
                'text' => substr($raw, 3),
                'encoding' => 'UTF-8',
                'warnings' => [['code' => 'encoding', 'message' => 'Stripped UTF-8 BOM']],
            ];
        }

        if (str_starts_with($raw, "\xFF\xFE")) {
            return [
                'text' => mb_convert_encoding(substr($raw, 2), 'UTF-8', 'UTF-16LE'),
                'encoding' => 'UTF-16LE',
                'warnings' => [['code' => 'encoding', 'message' => 'Converted from UTF-16LE']],
            ];
        }

        if (str_starts_with($raw, "\xFE\xFF")) {
            return [
                'text' => mb_convert_encoding(substr($raw, 2), 'UTF-8', 'UTF-16BE'),
                'encoding' => 'UTF-16BE',
                'warnings' => [['code' => 'encoding', 'message' => 'Converted from UTF-16BE']],
            ];
        }

        if (mb_check_encoding($raw, 'UTF-8')) {
            return [
                'text' => $raw,
                'encoding' => 'UTF-8',
                'warnings' => [],
            ];
        }

        $converted = mb_convert_encoding($raw, 'UTF-8', 'Windows-1252');

        return [
            'text' => is_string($converted) ? $converted : $raw,
            'encoding' => 'Windows-1252',
            'warnings' => [['code' => 'encoding', 'message' => 'Converted from Windows-1252']],
        ];
    }

    /**
     * @return array{cues: array<int, array{start: int, end: int, text: string}>, warnings: array<int, array{code: string, message: string}>, format: string}
     */
    private function parseText(string $text): array
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $format = preg_match('/^\s*WEBVTT\b/i', $text) ? 'vtt' : 'srt';
        $chunks = preg_split("/\n{2,}/", trim($text)) ?: [];

        $cues = [];
        $empty = 0;
        $malformed = 0;
        $inverted = 0;
        $short = 0;

        foreach ($chunks as $chunk) {
            $lines = explode("\n", trim($chunk));
            $lines = array_values(array_filter($lines, fn (string $line) => trim($line) !== ''));
            if ($lines === []) {
                continue;
            }

            $header = strtoupper(trim($lines[0]));
            if (in_array($header, ['WEBVTT', 'NOTE', 'STYLE', 'REGION'], true) || str_starts_with($header, 'WEBVTT') || str_starts_with($header, 'NOTE')) {
                continue;
            }

            $timeIndex = null;
            foreach ($lines as $index => $line) {
                if (str_contains($line, '-->')) {
                    $timeIndex = $index;
                    break;
                }
            }

            if ($timeIndex === null) {
                if (count($lines) === 1 && ctype_digit(trim($lines[0]))) {
                    continue;
                }
                $malformed++;

                continue;
            }

            $times = $this->parseTimeLine($lines[$timeIndex]);
            if ($times === null) {
                $malformed++;

                continue;
            }

            [$start, $end] = $times;
            if ($end <= $start) {
                $inverted++;

                continue;
            }

            $body = trim(implode("\n", array_slice($lines, $timeIndex + 1)));
            $body = $this->cleanText($body);
            if ($body === '') {
                $empty++;

                continue;
            }

            if (($end - $start) < 300) {
                $short++;
            }

            $cues[] = [
                'start' => $start,
                'end' => $end,
                'text' => $body,
            ];
        }

        usort($cues, fn (array $a, array $b) => $a['start'] <=> $b['start']);

        $overlaps = 0;
        $previousEnd = null;
        foreach ($cues as $cue) {
            if ($previousEnd !== null && $cue['start'] < $previousEnd) {
                $overlaps++;
            }
            $previousEnd = max($previousEnd ?? 0, $cue['end']);
        }

        $warnings = [];
        if ($empty > 0) {
            $warnings[] = ['code' => 'empty', 'message' => $empty.' empty '.($empty === 1 ? 'cue' : 'cues').' removed'];
        }
        if ($malformed > 0) {
            $warnings[] = ['code' => 'malformed', 'message' => $malformed.' malformed '.($malformed === 1 ? 'block' : 'blocks').' skipped'];
        }
        if ($inverted > 0) {
            $warnings[] = ['code' => 'inverted', 'message' => $inverted.' '.($inverted === 1 ? 'cue' : 'cues').' had an end before the start'];
        }
        if ($overlaps > 0) {
            $warnings[] = ['code' => 'overlap', 'message' => $overlaps.' overlapping '.($overlaps === 1 ? 'cue' : 'cues')];
        }
        if ($short > 0) {
            $warnings[] = ['code' => 'short', 'message' => $short.' '.($short === 1 ? 'cue' : 'cues').' shorter than 300ms'];
        }

        return [
            'cues' => $cues,
            'warnings' => $warnings,
            'format' => $format,
        ];
    }

    /**
     * @return array{0: int, 1: int}|null
     */
    private function parseTimeLine(string $line): ?array
    {
        $parts = preg_split('/\s*-->\s*/', trim($line), 2);
        if ($parts === false || count($parts) < 2) {
            return null;
        }

        $endPart = preg_split('/\s+/', trim($parts[1]), 2)[0] ?? '';
        $start = $this->parseTimestamp(trim($parts[0]));
        $end = $this->parseTimestamp($endPart);

        if ($start === null || $end === null) {
            return null;
        }

        return [$start, $end];
    }

    private function parseTimestamp(string $value): ?int
    {
        $pieces = explode(':', trim($value));
        if (count($pieces) === 2) {
            $hours = '0';
            [$minutes, $seconds] = $pieces;
        } elseif (count($pieces) === 3) {
            [$hours, $minutes, $seconds] = $pieces;
        } else {
            return null;
        }

        if (! ctype_digit($hours) || ! ctype_digit($minutes)) {
            return null;
        }

        if (! preg_match('/^(\d+)(?:[.,](\d{1,3}))?$/', $seconds, $matches)) {
            return null;
        }

        $millis = isset($matches[2]) ? (int) str_pad(substr($matches[2], 0, 3), 3, '0') : 0;

        return (((int) $hours * 3600) + ((int) $minutes * 60) + (int) $matches[1]) * 1000 + $millis;
    }

    private function cleanText(string $text): string
    {
        $text = preg_replace('/\{[^}]*\}/', '', $text) ?? $text;
        $text = preg_replace('/<\/?font[^>]*>/i', '', $text) ?? $text;
        $text = str_replace(['\\N', '\\n'], "\n", $text);
        $text = preg_replace("/[ \t]+\n/", "\n", $text) ?? $text;

        return trim($text);
    }

    /**
     * @param  array<int, array{start: int, end: int, text: string}>  $cues
     * @return array{cues: array<int, array{start: int, end: int, text: string}>, dropped: int}
     */
    private function shift(array $cues, int $offsetMs): array
    {
        $shifted = [];
        $dropped = 0;

        foreach ($cues as $cue) {
            $start = $cue['start'] + $offsetMs;
            $end = $cue['end'] + $offsetMs;

            if ($end <= 0) {
                $dropped++;

                continue;
            }

            $start = max(0, $start);
            if ($end <= $start) {
                $dropped++;

                continue;
            }

            $shifted[] = [
                'start' => $start,
                'end' => $end,
                'text' => $cue['text'],
            ];
        }

        return ['cues' => $shifted, 'dropped' => $dropped];
    }

    private function formatMs(int $ms): string
    {
        $ms = max(0, $ms);
        $hours = intdiv($ms, 3_600_000);
        $ms %= 3_600_000;
        $minutes = intdiv($ms, 60_000);
        $ms %= 60_000;
        $seconds = intdiv($ms, 1000);
        $millis = $ms % 1000;

        return sprintf('%02d:%02d:%02d.%03d', $hours, $minutes, $seconds, $millis);
    }
}
