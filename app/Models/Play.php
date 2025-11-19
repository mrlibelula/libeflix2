<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class Play extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'playable_id',
        'playable_type',
        'watch_duration',
        'media_duration',
        'completion_percentage',
    ];

    protected $casts = [
        'completion_percentage' => 'float',
        'watch_duration' => 'integer',
        'media_duration' => 'integer',
    ];

    /**
     * Get the user that recorded the play.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the playable model (Movie or Episode).
     */
    public function playable(): MorphTo
    {
        return $this->morphTo();
    }
}

