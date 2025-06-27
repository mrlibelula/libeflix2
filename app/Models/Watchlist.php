<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Watchlist extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'watchable_id',
        'watchable_type',
    ];

    /**
     * Get the user that owns the watchlist entry.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the watchable model (Movie, Tvshow, Season, Episode).
     */
    public function watchable(): MorphTo
    {
        return $this->morphTo();
    }
} 