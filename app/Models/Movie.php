<?php

namespace App\Models;

use App\Traits\Commentable;
use App\Traits\Likeable;
use App\Traits\Playable;
use App\Traits\Viewable;
use App\Traits\Watchable;
use Illuminate\Database\Eloquent\Model;

class Movie extends Model
{
    use Likeable, Commentable, Watchable, Viewable, Playable;
    
    protected $guarded = [];



    /**
     * Get the route key for the model.
     *
     * @return string
     */
    public function getRouteKeyName()
    {
        return 'slug';
    }


}
