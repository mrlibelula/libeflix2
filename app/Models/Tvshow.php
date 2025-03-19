<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Tvshow extends Model
{
    protected $guarded = [];

    public function getPosterUrlAttribute()
    {
        return 'https://image.tmdb.org/t/p/w780/' . $this->poster_path;
    }

    public function getBackdropUrlAttribute()
    {
        return 'https://image.tmdb.org/t/p/w780/' . $this->backdrop_path;
    }
    
}
