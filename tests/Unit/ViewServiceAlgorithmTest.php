<?php

use App\Models\WatchProgress;
use App\Services\ViewService;

test('does not count a view when progress is below thresholds for short content', function () {
    // Short content: 12 minutes (720 seconds)
    // Watching 8 minutes = 66.67% (below 70% and below 10 min threshold)
    $progress = new WatchProgress([
        'duration' => 12 * 60,
        'current_time' => 8 * 60, // 8 minutes watched (66.67%)
        'progress_percentage' => (8 * 60) / (12 * 60) * 100,
        'completed' => false,
    ]);

    expect(ViewService::shouldCountAsView($progress))->toBeFalse();
});

test('counts a view when short content passes 10 minutes watched', function () {
    // Short content: 12 minutes (720 seconds)
    $progress = new WatchProgress([
        'duration' => 12 * 60,
        'current_time' => 10 * 60, // 10 minutes watched
        'progress_percentage' => (10 * 60) / (12 * 60) * 100,
        'completed' => false,
    ]);

    expect(ViewService::shouldCountAsView($progress))->toBeTrue();
});

test('counts a view when short content passes 70 percent watched', function () {
    // Short content: 5 minutes (300 seconds)
    $duration = 5 * 60;
    $currentTime = (int) ceil($duration * 0.71); // just over 70%

    $progress = new WatchProgress([
        'duration' => $duration,
        'current_time' => $currentTime,
        'progress_percentage' => $currentTime / $duration * 100,
        'completed' => false,
    ]);

    expect(ViewService::shouldCountAsView($progress))->toBeTrue();
});

test('does not count a view for long content below 70 percent watched', function () {
    // Long content: 2 hours (7200 seconds)
    $duration = 2 * 60 * 60;
    $currentTime = (int) floor($duration * 0.60); // 60%

    $progress = new WatchProgress([
        'duration' => $duration,
        'current_time' => $currentTime,
        'progress_percentage' => $currentTime / $duration * 100,
        'completed' => false,
    ]);

    expect(ViewService::shouldCountAsView($progress))->toBeFalse();
});

test('counts a view for long content at or above 70 percent watched', function () {
    // Long content: 90 minutes (5400 seconds)
    $duration = 90 * 60;
    $currentTime = (int) ceil($duration * 0.70); // 70%

    $progress = new WatchProgress([
        'duration' => $duration,
        'current_time' => $currentTime,
        'progress_percentage' => $currentTime / $duration * 100,
        'completed' => false,
    ]);

    expect(ViewService::shouldCountAsView($progress))->toBeTrue();
});

test('does not count a view when progress is already marked completed', function () {
    $progress = new WatchProgress([
        'duration' => 60 * 60,
        'current_time' => 50 * 60,
        'progress_percentage' => (50 * 60) / (60 * 60) * 100,
        'completed' => true,
    ]);

    expect(ViewService::shouldCountAsView($progress))->toBeFalse();
});
