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
        Schema::create('views', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->nullable(); // nullable for guest views
            $table->unsignedBigInteger('viewable_id');
            $table->string('viewable_type');
            $table->timestamp('viewed_at');
            $table->timestamps();

            // Indexes for performance
            $table->index(['viewable_id', 'viewable_type'], 'views_viewable_index');
            $table->index(['user_id'], 'views_user_index');
            $table->unique(['user_id', 'viewable_id', 'viewable_type'], 'views_user_viewable_unique');

            $table->foreign('user_id')
                ->references('id')
                ->on('users')
                ->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('views');
    }
};

