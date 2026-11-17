<?php

namespace App\Services\Subtitles;

use App\Models\SubtitleDownloadLog;
use App\Models\User;

class SubtitleDownloadLogger
{
    /**
     * @param  array{type: string, id: int, title: string}  $target
     */
    public function log(
        ?User $user,
        array $target,
        string $language,
        int $fileId,
        ?string $fileName,
        bool $wasCached,
        ?int $remainingAfter,
    ): SubtitleDownloadLog {
        return SubtitleDownloadLog::query()->create([
            'user_id' => $user?->id,
            'target_type' => $target['type'],
            'target_id' => $target['id'],
            'title' => $target['title'],
            'language' => strtoupper($language),
            'file_id' => $fileId,
            'file_name' => $fileName,
            'was_cached' => $wasCached,
            'remaining_after' => $remainingAfter,
        ]);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, counted_today: int, cached_today: int}
     */
    public function recent(int $limit = 40): array
    {
        $todayStart = now()->utc()->startOfDay();

        $items = SubtitleDownloadLog::query()
            ->with('user:id,name')
            ->orderByDesc('id')
            ->limit($limit)
            ->get()
            ->map(fn (SubtitleDownloadLog $log) => $this->serialize($log))
            ->values()
            ->all();

        $today = SubtitleDownloadLog::query()
            ->where('created_at', '>=', $todayStart)
            ->get(['was_cached']);

        return [
            'items' => $items,
            'counted_today' => $today->where('was_cached', false)->count(),
            'cached_today' => $today->where('was_cached', true)->count(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function serialize(SubtitleDownloadLog $log): array
    {
        return [
            'id' => $log->id,
            'title' => $log->title,
            'target_type' => $log->target_type,
            'target_id' => $log->target_id,
            'language' => $log->language,
            'file_id' => $log->file_id,
            'file_name' => $log->file_name,
            'was_cached' => $log->was_cached,
            'remaining_after' => $log->remaining_after,
            'user_name' => $log->user?->name,
            'created_at' => $log->created_at?->toIso8601String(),
            'created_at_label' => $log->created_at?->timezone(config('app.timezone'))->format('M j, g:i A'),
        ];
    }
}
