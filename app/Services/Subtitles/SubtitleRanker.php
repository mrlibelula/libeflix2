<?php

namespace App\Services\Subtitles;

class SubtitleRanker
{
    private const RESOLUTIONS = ['480p', '576p', '720p', '1080p', '1080i', '2160p', '4k', 'uhd'];

    private const IGNORED = [
        'x264', 'x265', 'h264', 'h265', 'hevc', 'avc', 'aac', 'ac3', 'eac3', 'dts', 'ddp', 'dd',
        'atmos', 'truehd', '10bit', '8bit', 'hdr', 'hdr10', 'dv', 'sdr', 'mp4', 'mkv', 'avi',
        'srt', 'vtt', 'sub', 'subs', 'eng', 'english', 'spa', 'spanish', 'es', 'en', 'the', 'and',
        'of', 'a', 'an', 'proper', 'repack', 'internal', 'extended', 'hi', 'sdh', 'cc', 'forced',
    ];

    private const CAM = ['cam', 'camrip', 'hdcam', 'ts', 'telesync', 'hdts', 'tc', 'telecine', 'hdtc'];

    /**
     * Rank OpenSubtitles results for a local video file.
     * Order: hash match, release-name match, not AI/cam, release score, downloads.
     *
     * @param  array<int, array<string, mixed>>  $results
     * @return array<int, array<string, mixed>>
     */
    public static function rank(array $results, ?string $videoFileName = null, ?string $title = null): array
    {
        $local = $videoFileName ? self::releaseTokens($videoFileName, $title) : [];

        foreach ($results as &$result) {
            $candidate = self::releaseTokens(trim(($result['release'] ?? '').' '.($result['file_name'] ?? '')), $title);
            $shared = array_values(array_intersect($local, $candidate));
            $strong = array_values(array_diff($shared, self::RESOLUTIONS));

            $result['cam'] = array_intersect($candidate, self::CAM) !== [];
            $result['release_score'] = count($shared);
            $result['release_match'] = $strong !== [];
            $result['low_quality'] = $result['cam'] || (bool) ($result['ai_translated'] ?? false);
        }
        unset($result);

        usort($results, function (array $a, array $b) {
            foreach (['hash_match', 'release_match'] as $flag) {
                if ($a[$flag] !== $b[$flag]) {
                    return $a[$flag] ? -1 : 1;
                }
            }

            if ($a['low_quality'] !== $b['low_quality']) {
                return $a['low_quality'] ? 1 : -1;
            }

            if ($a['release_score'] !== $b['release_score']) {
                return $b['release_score'] <=> $a['release_score'];
            }

            return ($b['downloads'] ?? 0) <=> ($a['downloads'] ?? 0);
        });

        return $results;
    }

    /**
     * Lowercase release tags with title words, years, episode markers, and codecs removed.
     *
     * @return array<int, string>
     */
    public static function releaseTokens(string $name, ?string $title = null): array
    {
        $name = strtolower(pathinfo($name, PATHINFO_EXTENSION) === '' ? $name : pathinfo($name, PATHINFO_FILENAME));
        $tokens = preg_split('/[^a-z0-9]+/', $name) ?: [];
        $titleTokens = $title ? (preg_split('/[^a-z0-9]+/', strtolower($title)) ?: []) : [];
        $skip = array_flip(array_merge(self::IGNORED, $titleTokens));

        $kept = [];
        foreach ($tokens as $token) {
            if ($token === '' || isset($skip[$token])) {
                continue;
            }
            if (ctype_digit($token) || preg_match('/^s\d+e\d+$/', $token) || preg_match('/^(aac|ddp|dd|ac)\d/', $token)) {
                continue;
            }
            $kept[$token] = true;
        }

        return array_keys($kept);
    }
}
