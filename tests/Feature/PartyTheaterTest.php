<?php

use App\Models\Episode;
use App\Models\Movie;
use App\Models\PartyQueueItem;
use App\Models\PartyRoom;
use App\Models\PartyRoomMember;
use App\Models\Season;
use App\Models\Tvshow;
use App\Models\User;
use App\Models\WatchProgress;
use App\Services\HistoryService;

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
        ->assertOk()
        ->assertJsonPath('activity.type', 'queue_add')
        ->assertJsonPath('activity.by', $host->id)
        ->assertJsonPath('activity.meta.title', 'Party Movie');

    expect(PartyQueueItem::count())->toBe(1);
    expect($room->fresh()->current_queue_item_id)->not->toBeNull();
    expect($room->fresh()->activity_type)->toBe('queue_add');

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

test('queue remove and settings activity sync to peers', function () {
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

    $movieA = Movie::create([
        'slug' => 'party-a-'.uniqid(),
        'original_name' => 'Alpha',
        'title' => 'Alpha',
        'path' => '/fake/alpha.mp4',
        'is_free' => true,
    ]);
    $movieB = Movie::create([
        'slug' => 'party-b-'.uniqid(),
        'original_name' => 'Beta',
        'title' => 'Beta',
        'path' => '/fake/beta.mp4',
        'is_free' => true,
    ]);

    $this->actingAs($host)
        ->postJson(route('api.party.queue.add', ['code' => $room->code]), [
            'type' => 'movie',
            'id' => $movieA->id,
        ])
        ->assertOk();

    $this->actingAs($member)
        ->postJson(route('api.party.queue.add', ['code' => $room->code]), [
            'type' => 'movie',
            'id' => $movieB->id,
        ])
        ->assertOk()
        ->assertJsonPath('activity.type', 'queue_add')
        ->assertJsonPath('activity.by', $member->id);

    $alphaId = PartyQueueItem::where('watchable_id', $movieA->id)->value('id');
    $betaId = PartyQueueItem::where('watchable_id', $movieB->id)->value('id');

    $this->actingAs($host)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'queue_item_id' => $betaId,
            'is_playing' => true,
            'position_seconds' => 0,
        ])
        ->assertOk()
        ->assertJsonPath('activity.type', 'now_playing')
        ->assertJsonPath('activity.meta.title', 'Beta');

    $this->actingAs($member)
        ->getJson(route('api.party.sync', ['code' => $room->code]))
        ->assertOk()
        ->assertJsonPath('snapshot.activity.type', 'now_playing')
        ->assertJsonPath('snapshot.activity.by', $host->id);

    $this->actingAs($host)
        ->deleteJson(route('api.party.queue.remove', ['code' => $room->code, 'item' => $alphaId]))
        ->assertOk()
        ->assertJsonPath('activity.type', 'queue_remove')
        ->assertJsonPath('activity.meta.title', 'Alpha');

    $this->actingAs($host)
        ->patchJson(route('api.party.settings', ['code' => $room->code]), [
            'allow_chat' => false,
            'host_only_controls' => true,
        ])
        ->assertOk()
        ->assertJsonPath('activity.type', 'settings')
        ->assertJsonPath('activity.by', $host->id);

    $this->actingAs($member)
        ->getJson(route('api.party.sync', ['code' => $room->code]))
        ->assertOk()
        ->assertJsonPath('snapshot.activity.type', 'settings');
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

test('lobby myRooms exposes host_only_controls and can_control for the viewer', function () {
    $host = createPartyHost();
    $member = User::factory()->create();

    $openRoom = createOpenRoom($host, [
        'name' => 'Open Controls',
        'host_only_controls' => false,
        'is_public' => false,
    ]);
    $hostOnlyRoom = createOpenRoom($host, [
        'name' => 'Host Only',
        'host_only_controls' => true,
        'is_public' => false,
    ]);

    foreach ([$openRoom, $hostOnlyRoom] as $room) {
        PartyRoomMember::create([
            'party_room_id' => $room->id,
            'user_id' => $member->id,
            'role' => 'member',
            'joined_at' => now(),
            'last_seen_at' => now(),
        ]);
    }

    $this->actingAs($member)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonFragment([
            'code' => $openRoom->code,
            'host_only_controls' => false,
            'can_control' => true,
            'is_member' => true,
        ])
        ->assertJsonFragment([
            'code' => $hostOnlyRoom->code,
            'host_only_controls' => true,
            'can_control' => false,
            'is_member' => true,
        ]);

    $this->actingAs($host)
        ->getJson(route('api.party.lobby'))
        ->assertOk()
        ->assertJsonFragment([
            'code' => $hostOnlyRoom->code,
            'host_only_controls' => true,
            'can_control' => true,
            'is_host' => true,
        ]);
});

