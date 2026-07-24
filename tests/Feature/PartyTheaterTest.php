<?php

use App\Models\Movie;
use App\Models\PartyQueueItem;
use App\Models\PartyRoom;
use App\Models\PartyRoomMember;
use App\Models\User;

function createPartyHost(): User
{
    return User::factory()->create();
}

function createOpenRoom(User $host, array $overrides = []): PartyRoom
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

test('guests cannot open party lobby', function () {
    $this->get(route('party.index'))->assertRedirect(route('login'));
});

test('authenticated user can create and open a theater', function () {
    $user = createPartyHost();

    $this->actingAs($user)
        ->post(route('party.store'), [
            'name' => 'Friday Night',
            'max_members' => 6,
        ])
        ->assertRedirect();

    $room = PartyRoom::first();
    expect($room)->not->toBeNull();
    expect($room->name)->toBe('Friday Night');
    expect($room->max_members)->toBe(6);
    expect($room->is_public)->toBeTrue();
    expect($room->members()->count())->toBe(1);

    $this->actingAs($user)
        ->get(route('party.theater', ['code' => $room->code]))
        ->assertOk();
});

test('new theaters are public by default and appear in live lobby', function () {
    $host = createPartyHost();
    $viewer = User::factory()->create();

    $this->actingAs($host)
        ->post(route('party.store'), [
            'name' => 'Public Night',
        ])
        ->assertRedirect();

    $room = PartyRoom::first();
    expect($room->is_public)->toBeTrue();

    $this->actingAs($viewer)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonFragment([
            'code' => $room->code,
            'name' => 'Public Night',
            'is_public' => true,
        ]);
});

test('lobby shows now playing or about to play from the queue', function () {
    $host = createPartyHost();
    $viewer = User::factory()->create();
    $room = createOpenRoom($host, ['is_public' => true, 'name' => 'Friday night']);

    $movie = Movie::create([
        'slug' => 'lobby-movie-'.uniqid(),
        'original_name' => 'Neon Drift',
        'title' => 'Neon Drift',
        'path' => '/fake/neon-drift.mp4',
        'is_free' => true,
    ]);

    $this->actingAs($host)
        ->postJson(route('api.party.queue.add', ['code' => $room->code]), [
            'type' => 'movie',
            'id' => $movie->id,
        ])
        ->assertOk();

    $this->actingAs($viewer)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonFragment([
            'code' => $room->code,
            'now_showing' => [
                'title' => 'Neon Drift',
                'type' => 'movie',
                'poster' => null,
                'state' => 'up_next',
            ],
        ]);

    $itemId = $room->fresh()->current_queue_item_id;

    $this->actingAs($host)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'queue_item_id' => $itemId,
            'is_playing' => true,
            'position_seconds' => 12,
        ])
        ->assertOk();

    $this->actingAs($viewer)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonFragment([
            'code' => $room->code,
            'now_showing' => [
                'title' => 'Neon Drift',
                'type' => 'movie',
                'poster' => null,
                'state' => 'playing',
            ],
        ]);
});

test('host can delete their theater and non-host cannot', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, ['is_public' => true]);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $this->actingAs($member)
        ->deleteJson(route('party.destroy', ['code' => $room->code]))
        ->assertUnprocessable();

    expect(PartyRoom::find($room->id))->not->toBeNull();

    $this->actingAs($host)
        ->deleteJson(route('party.destroy', ['code' => $room->code]))
        ->assertOk()
        ->assertJsonPath('success', true);

    expect(PartyRoom::find($room->id))->toBeNull();

    $this->actingAs($member)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonMissing(['code' => $room->code]);
});

test('user can join by code and is rejected when theater is full', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, ['max_members' => 2]);

    $guest = User::factory()->create();
    $this->actingAs($guest)
        ->post(route('party.join'), ['code' => $room->code])
        ->assertRedirect(route('party.theater', ['code' => $room->code]));

    expect($room->fresh()->members()->count())->toBe(2);

    $third = User::factory()->create();
    $this->actingAs($third)
        ->post(route('party.join'), ['code' => $room->code])
        ->assertSessionHasErrors('code');
});

test('max members cannot exceed absolute hard cap of 8', function () {
    $user = createPartyHost();

    $this->actingAs($user)
        ->post(route('party.store'), [
            'name' => 'Big room attempt',
            'max_members' => 99,
        ])
        ->assertSessionHasErrors('max_members');

    $room = createOpenRoom($user, ['max_members' => 8]);

    $this->actingAs($user)
        ->patchJson(route('api.party.settings', ['code' => $room->code]), [
            'max_members' => 20,
        ])
        ->assertUnprocessable();
});

test('relaxed controls allow members to pause; host_only_controls blocks them', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, ['host_only_controls' => false]);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $this->actingAs($member)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'is_playing' => true,
            'position_seconds' => 12.5,
        ])
        ->assertOk();

    expect($room->fresh()->is_playing)->toBeTrue();
    expect($room->fresh()->position_seconds)->toBe(12.5);

    $this->actingAs($host)
        ->patchJson(route('api.party.settings', ['code' => $room->code]), [
            'host_only_controls' => true,
        ])
        ->assertOk();

    $this->actingAs($member)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'is_playing' => false,
            'position_seconds' => 20,
        ])
        ->assertUnprocessable();
});

