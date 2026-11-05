<?php

use App\Models\Episode;
use App\Models\Tvshow;
use App\Models\User;
use App\Services\TvshowService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('tvshows');

    Permission::firstOrCreate(['name' => 'manage movies']);
    Role::firstOrCreate(['name' => 'admin']);
    Role::firstOrCreate(['name' => 'editor'])->givePermissionTo('manage movies');
});

function createTvshowAdminUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

function createTvshowEditorUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('editor');

    return $user;
}

test('parseEpisodeNumberFromFilename extracts SxxEyy pattern', function () {
    expect(TvshowService::parseEpisodeNumberFromFilename(
        'Black Mirror S07E04 Plaything 1080p.mp4',
        7
    ))->toBe(4);
});

test('parseEpisodeNumberFromFilename respects already prefixed names', function () {
    expect(TvshowService::hasNumericEpisodePrefix('4.Black Mirror S07E04.mp4'))->toBeTrue();
    expect(TvshowService::parseEpisodeNumberFromFilename('4.Black Mirror S07E04.mp4', 7))->toBe(4);
});

test('parseEpisodeNumberFromFilename returns null when unresolved', function () {
    expect(TvshowService::parseEpisodeNumberFromFilename('random episode title.mp4', 1))->toBeNull();
});

test('normalizeEpisodeFilenames renames SxxEyy files and leaves prefixed files alone', function () {
    Storage::disk('tvshows')->put(
        'Black Mirror/7/Black Mirror S07E04 Plaything.mp4',
        'fake'
    );
    Storage::disk('tvshows')->put(
        'Black Mirror/7/3.Already Numbered.mp4',
        'fake'
    );

    $renames = TvshowService::normalizeEpisodeFilenames('Black Mirror');

    expect($renames)->toHaveCount(1);
    expect(Storage::disk('tvshows')->exists(
        'Black Mirror/7/4.Black Mirror S07E04 Plaything.mp4'
    ))->toBeTrue();
    expect(Storage::disk('tvshows')->exists(
        'Black Mirror/7/3.Already Numbered.mp4'
    ))->toBeTrue();
});

test('normalizeEpisodeFilenames falls back to sequential numbering', function () {
    Storage::disk('tvshows')->put('Show/1/first episode.mp4', 'fake');
    Storage::disk('tvshows')->put('Show/1/second episode.mp4', 'fake');

    TvshowService::normalizeEpisodeFilenames('Show');

    expect(Storage::disk('tvshows')->exists('Show/1/1.first episode.mp4'))->toBeTrue();
    expect(Storage::disk('tvshows')->exists('Show/1/2.second episode.mp4'))->toBeTrue();
});

test('scanPendingTvshowFolders detects folder with season video and no metadata', function () {
    Storage::disk('tvshows')->put('Test Show/1/episode.mp4', 'fake');

    $scan = TvshowService::scanPendingTvshowFolders();

    expect($scan['pending'])->toHaveCount(1);
    expect($scan['pending'][0]['folder'])->toBe('Test Show');
    expect($scan['pending'][0]['needs_numbering'])->toBeTrue();
    expect($scan['pending'][0]['season_count'])->toBe(1);
});

test('scanPendingTvshowFolders ignores imported folders', function () {
    Storage::disk('tvshows')->put('Imported Show/1/1.ep.mp4', 'fake');

    Tvshow::create([
        'slug' => 'imported-show-test',
        'folder_name' => 'Imported Show',
        'tmdb_id' => 999001,
        'name' => 'Imported Show',
        'original_name' => 'Imported Show',
    ]);

    $scan = TvshowService::scanPendingTvshowFolders();

    expect($scan['pending'])->toBeEmpty();
    expect($scan['ready'])->toBeEmpty();
});

test('createMetadataJson writes expected structure', function () {
    Storage::disk('tvshows')->makeDirectory('My Show');

    TvshowService::createMetadataJson('My Show', [
        'name' => 'My Show',
        'release_year' => 2011,
        'pick' => 0,
        'id' => 420,
    ]);

    $metadata = json_decode(Storage::disk('tvshows')->get('My Show/metadata.json'), true);

    expect($metadata)->toMatchArray([
        'name' => 'My Show',
        'release_year' => 2011,
        'releaseYear' => 2011,
        'pick' => 0,
        'dir' => 'My Show',
        'id' => 420,
        'selected_logo' => 0,
    ]);
});

test('scan lists ready folders with metadata not in database', function () {
    Storage::disk('tvshows')->put('Ready Show/1/1.ep.mp4', 'fake');
    Storage::disk('tvshows')->put('Ready Show/metadata.json', json_encode([
        'name' => 'Ready Show',
        'release_year' => 2015,
        'pick' => 0,
        'dir' => 'Ready Show',
        'id' => 550,
    ]));

    $scan = TvshowService::scanPendingTvshowFolders();

    expect($scan['ready'])->toHaveCount(1);
    expect($scan['ready'][0]['folder'])->toBe('Ready Show');
});

test('tvshow import scan endpoint requires authentication', function () {
    $this->getJson('/admin/api/tvshows/import/scan')->assertUnauthorized();
});

test('tvshow import scan endpoint is accessible to admin', function () {
    $admin = createTvshowAdminUser();

    Storage::disk('tvshows')->put('Admin Scan/1/ep.mp4', 'fake');

    $this->actingAs($admin)
        ->getJson('/admin/api/tvshows/import/scan')
        ->assertOk()
        ->assertJsonPath('stats.pending', 1);
});

