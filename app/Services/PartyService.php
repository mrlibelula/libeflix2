<?php

namespace App\Services;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\PartyChatMessage;
use App\Models\PartyQueueItem;
use App\Models\PartyRoom;
use App\Models\PartyRoomMember;
use App\Models\PartyVoiceSignal;
use App\Models\User;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class PartyService
{
    public function createRoom(User $user, array $data): PartyRoom
    {
        return DB::transaction(function () use ($user, $data) {
            $room = PartyRoom::create([
                'code' => PartyRoom::generateUniqueCode(),
                'name' => $data['name'] ?? ($user->name . "'s Theater"),
                'host_user_id' => $user->id,
                'status' => 'open',
                'host_only_controls' => (bool) ($data['host_only_controls'] ?? false),
                'allow_chat' => (bool) ($data['allow_chat'] ?? true),
                'allow_voice' => (bool) ($data['allow_voice'] ?? true),
                'max_members' => PartyRoom::clampMaxMembers((int) ($data['max_members'] ?? PartyRoom::ABSOLUTE_MAX_MEMBERS)),
                'is_public' => (bool) ($data['is_public'] ?? true),
                'is_playing' => false,
                'position_seconds' => 0,
                'playback_updated_at' => now(),
            ]);

            PartyRoomMember::create([
                'party_room_id' => $room->id,
                'user_id' => $user->id,
                'role' => 'host',
                'joined_at' => now(),
                'last_seen_at' => now(),
            ]);

            return $room->fresh(['host', 'members.user']);
        });
    }

    public function joinRoom(User $user, string $code): PartyRoom
    {
        $room = PartyRoom::where('code', Str::upper($code))->first();

        if (! $room || $room->isEnded()) {
            throw ValidationException::withMessages(['code' => 'Theater not found or has ended.']);
        }

        $this->pruneStaleMembers($room);
        $room->refresh();

        if ($room->isEnded()) {
            throw ValidationException::withMessages(['code' => 'Theater not found or has ended.']);
        }

        $existing = $room->members()->where('user_id', $user->id)->first();
        if ($existing) {
            $existing->update(['last_seen_at' => now()]);
            $this->reopenPausedRoom($room);

            return $room->fresh(['host', 'members.user']);
        }

        if ($room->isFull()) {
            throw ValidationException::withMessages([
                'code' => 'This theater is full (max '.$room->max_members.' people).',
            ]);
        }

        PartyRoomMember::create([
            'party_room_id' => $room->id,
            'user_id' => $user->id,
            'role' => $room->isHost($user) ? 'host' : 'member',
            'joined_at' => now(),
            'last_seen_at' => now(),
        ]);

        $this->reopenPausedRoom($room);

        return $room->fresh(['host', 'members.user']);
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listPublicRooms(?User $viewer = null): array
    {
        $rooms = PartyRoom::query()
            ->where('is_public', true)
            ->whereIn('status', ['open', 'playing'])
            ->with(['host:id,name', 'currentQueueItem.watchable'])
            ->latest()
            ->limit(20)
            ->get();

        $payload = [];
        foreach ($rooms as $room) {
            $this->pruneStaleMembers($room);
            $room->refresh();
            if ($room->isEnded() || $room->isPaused()) {
                continue;
            }
            $room->loadCount('members');
            if ((int) $room->members_count === 0) {
                continue;
            }
            $payload[] = $this->serializeLobbyRoom($room, $viewer);
        }

        return $payload;
    }

    /**
     * @return list<array<string, mixed>>
     */
    public function listMyRooms(User $user): array
    {
        $rooms = PartyRoom::query()
            ->where('status', '!=', 'ended')
            ->where(function ($q) use ($user) {
                $q->where('host_user_id', $user->id)
                    ->orWhereHas('members', fn ($m) => $m->where('user_id', $user->id));
            })
            ->with(['host:id,name', 'currentQueueItem.watchable'])
            ->latest()
            ->limit(10)
            ->get();

        $payload = [];
        foreach ($rooms as $room) {
            if (! $room->isPaused()) {
                $this->pruneStaleMembers($room);
                $room->refresh();
            }

            if ($room->isEnded()) {
                continue;
            }

            $isHost = (int) $room->host_user_id === (int) $user->id;
            $isMember = $room->members()->where('user_id', $user->id)->exists();

            // Paused rooms appear only for the host; live rooms for host or members.
            if ($room->isPaused()) {
                if (! $isHost) {
                    continue;
                }
            } elseif (! $isHost && ! $isMember) {
                continue;
            }

            $room->loadCount('members');
            $payload[] = $this->serializeLobbyRoom($room, $user);
        }

        return $payload;
    }

    /**
     * Remove members who stopped heartbeating (left without a clean leave).
     * Pauses the theater when nobody remains so queue/chat can be resumed later.
     */
    public function pruneStaleMembers(PartyRoom $room): void
    {
        if ($room->isEnded() || $room->isPaused()) {
            return;
        }

        $cutoff = now()->subSeconds(PartyRoom::STALE_SECONDS);

        $staleQuery = $room->members()->where(function ($q) use ($cutoff) {
            $q->whereNull('last_seen_at')
                ->orWhere('last_seen_at', '<', $cutoff);
        });

        if (! $staleQuery->exists()) {
            return;
        }

        DB::transaction(function () use ($room, $cutoff) {
            $room->refresh();
            if ($room->isEnded() || $room->isPaused()) {
                return;
            }

            $stale = $room->members()->where(function ($q) use ($cutoff) {
                $q->whereNull('last_seen_at')
                    ->orWhere('last_seen_at', '<', $cutoff);
            })->get();

            if ($stale->isEmpty()) {
                return;
            }

            $hostPruned = $stale->contains(
                fn (PartyRoomMember $member) => (int) $member->user_id === (int) $room->host_user_id
            );

            PartyRoomMember::query()
                ->whereIn('id', $stale->pluck('id'))
                ->delete();

            if ($hostPruned) {
                $next = $room->members()->orderBy('joined_at')->first();
                if ($next) {
                    $next->update(['role' => 'host']);
                    $room->update(['host_user_id' => $next->user_id]);
                } else {
                    $this->pauseEmptyRoom($room);
                }
            } elseif ($room->members()->count() === 0) {
                $this->pauseEmptyRoom($room);
            }
        });
    }

    /**
     * @return array<string, mixed>
     */
    private function serializeLobbyRoom(PartyRoom $room, ?User $viewer = null): array
    {
        $memberCount = (int) ($room->members_count ?? $room->members()->count());
        $isMember = $viewer
            ? $room->members()->where('user_id', $viewer->id)->exists()
            : false;

        return [
            'id' => $room->id,
            'code' => $room->code,
            'name' => $room->name,
            'host_name' => $room->host?->name,
            'host_user_id' => $room->host_user_id,
            'member_count' => $memberCount,
            'max_members' => $room->max_members,
            'is_public' => (bool) $room->is_public,
            'is_full' => $memberCount >= $room->max_members,
            'is_host' => $viewer ? $room->isHost($viewer) : false,
            'is_member' => $isMember,
            'is_paused' => $room->isPaused(),
            'status' => $room->status,
            'updated_at' => optional($room->updated_at)->toIso8601String(),
            'now_showing' => $this->serializeLobbyNowShowing($room),
        ];
    }

    /**
     * Lightweight title for lobby cards: current item, or first in queue.
     *
     * @return array{title: string, type: string, poster: string|null, state: string}|null
     */
    private function serializeLobbyNowShowing(PartyRoom $room): ?array
    {
        $item = $room->relationLoaded('currentQueueItem')
            ? $room->currentQueueItem
            : $room->currentQueueItem()->with('watchable')->first();

        $state = 'playing';

        if (! $item) {
            $item = $room->queueItems()->with('watchable')->orderBy('position')->first();
            if (! $item) {
                return null;
            }
            $state = 'up_next';
        } elseif (! $room->is_playing) {
            $state = 'up_next';
        }

        $watchable = $item->watchable;
        if (! $watchable) {
            return null;
        }

        $imgBase = rtrim((string) env('TMDB_IMAGE_BASE_URL_300', ''), '/');
        $type = $watchable instanceof Episode ? 'episode' : 'movie';
        $title = $watchable instanceof Movie
            ? (string) ($watchable->title ?: $watchable->original_name ?: 'Movie')
            : 'Episode';
        $poster = null;

        if ($watchable instanceof Movie) {
            $poster = $watchable->poster_path ? $imgBase.$watchable->poster_path : null;
        } elseif ($watchable instanceof Episode) {
            $watchable->loadMissing(['season.tvshow']);
            $tvshow = $watchable->season?->tvshow;
            $seasonNumber = $watchable->season?->season_number;
            $title = trim(
                ($tvshow?->name ? $tvshow->name.' — ' : '')
                .'S'.($seasonNumber ?? '?')
                .'E'.$watchable->episode_number
            );
            $poster = $watchable->stillUrl ?? null;
        }

        return [
            'title' => $title,
            'type' => $type,
            'poster' => $poster,
            'state' => $state,
        ];
    }

    public function leaveRoom(PartyRoom $room, User $user): void
    {
        $member = $room->members()->where('user_id', $user->id)->first();
        if (! $member) {
            return;
        }

        DB::transaction(function () use ($room, $user, $member) {
            $wasHost = $room->isHost($user);
            $member->delete();

            if ($wasHost) {
                $next = $room->members()->orderBy('joined_at')->first();
                if ($next) {
                    $next->update(['role' => 'host']);
                    $room->update(['host_user_id' => $next->user_id]);
                } else {
                    $this->pauseEmptyRoom($room);
                }
            } elseif ($room->members()->count() === 0) {
                $this->pauseEmptyRoom($room);
            }
        });
    }

    private function pauseEmptyRoom(PartyRoom $room): void
    {
        $room->update([
            'status' => 'paused',
            'is_playing' => false,
        ]);
    }

    private function reopenPausedRoom(PartyRoom $room): void
    {
        if ($room->isPaused()) {
            $room->update(['status' => 'open']);
        }
    }

    public function deleteRoom(PartyRoom $room, User $user): void
    {
        if (! $room->isHost($user)) {
            throw ValidationException::withMessages([
                'room' => 'Only the host can delete this theater.',
            ]);
        }

        DB::transaction(function () use ($room) {
            // Break circular FK before cascade-deleting queue items with the room
            $room->update([
                'current_queue_item_id' => null,
                'status' => 'ended',
            ]);
            $room->delete();
        });
    }

    public function updateSettings(PartyRoom $room, User $user, array $data): PartyRoom
    {
        if (! $room->isHost($user)) {
            throw ValidationException::withMessages(['settings' => 'Only the host can change theater settings.']);
        }

        $room->update([
            'name' => $data['name'] ?? $room->name,
            'host_only_controls' => array_key_exists('host_only_controls', $data)
                ? (bool) $data['host_only_controls']
                : $room->host_only_controls,
            'allow_chat' => array_key_exists('allow_chat', $data)
                ? (bool) $data['allow_chat']
                : $room->allow_chat,
            'allow_voice' => array_key_exists('allow_voice', $data)
                ? (bool) $data['allow_voice']
                : $room->allow_voice,
            'max_members' => array_key_exists('max_members', $data)
                ? PartyRoom::clampMaxMembers((int) $data['max_members'])
                : $room->max_members,
            'is_public' => array_key_exists('is_public', $data)
                ? (bool) $data['is_public']
                : $room->is_public,
        ]);

        return $room->fresh();
    }

    public function assertCanControl(PartyRoom $room, User $user): void
    {
        if ($room->isEnded()) {
            throw ValidationException::withMessages(['room' => 'This theater has ended.']);
        }

        if (! $room->members()->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['room' => 'You are not in this theater.']);
        }

        if (! $room->userCanControl($user)) {
            throw ValidationException::withMessages([
                'controls' => 'Only the host can control playback in this theater.',
            ]);
        }
    }

    public function addQueueItem(PartyRoom $room, User $user, string $type, int $id): PartyQueueItem
    {
        $this->assertCanControl($room, $user);

        $watchable = $this->resolveWatchable($type, $id);
        $position = ((int) $room->queueItems()->max('position')) + 1;

        $item = PartyQueueItem::create([
            'party_room_id' => $room->id,
            'watchable_type' => $watchable::class,
            'watchable_id' => $watchable->id,
            'position' => $position,
            'added_by' => $user->id,
        ]);

        if (! $room->current_queue_item_id) {
            $room->update([
                'current_queue_item_id' => $item->id,
                'is_playing' => false,
                'position_seconds' => 0,
                'playback_updated_at' => now(),
                'status' => 'playing',
            ]);
        }

        return $item->load('watchable', 'addedByUser');
    }

    public function removeQueueItem(PartyRoom $room, User $user, PartyQueueItem $item): void
    {
        $this->assertCanControl($room, $user);

        if ((int) $item->party_room_id !== (int) $room->id) {
            throw ValidationException::withMessages(['queue' => 'Invalid queue item.']);
        }

        DB::transaction(function () use ($room, $item) {
            $wasCurrent = (int) $room->current_queue_item_id === (int) $item->id;
            $item->delete();

            if ($wasCurrent) {
                $next = $room->queueItems()->orderBy('position')->first();
                $room->update([
                    'current_queue_item_id' => $next?->id,
                    'is_playing' => false,
                    'position_seconds' => 0,
                    'playback_updated_at' => now(),
                ]);
            }
        });
    }

    public function updatePlayback(PartyRoom $room, User $user, array $data): PartyRoom
    {
        $this->assertCanControl($room, $user);

        $updates = [
            'playback_updated_at' => now(),
        ];

        if (array_key_exists('is_playing', $data)) {
            $updates['is_playing'] = (bool) $data['is_playing'];
            if ($updates['is_playing']) {
                $updates['status'] = 'playing';
            }
        }

        if (array_key_exists('position_seconds', $data)) {
            $updates['position_seconds'] = max(0, (float) $data['position_seconds']);
        }

        if (! empty($data['queue_item_id'])) {
            $item = $room->queueItems()->where('id', $data['queue_item_id'])->first();
            if (! $item) {
                throw ValidationException::withMessages(['queue_item_id' => 'Queue item not found.']);
            }
            $updates['current_queue_item_id'] = $item->id;
            $updates['position_seconds'] = array_key_exists('position_seconds', $data)
                ? max(0, (float) $data['position_seconds'])
                : 0;
            $updates['is_playing'] = array_key_exists('is_playing', $data)
                ? (bool) $data['is_playing']
                : true;
            $item->update(['played_at' => now()]);
        }

        $room->update($updates);

        return $room->fresh();
    }

    public function postChat(PartyRoom $room, User $user, string $body): PartyChatMessage
    {
        if (! $room->allow_chat) {
            throw ValidationException::withMessages(['chat' => 'Chat is disabled in this theater.']);
        }

        if (! $room->members()->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['chat' => 'You are not in this theater.']);
        }

        return PartyChatMessage::create([
            'party_room_id' => $room->id,
            'user_id' => $user->id,
            'body' => trim($body),
        ])->load('user');
    }

    public function postVoiceSignal(PartyRoom $room, User $user, array $data): PartyVoiceSignal
    {
        if (! $room->allow_voice) {
            throw ValidationException::withMessages(['voice' => 'Voice is disabled in this theater.']);
        }

        if (! $room->members()->where('user_id', $user->id)->exists()) {
            throw ValidationException::withMessages(['voice' => 'You are not in this theater.']);
        }

        $toUserId = (int) $data['to_user_id'];
        if (! $room->members()->where('user_id', $toUserId)->exists()) {
            throw ValidationException::withMessages(['to_user_id' => 'Recipient is not in this theater.']);
        }

        return PartyVoiceSignal::create([
            'party_room_id' => $room->id,
            'from_user_id' => $user->id,
            'to_user_id' => $toUserId,
            'type' => $data['type'],
            'payload' => $data['payload'] ?? [],
            'consumed' => false,
        ]);
    }

    public function touchMember(PartyRoom $room, User $user): void
    {
        $room->members()->where('user_id', $user->id)->update(['last_seen_at' => now()]);
    }

    public function cleanupVoiceSignals(PartyRoom $room): void
    {
        $room->voiceSignals()
            ->where(function ($q) {
                $q->where('consumed', true)
                    ->orWhere('created_at', '<', now()->subSeconds(60));
            })
            ->delete();
    }

    public function buildSnapshot(PartyRoom $room, User $user, ?int $sinceChatId = null, ?int $sinceSignalId = null): array
    {
        // Heartbeat first so the active viewer is never pruned mid-request.
        $this->touchMember($room, $user);
        $this->pruneStaleMembers($room);
        $room->refresh();
        $this->cleanupVoiceSignals($room);

        $room->load([
            'host:id,name',
            'members.user:id,name',
            'queueItems.watchable',
            'queueItems.addedByUser:id,name',
            'currentQueueItem.watchable',
        ]);

        $chatQuery = $room->chatMessages()->with('user:id,name')->orderBy('id');
        if ($sinceChatId) {
            $chatQuery->where('id', '>', $sinceChatId);
        } else {
            $chatQuery->latest('id')->limit(50);
        }
        $chat = $chatQuery->get();
        if (! $sinceChatId) {
            $chat = $chat->sortBy('id')->values();
        }

        $signals = $room->voiceSignals()
            ->where('to_user_id', $user->id)
            ->where('consumed', false)
            ->when($sinceSignalId, fn ($q) => $q->where('id', '>', $sinceSignalId))
            ->orderBy('id')
            ->limit(50)
            ->get();

        if ($signals->isNotEmpty()) {
            PartyVoiceSignal::whereIn('id', $signals->pluck('id'))->update(['consumed' => true]);
        }

        $imgBase = rtrim((string) env('TMDB_IMAGE_BASE_URL_300', ''), '/');

        return [
            'server_time' => now()->toIso8601String(),
            'room' => [
                'id' => $room->id,
                'code' => $room->code,
                'name' => $room->name,
                'status' => $room->status,
                'host_user_id' => $room->host_user_id,
                'host_only_controls' => $room->host_only_controls,
                'allow_chat' => $room->allow_chat,
                'allow_voice' => $room->allow_voice,
                'max_members' => $room->max_members,
                'absolute_max_members' => PartyRoom::ABSOLUTE_MAX_MEMBERS,
                'is_public' => $room->is_public,
                'member_count' => $room->members->count(),
            ],
            // Return raw position — clients extrapolate while playing so polls don't force seek fights
            'playback' => [
                'current_queue_item_id' => $room->current_queue_item_id,
                'is_playing' => (bool) $room->is_playing,
                'position_seconds' => (float) $room->position_seconds,
                'playback_updated_at' => optional($room->playback_updated_at)->toIso8601String(),
            ],
            'current_item' => $room->currentQueueItem
                ? $this->serializeQueueItem($room->currentQueueItem, $imgBase, $user)
                : null,
            'queue' => $room->queueItems->map(fn ($item) => $this->serializeQueueItem($item, $imgBase, $user))->values(),
            'members' => $room->members->map(function (PartyRoomMember $member) {
                return [
                    'user_id' => $member->user_id,
                    'name' => $member->user?->name,
                    'role' => $member->role,
                    'is_host' => $member->role === 'host',
                    'online' => $member->isOnline(),
                    'last_seen_at' => optional($member->last_seen_at)->toIso8601String(),
                ];
            })->values(),
            'chat' => $chat->map(fn (PartyChatMessage $m) => [
                'id' => $m->id,
                'user_id' => $m->user_id,
                'user_name' => $m->user?->name,
                'body' => $m->body,
                'created_at' => optional($m->created_at)->toIso8601String(),
            ])->values(),
            'voice_signals' => $signals->map(fn (PartyVoiceSignal $s) => [
                'id' => $s->id,
                'from_user_id' => $s->from_user_id,
                'type' => $s->type,
                'payload' => $s->payload,
            ])->values(),
            'viewer' => [
                'user_id' => $user->id,
                'is_host' => $room->isHost($user),
                'can_control' => $room->userCanControl($user),
                'can_access_premium' => $user->canAccessPremiumContent(),
            ],
        ];
    }

    public function serializeQueueItem(PartyQueueItem $item, string $imgBase, ?User $user = null): array
    {
        $watchable = $item->watchable;
        $type = $watchable instanceof Episode ? 'episode' : 'movie';

        $title = $watchable instanceof Movie
            ? ($watchable->title ?? $watchable->original_name)
            : ($watchable->name ?? 'Episode');

        $poster = null;
        $encFilePath = null;
        $disk = null;
        $isFree = false;
        $meta = [];
        $media = null;

        if ($watchable instanceof Movie) {
            $poster = $watchable->poster_path ? $imgBase.$watchable->poster_path : null;
            $encFilePath = $watchable->path ? Tool::encode($watchable->path) : null;
            $disk = $watchable->disk ?: 'movies';
            $isFree = (bool) $watchable->is_free;
            $meta = [
                'slug' => $watchable->slug,
                'runtime' => $watchable->runtime,
            ];

            $subtitles = $watchable->subtitles;
            if (is_string($subtitles)) {
                $subtitles = json_decode($subtitles, true) ?: [];
            }
            if (! is_array($subtitles)) {
                $subtitles = [];
            }

            $media = [
                'kind' => 'movie',
                'encFilePath' => $encFilePath,
                'movie' => [
                    'id' => $watchable->id,
                    'title' => $watchable->title,
                    'original_name' => $watchable->original_name,
                    'slug' => $watchable->slug,
                    'poster_path' => $watchable->poster_path,
                    'is_free' => (bool) $watchable->is_free,
                    'subtitles' => $subtitles,
                    'path' => $watchable->path,
                    'disk' => $disk,
                ],
            ];
        } elseif ($watchable instanceof Episode) {
            $watchable->loadMissing(['season.tvshow.seasons']);
            $poster = $watchable->stillUrl ?? null;
            if (is_string($watchable->is_in_storage) && $watchable->is_in_storage !== '') {
                $encFilePath = Tool::encode($watchable->is_in_storage);
            }
            $disk = 'tvshows';
            $tvshow = $watchable->season?->tvshow;
            $isFree = (bool) $watchable->is_free || (bool) ($tvshow?->is_free);
            $seasonNumber = $watchable->season?->season_number;
            $meta = [
                'episode_number' => $watchable->episode_number,
                'season_number' => $seasonNumber,
                'tvshow_name' => $tvshow?->name,
                'tvshow_slug' => $tvshow?->slug,
            ];
            $title = trim(($tvshow?->name ? $tvshow->name.' — ' : '').'S'
                .($seasonNumber ?? '?')
                .'E'.$watchable->episode_number
                .' '.$watchable->name);

            $subtitles = $watchable->subtitles;
            if (! is_array($subtitles)) {
                $subtitles = [];
            }

            $encodedLanguageVideoFiles = [];
            $languageFiles = $watchable->language_video_files;
            if (is_array($languageFiles)) {
                foreach ($languageFiles as $langFile) {
                    $langCode = $langFile['language_code'] ?? $langFile['langCode'] ?? '';
                    $langName = $langFile['language_name'] ?? $langFile['langName'] ?? '';
                    $filePath = $langFile['file_path'] ?? '';
                    $langEnc = $langFile['encFilePath'] ?? '';
                    if ($langEnc === '' && $filePath !== '') {
                        $langEnc = Tool::encode($filePath);
                    }
                    $encodedLanguageVideoFiles[] = [
                        'language_code' => $langCode,
                        'language_name' => $langName,
                        'encFilePath' => $langEnc,
                    ];
                }
            }

            $episodePayload = $watchable->toArray();
            $episodePayload['encFilePath'] = $encFilePath;
            $episodePayload['season_number'] = $seasonNumber;
            $episodePayload['subtitles'] = $subtitles;
            $episodePayload['encodedLanguageVideoFiles'] = $encodedLanguageVideoFiles;
            $episodePayload['tvshow_is_free'] = (bool) ($tvshow?->is_free);
            $episodePayload['is_free'] = (bool) $watchable->is_free;

            $media = [
                'kind' => 'episode',
                'episode' => $episodePayload,
                'tvshowName' => $tvshow?->name ?? 'TV Show',
                'tvshowId' => $tvshow?->id,
                'tvshowSlug' => $tvshow?->slug,
                'totalSeasons' => $tvshow?->seasons?->count() ?? 1,
            ];
        }

        $canPlay = $isFree || ($user?->canAccessPremiumContent() ?? false);

        return [
            'id' => $item->id,
            'position' => $item->position,
            'type' => $type,
            'watchable_id' => $item->watchable_id,
            'title' => $title,
            'poster' => $poster,
            'enc_file_path' => $encFilePath,
            'disk' => $disk,
            'is_free' => $isFree,
            'can_play' => $canPlay,
            'meta' => $meta,
            'media' => $media,
            'added_by' => $item->addedByUser?->name,
            'added_by_id' => $item->added_by,
        ];
    }

    private function resolveWatchable(string $type, int $id): Movie|Episode
    {
        return match (strtolower($type)) {
            'movie' => Movie::findOrFail($id),
            'episode' => Episode::findOrFail($id),
            default => throw ValidationException::withMessages(['type' => 'Type must be movie or episode.']),
        };
    }
}
