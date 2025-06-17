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
        Schema::create('search_query_tvshows', function (Blueprint $table) {
            $table->id();
            
            // User and query information
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->string('query');
            
            // Search results metadata
            $table->integer('results_count')->default(0);
            $table->json('results_summary')->nullable(); // Array of top results with basic info
            $table->boolean('has_results')->default(false);
            $table->string('search_type')->default('real_time'); // 'real_time', 'delayed_log', 'comprehensive', 'click_fallback'
            
            // Request metadata
            $table->string('source_page')->nullable(); // Page where search was initiated
            $table->string('ip_address')->nullable();
            $table->text('user_agent')->nullable();
            
            // Click tracking - when user clicks on a result
            $table->timestamp('clicked_result_at')->nullable();
            $table->string('clicked_result_type')->nullable(); // 'tvshow', 'season', 'episode'
            $table->integer('time_to_click_ms')->nullable(); // Time from search to click
            
            // TV Show information (always present for any click)
            $table->unsignedBigInteger('clicked_tvshow_id')->nullable();
            $table->string('clicked_tvshow_title')->nullable();
            $table->string('clicked_tvshow_slug')->nullable();
            
            // Season information (for season or episode clicks)
            $table->unsignedBigInteger('clicked_season_id')->nullable();
            $table->string('clicked_season_name')->nullable();
            $table->integer('clicked_season_number')->nullable();
            
            // Episode information (for episode clicks only)
            $table->unsignedBigInteger('clicked_episode_id')->nullable();
            $table->string('clicked_episode_name')->nullable();
            $table->integer('clicked_episode_number')->nullable();
            
            // Additional result data (JSON for any extra context)
            $table->json('clicked_result_data')->nullable(); // Store full result object for analysis
            
            // Session and debugging data
            $table->json('session_data')->nullable(); // Search time, filters, etc.
            
            $table->timestamps();
            
            // Indexes for better performance
            $table->index(['user_id', 'query']);
            $table->index(['user_id', 'created_at']);
            $table->index(['query', 'has_results']);
            $table->index(['clicked_result_type', 'clicked_result_at']);
            $table->index(['clicked_tvshow_id', 'clicked_result_at']);
            $table->index(['search_type', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('search_query_tvshows');
    }
};
