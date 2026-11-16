<?php

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Play;
use App\Models\Season;
use App\Models\Tvshow;
use App\Models\User;
use App\Models\WatchProgress;
use App\Services\HistoryService;
use App\Services\ViewService;
use Inertia\Testing\AssertableInertia as Assert;

function createHistoryMovie(string $title = 'History Movie'): Movie
{
    return Movie::create([
        'slug' => 'history-movie-' . uniqid(),
        'original_name' => $title . ' Original',
        'title' => $title,
        'path' => '/path/to/history/movie.mp4',
        'runtime' => 120,
        'poster_path' => '/poster.jpg',
        'release_date' => '2020-01-01',
    ]);
}

function createHistoryEpisode(string $name = 'History Episode'): Episode
{
    $tvshow = Tvshow::create([
        'slug' => 'history-tvshow-' . uniqid(),
        'folder_name' => 'History Tvshow Folder',
        'tmdb_id' => random_int(1, 9999999),
        'name' => 'History Tvshow',
        'original_name' => 'History Tvshow Original',
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
        'name' => $name,
        'episode_number' => 1,
        'season_number' => 1,
        'runtime' => 42,
        'still_path' => '/still.jpg',
    ]);
}

test('guests are redirected from history page', function () {
    $this->get(route('history.index'))->assertRedirect(route('login'));
});

test('authenticated user sees history payload with movies episodes continue and rewatched', function () {
    $user = User::factory()->create();
    $movieInProgress = createHistoryMovie('Continue Movie');
    $finishedMovie = createHistoryMovie('Finished Movie');
    $episode = createHistoryEpisode('Continue Episode');
    $rewatchedMovie = createHistoryMovie('Rewatched Movie');

    // Continue watching movie (~25%)
    ViewService::updateProgress($movieInProgress, $user, 900, 3600);

    // Finished / completed movie (above view threshold)
    ViewService::updateProgress($finishedMovie, $user, 3000, 3600);

    // Continue watching episode (~40%)
    ViewService::updateProgress($episode, $user, 1000, 2520);

    // Rewatched movie with progress + 2 plays
    ViewService::updateProgress($rewatchedMovie, $user, 3500, 3600);
    ViewService::recordPlay($rewatchedMovie, $user, 3500, 3600);
    ViewService::recordPlay($rewatchedMovie, $user, 3400, 3600);

    $this->actingAs($user)
        ->get(route('history.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('history')
            ->where('stats.titles', 4)
            ->where('stats.movies', 3)
            ->where('stats.episodes', 1)
            ->where('stats.total_plays', 2)
            ->has('continueWatching')
            ->has('historyMovies', 3)
            ->has('historyEpisodes', 1)
            ->has('mostRewatched', 1)
            ->where('mostRewatched.0.id', $rewatchedMovie->id)
            ->where('mostRewatched.0.plays_count', 2)
            ->where('mostRewatched.0.history_type', 'movie')
            ->has('imgBaseUrl')
        );

    $history = HistoryService::getHistory($user);

    $continueIds = collect($history['continueWatching'])->pluck('id')->all();
    expect($continueIds)->toContain($movieInProgress->id);
    expect($continueIds)->toContain($episode->id);
    expect($continueIds)->not->toContain($finishedMovie->id);

    $finishedItem = collect($history['movies'])->firstWhere('id', $finishedMovie->id);
    expect($finishedItem['completed'])->toBeTrue();
    expect($finishedItem['progress_percentage'])->toBeGreaterThan(70);
});

test('resetting progress removes title from history page', function () {
    $user = User::factory()->create();
    $movie = createHistoryMovie('Removable Movie');

    ViewService::updateProgress($movie, $user, 600, 3600);
    expect(WatchProgress::where('user_id', $user->id)->count())->toBe(1);

    $this->actingAs($user)
        ->get(route('history.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('history')
            ->where('stats.titles', 1)
            ->has('historyMovies', 1)
        );

    $this->actingAs($user)
        ->deleteJson(route('api.views.progress.reset'), [
            'type' => 'movie',
            'id' => $movie->id,
        ])
        ->assertOk();

    expect(WatchProgress::where('user_id', $user->id)->count())->toBe(0);

    $this->actingAs($user)
        ->get(route('history.index'))
        ->assertOk()
        ->assertInertia(fn (Assert $page) => $page
            ->component('history')
            ->where('stats.titles', 0)
            ->has('historyMovies', 0)
            ->has('continueWatching', 0)
            ->has('mostRewatched', 0)
        );
});

test('most rewatched excludes titles with fewer than two plays', function () {
    $user = User::factory()->create();
    $once = createHistoryMovie('Played Once');
    $twice = createHistoryMovie('Played Twice');

    ViewService::updateProgress($once, $user, 3500, 3600);
    ViewService::recordPlay($once, $user, 3500, 3600);

    ViewService::updateProgress($twice, $user, 3500, 3600);
    ViewService::recordPlay($twice, $user, 3500, 3600);
    ViewService::recordPlay($twice, $user, 3400, 3600);

    $history = HistoryService::getHistory($user);

    expect($history['mostRewatched'])->toHaveCount(1);
    expect($history['mostRewatched'][0]['id'])->toBe($twice->id);
    expect($history['mostRewatched'][0]['plays_count'])->toBe(2);
    expect(Play::where('user_id', $user->id)->count())->toBe(3);
});

test('continue watching excludes completed and near-finished progress', function () {
    $user = User::factory()->create();
    $mid = createHistoryMovie('Mid Watch');
    $nearEnd = createHistoryMovie('Near End');
    $done = createHistoryMovie('Done');

    ViewService::updateProgress($mid, $user, 1200, 3600); // 33%
    ViewService::updateProgress($nearEnd, $user, 3300, 3600); // 91.6%
    ViewService::updateProgress($done, $user, 3000, 3600); // completed via view threshold

    $history = HistoryService::getHistory($user);
    $continueIds = collect($history['continueWatching'])->pluck('id')->all();

    expect($continueIds)->toContain($mid->id);
    expect($continueIds)->not->toContain($nearEnd->id);
    expect($continueIds)->not->toContain($done->id);
});

test('history sections are capped while stats reflect full totals', function () {
    $user = User::factory()->create();

    $episodeLimit = HistoryService::EPISODES_LIMIT;
    $continueLimit = HistoryService::CONTINUE_WATCHING_LIMIT;

    // Create more episodes than the continue / episodes caps
    $totalEpisodes = $episodeLimit + 5;
    for ($i = 0; $i < $totalEpisodes; $i++) {
        $episode = createHistoryEpisode("Episode {$i}");
        // Stagger last_watched via progress updates (~40% incomplete)
        ViewService::updateProgress($episode, $user, 1000, 2520);
    }

    $history = HistoryService::getHistory($user);

    expect($history['stats']['episodes'])->toBe($totalEpisodes);
    expect($history['stats']['titles'])->toBe($totalEpisodes);
    expect($history['episodes'])->toHaveCount($episodeLimit);
    expect(count($history['continueWatching']))->toBeLessThanOrEqual($continueLimit);
    expect(count($history['continueWatching']))->toBe($continueLimit);

    // Slim payloads — no heavy episode JSON dumps
    expect($history['episodes'][0])->toHaveKeys([
        'id',
        'history_type',
        'name',
        'progress_percentage',
        'last_watched_at',
        'plays_count',
    ]);
    expect($history['episodes'][0])->not->toHaveKey('credits');
});
