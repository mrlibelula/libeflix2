<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('party_rooms', function (Blueprint $table) {
            $table->foreignId('episode_repeat_updated_by')
                ->nullable()
                ->after('episode_repeat_mode')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('episode_repeat_updated_at')
                ->nullable()
                ->after('episode_repeat_updated_by');
        });
    }

    public function down(): void
    {
        Schema::table('party_rooms', function (Blueprint $table) {
            $table->dropConstrainedForeignId('episode_repeat_updated_by');
            $table->dropColumn('episode_repeat_updated_at');
        });
    }
};
