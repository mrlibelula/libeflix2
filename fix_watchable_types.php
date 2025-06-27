<?php

/**
 * Standalone script to fix watchable_type values that have double backslashes
 * in the watchlists table.
 * 
 * Run this script from the project root:
 * php fix_watchable_types.php
 */

require_once __DIR__ . '/vendor/autoload.php';

// Load Laravel app
$app = require_once __DIR__ . '/bootstrap/app.php';
$app->make(\Illuminate\Contracts\Console\Kernel::class)->bootstrap();

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

try {
    if (!Schema::hasTable('watchlists')) {
        echo "❌ Watchlists table does not exist.\n";
        exit(1);
    }

    echo "🔍 Checking for watchable_type values with double backslashes...\n";

    // Define the mapping of incorrect to correct values
    $modelTypes = [
        'App\\\\Models\\\\Movie' => 'App\\Models\\Movie',
        'App\\\\Models\\\\Tvshow' => 'App\\Models\\Tvshow',
        'App\\\\Models\\\\Season' => 'App\\Models\\Season',
        'App\\\\Models\\\\Episode' => 'App\\Models\\Episode',
    ];

    $totalFixed = 0;

    foreach ($modelTypes as $wrongType => $correctType) {
        echo "🔧 Checking for '{$wrongType}'...\n";
        
        $count = DB::table('watchlists')
            ->where('watchable_type', $wrongType)
            ->count();

        if ($count > 0) {
            echo "   Found {$count} records with incorrect type.\n";
            
            $updated = DB::table('watchlists')
                ->where('watchable_type', $wrongType)
                ->update(['watchable_type' => $correctType]);
            
            echo "   ✅ Updated {$updated} records to '{$correctType}'.\n";
            $totalFixed += $updated;
        } else {
            echo "   ✓ No records found with this incorrect type.\n";
        }
    }

    echo "\n🎉 Fixed {$totalFixed} records in total.\n";

    // Show current distribution of watchable_types
    echo "\n📊 Current watchable_type distribution:\n";
    $distribution = DB::table('watchlists')
        ->selectRaw('watchable_type, COUNT(*) as count')
        ->groupBy('watchable_type')
        ->orderBy('count', 'desc')
        ->get();

    foreach ($distribution as $row) {
        echo "   {$row->watchable_type}: {$row->count} records\n";
    }

} catch (Exception $e) {
    echo "❌ Error: " . $e->getMessage() . "\n";
    exit(1);
}

echo "\n✨ Script completed successfully!\n"; 