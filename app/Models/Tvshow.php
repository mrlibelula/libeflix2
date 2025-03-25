<?php

namespace App\Models;

use App\Services\TvshowService;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasManyThrough;

class Tvshow extends Model
{
    protected $guarded = [];
    protected $appends = ['logo'];

    public function seasons(): HasMany
    {
        return $this->hasMany(Season::class, 'tvshow_id');
    }

    public function episodes(): HasManyThrough
    {
        return $this->hasManyThrough(Episode::class, Season::class, 'tvshow_id', 'season_id');
    }

    public function getPosterUrlAttribute()
    {
        return env('TMDB_IMAGE_BASE_URL_780') . $this->poster_path;
    }

    public function getBackdropUrlAttribute()
    {
        return env('TMDB_IMAGE_BASE_URL_780') . $this->backdrop_path;
    }

    public function getLogoAttribute(): array|null
    {
        $logos = TvshowService::getTvshowImages($this, 'logos');
        if (count($logos)) {
            $logo = $logos[$this->selected_logo] ?? $logos[0];
            return [
                'url' => env('TMDB_IMAGE_BASE_URL_780') . $logo['file_path'],
                'width' => $logo['width'],
                'height' => $logo['height'],
                'aspect_ratio' => $logo['aspect_ratio'],
            ];
        }
        return null;
    }
}
