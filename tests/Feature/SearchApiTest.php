<?php

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Season;
use App\Models\Tvshow;
use App\Models\User;

function createSearchTvshow(string $name = 'Search Show'): Tvshow
{
    return Tvshow::create([
        'slug' => 'search-tvshow-'.uniqid(),
        'folder_name' => $name.' Folder',
        'tmdb_id' => random_int(1, 9999999),
        'name' => $name,
        'original_name' => $name.' Original',
        'overview' => 'An overview mentioning cars and racing.',
    ]);
}

function createSearchEpisode(Tvshow $tvshow, string $name, int $episodeNumber = 1): Episode
{
    $season = Season::firstOrCreate(
        [
            'tvshow_id' => $tvshow->id,
            'season_number' => 1,
        ],
        [
            'tmdb_id' => random_int(1, 9999999),
            'name' => 'Season 1',
        ]
    );

    return Episode::create([
        'tmdb_id' => random_int(1, 9999999),
        'season_id' => $season->id,
        'name' => $name,
        'episode_number' => $episodeNumber,
        'season_number' => 1,
        'overview' => 'Episode overview about cars and travel.',
        'runtime' => 22,
    ]);
}

test('tv show search respects configured result limit', function () {
    config(['search.default_limit' => 5, 'search.max_limit' => 5]);

    $user = User::factory()->create();
    $tvshow = createSearchTvshow('Car Chronicles');

    for ($i = 1; $i <= 12; $i++) {
        createSearchEpisode($tvshow, "Car Episode {$i}", $i);
    }

    $this->actingAs($user);

    $response = $this->getJson(route('api.tvshows.search', [
        'q' => 'car',
        'log' => 'false',
    ]));

    $response->assertOk()
        ->assertJsonPath('success', true);

    expect(count($response->json('results')))->toBeLessThanOrEqual(5);
});

test('movie search respects configured result limit', function () {
    config(['search.default_limit' => 3, 'search.max_limit' => 3]);

    $user = User::factory()->create();

    for ($i = 1; $i <= 8; $i++) {
        Movie::create([
            'slug' => 'search-movie-'.uniqid(),
            'original_name' => "Car Movie {$i} Original",
            'title' => "Car Movie {$i}",
            'path' => "/path/to/car-movie-{$i}.mp4",
            'overview' => 'A movie about cars.',
            'runtime' => 100,
        ]);
    }

    $this->actingAs($user);

    $response = $this->getJson(route('api.movies.search', [
        'q' => 'car',
        'log' => 'false',
    ]));

    $response->assertOk()
        ->assertJsonPath('success', true);

    expect(count($response->json('results')))->toBeLessThanOrEqual(3);
});

test('tv show search log accepts client summary without re-searching', function () {
    $user = User::factory()->create();
    createSearchTvshow('Logged Show');

    $this->actingAs($user);

    $response = $this->postJson(route('api.tvshows.search.log'), [
        'query' => 'logged show',
        'timestamp' => now()->toISOString(),
        'results_count' => 1,
        'results_summary' => [
            [
                'type' => 'tvshow',
                'id' => 1,
                'name' => 'Logged Show',
                'slug' => 'logged-show',
            ],
        ],
    ]);

    $response->assertOk()->assertJsonPath('success', true);
});
