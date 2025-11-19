<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class WatchProgress extends Model
{
    use HasFactory;

    protected $table = 'watch_progress';

    protected $fillable = [
        'user_id',
        'watchable_id',
        'watchable_type',
        'current_time',
        'duration',
        'progress_percentage',
        'completed',
        'last_watched_at',
    ];

    protected $casts = [
        'current_time' => 'integer',
        'duration' => 'integer',
        'progress_percentage' => 'decimal:2',
        'completed' => 'boolean',
        'last_watched_at' => 'datetime',
    ];

    /**
     * Get the user that owns the watch progress.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the watchable model (Movie, Episode, etc.).
     */
    public function watchable(): MorphTo
    {
        return $this->morphTo();
    }

    /**
     * Calculate and update the progress percentage.
     */
    public function updateProgress(int $currentTime, ?int $duration = null): void
    {
        $this->current_time = $currentTime;
        
        if ($duration !== null) {
            $this->duration = $duration;
        }

        if ($this->duration > 0) {
            $this->progress_percentage = min(100, ($currentTime / $this->duration) * 100);
        }

        $this->last_watched_at = now();
        $this->save();
    }

    /**
     * Mark as completed.
     */
    public function markCompleted(): void
    {
        $this->completed = true;
        $this->progress_percentage = 100;
        $this->save();
    }
}

