<?php

namespace App\Services\Subtitles;

use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class OpenSubtitlesClient
{
    /**
     * @param  array<int, string>  $languages  Our two-letter codes.
     * @return array<int, array<string, mixed>>
     */
    public function searchMovie(int $tmdbId, array $languages, ?string $movieHash = null, ?string $videoFileName = null, ?string $title = null): array
    {
        return SubtitleRanker::rank($this->search([
            'tmdb_id' => $tmdbId,
            'type' => 'movie',
            'languages' => $this->languageQuery($languages),
            'moviehash' => $movieHash,
        ], $languages), $videoFileName, $title);
    }

    /**
     * @param  array<int, string>  $languages
     * @return array<int, array<string, mixed>>
     */
    public function searchEpisode(int $parentTmdbId, int $seasonNumber, int $episodeNumber, array $languages, ?string $movieHash = null, ?string $videoFileName = null, ?string $title = null): array
    {
        return SubtitleRanker::rank($this->search([
            'parent_tmdb_id' => $parentTmdbId,
            'season_number' => $seasonNumber,
            'episode_number' => $episodeNumber,
            'type' => 'episode',
            'languages' => $this->languageQuery($languages),
            'moviehash' => $movieHash,
        ], $languages), $videoFileName, $title);
    }

    /**
     * Files are cached for 3 hours, matching the window in which OpenSubtitles
     * does not count a repeat download of the same file against the quota.
     *
     * @return array{content: string, file_name: ?string, remaining: ?int, allowed: ?int, requests: ?int, reset_time_utc: ?string, cached: bool}
     */
    public function download(int $fileId): array
    {
        $cacheKey = 'opensubtitles.file.'.$fileId;
        $cached = Cache::get($cacheKey);
        if (is_array($cached) && is_string($cached['content'] ?? null)) {
            return [
                'content' => $cached['content'],
                'file_name' => $cached['file_name'] ?? null,
                'remaining' => null,
                'allowed' => null,
                'requests' => null,
                'reset_time_utc' => null,
                'cached' => true,
            ];
        }

        $fresh = $this->downloadFresh($fileId);
        Cache::put($cacheKey, [
            'content' => $fresh['content'],
            'file_name' => $fresh['file_name'],
        ], now()->addHours(3));

        return $fresh;
    }

    /**
     * @return array{content: string, file_name: ?string, remaining: ?int, allowed: ?int, requests: ?int, reset_time_utc: ?string, cached: bool}
     */
    private function downloadFresh(int $fileId): array
    {
        $response = $this->request()->post($this->baseUrl().'/download', [
            'file_id' => $fileId,
        ]);

        if ($response->status() === 406 || $this->isQuotaMessage($response)) {
            throw new OpenSubtitlesQuotaException(
                (string) ($response->json('message') ?: 'OpenSubtitles download quota reached.'),
                $response->json('reset_time_utc'),
                is_numeric($response->json('remaining')) ? (int) $response->json('remaining') : null,
            );
        }

        if (! $response->successful()) {
            throw new RuntimeException('OpenSubtitles download failed ('.$response->status().').');
        }

        $link = $response->json('link');
        if (! is_string($link) || $link === '') {
            throw new RuntimeException('OpenSubtitles did not return a download link.');
        }

        $file = Http::withHeaders([
            'User-Agent' => $this->userAgent(),
        ])->timeout(60)->get($link);

        if (! $file->successful()) {
            throw new RuntimeException('Subtitle file download failed ('.$file->status().').');
        }

        return [
            'content' => $this->decodePayload($file->body(), (string) $response->json('file_name')),
            'file_name' => $response->json('file_name'),
            'remaining' => is_numeric($response->json('remaining')) ? (int) $response->json('remaining') : null,
            'allowed' => is_numeric($response->json('allowed')) ? (int) $response->json('allowed') : null,
            'requests' => is_numeric($response->json('requests')) ? (int) $response->json('requests') : null,
            'reset_time_utc' => $response->json('reset_time_utc'),
            'cached' => false,
        ];
    }

    /**
     * @return array{remaining: ?int, allowed: ?int, used: ?int, downloads_count: ?int, level: ?string, vip: bool, reset_time: ?string, reset_time_utc: ?string}|null
     */
    public function quota(): ?array
    {
        try {
            $response = $this->request()->get($this->baseUrl().'/infos/user');
        } catch (RuntimeException) {
            return null;
        }

        if (! $response->successful()) {
            return null;
        }

        $data = $response->json('data') ?? $response->json();
        $remaining = is_numeric($data['remaining_downloads'] ?? null) ? (int) $data['remaining_downloads'] : null;
        $allowed = is_numeric($data['allowed_downloads'] ?? null) ? (int) $data['allowed_downloads'] : null;
        $used = ($remaining !== null && $allowed !== null) ? max(0, $allowed - $remaining) : null;

        return [
            'remaining' => $remaining,
            'allowed' => $allowed,
            'used' => $used,
            'downloads_count' => is_numeric($data['downloads_count'] ?? null) ? (int) $data['downloads_count'] : null,
            'level' => is_string($data['level'] ?? null) ? $data['level'] : null,
            'vip' => (bool) ($data['vip'] ?? false),
            'reset_time' => is_string($data['reset_time'] ?? null) ? $data['reset_time'] : null,
            'reset_time_utc' => is_string($data['reset_time_utc'] ?? null) ? $data['reset_time_utc'] : null,
        ];
    }

    /**
     * @param  array<string, mixed>  $query
     * @param  array<int, string>  $requested
     * @return array<int, array<string, mixed>>
     */
    private function search(array $query, array $requested): array
    {
        $query = array_filter($query, fn ($value) => $value !== null && $value !== '');
        $response = $this->request(false)->get($this->baseUrl().'/subtitles', $query);

        if (! $response->successful()) {
            throw new RuntimeException('OpenSubtitles search failed ('.$response->status().').');
        }

        $wanted = [];
        foreach ($requested as $code) {
            $normalized = SubtitleLanguages::normalize($code);
            if ($normalized !== null) {
                $wanted[$normalized] = true;
            }
        }

        $results = [];
        foreach ($response->json('data') ?? [] as $row) {
            $attributes = $row['attributes'] ?? [];
            $language = SubtitleLanguages::normalize($attributes['language'] ?? null);
            if ($language === null || ! isset($wanted[$language])) {
                continue;
            }

            $file = $this->firstFile($attributes['files'] ?? []);
            if ($file === null) {
                continue;
            }

            if ((int) ($attributes['nb_cd'] ?? 1) > 1) {
                continue;
            }

            $results[] = [
                'file_id' => (int) $file['file_id'],
                'file_name' => (string) ($file['file_name'] ?? ''),
                'language' => $language,
                'release' => (string) ($attributes['release'] ?? ''),
                'downloads' => (int) ($attributes['download_count'] ?? 0),
                'fps' => $attributes['fps'] ?? null,
                'hearing_impaired' => (bool) ($attributes['hearing_impaired'] ?? false),
                'forced' => (bool) ($attributes['foreign_parts_only'] ?? false),
                'hash_match' => (bool) ($attributes['moviehash_match'] ?? false),
                'ai_translated' => (bool) ($attributes['ai_translated'] ?? false),
            ];
        }

        return $results;
    }

    /**
     * @param  array<int, mixed>  $files
     * @return array{file_id: int|string, file_name?: string}|null
     */
    private function firstFile(array $files): ?array
    {
        foreach ($files as $file) {
            if (is_array($file) && isset($file['file_id'])) {
                return $file;
            }
        }

        return null;
    }

    /**
     * @param  array<int, string>  $languages
     */
    private function languageQuery(array $languages): string
    {
        $codes = [];
        foreach ($languages as $language) {
            $normalized = SubtitleLanguages::normalize($language);
            if ($normalized !== null) {
                $codes[] = SubtitleLanguages::toOpenSubtitles($normalized);
            }
        }

        $codes = array_values(array_unique($codes));
        sort($codes);

        return implode(',', $codes);
    }

    private function request(bool $withToken = true): \Illuminate\Http\Client\PendingRequest
    {
        $key = config('services.opensubtitles.api_key');
        if (! is_string($key) || $key === '') {
            throw new RuntimeException('OpenSubtitles API key is not configured.');
        }

        $headers = [
            'Api-Key' => $key,
            'User-Agent' => $this->userAgent(),
            'Accept' => 'application/json',
        ];

        if ($withToken) {
            $headers['Authorization'] = 'Bearer '.$this->login();
        }

        return Http::withHeaders($headers)->acceptJson()->timeout(30);
    }

    private function login(): string
    {
        $cached = Cache::get($this->tokenCacheKey());
        if (is_string($cached) && $cached !== '') {
            return $cached;
        }

        $username = config('services.opensubtitles.username');
        $password = config('services.opensubtitles.password');
        if (! is_string($username) || $username === '' || ! is_string($password) || $password === '') {
            throw new RuntimeException('OpenSubtitles username and password are not configured.');
        }

        $response = Http::withHeaders([
            'Api-Key' => config('services.opensubtitles.api_key'),
            'User-Agent' => $this->userAgent(),
            'Accept' => 'application/json',
        ])->acceptJson()->timeout(30)->post($this->baseUrl().'/login', [
            'username' => $username,
            'password' => $password,
        ]);

        $token = $response->json('token');
        if (! $response->successful() || ! is_string($token) || $token === '') {
            throw new RuntimeException('OpenSubtitles login failed.');
        }

        Cache::put($this->tokenCacheKey(), $token, now()->addHours(23));

        return $token;
    }

    private function decodePayload(string $body, string $fileName): string
    {
        if (str_starts_with($body, "\x1f\x8b")) {
            $decoded = gzdecode($body);
            if (is_string($decoded)) {
                $body = $decoded;
            }
        }

        if (str_starts_with($body, 'PK')) {
            return $this->extractZip($body);
        }

        return $body;
    }

    private function extractZip(string $body): string
    {
        $temp = tempnam(sys_get_temp_dir(), 'oszip');
        if ($temp === false) {
            throw new RuntimeException('Could not create a temp file for the subtitle archive.');
        }

        file_put_contents($temp, $body);
        $zip = new \ZipArchive;
        if ($zip->open($temp) !== true) {
            @unlink($temp);
            throw new RuntimeException('OpenSubtitles returned an archive that could not be opened.');
        }

        $picked = null;
        for ($i = 0; $i < $zip->numFiles; $i++) {
            $name = (string) $zip->getNameIndex($i);
            $lower = strtolower($name);
            if (str_ends_with($lower, '.srt') || str_ends_with($lower, '.vtt')) {
                $picked = $zip->getFromIndex($i);
                if (is_string($picked)) {
                    break;
                }
            }
        }

        $zip->close();
        @unlink($temp);

        if (! is_string($picked)) {
            throw new RuntimeException('The subtitle archive did not contain an SRT or VTT file.');
        }

        return $picked;
    }

    private function isQuotaMessage(Response $response): bool
    {
        $message = strtolower((string) $response->json('message'));

        return $response->status() === 406
            || str_contains($message, 'download') && str_contains($message, 'allowed');
    }

    private function baseUrl(): string
    {
        return rtrim((string) config('services.opensubtitles.base_url'), '/');
    }

    private function userAgent(): string
    {
        $agent = config('services.opensubtitles.user_agent');

        return is_string($agent) && $agent !== '' ? $agent : 'Libeflix v1.0';
    }

    private function tokenCacheKey(): string
    {
        return 'opensubtitles.token.'.md5((string) config('services.opensubtitles.username'));
    }
}
