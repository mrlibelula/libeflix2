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
        Schema::create('watch_progress', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('watchable_id');
            $table->string('watchable_type');
            $table->integer('current_time')->default(0); // in seconds
            $table->integer('duration')->nullable(); // total duration in seconds
            $table->decimal('progress_percentage', 5, 2)->default(0); // 0.00 to 100.00
            $table->boolean('completed')->default(false);
            $table->timestamp('last_watched_at')->useCurrent();
            $table->timestamps();

            // Indexes
            $table->index(['watchable_id', 'watchable_type'], 'watch_progress_watchable_index');
            $table->index(['user_id'], 'watch_progress_user_index');
            $table->unique(['user_id', 'watchable_id', 'watchable_type'], 'watch_progress_unique');

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('watch_progress');
    }
};

