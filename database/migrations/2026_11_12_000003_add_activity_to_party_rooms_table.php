<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('party_rooms', function (Blueprint $table) {
            $table->string('activity_type', 32)->nullable()->after('episode_repeat_updated_at');
            $table->foreignId('activity_by')
                ->nullable()
                ->after('activity_type')
                ->constrained('users')
                ->nullOnDelete();
            $table->timestamp('activity_at')->nullable()->after('activity_by');
            $table->json('activity_meta')->nullable()->after('activity_at');
        });
    }

    public function down(): void
    {
        Schema::table('party_rooms', function (Blueprint $table) {
            $table->dropConstrainedForeignId('activity_by');
            $table->dropColumn(['activity_type', 'activity_at', 'activity_meta']);
        });
    }
};
