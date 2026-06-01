<?php

namespace App\Jobs;

use App\Services\MovieService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class ImportMovieJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public function __construct(
        public string $jobId,
        public string $folder,
        public string $disk = 'movies',
    ) {}

    public static function cacheKey(string $jobId): string
    {
        return 'movie_import_' . $jobId;
    }

    public function handle(): void
    {
        Cache::put(self::cacheKey($this->jobId), ['status' => 'importing'], 600);

        try {
            $movie = MovieService::importMovieFolder($this->folder, $this->disk);

            Cache::put(self::cacheKey($this->jobId), [
                'status' => 'completed',
                'movie_id' => $movie->id,
                'slug' => $movie->slug,
                'title' => $movie->title,
            ], 600);
        } catch (\Throwable $e) {
            Log::error('Movie import job failed', [
                'folder' => $this->folder,
                'error' => $e->getMessage(),
            ]);

            Cache::put(self::cacheKey($this->jobId), [
                'status' => 'failed',
                'error' => $e->getMessage(),
            ], 600);
        }
    }
}
