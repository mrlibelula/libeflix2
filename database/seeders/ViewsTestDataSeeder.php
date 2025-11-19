<?php

namespace Database\Seeders;

use App\Models\Episode;
use App\Models\Movie;
use App\Models\User;
use App\Models\View;
use App\Models\WatchProgress;
use Illuminate\Database\Seeder;

class ViewsTestDataSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $this->command->info('Creating test views data for analytics...');

        // Get or create some users
        $users = User::limit(5)->get();
        if ($users->count() === 0) {
            $this->command->warn('No users found. Please create users first.');
            return;
        }

        // Get some movies and episodes
        $movies = Movie::limit(10)->get();
        $episodes = Episode::limit(10)->get();

        if ($movies->count() === 0 && $episodes->count() === 0) {
            $this->command->warn('No movies or episodes found. Please add content first.');
            return;
        }

        $viewsCreated = 0;
        $progressCreated = 0;

        // Create views for the last 30 days
        foreach ($users as $user) {
            // Create views for movies
            foreach ($movies->random(min(5, $movies->count())) as $movie) {
                // Random date within last 30 days
                $daysAgo = rand(0, 30);
                $hoursAgo = rand(0, 23);
                $viewedAt = now()->subDays($daysAgo)->subHours($hoursAgo);

                // Create view if it doesn't exist
                $view = View::firstOrCreate(
                    [
                        'user_id' => $user->id,
                        'viewable_id' => $movie->id,
                        'viewable_type' => Movie::class,
                    ],
                    [
                        'viewed_at' => $viewedAt,
                    ]
                );

                if ($view->wasRecentlyCreated) {
                    $viewsCreated++;
                }

                // Create some watch progress
                $progress = rand(10, 100);
                WatchProgress::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'watchable_id' => $movie->id,
                        'watchable_type' => Movie::class,
                    ],
                    [
                        'current_time' => rand(600, 7200),
                        'duration' => 7200,
                        'progress_percentage' => $progress,
                        'completed' => $progress >= 70,
                        'last_watched_at' => $viewedAt,
                    ]
                );
                $progressCreated++;
            }

            // Create views for episodes
            foreach ($episodes->random(min(5, $episodes->count())) as $episode) {
                $daysAgo = rand(0, 30);
                $hoursAgo = rand(0, 23);
                $viewedAt = now()->subDays($daysAgo)->subHours($hoursAgo);

                $view = View::firstOrCreate(
                    [
                        'user_id' => $user->id,
                        'viewable_id' => $episode->id,
                        'viewable_type' => Episode::class,
                    ],
                    [
                        'viewed_at' => $viewedAt,
                    ]
                );

                if ($view->wasRecentlyCreated) {
                    $viewsCreated++;
                }

                // Create some watch progress
                $progress = rand(10, 100);
                WatchProgress::updateOrCreate(
                    [
                        'user_id' => $user->id,
                        'watchable_id' => $episode->id,
                        'watchable_type' => Episode::class,
                    ],
                    [
                        'current_time' => rand(300, 2400),
                        'duration' => 2400,
                        'progress_percentage' => $progress,
                        'completed' => $progress >= 70,
                        'last_watched_at' => $viewedAt,
                    ]
                );
                $progressCreated++;
            }
        }

        $this->command->info("✓ Created {$viewsCreated} new views");
        $this->command->info("✓ Created/Updated {$progressCreated} watch progress entries");
        $this->command->info('Test data seeding complete!');
    }
}

