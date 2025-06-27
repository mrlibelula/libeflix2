<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Drop the movie_user table after data has been migrated to watchlists.
     */
    public function up(): void
    {
        Schema::dropIfExists('movie_user');
    }

    /**
     * Reverse the migrations.
     * Recreate the movie_user table if needed for rollback.
     */
    public function down(): void
    {
        Schema::create('movie_user', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('movie_id');
            $table->timestamps();

            $table->unique(['user_id', 'movie_id']);

            $table->foreign('user_id')
                ->references('id')
                ->on('users');

            $table->foreign('movie_id')
                ->references('id')
                ->on('movies');
        });

        // If watchlists table exists, migrate movie data back
        if (Schema::hasTable('watchlists')) {
            DB::statement("
                INSERT INTO movie_user (user_id, movie_id, created_at, updated_at)
                SELECT user_id, watchable_id, created_at, updated_at
                FROM watchlists
                WHERE watchable_type = 'App\\Models\\Movie'
            ");
        }
    }
}; 