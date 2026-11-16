<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Speed up History page queries ordered by last_watched_at / play aggregates.
     */
    public function up(): void
    {
        Schema::table('watch_progress', function (Blueprint $table) {
            $table->index(
                ['user_id', 'last_watched_at'],
                'watch_progress_user_last_watched_index'
            );
            $table->index(
                ['user_id', 'watchable_type', 'last_watched_at'],
                'watch_progress_user_type_last_watched_index'
            );
        });

        Schema::table('plays', function (Blueprint $table) {
            $table->index(
                ['user_id', 'playable_type', 'playable_id'],
                'plays_user_playable_index'
            );
        });
    }

    public function down(): void
    {
        Schema::table('watch_progress', function (Blueprint $table) {
            $table->dropIndex('watch_progress_user_last_watched_index');
            $table->dropIndex('watch_progress_user_type_last_watched_index');
        });

        Schema::table('plays', function (Blueprint $table) {
            $table->dropIndex('plays_user_playable_index');
        });
    }
};
