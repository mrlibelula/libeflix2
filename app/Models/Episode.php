<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

class Episode extends Model
{
    protected $guarded = [];
    protected $appends = ['stillUrl'];
    protected $casts = [
        'credits' => 'array',
    ];

    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class, 'season_id');
    }

    public function tvshow(): HasOneThrough
    {
        return $this->hasOneThrough(Tvshow::class, Season::class, 'id', 'id', 'season_id', 'tvshow_id');
    }

    public function getStillUrlAttribute(): string
    {
        if (!$this->still_path) {
            return env('DEFAULT_EPISODE_STILL_IMAGE_URL');
        }

        return env('TMDB_IMAGE_BASE_URL_300') . $this->still_path;
    }
}
