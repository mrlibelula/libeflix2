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
        Schema::create('episodes', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('tmdb_id')->unique();
            $table->foreignId('season_id')->constrained('seasons')->onDelete('cascade');
            $table->string('name')->nullable();
            $table->string('overview')->nullable();
            $table->string('air_date')->nullable();
            $table->mediumText('crew')->default(json_encode([])); // dropped
            $table->mediumText('guest_stars')->default(json_encode([])); // dropped
            $table->integer('episode_number')->nullable();
            $table->string('production_code')->nullable();
            $table->integer('runtime')->nullable();
            $table->integer('season_number')->nullable();
            $table->string('still_path')->nullable();
            $table->float('vote_average')->nullable();
            $table->integer('vote_count')->nullable();
            $table->mediumText('credits')->default(json_encode([]));
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('episodes');
    }
};
