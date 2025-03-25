<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

class Episode extends Model
{
    protected $guarded = [];

    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class, 'season_id');
    }

    public function tvshow(): HasOneThrough
    {
        return $this->hasOneThrough(Tvshow::class, Season::class, 'id', 'id', 'season_id', 'tvshow_id');
    }
}
