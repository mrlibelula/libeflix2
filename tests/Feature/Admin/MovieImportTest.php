<?php

use App\Models\Movie;
use App\Models\User;
use App\Services\MovieService;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

beforeEach(function () {
    Storage::fake('movies');

    Permission::firstOrCreate(['name' => 'manage movies']);
    Role::firstOrCreate(['name' => 'admin']);
    Role::firstOrCreate(['name' => 'editor'])->givePermissionTo('manage movies');
});

function createAdminUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('admin');

    return $user;
}

function createEditorUser(): User
{
    $user = User::factory()->create();
    $user->assignRole('editor');

    return $user;
}

test('parseReleaseYearFromFolderName extracts year from folder name', function () {
    expect(MovieService::parseReleaseYearFromFolderName('Alien vs Predator (2004)'))->toBe(2004);
    expect(MovieService::parseReleaseYearFromFolderName('Some Movie'))->toBeNull();
});

test('parseTitleFromFolderName strips year suffix', function () {
    expect(MovieService::parseTitleFromFolderName('Alien vs Predator (2004)'))->toBe('Alien vs Predator');
});

test('scanPendingMovieFolders detects folder with video and no metadata', function () {
    Storage::disk('movies')->put('Test Movie (2020)/movie.mp4', 'fake');

    $scan = MovieService::scanPendingMovieFolders();

    expect($scan['pending'])->toHaveCount(1);
    expect($scan['pending'][0]['folder'])->toBe('Test Movie (2020)');
    expect($scan['pending'][0]['parsed_release_year'])->toBe(2020);
});

test('scanPendingMovieFolders ignores imported folders', function () {
    Storage::disk('movies')->put('Imported Movie (2019)/movie.mp4', 'fake');

    Movie::create([
        'id' => 999001,
        'slug' => 'imported-movie-test',
        'original_name' => 'Imported Movie',
        'title' => 'Imported Movie',
        'path' => 'Imported Movie (2019)/movie.mp4',
    ]);

    $scan = MovieService::scanPendingMovieFolders();

    expect($scan['pending'])->toBeEmpty();
});

test('createMetadataJson writes expected structure', function () {
    Storage::disk('movies')->makeDirectory('My Movie (2001)');

    MovieService::createMetadataJson('My Movie (2001)', [
        'name' => 'My Movie',
        'release_year' => 2001,
        'pick' => 0,
        'id' => 123,
    ]);

    $metadata = json_decode(Storage::disk('movies')->get('My Movie (2001)/metadata.json'), true);

    expect($metadata)->toMatchArray([
        'name' => 'My Movie',
        'release_year' => 2001,
        'pick' => 0,
        'dir' => 'My Movie (2001)',
        'id' => 123,
    ]);
});

test('scan lists ready folders with metadata not in database', function () {
    Storage::disk('movies')->put('Ready Movie (2015)/movie.mp4', 'fake');
    Storage::disk('movies')->put('Ready Movie (2015)/metadata.json', json_encode([
        'name' => 'Ready Movie',
        'release_year' => 2015,
        'pick' => 0,
        'dir' => 'Ready Movie (2015)',
        'id' => 550,
    ]));

    $scan = MovieService::scanPendingMovieFolders();

    expect($scan['ready'])->toHaveCount(1);
    expect($scan['ready'][0]['folder'])->toBe('Ready Movie (2015)');
});

test('movie import scan endpoint requires authentication', function () {
    $this->getJson('/admin/api/movies/import/scan')->assertUnauthorized();
});

test('movie import scan endpoint is accessible to admin', function () {
    $admin = createAdminUser();

    Storage::disk('movies')->put('Admin Scan (2022)/movie.mp4', 'fake');

    $this->actingAs($admin)
        ->getJson('/admin/api/movies/import/scan')
        ->assertOk()
        ->assertJsonPath('stats.pending', 1);
});