test('episode repeat mode syncs to peers without bumping playback clock', function () {
    $host = createPartyHost();
    $room = createOpenRoom($host, [
        'host_only_controls' => false,
        'is_playing' => true,
        'position_seconds' => 42.5,
        'episode_repeat_mode' => 'tvshow',
        'playback_updated_at' => now()->subSeconds(30),
    ]);
    $member = User::factory()->create();

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $anchorBefore = $room->playback_updated_at?->toIso8601String();

    $this->actingAs($host)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'episode_repeat_mode' => 'one',
        ])
        ->assertOk()
        ->assertJsonPath('playback.episode_repeat_mode', 'one')
        ->assertJsonPath('playback.episode_repeat_updated_by', $host->id)
        ->assertJsonPath('playback.position_seconds', 42.5)
        ->assertJsonPath('playback.is_playing', true);

    $room->refresh();
    expect($room->episode_repeat_mode)->toBe('one');
    expect($room->episode_repeat_updated_by)->toBe($host->id);
    expect($room->episode_repeat_updated_at)->not->toBeNull();
    expect(optional($room->playback_updated_at)->toIso8601String())->toBe($anchorBefore);

    $this->actingAs($member)
        ->getJson(route('api.party.sync', ['code' => $room->code]))
        ->assertOk()
        ->assertJsonPath('snapshot.playback.episode_repeat_mode', 'one')
        ->assertJsonPath('snapshot.playback.episode_repeat_updated_by', $host->id);

    $this->actingAs($member)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'episode_repeat_mode' => 'season',
        ])
        ->assertOk()
        ->assertJsonPath('playback.episode_repeat_mode', 'season')
        ->assertJsonPath('playback.episode_repeat_updated_by', $member->id);

    $this->actingAs($host)
        ->patchJson(route('api.party.settings', ['code' => $room->code]), [
            'host_only_controls' => true,
        ])
        ->assertOk();

    $this->actingAs($member)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'episode_repeat_mode' => 'none',
        ])
        ->assertUnprocessable();

    expect($room->fresh()->episode_repeat_mode)->toBe('season');
});

test('party browse lists playable movies and tv shows with seasons and episodes', function () {
    $host = createPartyHost();

    Movie::create([
        'slug' => 'browse-movie-'.uniqid(),
        'original_name' => 'Browse Alpha',
        'title' => 'Browse Alpha',
        'path' => '/fake/browse-alpha.mp4',
        'poster_path' => '/alpha.jpg',
        'release_date' => '2020-01-01',
        'is_free' => true,
        'trailers' => json_encode([
            ['site' => 'YouTube', 'key' => 'abc123', 'type' => 'Trailer', 'official' => true],
        ]),
    ]);

    Movie::create([
        'slug' => 'unplayable-movie-'.uniqid(),
        'original_name' => 'Missing File',
        'title' => 'Missing File',
        'path' => '',
        'is_free' => true,
    ]);

    $tvshow = Tvshow::create([
        'slug' => 'browse-show-'.uniqid(),
        'folder_name' => 'Browse Show Folder',
        'tmdb_id' => random_int(1, 9999999),
        'name' => 'Browse Show',
        'original_name' => 'Browse Show',
        'poster_path' => '/show.jpg',
        'first_air_date' => '2019-05-01',
        'is_free' => true,
        'videos' => [
            'results' => [
                ['site' => 'YouTube', 'key' => 'tvtrailer', 'type' => 'Trailer', 'official' => true],
            ],
        ],
    ]);

    $season = Season::create([
        'tmdb_id' => random_int(1, 9999999),
        'tvshow_id' => $tvshow->id,
        'name' => 'Season 1',
        'season_number' => 1,
    ]);

    $playable = Episode::create([
        'tmdb_id' => random_int(1, 9999999),
        'season_id' => $season->id,
        'name' => 'Pilot',
        'episode_number' => 1,
        'is_in_storage' => '/fake/show/s01e01.mp4',
        'is_free' => true,
    ]);

    Episode::create([
        'tmdb_id' => random_int(1, 9999999),
        'season_id' => $season->id,
        'name' => 'Missing',
        'episode_number' => 2,
        'is_in_storage' => '0',
        'is_free' => true,
    ]);

    $emptyShow = Tvshow::create([
        'slug' => 'empty-show-'.uniqid(),
        'folder_name' => 'Empty Show Folder',
        'tmdb_id' => random_int(1, 9999999),
        'name' => 'Empty Show',
        'original_name' => 'Empty Show',
    ]);

    Season::create([
        'tmdb_id' => random_int(1, 9999999),
        'tvshow_id' => $emptyShow->id,
        'name' => 'Season 1',
        'season_number' => 1,
    ]);

    $this->actingAs($host)
        ->getJson(route('api.party.content.browse', ['type' => 'movies']))
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('type', 'movies')
        ->assertJsonFragment([
            'title' => 'Browse Alpha',
            'has_trailer' => true,
            'caption' => '2020',
        ])
        ->assertJsonMissing([
            'title' => 'Missing File',
        ]);

    $this->actingAs($host)
        ->getJson(route('api.party.content.browse', ['type' => 'tvshows']))
        ->assertOk()
        ->assertJsonFragment([
            'title' => 'Browse Show',
            'has_trailer' => true,
            'trailer_key' => 'tvtrailer',
        ])
        ->assertJsonMissing([
            'title' => 'Empty Show',
        ]);

    $this->actingAs($host)
        ->getJson(route('api.party.content.tvshow', ['tvshowId' => $tvshow->id]))
        ->assertOk()
        ->assertJsonPath('tvshow.title', 'Browse Show')
        ->assertJsonPath('seasons.0.season_number', 1)
        ->assertJsonPath('seasons.0.playable_count', 1);

    $this->actingAs($host)
        ->getJson(route('api.party.content.tvshow.season', [
            'tvshowId' => $tvshow->id,
            'seasonNumber' => 1,
        ]))
        ->assertOk()
        ->assertJsonCount(1, 'episodes')
        ->assertJsonPath('episodes.0.id', $playable->id)
        ->assertJsonPath('episodes.0.title', 'Pilot');
});

