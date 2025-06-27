<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * This migration only migrates data from movie_user to watchlists.
     * The movie_user table will be dropped in a separate migration.
     */
    public function up(): void
    {
        // Only migrate if both tables exist
        if (Schema::hasTable('movie_user') && Schema::hasTable('watchlists')) {
            // Migrate existing movie_user records to watchlists table
            DB::statement("
                INSERT INTO watchlists (user_id, watchable_id, watchable_type, created_at, updated_at)
                SELECT user_id, movie_id, 'App\\Models\\Movie', created_at, updated_at
                FROM movie_user
                WHERE NOT EXISTS (
                    SELECT 1 FROM watchlists 
                    WHERE watchlists.user_id = movie_user.user_id 
                    AND watchlists.watchable_id = movie_user.movie_id 
                    AND watchlists.watchable_type = 'App\\Models\\Movie'
                )
            ");
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove movie records from watchlists table
        if (Schema::hasTable('watchlists')) {
            DB::statement("
                DELETE FROM watchlists 
                WHERE watchable_type = 'App\\Models\\Movie'
            ");
        }
    }
}; 