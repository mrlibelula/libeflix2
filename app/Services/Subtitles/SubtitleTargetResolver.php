<?php

namespace App\Services\Subtitles;

use App\Models\Episode;
use App\Models\Movie;
use App\Services\EpisodeService;
use App\Services\MovieService;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class SubtitleTargetResolver
{
    /**
     * @return array{type: string, id: int, model: Movie|Episode, disk: string, video_path: string, title: string, subtitle: ?string}
     */
    public function resolve(string $type, int $id): array
    {
        if ($type === 'movie') {
            $movie = Movie::query()->find($id);
            if (! $movie) {
                throw new RuntimeException('Movie not found.');
            }

            $path = (string) $movie->path;
            if ($path === '' || ! Storage::disk($movie->disk ?: 'movies')->exists($path)) {
                throw new RuntimeException('This movie has no video file on disk.');
            }

            return [
                'type' => 'movie',
                'id' => (int) $movie->id,
                'model' => $movie,
                'disk' => $movie->disk ?: 'movies',
                'video_path' => $path,
                'title' => (string) $movie->title,
                'subtitle' => $movie->release_date ? (string) $movie->release_date : null,
            ];
        }

        if ($type !== 'episode') {
            throw new RuntimeException('Unknown subtitle target.');
        }

        $episode = Episode::query()->with('season.tvshow')->find($id);
        if (! $episode) {
            throw new RuntimeException('Episode not found.');
        }

        $path = (string) $episode->is_in_storage;
        if ($path === '' || ! Storage::disk('tvshows')->exists($path)) {
            throw new RuntimeException('This episode has no video file on disk.');
        }

        $show = $episode->season?->tvshow;
        $label = trim(($show?->name ? $show->name.' · ' : '').'S'.str_pad((string) ($episode->season_number ?? $episode->season?->season_number ?? 0), 2, '0', STR_PAD_LEFT).'E'.str_pad((string) $episode->episode_number, 2, '0', STR_PAD_LEFT));

        return [
            'type' => 'episode',
            'id' => (int) $episode->id,
            'model' => $episode,
            'disk' => 'tvshows',
            'video_path' => $path,
            'title' => $episode->name ? $label.' · '.$episode->name : $label,
            'subtitle' => $show?->name,
        ];
    }

    public function vttRelativePath(string $videoPath, string $language): string
    {
        $language = strtoupper($language);
        $directory = dirname($videoPath);
        $basename = pathinfo($videoPath, PATHINFO_FILENAME);
        $filename = $basename.'_'.$language.'.vtt';

        if ($directory === '.' || $directory === '' || $directory === DIRECTORY_SEPARATOR) {
            return $filename;
        }

        return str_replace('\\', '/', $directory).'/'.$filename;
    }

    /**
     * @param  array{disk: string, video_path: string}  $target
     * @return array<int, array{language: string, language_name: string, file_name: string, path: string, cue_count: int}>
     */
    public function existingTracks(array $target): array
    {
        $storage = Storage::disk($target['disk']);
        $directory = dirname($target['video_path']);
        $searchPath = ($directory === '.' || $directory === '') ? '' : $directory;
        $basename = pathinfo($target['video_path'], PATHINFO_FILENAME);
        $converter = new SubtitleConverter;
        $tracks = [];

        foreach ($storage->files($searchPath) as $file) {
            $name = basename($file);
            if (! preg_match('/^'.preg_quote($basename, '/').'_([A-Z]{2})\.vtt$/i', $name, $matches)) {
                continue;
            }

            $language = strtoupper($matches[1]);
            $cueCount = 0;
            try {
                $parsed = $converter->parse($storage->get($file));
                $cueCount = count($parsed['cues']);
            } catch (\Throwable) {
                $cueCount = 0;
            }

            $tracks[] = [
                'language' => $language,
                'language_name' => SubtitleLanguages::name($language),
                'file_name' => $name,
                'path' => $file,
                'cue_count' => $cueCount,
            ];
        }

        usort($tracks, fn (array $a, array $b) => $a['language'] <=> $b['language']);

        return $tracks;
    }

    /**
     * @param  array{type: string, model: Movie|Episode, disk: string, video_path: string}  $target
     */
    public function refresh(array $target): void
    {
        if ($target['type'] === 'movie' && $target['model'] instanceof Movie) {
            $target['model']->subtitles = MovieService::getMovieSubtitles($target['model']);
            $target['model']->save();

            return;
        }

        if ($target['model'] instanceof Episode) {
            $storage = Storage::disk($target['disk']);
            $directory = dirname($target['video_path']);
            $searchPath = ($directory === '.' || $directory === '') ? '' : $directory;
            $subtitles = EpisodeService::findSubtitleFiles($storage, $searchPath, $target['video_path']);
            // Pass an array: Episode casts subtitles as array, so json_encode() here
            // would double-encode and the library list would read languages as [].
            $target['model']->update([
                'subtitles' => $subtitles === [] ? null : $subtitles,
            ]);
        }
    }

    /**
     * @return array<int, string>
     */
    public function languageCodesFromMovie(Movie $movie): array
    {
        $raw = $movie->subtitles;
        if (is_string($raw)) {
            $raw = json_decode($raw, true);
        }
        if (! is_array($raw)) {
            return [];
        }

        $codes = [];
        foreach ($raw as $row) {
            if (! is_array($row)) {
                continue;
            }
            $code = strtoupper((string) ($row['languageCode'] ?? $row['language_code'] ?? ''));
            if ($code !== '') {
                $codes[] = $code;
            }
        }

        return array_values(array_unique($codes));
    }
}