test('party theater progress registers movies and episodes in personal history', function () {
    $host = createPartyHost();
    $member = User::factory()->create();
    $room = createOpenRoom($host);

    PartyRoomMember::create([
        'party_room_id' => $room->id,
        'user_id' => $member->id,
        'role' => 'member',
        'joined_at' => now(),
        'last_seen_at' => now(),
    ]);

    $movie = Movie::create([
        'slug' => 'party-history-movie-'.uniqid(),
        'original_name' => 'Party History Movie',
        'title' => 'Party History Movie',
        'path' => '/fake/party-history.mp4',
        'runtime' => 120,
        'is_free' => true,
    ]);

    $tvshow = Tvshow::create([
        'slug' => 'party-history-show-'.uniqid(),
        'folder_name' => 'Party History Show',
        'tmdb_id' => random_int(1, 9999999),
        'name' => 'Party History Show',
        'original_name' => 'Party History Show',
    ]);

    $season = Season::create([
        'tmdb_id' => random_int(1, 9999999),
        'tvshow_id' => $tvshow->id,
        'name' => 'Season 1',
        'season_number' => 1,
    ]);

    $episode = Episode::create([
        'tmdb_id' => random_int(1, 9999999),
        'season_id' => $season->id,
        'name' => 'Party History Episode',
        'episode_number' => 1,
        'season_number' => 1,
        'runtime' => 42,
        'is_in_storage' => '1',
        'is_free' => true,
    ]);

    $this->actingAs($host)
        ->postJson(route('api.party.queue.add', ['code' => $room->code]), [
            'type' => 'movie',
            'id' => $movie->id,
        ])
        ->assertOk();

    $this->actingAs($host)
        ->postJson(route('api.party.playback', ['code' => $room->code]), [
            'queue_item_id' => $room->fresh()->current_queue_item_id,
            'is_playing' => true,
            'position_seconds' => 90,
        ])
        ->assertOk();

    // Client players post personal progress while synced in the theater (movies + episodes).
    $this->actingAs($host)
        ->postJson(route('api.views.progress.update'), [
            'type' => 'movie',
            'id' => $movie->id,
            'current_time' => 90,
            'duration' => 7200,
        ])
        ->assertOk();

    $this->actingAs($member)
        ->postJson(route('api.views.progress.update'), [
            'type' => 'movie',
            'id' => $movie->id,
            'current_time' => 90,
            'duration' => 7200,
        ])
        ->assertOk();

    $this->actingAs($member)
        ->postJson(route('api.views.progress.update'), [
            'type' => 'episode',
            'id' => $episode->id,
            'current_time' => 600,
            'duration' => 2520,
        ])
        ->assertOk();

    expect(WatchProgress::where('user_id', $host->id)->where('watchable_type', Movie::class)->count())->toBe(1);
    expect(WatchProgress::where('user_id', $member->id)->count())->toBe(2);

    $hostHistory = HistoryService::getHistory($host);
    expect($hostHistory['continueWatching']['total'])->toBe(1);
    expect($hostHistory['continueWatching']['items'][0]['id'])->toBe($movie->id);
    expect($hostHistory['movies']['total'])->toBe(1);

    $memberHistory = HistoryService::getHistory($member);
    expect($memberHistory['continueWatching']['total'])->toBe(2);
    expect($memberHistory['movies']['total'])->toBe(1);
    expect($memberHistory['episodes']['total'])->toBe(1);
    expect(collect($memberHistory['movies']['items'])->pluck('id')->all())->toContain($movie->id);
    expect(collect($memberHistory['episodes']['items'])->pluck('id')->all())->toContain($episode->id);
});