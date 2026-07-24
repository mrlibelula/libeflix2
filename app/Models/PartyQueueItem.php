<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\MorphTo;

class PartyQueueItem extends Model
{
    protected $fillable = [
        'party_room_id',
        'watchable_id',
        'watchable_type',
        'position',
        'added_by',
        'played_at',
    ];

    protected $casts = [
        'played_at' => 'datetime',
        'position' => 'integer',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(PartyRoom::class, 'party_room_id');
    }

    public function watchable(): MorphTo
    {
        return $this->morphTo();
    }

    public function addedByUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'added_by');
    }
}
