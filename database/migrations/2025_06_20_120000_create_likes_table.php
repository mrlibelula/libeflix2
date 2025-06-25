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
        Schema::create('likes', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->morphs('likeable'); // This creates likeable_id and likeable_type columns
            $table->timestamps();

            // Add unique constraint to prevent duplicate likes
            $table->unique(['user_id', 'likeable_id', 'likeable_type']);
            
            // Add indexes for better performance
            $table->index(['likeable_id', 'likeable_type']);
            $table->index(['user_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('likes');
    }
}; 