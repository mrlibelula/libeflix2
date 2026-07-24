<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Support\Str;

class PartyRoom extends Model
{
    /** Hard cap for WebRTC mesh + shared-hosting MVP */
    public const ABSOLUTE_MAX_MEMBERS = 8;

    /** UI "online" presence window (sync heartbeats ~1.2s). */
    public const ONLINE_SECONDS = 15;

    /**
     * Drop membership after this long without a heartbeat.
     * Longer than ONLINE so brief lag does not kick people; short enough that
     * lobby seats free up when everyone has left the theater page.
     */
    public const STALE_SECONDS = 45;

    protected $fillable = [
        'code',
        'name',
        'host_user_id',
        'status',
        'host_only_controls',
        'allow_chat',
        'allow_voice',
        'max_members',
        'is_public',
        'current_queue_item_id',
        'is_playing',
        'position_seconds',
        'playback_updated_at',
    ];

    protected $casts = [
        'host_only_controls' => 'boolean',
        'allow_chat' => 'boolean',
        'allow_voice' => 'boolean',
        'is_public' => 'boolean',
        'is_playing' => 'boolean',
        'position_seconds' => 'float',
        'playback_updated_at' => 'datetime',
        'max_members' => 'integer',
    ];

    public static function generateUniqueCode(): string
    {
        do {
            $code = Str::upper(Str::random(6));
        } while (static::where('code', $code)->exists());

        return $code;
    }

    public static function clampMaxMembers(int $value): int
    {
        return max(2, min(self::ABSOLUTE_MAX_MEMBERS, $value));
    }

    public function host(): BelongsTo
    {
        return $this->belongsTo(User::class, 'host_user_id');
    }

    public function members(): HasMany
    {
        return $this->hasMany(PartyRoomMember::class);
    }

    public function queueItems(): HasMany
    {
        return $this->hasMany(PartyQueueItem::class)->orderBy('position');
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(PartyChatMessage::class);
    }

    public function voiceSignals(): HasMany
    {
        return $this->hasMany(PartyVoiceSignal::class);
    }

    public function currentQueueItem(): BelongsTo
    {
        return $this->belongsTo(PartyQueueItem::class, 'current_queue_item_id');
    }

    public function isEnded(): bool
    {
        return $this->status === 'ended';
    }

    public function isPaused(): bool
    {
        return $this->status === 'paused';
    }

    public function isHost(User $user): bool
    {
        return (int) $this->host_user_id === (int) $user->id;
    }

    public function userCanControl(User $user): bool
    {
        if ($this->isHost($user)) {
            return true;
        }

        return ! $this->host_only_controls;
    }

    public function memberCount(): int
    {
        return $this->members()->count();
    }

    public function isFull(): bool
    {
        return $this->memberCount() >= $this->max_members;
    }

    public function estimatedPositionSeconds(?\DateTimeInterface $now = null): float
    {
        $base = (float) $this->position_seconds;

        if (! $this->is_playing || ! $this->playback_updated_at) {
            return $base;
        }

        $nowTs = ($now ?? now())->getTimestamp() + (float) (($now ?? now())->format('u') / 1_000_000);
        $updatedTs = $this->playback_updated_at->getTimestamp()
            + (float) ($this->playback_updated_at->format('u') / 1_000_000);

        return max(0, $base + ($nowTs - $updatedTs));
    }
}
