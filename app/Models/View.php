<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class View extends Model
{
    use HasFactory;

    protected $fillable = [
        'user_id',
        'viewable_id',
        'viewable_type',
        'viewed_at',
    ];

    protected $casts = [
        'viewed_at' => 'datetime',
    ];

    /**
     * Get the user that owns the view.
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * Get the viewable model (Movie, Episode, etc.).
     */
    public function viewable(): MorphTo
    {
        return $this->morphTo();
    }
}

