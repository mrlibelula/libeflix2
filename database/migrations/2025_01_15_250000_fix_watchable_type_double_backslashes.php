<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Fix any watchable_type values that have double backslashes.
     */
    public function up(): void
    {
        if (Schema::hasTable('watchlists')) {
            // Fix double backslashes in watchable_type for all possible model types
            $modelTypes = [
                'App\\\\Models\\\\Movie' => 'App\\Models\\Movie',
                'App\\\\Models\\\\Tvshow' => 'App\\Models\\Tvshow',
                'App\\\\Models\\\\Season' => 'App\\Models\\Season',
                'App\\\\Models\\\\Episode' => 'App\\Models\\Episode',
            ];

            foreach ($modelTypes as $wrongType => $correctType) {
                DB::table('watchlists')
                    ->where('watchable_type', $wrongType)
                    ->update(['watchable_type' => $correctType]);
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        if (Schema::hasTable('watchlists')) {
            // Revert back to double backslashes (though this is not recommended)
            $modelTypes = [
                'App\\Models\\Movie' => 'App\\\\Models\\\\Movie',
                'App\\Models\\Tvshow' => 'App\\\\Models\\\\Tvshow',
                'App\\Models\\Season' => 'App\\\\Models\\\\Season',
                'App\\Models\\Episode' => 'App\\\\Models\\\\Episode',
            ];

            foreach ($modelTypes as $correctType => $wrongType) {
                DB::table('watchlists')
                    ->where('watchable_type', $correctType)
                    ->update(['watchable_type' => $wrongType]);
            }
        }
    }
}; 