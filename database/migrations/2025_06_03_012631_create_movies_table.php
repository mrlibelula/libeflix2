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
        Schema::create('movies', function (Blueprint $table) {
            $table->id();
            $table->string('slug')->index()->unique();
            $table->string('original_name')->index();
            $table->string('title')->index();
            $table->mediumText('alternative_titles')->index()->nullable(); //json
            $table->mediumText('keywords')->index()->nullable(); //json
            $table->string('disk')->nullable();
            $table->string('path');
            $table->string('google_drive_file_id')->nullable();
            $table->mediumText('trailers')->nullable(); //json
            $table->string('poster_path')->nullable();
            $table->string('backdrop_path')->nullable();
            $table->mediumText('genres')->index()->nullable(); //json
            $table->mediumText('credits')->index()->nullable(); //json
            $table->mediumText('images')->nullable(); //json
            $table->float('vote_average')->nullable();
            $table->integer('runtime')->nullable();
            $table->string('release_date')->nullable();
            $table->string('tagline')->index()->nullable();
            $table->text('overview')->index()->nullable();
            $table->boolean('is_free')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('movies');
    }
};
