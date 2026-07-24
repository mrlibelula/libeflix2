<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('party_rooms', function (Blueprint $table) {
            $table->id();
            $table->string('code', 12)->unique();
            $table->string('name');
            $table->foreignId('host_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('status')->default('open'); // open|playing|paused|ended
            $table->boolean('host_only_controls')->default(false);
            $table->boolean('allow_chat')->default(true);
            $table->boolean('allow_voice')->default(true);
            $table->unsignedTinyInteger('max_members')->default(8);
            $table->boolean('is_public')->default(true);
            $table->foreignId('current_queue_item_id')->nullable();
            $table->boolean('is_playing')->default(false);
            $table->float('position_seconds')->default(0);
            $table->timestamp('playback_updated_at')->nullable();
            $table->timestamps();
        });

        Schema::create('party_room_members', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_room_id')->constrained('party_rooms')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('role')->default('member'); // host|member
            $table->timestamp('joined_at')->useCurrent();
            $table->timestamp('last_seen_at')->nullable();
            $table->timestamps();

            $table->unique(['party_room_id', 'user_id']);
        });

        Schema::create('party_queue_items', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_room_id')->constrained('party_rooms')->cascadeOnDelete();
            $table->morphs('watchable');
            $table->unsignedInteger('position')->default(0);
            $table->foreignId('added_by')->constrained('users')->cascadeOnDelete();
            $table->timestamp('played_at')->nullable();
            $table->timestamps();
        });

        Schema::table('party_rooms', function (Blueprint $table) {
            $table->foreign('current_queue_item_id')
                ->references('id')
                ->on('party_queue_items')
                ->nullOnDelete();
        });

        Schema::create('party_chat_messages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_room_id')->constrained('party_rooms')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->string('body', 1000);
            $table->timestamps();
        });

        Schema::create('party_voice_signals', function (Blueprint $table) {
            $table->id();
            $table->foreignId('party_room_id')->constrained('party_rooms')->cascadeOnDelete();
            $table->foreignId('from_user_id')->constrained('users')->cascadeOnDelete();
            $table->foreignId('to_user_id')->constrained('users')->cascadeOnDelete();
            $table->string('type', 32); // offer|answer|ice|mute
            $table->text('payload');
            $table->boolean('consumed')->default(false);
            $table->timestamps();

            $table->index(['party_room_id', 'to_user_id', 'consumed', 'id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('party_voice_signals');
        Schema::dropIfExists('party_chat_messages');
        Schema::table('party_rooms', function (Blueprint $table) {
            $table->dropForeign(['current_queue_item_id']);
        });
        Schema::dropIfExists('party_queue_items');
        Schema::dropIfExists('party_room_members');
        Schema::dropIfExists('party_rooms');
    }
};
