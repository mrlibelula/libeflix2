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
        Schema::create('watchlists', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('watchable_id');
            $table->string('watchable_type');
            $table->timestamps();

            $table->unique(['user_id', 'watchable_id', 'watchable_type'], 'watchlists_user_watchable_unique');
            $table->index(['watchable_id', 'watchable_type'], 'watchlists_watchable_index');
            $table->index(['user_id'], 'watchlists_user_index');

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
        Schema::dropIfExists('watchlists');
    }
}; 