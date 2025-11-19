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
        Schema::create('plays', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->onDelete('cascade');
            $table->morphs('playable'); // playable_id, playable_type
            $table->integer('watch_duration')->default(0); // How long they watched in seconds
            $table->integer('media_duration')->default(0); // Total media duration in seconds
            $table->float('completion_percentage')->default(0); // Percentage completed
            $table->timestamps();
            
            // No unique constraint - allows multiple plays by same user
            $table->index(['playable_id', 'playable_type']);
            $table->index('user_id');
            $table->index('created_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('plays');
    }
};

