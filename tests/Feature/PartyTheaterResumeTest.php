<?php

use App\Models\Movie;
use App\Models\PartyChatMessage;
use App\Models\PartyQueueItem;
use App\Models\PartyRoom;
use App\Models\PartyRoomMember;
use App\Models\User;

function createResumePartyHost(): User
{
    return User::factory()->create();
}

function createResumeOpenRoom(User $host, array $overrides = []): PartyRoom
{
    $room = PartyRoom::create(array_merge([
        'code' => PartyRoom::generateUniqueCode(),
        'name' => 'Test Theater',
        'host_user_id' => $host->id,
        'status' => 'open',
        'host_only_controls' => false,
        'allow_chat' => true,
        'allow_voice' => true,
        'max_members' => PartyRoom::ABSOLUTE_MAX_MEMBERS,
        'is_public' => false,
        'is_playing' => false,
        'position_seconds' => 0,
        'playback_updated_at' => now(),
    ], $overrides));

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $host->id,
        'role' => 'host',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    return $room;
}

test('last member leave pauses the room and keeps queue and chat for resume', function () {
    $host = createResumePartyHost();
    $room = createResumeOpenRoom($host, ['is_public' => true, 'name' => 'Resume me']);
    $movie = Movie::create([
        'slug' => 'pause-movie-'.uniqid(),
        'original_name' => 'Carry On',
        'title' => 'Carry On',
        'path' => '/fake/carry-on.mp4',
        'is_free' => true,
    ]);

    $item = PartyQueueItem::create([
        'party_room_id' => $room->id,
        'watchable_type' => Movie::class,
        'watchable_id' => $movie->id,
        'position' => 1,
        'added_by' => $host->id,
    ]);

    $room->update([
        'current_queue_item_id' => $item->id,
        'is_playing' => true,
        'position_seconds' => 42.5,
        'status' => 'playing',
    ]);

    PartyChatMessage::create([
        'party_room_id' => $room->id,
        'user_id' => $host->id,
        'body' => 'See you next time',
    ]);

    $this->actingAs($host)
        ->postJson(route('party.leave', ['code' => $room->code]))
        ->assertOk();

    $room->refresh();
    expect($room->status)->toBe('paused');
    expect($room->is_playing)->toBeFalse();
    expect($room->position_seconds)->toBe(42.5);
    expect($room->current_queue_item_id)->toBe($item->id);
    expect($room->host_user_id)->toBe($host->id);
    expect($room->members()->count())->toBe(0);
    expect(PartyQueueItem::where('party_room_id', $room->id)->count())->toBe(1);
    expect(PartyChatMessage::where('party_room_id', $room->id)->count())->toBe(1);
});

test('joining a paused room reopens it and preserves queue chat and position', function () {
    $host = createResumePartyHost();
    $room = createResumeOpenRoom($host, ['is_public' => true]);
    $guest = User::factory()->create();
    $movie = Movie::create([
        'slug' => 'resume-movie-'.uniqid(),
        'original_name' => 'Neon Drift',
        'title' => 'Neon Drift',
        'path' => '/fake/neon-drift.mp4',
        'is_free' => true,
    ]);

    $item = PartyQueueItem::create([
        'party_room_id' => $room->id,
        'watchable_type' => Movie::class,
        'watchable_id' => $movie->id,
        'position' => 1,
        'added_by' => $host->id,
    ]);

    $room->update([
        'current_queue_item_id' => $item->id,
        'position_seconds' => 88,
        'is_playing' => false,
    ]);

    PartyChatMessage::create([
        'party_room_id' => $room->id,
        'user_id' => $host->id,
        'body' => 'Saved message',
    ]);

    $this->actingAs($host)
        ->postJson(route('party.leave', ['code' => $room->code]))
        ->assertOk();

    expect($room->fresh()->status)->toBe('paused');

    $this->actingAs($guest)
        ->post(route('party.join'), ['code' => $room->code])
        ->assertRedirect(route('party.theater', ['code' => $room->code]));

    $room->refresh();
    expect($room->status)->toBe('open');
    expect($room->host_user_id)->toBe($host->id);
    expect($room->position_seconds)->toBe(88.0);
    expect($room->current_queue_item_id)->toBe($item->id);
    expect($room->members()->where('user_id', $guest->id)->exists())->toBeTrue();
    expect($room->members()->where('user_id', $guest->id)->value('role'))->toBe('member');
    expect(PartyChatMessage::where('party_room_id', $room->id)->pluck('body'))->toContain('Saved message');

    $this->actingAs($host)
        ->post(route('party.join'), ['code' => $room->code])
        ->assertRedirect(route('party.theater', ['code' => $room->code]));

    expect($room->fresh()->members()->where('user_id', $host->id)->value('role'))->toBe('host');
});

test('paused room appears in host myRooms but not public lobby and can be deleted', function () {
    $host = createResumePartyHost();
    $viewer = User::factory()->create();
    $room = createResumeOpenRoom($host, ['is_public' => true, 'name' => 'Paused public']);

    $this->actingAs($host)
        ->postJson(route('party.leave', ['code' => $room->code]))
        ->assertOk();

    expect($room->fresh()->status)->toBe('paused');

    $this->actingAs($host)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonPath('publicRooms', [])
        ->assertJsonFragment([
            'code' => $room->code,
            'name' => 'Paused public',
            'is_paused' => true,
            'is_host' => true,
        ]);

    $this->actingAs($viewer)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonPath('publicRooms', [])
        ->assertJsonPath('myRooms', []);

    $this->actingAs($host)
        ->deleteJson(route('party.destroy', ['code' => $room->code]))
        ->assertOk()
        ->assertJsonPath('success', true);

    expect(PartyRoom::find($room->id))->toBeNull();
});
