<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Season extends Model
{
    protected $guarded = [];

    public function tvshow()
    {
        return $this->belongsTo(Tvshow::class, 'tvshow_id');
    }

    public function episodes()
    {
        return $this->hasMany(Episode::class, 'season_id');
    }
    
}
