<?php

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Season;
use App\Models\Tvshow;
use App\Models\User;
use App\Models\View;
use App\Models\WatchProgress;
use App\Services\ViewService;
use Illuminate\Testing\Fluent\AssertableJson;

function createTestMovie(): Movie
{
    return Movie::create([
        'slug' => 'test-movie-' . uniqid(),
        'original_name' => 'Test Movie Original',
        'title' => 'Test Movie',
        'path' => '/path/to/test/movie.mp4',
        'runtime' => 120, // minutes (not used by ViewService when duration is provided)
    ]);
}

function createTestEpisode(): Episode
{
    $tvshow = Tvshow::create([
        'slug' => 'test-tvshow-' . uniqid(),
        'folder_name' => 'Test Tvshow Folder',
        'tmdb_id' => random_int(1, 9999999),
        'name' => 'Test Tvshow',
        'original_name' => 'Test Tvshow Original',
    ]);

    $season = Season::create([
        'tmdb_id' => random_int(1, 9999999),
        'tvshow_id' => $tvshow->id,
        'name' => 'Season 1',
        'season_number' => 1,
    ]);

    return Episode::create([
        'tmdb_id' => random_int(1, 9999999),
        'season_id' => $season->id,
        'name' => 'Episode 1',
        'episode_number' => 1,
        'runtime' => 22, // minutes
    ]);
}

test('updates watch progress and does not record a view below threshold for movies', function () {
    $user = User::factory()->create();
    $movie = createTestMovie();

    $this->actingAs($user);

    // Watch 20% of a long movie
    $response = $this->postJson(route('api.views.progress.update'), [
        'type' => 'movie',
        'id' => $movie->id,
        'current_time' => 600,   // 10 minutes
        'duration' => 3600,      // 60 minutes
    ]);

    $response->assertOk()
        ->assertJson(fn (AssertableJson $json) =>
            $json->where('success', true)
                 ->where('progress.completed', false)
                 ->where('view_recorded', false)
                 ->etc()
        );

    expect(WatchProgress::count())->toBe(1);
    expect(View::count())->toBe(0);
});

test('records a movie view once when thresholds are met and does not duplicate', function () {
    $user = User::factory()->create();
    $movie = createTestMovie();

    $this->actingAs($user);

    // First send progress below threshold
    ViewService::updateProgress($movie, $user, 600, 3600); // 10 of 60 minutes (16%)

    expect(View::count())->toBe(0);

    // Now send progress above 70% threshold - should create one view
    $result = ViewService::updateProgress($movie, $user, 2600, 3600); // ~72%

    expect($result['progress']->completed)->toBeTrue();
    expect(View::count())->toBe(1);

    // Further updates should NOT create additional views
    ViewService::updateProgress($movie, $user, 3500, 3600);

    expect(View::count())->toBe(1);
});

test('records an episode view when thresholds are met via API', function () {
    $user = User::factory()->create();
    $episode = createTestEpisode();

    $this->actingAs($user);

    // Below threshold
    $this->postJson(route('api.views.progress.update'), [
        'type' => 'episode',
        'id' => $episode->id,
        'current_time' => 300,   // 5 minutes
        'duration' => 22 * 60,   // 22 minutes
    ])->assertOk();

    expect(View::count())->toBe(0);

    // Above 70% threshold
    $this->postJson(route('api.views.progress.update'), [
        'type' => 'episode',
        'id' => $episode->id,
        'current_time' => 17 * 60,  // ~77%
        'duration' => 22 * 60,
    ])->assertOk();

    expect(View::count())->toBe(1);

    $this->assertDatabaseHas('views', [
        'user_id' => $user->id,
        'viewable_id' => $episode->id,
        'viewable_type' => Episode::class,
    ]);
});

test('returns and resets watch progress via API', function () {
    $user = User::factory()->create();
    $movie = createTestMovie();

    $this->actingAs($user);

    // Store some progress
    $this->postJson(route('api.views.progress.update'), [
        'type' => 'movie',
        'id' => $movie->id,
        'current_time' => 900,
        'duration' => 3600,
    ])->assertOk();

    // Retrieve progress
    $getResponse = $this->getJson(route('api.views.progress.get', [
        'type' => 'movie',
        'id' => $movie->id,
    ]));

    $getResponse->assertOk()
        ->assertJson(fn (AssertableJson $json) =>
            $json->where('success', true)
                 ->where('progress.current_time', 900)
                 ->where('progress.duration', 3600)
        );

    // Reset progress
    $deleteResponse = $this->deleteJson(route('api.views.progress.reset'), [
        'type' => 'movie',
        'id' => $movie->id,
    ]);

    $deleteResponse->assertOk()
        ->assertJson(fn (AssertableJson $json) =>
            $json->where('success', true)
        );

    expect(WatchProgress::count())->toBe(0);
});

test('returns views count via API', function () {
    $user = User::factory()->create();
    $movie = createTestMovie();

    $this->actingAs($user);

    // Force a view to be recorded
    ViewService::recordView($movie, $user);

    $response = $this->getJson(route('api.views.count', [
        'type' => 'movie',
        'id' => $movie->id,
    ]));

    $response->assertOk()
        ->assertJson(fn (AssertableJson $json) =>
            $json->where('success', true)
                 ->where('views_count', 1)
        );
});

test('requires authentication for progress endpoints', function () {
    $movie = createTestMovie();

    $this->postJson(route('api.views.progress.update'), [
        'type' => 'movie',
        'id' => $movie->id,
        'current_time' => 100,
        'duration' => 3600,
    ])->assertStatus(401);

    $this->getJson(route('api.views.progress.get', [
        'type' => 'movie',
        'id' => $movie->id,
    ]))->assertStatus(401);

    $this->deleteJson(route('api.views.progress.reset'), [
        'type' => 'movie',
        'id' => $movie->id,
    ])->assertStatus(401);
});
