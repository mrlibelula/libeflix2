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
        Schema::create('comments', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->text('content');
            $table->morphs('commentable'); // This creates commentable_id and commentable_type columns
            $table->foreignId('parent_id')->nullable()->constrained('comments')->onDelete('cascade'); // For nested comments
            $table->timestamps();

            // Add indexes for better performance
            $table->index(['commentable_id', 'commentable_type']);
            $table->index(['user_id']);
            $table->index(['parent_id']);
            $table->index(['created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('comments');
    }
};