test('tvshow import scan endpoint is accessible to editor with manage movies', function () {
    $editor = createTvshowEditorUser();

    Storage::disk('tvshows')->put('Editor Scan/1/ep.mp4', 'fake');

    $this->actingAs($editor)
        ->getJson('/admin/api/tvshows/import/scan')
        ->assertOk()
        ->assertJsonPath('stats.pending', 1);
});

test('store metadata endpoint creates metadata json on disk', function () {
    $admin = createTvshowAdminUser();
    Storage::disk('tvshows')->makeDirectory('Store Test');

    $this->actingAs($admin)
        ->postJson('/admin/api/tvshows/import/metadata', [
            'folder' => 'Store Test',
            'name' => 'Store Test',
            'release_year' => 2011,
            'pick' => 0,
            'id' => 42,
        ])
        ->assertOk()
        ->assertJsonPath('metadata.id', 42);

    expect(Storage::disk('tvshows')->exists('Store Test/metadata.json'))->toBeTrue();
});

test('search tmdb endpoint returns normalized results', function () {
    $admin = createTvshowAdminUser();

    Http::fake([
        '*/search/tv*' => Http::response([
            'results' => [[
                'id' => 100,
                'name' => 'Search Test',
                'original_name' => 'Search Test',
                'first_air_date' => '2010-01-01',
                'poster_path' => '/p.jpg',
                'vote_average' => 7.5,
                'overview' => 'Overview text',
            ]],
        ]),
    ]);

    $this->actingAs($admin)
        ->getJson('/admin/api/tvshows/import/search?name=Search+Test&year=2010')
        ->assertOk()
        ->assertJsonPath('results.0.id', 100)
        ->assertJsonPath('results.0.pick', 0)
        ->assertJsonPath('results.0.title', 'Search Test');
});

test('run endpoint imports tvshow synchronously with faked tmdb responses', function () {
    $admin = createTvshowAdminUser();

    Http::fake([
        '*/tv/420?*' => Http::response([
            'id' => 420,
            'name' => 'Black Mirror',
            'original_name' => 'Black Mirror',
            'first_air_date' => '2011-12-04',
            'poster_path' => '/poster.jpg',
            'backdrop_path' => '/backdrop.jpg',
            'vote_average' => 8.3,
            'vote_count' => 100,
            'overview' => 'Test overview',
            'original_language' => 'en',
            'popularity' => 50,
            'homepage' => '',
            'status' => 'Returning Series',
            'tagline' => '',
            'type' => 'Scripted',
            'number_of_seasons' => 1,
            'number_of_episodes' => 1,
            'created_by' => [],
            'genres' => [['id' => 18, 'name' => 'Drama']],
            'languages' => ['en'],
            'networks' => [],
            'origin_country' => ['GB'],
            'production_companies' => [],
            'production_countries' => [],
            'seasons' => [['season_number' => 1]],
            'spoken_languages' => [],
            'videos' => ['results' => []],
            'images' => ['logos' => [], 'posters' => [], 'backdrops' => []],
        ]),
        '*/tv/420/credits*' => Http::response([
            'cast' => [],
            'crew' => [],
        ]),
        '*/tv/420/season/1?*' => Http::response([
            'id' => 1001,
            'name' => 'Season 1',
            'overview' => 'Season overview',
            'poster_path' => null,
            'air_date' => '2011-12-04',
            'season_number' => 1,
            'vote_average' => 8.0,
            'episodes' => [[
                'id' => 2001,
                'name' => 'Episode 1',
                'episode_number' => 1,
            ]],
        ]),
        '*/tv/420/season/1/episode/1*' => Http::response([
            'id' => 2001,
            'name' => 'The National Anthem',
            'overview' => 'Episode overview',
            'air_date' => '2011-12-04',
            'episode_number' => 1,
            'production_code' => '',
            'runtime' => 44,
            'season_number' => 1,
            'still_path' => null,
            'vote_average' => 7.5,
            'vote_count' => 10,
            'credits' => ['cast' => [], 'crew' => [], 'guest_stars' => []],
        ]),
    ]);

    Storage::disk('tvshows')->put(
        'Black Mirror/1/Black Mirror S01E01 The National Anthem.mp4',
        'fake'
    );
    TvshowService::createMetadataJson('Black Mirror', [
        'name' => 'Black Mirror',
        'release_year' => 2011,
        'pick' => 0,
        'id' => 420,
    ]);

    $response = $this->actingAs($admin)
        ->postJson('/admin/api/tvshows/import/run', [
            'folders' => ['Black Mirror'],
        ])
        ->assertOk()
        ->assertJsonPath('results.0.success', true)
        ->assertJsonPath('results.0.title', 'Black Mirror');

    // EpisodeService used to echo progress into the HTTP body and break JSON clients.
    expect($response->getContent())->toStartWith('{');

    $tvshow = Tvshow::where('tmdb_id', 420)->first();
    expect($tvshow)->not->toBeNull();
    expect($tvshow->folder_name)->toBe('Black Mirror');
    expect($tvshow->seasons)->toHaveCount(1);
    expect($tvshow->episodes)->toHaveCount(1);

    expect(Storage::disk('tvshows')->exists(
        'Black Mirror/1/1.Black Mirror S01E01 The National Anthem.mp4'
    ))->toBeTrue();

    $episode = Episode::first();
    expect($episode->is_in_storage)->toBe(
        'Black Mirror/1/1.Black Mirror S01E01 The National Anthem.mp4'
    );
});
