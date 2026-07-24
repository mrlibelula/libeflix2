<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PartyRoomMember extends Model
{
    protected $fillable = [
        'party_room_id',
        'user_id',
        'role',
        'joined_at',
        'last_seen_at',
    ];

    protected $casts = [
        'joined_at' => 'datetime',
        'last_seen_at' => 'datetime',
    ];

    public function room(): BelongsTo
    {
        return $this->belongsTo(PartyRoom::class, 'party_room_id');
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isOnline(): bool
    {
        if (! $this->last_seen_at) {
            return false;
        }

        return $this->last_seen_at->gte(now()->subSeconds(PartyRoom::ONLINE_SECONDS));
    }
}
