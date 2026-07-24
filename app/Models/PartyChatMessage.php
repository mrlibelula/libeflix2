<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartyChatMessage extends Model
{
    protected $fillable = [
        'party_room_id',
        'user_id',
        'body',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(PartyRoom::class, 'party_room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
