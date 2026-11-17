<?php

use App\Models\Episode;
use App\Models\Season;
use App\Models\Tvshow;
use App\Services\Subtitles\SubtitleTargetResolver;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
  Storage::fake('tvshows');
});

function createStoredEpisodeWithVideo(): Episode
{
  $show = Tvshow::create([
    'slug' => 'refresh-show',
    'folder_name' => 'Refresh Show',
    'tmdb_id' => 88001,
    'name' => 'Refresh Show',
    'original_name' => 'Refresh Show',
  ]);

  $season = Season::create([
    'tmdb_id' => 880011,
    'tvshow_id' => $show->id,
    'season_number' => 1,
    'name' => 'Season 1',
  ]);

  $videoPath = 'Refresh Show/1/1.episode.mp4';
  Storage::disk('tvshows')->put($videoPath, 'fake-video');

  return Episode::create([
    'tmdb_id' => 880012,
    'season_id' => $season->id,
    'episode_number' => 1,
    'season_number' => 1,
    'name' => 'Pilot',
    'is_in_storage' => $videoPath,
    'subtitles' => null,
  ]);
}

test('episode subtitle refresh stores a single-encoded languages array', function () {
  $episode = createStoredEpisodeWithVideo();
  Storage::disk('tvshows')->put(
    'Refresh Show/1/1.episode_ES.vtt',
    "WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nHola\n"
  );

  $resolver = app(SubtitleTargetResolver::class);
  $target = $resolver->resolve('episode', $episode->id);
  $resolver->refresh($target);

  $episode->refresh();
  $raw = $episode->getAttributes()['subtitles'] ?? null;

  expect($raw)->toBeString();
  expect(json_decode((string) $raw, true))->toBeArray()
    ->and(json_decode((string) $raw, true)[0]['language_code'] ?? null)->toBe('ES');
  // Must not be double-encoded: one decode yields an array, not another JSON string.
  expect(json_decode((string) $raw, true))->not->toBeString();
  expect($episode->subtitles)->toHaveCount(1)
    ->and($episode->subtitles[0]['language_code'])->toBe('ES');
});

test('episode accessor still reads legacy double-encoded subtitles', function () {
  $episode = createStoredEpisodeWithVideo();
  $payload = [[
    'file_path' => 'Refresh Show/1/1.episode_ES.vtt',
    'language_code' => 'ES',
  ]];

  // Simulate the old buggy write (Eloquent array cast + json_encode).
  DB::table('episodes')->where('id', $episode->id)->update([
    'subtitles' => json_encode(json_encode($payload)),
  ]);

  $episode->refresh();

  expect($episode->subtitles)->toHaveCount(1)
    ->and($episode->subtitles[0]['language_code'])->toBe('ES');
});
