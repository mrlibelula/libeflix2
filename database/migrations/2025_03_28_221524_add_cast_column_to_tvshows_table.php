<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('tvshows', function (Blueprint $table) {
            $table->mediumText('cast')->default(json_encode([]))->after('created_by');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('tvshows', function (Blueprint $table) {
            $table->dropColumn('cast');
        });
    }
};
