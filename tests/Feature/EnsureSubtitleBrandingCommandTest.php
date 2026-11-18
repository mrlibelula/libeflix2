<?php

use App\Models\Episode;
use App\Models\Movie;
use App\Models\Season;
use App\Models\Tvshow;
use App\Services\Subtitles\SubtitleConverter;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
  Storage::fake('movies');
  Storage::fake('tvshows');
});

function unbrandedVtt(): string
{
  return "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola\n";
}

function brandedVtt(): string
{
  return (new SubtitleConverter)->convert(unbrandedVtt())['vtt'];
}

function createMovieWithSubtitle(string $vtt, string $language = 'ES'): Movie
{
  $videoPath = 'Brand Movie (2020)/movie.mp4';
  Storage::disk('movies')->put($videoPath, 'fake-video');
  Storage::disk('movies')->put('Brand Movie (2020)/movie_'.$language.'.vtt', $vtt);

  return Movie::create([
    'slug' => 'brand-movie-'.uniqid(),
    'original_name' => 'Brand Movie',
    'title' => 'Brand Movie',
    'path' => $videoPath,
    'disk' => 'movies',
  ]);
}

function createEpisodeWithSubtitle(string $vtt, string $language = 'ES'): Episode
{
  $show = Tvshow::create([
    'slug' => 'brand-show-'.uniqid(),
    'folder_name' => 'Brand Show',
    'tmdb_id' => random_int(900000, 999999),
    'name' => 'Brand Show',
    'original_name' => 'Brand Show',
  ]);

  $season = Season::create([
    'tmdb_id' => random_int(900000, 999999),
    'tvshow_id' => $show->id,
    'season_number' => 1,
    'name' => 'Season 1',
  ]);

  $videoPath = 'Brand Show/1/1.episode.mp4';
  Storage::disk('tvshows')->put($videoPath, 'fake-video');
  Storage::disk('tvshows')->put('Brand Show/1/1.episode_'.$language.'.vtt', $vtt);

  return Episode::create([
    'tmdb_id' => random_int(900000, 999999),
    'season_id' => $season->id,
    'episode_number' => 1,
    'season_number' => 1,
    'name' => 'Pilot',
    'is_in_storage' => $videoPath,
    'subtitles' => null,
  ]);
}

test('command previews unbranded files and aborts without writing when declined', function () {
  $movie = createMovieWithSubtitle(unbrandedVtt());
  $path = 'Brand Movie (2020)/movie_ES.vtt';

  $this->artisan('subtitles:ensure-branding', ['--movie' => $movie->id])
    ->expectsConfirmation('Rewrite 1 VTT file(s) with Libeflix branding?', 'no')
    ->assertSuccessful();

  expect(Storage::disk('movies')->get($path))->toBe(unbrandedVtt())
    ->and((new SubtitleConverter)->hasBranding(Storage::disk('movies')->get($path)))->toBeFalse();
});

test('command rewrites unbranded vtt after confirmation', function () {
  $movie = createMovieWithSubtitle(unbrandedVtt());
  $path = 'Brand Movie (2020)/movie_ES.vtt';

  $this->artisan('subtitles:ensure-branding', ['--movie' => $movie->id])
    ->expectsConfirmation('Rewrite 1 VTT file(s) with Libeflix branding?', 'yes')
    ->assertSuccessful();

  $written = Storage::disk('movies')->get($path);

  expect((new SubtitleConverter)->hasBranding($written))->toBeTrue()
    ->and($written)->toContain('00:00:01.250 --> 00:00:10.500')
    ->and($written)->toContain('<i>Libeflix</i>')
    ->and(substr_count($written, '<i>Libeflix</i>'))->toBe(1)
    ->and($written)->toContain('Hola');

  $movie->refresh();
  expect($movie->subtitles)->not->toBeNull();
});

test('command skips already branded files', function () {
  $movie = createMovieWithSubtitle(brandedVtt());
  $path = 'Brand Movie (2020)/movie_ES.vtt';
  $before = Storage::disk('movies')->get($path);

  $this->artisan('subtitles:ensure-branding', ['--movie' => $movie->id])
    ->expectsOutputToContain('Nothing to update.')
    ->assertSuccessful();

  expect(Storage::disk('movies')->get($path))->toBe($before)
    ->and(substr_count($before, '<i>Libeflix</i>'))->toBe(1);
});

test('command can scope to a single episode', function () {
  $episode = createEpisodeWithSubtitle(unbrandedVtt(), 'EN');
  $path = 'Brand Show/1/1.episode_EN.vtt';

  $this->artisan('subtitles:ensure-branding', ['--episode' => $episode->id])
    ->expectsConfirmation('Rewrite 1 VTT file(s) with Libeflix branding?', 'yes')
    ->assertSuccessful();

  $written = Storage::disk('tvshows')->get($path);

  expect((new SubtitleConverter)->hasBranding($written))->toBeTrue()
    ->and(substr_count($written, '<i>Libeflix</i>'))->toBe(1);

  $episode->refresh();
  expect($episode->subtitles)->toHaveCount(1)
    ->and($episode->subtitles[0]['language_code'])->toBe('EN');
});
