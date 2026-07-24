<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartyVoiceSignal extends Model
{
    protected $fillable = [
        'party_room_id',
        'from_user_id',
        'to_user_id',
        'type',
        'payload',
        'consumed',
    ];

    protected $casts = [
        'consumed' => 'boolean',
        'payload' => 'array',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(PartyRoom::class, 'party_room_id');
    }

    public function fromUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'from_user_id');
    }

    public function toUser(): BelongsTo
    {
        return $this->belongsTo(User::class, 'to_user_id');
    }
}
