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
        Schema::create('tvshows', function (Blueprint $table) {
            $table->id();
            $table->string('folder_name');
            $table->unsignedBigInteger('tmdb_id')->unique();
            $table->string('name');
            $table->string('original_name');
            $table->string('genre_ids')->default(json_encode([]));
            $table->string('poster_path')->nullable();
            $table->string('backdrop_path')->nullable();
            $table->string('original_language')->nullable();
            $table->string('overview')->nullable();
            $table->float('popularity')->nullable();
            $table->string('first_air_date')->nullable();
            $table->float('vote_average')->nullable();
            $table->integer('vote_count')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('tvshows');
    }
};
