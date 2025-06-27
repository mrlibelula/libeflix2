<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * This migration was created before the watchlists table migration.
     * Data migration is handled in 2025_01_15_200000_migrate_data_movie_user_to_watchlists.php
     */
    public function up(): void
    {
        // This migration intentionally does nothing.
        // The actual data migration happens in a later migration after watchlists table is created.
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // This migration intentionally does nothing.
    }
}; 