test('only host can update settings', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $this->actingAs($member)
        ->patchJson(route('api.party.settings', ['code' => $room->code]), [
            'name' => 'Hacked',
        ])
        ->assertUnprocessable();
});

test('members can chat and sync snapshot returns messages', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host);

    $this->actingAs($host)
        ->postJson(route('api.party.chat', ['code' => $room->code]), [
            'body' => 'Hello theater',
        ])
        ->assertOk()
        ->assertJsonPath('message.body', 'Hello theater');

    $this->actingAs($host)
        ->getJson(route('api.party.sync', ['code' => $room->code]))
        ->assertOk()
        ->assertJsonPath('snapshot.room.code', $room->code);
});

test('queue add and playback set current item', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host);

    $movie = Movie::create([
        'slug' => 'party-movie-'.uniqid(),
        'original_name' => 'Party Movie',
        'title' => 'Party Movie',
        'path' => '/fake/party-movie.mp4',
        'is_free' => true,
    ]);

    $this->actingAs($host)
        ->postJson(route('api.party.queue.add', ['code' => $room->code]), [
            'type' => 'movie',
            'id' => $movie->id,
        ])
        ->assertOk();

    expect(PartyQueueItem::count())->toBe(1);
    expect($room->fresh()->current_queue_item_id)->not->toBeNull();

    $itemId = $room->fresh()->current_queue_item_id;

    $this->actingAs($host)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'queue_item_id' => $itemId,
            'is_playing' => true,
            'position_seconds' => 0,
        ])
        ->assertOk();

    expect($room->fresh()->is_playing)->toBeTrue();
});

test('ended room cannot be synced', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, ['status' => 'ended']);

    $this->actingAs($host)
        ->getJson(route('api.party.sync', ['code' => $room->code]))
        ->assertStatus(410);
});

test('voice signal can be posted for a fellow member', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $this->actingAs($host)
        ->postJson(route('api.party.voice', ['code' => $room->code]), [
            'to_user_id' => $member->id,
            'type' => 'offer',
            'payload' => ['sdp' => 'v=0', 'type' => 'offer'],
        ])
        ->assertOk();
});

test('member leave removes them from the room and leave is idempotent for missing rooms', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $this->actingAs($member)
        ->postJson(route('party.leave', ['code' => $room->code]))
        ->assertOk()
        ->assertJsonPath('success', true);

    expect(
        PartyRoomMember::query()
            ->where('party_room_id', $room->id)
            ->where('user_id', $member->id)
            ->exists()
    )->toBeFalse();

    $this->actingAs($member)
        ->postJson(route('party.leave', ['code' => 'ZZZZZZ']))
        ->assertOk()
        ->assertJsonPath('success', true);
});

test('stale members are pruned from the lobby so empty theaters are not marked full', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, [
        'max_members' => 2,
        'is_public' => true,
        'name' => 'Friday night',
    ]);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now()->subMinutes(5),
        'last_seen_at' => now()->subMinutes(5),
    ]);

    // Host also went idle (left theater without a clean leave).
    PartyRoomMember::query()
        ->where('party_room_id', $room->id)
        ->where('user_id', $host->id)
        ->update(['last_seen_at' => now()->subMinutes(5)]);

    $this->actingAs($host)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonPath('publicRooms', [])
        ->assertJsonFragment([
            'code' => $room->code,
            'status' => 'paused',
            'is_paused' => true,
            'is_host' => true,
            'member_count' => 0,
        ]);

    expect($room->fresh()->status)->toBe('paused');
    expect($room->fresh()->is_playing)->toBeFalse();
    expect($room->members()->count())->toBe(0);
});

test('stale seats free up so a new guest can join a previously full theater', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, ['max_members' => 2, 'is_public' => true]);
    $ghost = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $ghost->id,
        'role' => 'member',
        'joined_at' => now()->subMinutes(5),
        'last_seen_at' => now()->subMinutes(5),
    ]);

    // Host is still actively heartbeating.
    PartyRoomMember::query()
        ->where('party_room_id', $room->id)
        ->where('user_id', $host->id)
        ->update(['last_seen_at' => now()]);

    expect($room->fresh()->members()->count())->toBe(2);

    $guest = User::factory()->create();
    $this->actingAs($guest)
        ->post(route('party.join'), ['code' => $room->code])
        ->assertRedirect(route('party.theater', ['code' => $room->code]));

    $memberIds = $room->fresh()->members()->pluck('user_id')->all();
    expect($memberIds)->toContain($host->id);
    expect($memberIds)->toContain($guest->id);
    expect($memberIds)->not->toContain($ghost->id);
});

test('lobby marks the viewer as a member so full rooms stay enterable for them', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, ['max_members' => 2, 'is_public' => true]);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $this->actingAs($member)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonFragment([
            'code' => $room->code,
            'is_full' => true,
            'is_member' => true,
            'member_count' => 2,
        ]);
});