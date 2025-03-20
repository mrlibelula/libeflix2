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
            $table->string('genres')->default(json_encode([]));
            $table->string('poster_path')->nullable();
            $table->string('backdrop_path')->nullable();
            $table->string('original_language')->nullable();
            $table->string('overview')->nullable();
            $table->float('popularity')->nullable();
            $table->string('first_air_date')->nullable();
            $table->float('vote_average')->nullable();
            $table->integer('vote_count')->nullable();
            $table->mediumText('created_by')->default(json_encode([]));
            $table->string('homepage')->nullable();
            $table->text('languages')->default(json_encode([]));
            $table->mediumText('networks')->default(json_encode([]));
            $table->integer('number_of_episodes')->nullable();
            $table->integer('number_of_seasons')->nullable();
            $table->mediumText('origin_country')->default(json_encode([]));
            $table->mediumText('production_companies')->default(json_encode([]));
            $table->mediumText('production_countries')->default(json_encode([]));
            $table->mediumText('availableSeasons')->default(json_encode([]));
            $table->text('spoken_languages')->default(json_encode([]));
            $table->string('status')->nullable(); 
            $table->string('tagline')->nullable();
            $table->string('type')->nullable();
            $table->mediumText('videos')->default(json_encode([]));
            $table->mediumText('images')->default(json_encode([]));
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
