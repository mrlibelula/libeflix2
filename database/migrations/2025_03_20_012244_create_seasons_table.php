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
        Schema::create('seasons', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tmdb_id')->unique();
            $table->foreignId('tvshow_id')->constrained('tvshows')->onDelete('cascade');
            $table->string('name');
            $table->string('overview')->nullable();
            $table->string('poster_path')->nullable();
            $table->string('air_date')->nullable();
            $table->integer('episode_count')->nullable();
            $table->integer('season_number')->nullable();
            $table->float('vote_average')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('seasons');
    }
};
