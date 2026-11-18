<?php

namespace App\Console\Commands;

use App\Models\Episode;
use App\Models\Movie;
use App\Services\Subtitles\SubtitleConverter;
use App\Services\Subtitles\SubtitleTargetResolver;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Throwable;

class EnsureSubtitleBrandingCommand extends Command
{
    protected $signature = 'subtitles:ensure-branding
                            {--movie= : Only scan this movie id}
                            {--episode= : Only scan this episode id}';

    protected $description = 'Preview VTT files missing Libeflix branding, then confirm before rewriting them';

    public function handle(SubtitleTargetResolver $resolver, SubtitleConverter $converter): int
    {
        $movieId = $this->option('movie');
        $episodeId = $this->option('episode');

        if ($movieId !== null && $episodeId !== null) {
            $this->error('Use either --movie or --episode, not both.');

            return self::FAILURE;
        }

        $this->info('Scanning for VTT files missing Libeflix branding…');

        $pending = [];
        $alreadyBranded = 0;
        $errors = 0;

        foreach ($this->targets($resolver, $movieId, $episodeId) as $target) {
            foreach ($resolver->existingTracks($target) as $track) {
                try {
                    $raw = Storage::disk($target['disk'])->get($track['path']);
                    if (! is_string($raw)) {
                        $errors++;
                        $this->warn("Could not read {$track['path']}");

                        continue;
                    }

                    if ($converter->hasBranding($raw)) {
                        $alreadyBranded++;

                        continue;
                    }

                    $pending[] = [
                        'target' => $target,
                        'track' => $track,
                        'raw' => $raw,
                    ];
                } catch (Throwable $e) {
                    $errors++;
                    $this->warn("Error on {$track['path']}: {$e->getMessage()}");
                }
            }
        }

        $this->newLine();
        $this->line("Already branded: <info>{$alreadyBranded}</info>");
        $this->line('Missing branding: <comment>'.count($pending).'</comment>');
        if ($errors > 0) {
            $this->line("Read errors: <error>{$errors}</error>");
        }

        if ($pending === []) {
            $this->info('Nothing to update.');

            return self::SUCCESS;
        }

        $this->newLine();
        $this->table(
            ['Type', 'Id', 'Title', 'Lang', 'Path', 'Cues'],
            array_map(fn (array $row) => [
                $row['target']['type'],
                $row['target']['id'],
                $row['target']['title'],
                $row['track']['language'],
                $row['track']['path'],
                $row['track']['cue_count'],
            ], $pending)
        );

        $this->newLine();
        $this->comment('Preview — first cues of each file (branding cue will be prepended on confirm):');
        $this->newLine();

        foreach ($pending as $index => $row) {
            $n = $index + 1;
            $this->line("<fg=cyan>[{$n}/".count($pending).'] '.$row['target']['type'].'#'.$row['target']['id'].' '.$row['track']['language'].' — '.$row['track']['path'].'</>');
            $this->line($this->previewSnippet($row['raw']));
            $this->newLine();
        }

        $this->line('Branding cue to prepend:');
        $this->line('  00:00:01.250 --> 00:00:10.500');
        $this->line('  '.SubtitleConverter::BRANDING_TEXT);
        $this->newLine();

        if (! $this->confirm('Rewrite '.count($pending).' VTT file(s) with Libeflix branding?', false)) {
            $this->warn('Aborted. No files were changed.');

            return self::SUCCESS;
        }

        $updated = 0;
        $writeErrors = 0;
        $refreshed = [];

        foreach ($pending as $row) {
            $path = $row['track']['path'];
            $disk = $row['target']['disk'];

            try {
                $converted = $converter->convert($row['raw']);
                Storage::disk($disk)->put($path, $converted['vtt']);
                $updated++;
                $key = $row['target']['type'].':'.$row['target']['id'];
                $refreshed[$key] = $row['target'];
                $this->line("Updated <info>{$path}</info>");
            } catch (Throwable $e) {
                $writeErrors++;
                $this->error("Failed {$path}: {$e->getMessage()}");
            }
        }

        foreach ($refreshed as $target) {
            try {
                $resolver->refresh($target);
            } catch (Throwable $e) {
                $this->warn("Metadata refresh failed for {$target['type']}#{$target['id']}: {$e->getMessage()}");
            }
        }

        $this->newLine();
        $this->info("Done. Updated {$updated} file(s)".($writeErrors > 0 ? ", {$writeErrors} write error(s)" : '').'.');

        return $writeErrors > 0 ? self::FAILURE : self::SUCCESS;
    }

    /**
     * @return iterable<int, array{type: string, id: int, model: Movie|Episode, disk: string, video_path: string, title: string, subtitle: ?string}>
     */
    private function targets(SubtitleTargetResolver $resolver, mixed $movieId, mixed $episodeId): iterable
    {
        if ($movieId !== null && $movieId !== '') {
            yield $resolver->resolve('movie', (int) $movieId);

            return;
        }

        if ($episodeId !== null && $episodeId !== '') {
            yield $resolver->resolve('episode', (int) $episodeId);

            return;
        }

        $movies = Movie::query()
            ->whereNotNull('path')
            ->where('path', '!=', '')
            ->orderBy('id')
            ->cursor();

        foreach ($movies as $movie) {
            try {
                yield $resolver->resolve('movie', (int) $movie->id);
            } catch (Throwable $e) {
                $this->warn("Skipping movie #{$movie->id}: {$e->getMessage()}");
            }
        }

        $episodes = Episode::query()
            ->whereNotNull('is_in_storage')
            ->where('is_in_storage', '!=', '')
            ->orderBy('id')
            ->cursor();

        foreach ($episodes as $episode) {
            try {
                yield $resolver->resolve('episode', (int) $episode->id);
            } catch (Throwable $e) {
                $this->warn("Skipping episode #{$episode->id}: {$e->getMessage()}");
            }
        }
    }

    private function previewSnippet(string $raw): string
    {
        $normalized = str_replace(["\r\n", "\r"], "\n", $raw);
        $lines = explode("\n", $normalized);
        $slice = array_slice($lines, 0, 12);
        $body = implode("\n", $slice);
        if (count($lines) > 12) {
            $body .= "\n…";
        }

        return $body;
    }
}
