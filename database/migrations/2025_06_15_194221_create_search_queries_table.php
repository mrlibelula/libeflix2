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
        Schema::create('search_queries', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('query', 500)->index(); // The search term/query
            $table->integer('results_count')->default(0); // Number of results returned
            $table->json('results_summary')->nullable(); // Summary of results (movie IDs, titles, etc.)
            $table->boolean('has_results')->default(false)->index(); // Quick lookup for successful searches
            $table->string('search_type')->default('real_time')->index(); // 'real_time', 'full_page', etc.
            $table->string('source_page')->nullable()->index(); // Which page the search was performed from
            $table->string('ip_address')->nullable(); // For analytics
            $table->string('user_agent')->nullable(); // Browser/device info
            $table->timestamp('clicked_result_at')->nullable(); // When user clicked a result
            $table->integer('clicked_movie_id')->nullable(); // Which movie was clicked
            $table->string('clicked_movie_title')->nullable(); // Title of clicked movie
            $table->integer('time_to_click_ms')->nullable(); // Time from search to click (milliseconds)
            $table->json('session_data')->nullable(); // Additional session context
            $table->timestamps();
            
            // Indexes for analytics queries
            $table->index(['user_id', 'created_at']);
            $table->index(['query', 'has_results']);
            $table->index(['created_at', 'has_results']);
            $table->index('clicked_movie_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('search_queries');
    }
};
