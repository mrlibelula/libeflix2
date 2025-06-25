<?php

namespace App\Models;

use App\Traits\Likeable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Season extends Model
{
    use Likeable;
    
    protected $guarded = [];

    public function tvshow(): BelongsTo
    {
        return $this->belongsTo(Tvshow::class, 'tvshow_id');
    }

    public function episodes(): HasMany
    {
        return $this->hasMany(Episode::class, 'season_id');
    }

    public function getPosterUrlAttribute(): string
    {
        return env('TMDB_IMAGE_BASE_URL_780') . $this->poster_path;
    }

    public function getBackdropUrlAttribute(): string
    {
        return env('TMDB_IMAGE_BASE_URL_1280') . $this->backdrop_path;
    }


}
