<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('subtitle_download_logs', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('target_type', 16); // movie|episode
            $table->unsignedBigInteger('target_id');
            $table->string('title');
            $table->string('language', 8);
            $table->unsignedBigInteger('file_id');
            $table->string('file_name')->nullable();
            $table->boolean('was_cached')->default(false);
            $table->unsignedInteger('remaining_after')->nullable();
            $table->timestamps();

            $table->index(['created_at']);
            $table->index(['target_type', 'target_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('subtitle_download_logs');
    }
};
