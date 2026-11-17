<?php

namespace App\Services\Subtitles;

use App\Models\Episode;
use App\Models\Season;
use App\Models\Tvshow;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class SubtitleLibrary
{
    public function __construct(
        private readonly SubtitleConverter $converter,
        private readonly SubtitleTargetResolver $resolver,
        private readonly OpenSubtitlesClient $client,
        private readonly SubtitleDownloadLogger $downloadLogger,
    ) {}

    /**
     * @param  array<int, array{language: string, source: string, offset_ms?: int, overwrite?: bool}>  $tracks
     * @param  array{type: string, model: mixed, disk: string, video_path: string}  $target
     * @return array{saved: array<int, array<string, mixed>>, conflicts: array<int, array<string, mixed>>, tracks: array<int, array<string, mixed>>}
     */
    public function saveTracks(array $target, array $tracks): array
    {
        $languages = [];
        foreach ($tracks as $track) {
            $language = strtoupper((string) ($track['language'] ?? ''));
            if (! SubtitleLanguages::isAllowed($language)) {
                throw ValidationException::withMessages([
                    'tracks' => $language.' is not a supported subtitle language.',
                ]);
            }
            if (isset($languages[$language])) {
                throw ValidationException::withMessages([
                    'tracks' => 'Each track must use a different language.',
                ]);
            }
            $languages[$language] = true;
        }

        $storage = Storage::disk($target['disk']);
        $saved = [];
        $conflicts = [];

        foreach ($tracks as $track) {
            $language = strtoupper((string) $track['language']);
            $path = $this->resolver->vttRelativePath($target['video_path'], $language);
            $exists = $storage->exists($path);

            if ($exists && empty($track['overwrite'])) {
                $conflicts[] = [
                    'language' => $language,
                    'language_name' => SubtitleLanguages::name($language),
                    'path' => $path,
                ];

                continue;
            }

            $converted = $this->converter->convert((string) $track['source'], (int) ($track['offset_ms'] ?? 0));
            $storage->put($path, $converted['vtt']);
            $saved[] = [
                'language' => $language,
                'language_name' => SubtitleLanguages::name($language),
                'path' => $path,
                'cue_count' => count($converted['cues']),
                'warnings' => $converted['warnings'],
            ];
        }

        if ($saved !== []) {
            $this->resolver->refresh($target);
        }

        return [
            'saved' => $saved,
            'conflicts' => $conflicts,
            'tracks' => $this->resolver->existingTracks($target),
        ];
    }

    /**
     * @param  array{type: string, model: mixed, disk: string, video_path: string}  $target
     * @return array{deleted: string, tracks: array<int, array<string, mixed>>}
     */
    public function deleteTrack(array $target, string $language): array
    {
        $language = strtoupper($language);
        if (! SubtitleLanguages::isAllowed($language)) {
            throw ValidationException::withMessages([
                'language' => 'Unknown subtitle language.',
            ]);
        }

        $path = $this->resolver->vttRelativePath($target['video_path'], $language);
        $storage = Storage::disk($target['disk']);
        if ($storage->exists($path)) {
            $storage->delete($path);
        }

        $this->resolver->refresh($target);

        return [
            'deleted' => $language,
            'tracks' => $this->resolver->existingTracks($target),
        ];
    }

    /**
     * @param  array<int, string>  $languages
     * @return array<string, mixed>
     */
    public function autofillSeason(Tvshow $tvshow, Season $season, array $languages, bool $dryRun): array
    {
        if ((int) $season->tvshow_id !== (int) $tvshow->id) {
            throw ValidationException::withMessages([
                'season' => 'That season does not belong to this show.',
            ]);
        }

        $normalized = [];
        foreach ($languages as $language) {
            $code = SubtitleLanguages::normalize($language);
            if ($code === null) {
                throw ValidationException::withMessages([
                    'languages' => strtoupper((string) $language).' is not a supported subtitle language.',
                ]);
            }
            $normalized[$code] = $code;
        }
        $normalized = array_values($normalized);

        $episodes = Episode::query()
            ->where('season_id', $season->id)
            ->orderBy('episode_number')
            ->get();

        $pairs = [];
        foreach ($episodes as $episode) {
            $path = (string) $episode->is_in_storage;
            if ($path === '' || ! Storage::disk('tvshows')->exists($path)) {
                continue;
            }

            foreach ($normalized as $language) {
                $vttPath = $this->resolver->vttRelativePath($path, $language);
                if (Storage::disk('tvshows')->exists($vttPath)) {
                    continue;
                }
                $pairs[] = [
                    'episode_id' => (int) $episode->id,
                    'episode_number' => $episode->episode_number,
                    'name' => $episode->name,
                    'language' => $language,
                ];
            }
        }

        $quota = $this->client->quota();

        if ($dryRun) {
            return [
                'dry_run' => true,
                'missing' => count($pairs),
                'pairs' => $pairs,
                'quota' => $quota,
                'saved' => [],
                'needs_review' => [],
                'quota_exceeded' => false,
            ];
        }

        @set_time_limit(180);

        $saved = [];
        $needsReview = [];
        $quotaExceeded = false;
        $remaining = $quota['remaining'] ?? null;

        foreach ($pairs as $pair) {
            if ($quotaExceeded) {
                break;
            }

            $episode = $episodes->firstWhere('id', $pair['episode_id']);
            if (! $episode instanceof Episode) {
                continue;
            }

            try {
                $target = $this->resolver->resolve('episode', (int) $episode->id);
            } catch (\Throwable $exception) {
                $needsReview[] = $this->reviewDraft($pair, null, [], [['code' => 'malformed', 'message' => $exception->getMessage()]], false);

                continue;
            }

            $hash = OpenSubtitlesHash::fromDisk($target['disk'], $target['video_path']);

            try {
                $results = $this->client->searchEpisode(
                    (int) $tvshow->tmdb_id,
                    (int) ($episode->season_number ?? $season->season_number),
                    (int) $episode->episode_number,
                    [$pair['language']],
                    $hash,
                    basename($target['video_path']),
                    (string) $tvshow->name,
                );
            } catch (OpenSubtitlesQuotaException $exception) {
                $quotaExceeded = true;
                $remaining = $exception->remaining;
                break;
            } catch (\Throwable $exception) {
                $needsReview[] = $this->reviewDraft($pair, null, [], [['code' => 'malformed', 'message' => $exception->getMessage()]], false);

                continue;
            }

            $best = $results[0] ?? null;
            if ($best === null) {
                $needsReview[] = $this->reviewDraft($pair, null, [], [['code' => 'empty', 'message' => 'No '.$pair['language'].' subtitles found']], false);

                continue;
            }

            try {
                $download = $this->client->download((int) $best['file_id']);
            } catch (OpenSubtitlesQuotaException $exception) {
                $quotaExceeded = true;
                $remaining = $exception->remaining;
                break;
            } catch (\Throwable $exception) {
                $needsReview[] = $this->reviewDraft($pair, null, [], [['code' => 'malformed', 'message' => $exception->getMessage()]], (bool) $best['hash_match']);

                continue;
            }

            $remaining = $download['remaining'];
            $user = Auth::user();
            $this->downloadLogger->log(
                $user instanceof User ? $user : null,
                [
                    'type' => 'episode',
                    'id' => (int) $episode->id,
                    'title' => $target['title'],
                ],
                $pair['language'],
                (int) $best['file_id'],
                is_string($download['file_name'] ?? null) ? $download['file_name'] : null,
                (bool) $download['cached'],
                $download['cached'] ? null : (is_numeric($download['remaining'] ?? null) ? (int) $download['remaining'] : null),
            );
            $converted = $this->converter->convert($download['content']);
            $hashMatch = (bool) $best['hash_match'];

            if ($hashMatch && ! $this->converter->hasBlockingWarnings($converted['warnings'])) {
                $path = $this->resolver->vttRelativePath($target['video_path'], $pair['language']);
                Storage::disk($target['disk'])->put($path, $converted['vtt']);
                $this->resolver->refresh($target);
                $saved[] = [
                    'episode_id' => $pair['episode_id'],
                    'episode_number' => $pair['episode_number'],
                    'name' => $pair['name'],
                    'language' => $pair['language'],
                    'cue_count' => count($converted['cues']),
                ];

                continue;
            }

            $needsReview[] = $this->reviewDraft(
                $pair,
                $download['content'],
                $converted['cues'],
                $converted['warnings'],
                $hashMatch,
                $converted['vtt'],
            );
        }

        return [
            'dry_run' => false,
            'missing' => count($pairs),
            'pairs' => $pairs,
            'quota' => [
                'remaining' => $remaining,
                'allowed' => $quota['allowed'] ?? null,
            ],
            'saved' => $saved,
            'needs_review' => $needsReview,
            'quota_exceeded' => $quotaExceeded,
        ];
    }

    /**
     * @param  array{episode_id: int, episode_number: mixed, name: mixed, language: string}  $pair
     * @param  array<int, array{start: int, end: int, text: string}>  $cues
     * @param  array<int, array{code: string, message: string}>  $warnings
     * @return array<string, mixed>
     */
    private function reviewDraft(array $pair, ?string $source, array $cues, array $warnings, bool $hashMatch, ?string $vtt = null): array
    {
        return [
            'episode_id' => $pair['episode_id'],
            'episode_number' => $pair['episode_number'],
            'name' => $pair['name'],
            'language' => $pair['language'],
            'language_name' => SubtitleLanguages::name($pair['language']),
            'source' => $source,
            'cues' => $cues,
            'warnings' => $warnings,
            'vtt' => $vtt,
            'hash_match' => $hashMatch,
        ];
    }
}