test('movie import scan endpoint is accessible to editor with manage movies', function () {
    $editor = createEditorUser();

    Storage::disk('movies')->put('Editor Scan (2023)/movie.mp4', 'fake');

    $this->actingAs($editor)
        ->getJson('/admin/api/movies/import/scan')
        ->assertOk()
        ->assertJsonPath('stats.pending', 1);
});

test('store metadata endpoint creates metadata json on disk', function () {
    $admin = createAdminUser();
    Storage::disk('movies')->makeDirectory('Store Test (2005)');

    $this->actingAs($admin)
        ->postJson('/admin/api/movies/import/metadata', [
            'folder' => 'Store Test (2005)',
            'name' => 'Store Test',
            'release_year' => 2005,
            'pick' => 0,
            'id' => 42,
        ])
        ->assertOk()
        ->assertJsonPath('metadata.id', 42);

    expect(Storage::disk('movies')->exists('Store Test (2005)/metadata.json'))->toBeTrue();
});

test('run endpoint imports movie synchronously with faked tmdb responses', function () {
    $admin = createAdminUser();

    Http::fake([
        '*/search/movie*' => Http::response([
            'results' => [[
                'id' => 395,
                'title' => 'Alien vs Predator',
                'original_title' => 'Alien vs Predator',
                'release_date' => '2004-08-13',
                'poster_path' => '/poster.jpg',
                'vote_average' => 5.9,
                'overview' => 'Test overview',
            ]],
        ]),
        '*/movie/395?*' => Http::response([
            'id' => 395,
            'title' => 'Alien vs Predator',
            'original_title' => 'Alien vs Predator',
            'release_date' => '2004-08-13',
            'poster_path' => '/poster.jpg',
            'backdrop_path' => '/backdrop.jpg',
            'vote_average' => 5.9,
            'runtime' => 101,
            'tagline' => 'Whoever wins...',
            'overview' => 'Test overview',
            'genres' => [['id' => 878, 'name' => 'Science Fiction']],
            'credits' => ['cast' => [], 'crew' => []],
            'images' => ['backdrops' => [], 'posters' => []],
            'videos' => ['results' => []],
        ]),
        '*/movie/395/alternative_titles*' => Http::response(['titles' => []]),
        '*/movie/395/keywords*' => Http::response(['keywords' => []]),
    ]);

    Storage::disk('movies')->put('Alien vs Predator (2004)/movie.mp4', 'fake');
    MovieService::createMetadataJson('Alien vs Predator (2004)', [
        'name' => 'Alien vs Predator',
        'release_year' => 2004,
        'pick' => 0,
        'id' => 395,
    ]);

    $this->actingAs($admin)
        ->postJson('/admin/api/movies/import/run', [
            'folders' => ['Alien vs Predator (2004)'],
        ])
        ->assertOk()
        ->assertJsonPath('results.0.success', true)
        ->assertJsonPath('results.0.title', 'Alien vs Predator');

    expect(Movie::where('id', 395)->exists())->toBeTrue();
    expect(Movie::find(395)->path)->toBe('Alien vs Predator (2004)/movie.mp4');
});

test('search tmdb endpoint returns normalized results', function () {
    $admin = createAdminUser();

    Http::fake([
        '*/search/movie*' => Http::response([
            'results' => [[
                'id' => 100,
                'title' => 'Search Test',
                'original_title' => 'Search Test',
                'release_date' => '2010-01-01',
                'poster_path' => '/p.jpg',
                'vote_average' => 7.5,
                'overview' => 'Overview text',
            ]],
        ]),
    ]);

    $this->actingAs($admin)
        ->getJson('/admin/api/movies/import/search?name=Search+Test&year=2010')
        ->assertOk()
        ->assertJsonPath('results.0.id', 100)
        ->assertJsonPath('results.0.pick', 0)
        ->assertJsonPath('results.0.title', 'Search Test');
});
