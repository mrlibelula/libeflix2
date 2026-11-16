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

test('authenticated user sees paginated history payload with movies episodes continue and rewatched', function () {
    $user = User::factory()->create();
    $movieInProgress = createHistoryMovie('Continue Movie');
    $finishedMovie = createHistoryMovie('Finished Movie');
    $episode = createHistoryEpisode('Continue Episode');
    $rewatchedMovie = createHistoryMovie('Rewatched Movie');

    ViewService::updateProgress($movieInProgress, $user, 900, 3600);
    ViewService::updateProgress($finishedMovie, $user, 3000, 3600);
    ViewService::updateProgress($episode, $user, 1000, 2520);
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
            ->has('continueWatching.items')
            ->has('historyMovies.items', 3)
            ->has('historyEpisodes.items', 1)
            ->where('historyMovies.total', 3)
            ->where('historyEpisodes.total', 1)
            ->where('mostRewatched.total', 1)
            ->where('mostRewatched.items.0.id', $rewatchedMovie->id)
            ->where('mostRewatched.items.0.plays_count', 2)
            ->has('imgBaseUrl')
            ->has('pageSize')
        );

    $history = HistoryService::getHistory($user);

    $continueIds = collect($history['continueWatching']['items'])->pluck('id')->all();
    expect($continueIds)->toContain($movieInProgress->id);
    expect($continueIds)->toContain($episode->id);
    expect($continueIds)->not->toContain($finishedMovie->id);

    $finishedItem = collect($history['movies']['items'])->firstWhere('id', $finishedMovie->id);
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
            ->where('historyMovies.total', 1)
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
            ->where('historyMovies.total', 0)
            ->where('continueWatching.total', 0)
            ->where('mostRewatched.total', 0)
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

    expect($history['mostRewatched']['total'])->toBe(1);
    expect($history['mostRewatched']['items'])->toHaveCount(1);
    expect($history['mostRewatched']['items'][0]['id'])->toBe($twice->id);
    expect($history['mostRewatched']['items'][0]['plays_count'])->toBe(2);
    expect(Play::where('user_id', $user->id)->count())->toBe(3);
});

test('continue watching excludes completed and near-finished progress', function () {
    $user = User::factory()->create();
    $mid = createHistoryMovie('Mid Watch');
    $nearEnd = createHistoryMovie('Near End');
    $done = createHistoryMovie('Done');

    ViewService::updateProgress($mid, $user, 1200, 3600);
    ViewService::updateProgress($nearEnd, $user, 3300, 3600);
    ViewService::updateProgress($done, $user, 3000, 3600);

    $history = HistoryService::getHistory($user);
    $continueIds = collect($history['continueWatching']['items'])->pluck('id')->all();

    expect($continueIds)->toContain($mid->id);
    expect($continueIds)->not->toContain($nearEnd->id);
    expect($continueIds)->not->toContain($done->id);
});

test('history section API lazy-loads later pages with correct totals', function () {
    $user = User::factory()->create();
    $perPage = HistoryService::PAGE_SIZE;
    $totalEpisodes = $perPage + 5;

    for ($i = 0; $i < $totalEpisodes; $i++) {
        $episode = createHistoryEpisode("Episode {$i}");
        ViewService::updateProgress($episode, $user, 1000, 2520);
    }

    $this->actingAs($user);

    $page1 = $this->getJson(route('api.history.section', [
        'section' => 'episodes',
        'page' => 1,
        'per_page' => $perPage,
    ]));

    $page1->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('total', $totalEpisodes)
        ->assertJsonPath('page', 1)
        ->assertJsonPath('last_page', 2)
        ->assertJsonCount($perPage, 'items');

    $page2 = $this->getJson(route('api.history.section', [
        'section' => 'episodes',
        'page' => 2,
        'per_page' => $perPage,
    ]));

    $page2->assertOk()
        ->assertJsonPath('page', 2)
        ->assertJsonPath('total', $totalEpisodes)
        ->assertJsonCount(5, 'items');

    $page1Ids = collect($page1->json('items'))->pluck('id')->all();
    $page2Ids = collect($page2->json('items'))->pluck('id')->all();
    expect(array_intersect($page1Ids, $page2Ids))->toBe([]);

    $history = HistoryService::getHistory($user, $perPage);
    expect($history['episodes']['total'])->toBe($totalEpisodes);
    expect($history['episodes']['items'])->toHaveCount($perPage);
    expect($history['episodes']['last_page'])->toBe(2);
    expect($history['stats']['episodes'])->toBe($totalEpisodes);
});

test('guests cannot access history section API', function () {
    $this->getJson(route('api.history.section', ['section' => 'episodes']))
        ->assertStatus(401);
});
