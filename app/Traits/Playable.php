<?php

namespace App\Traits;

use App\Models\Play;
use Illuminate\Database\Eloquent\Relations\MorphMany;

trait Playable
{
    /**
     * Get all plays for this content.
     */
    public function plays(): MorphMany
    {
        return $this->morphMany(Play::class, 'playable');
    }

    /**
     * Get total play count (including duplicates).
     */
    public function playsCount(): int
    {
        return $this->plays()->count();
    }

    /**
     * Get unique users who have played this content.
     */
    public function uniquePlayersCount(): int
    {
        return $this->plays()->distinct('user_id')->count('user_id');
    }

    /**
     * Get average completion percentage for all plays.
     */
    public function averageCompletionPercentage(): float
    {
        return (float) $this->plays()->avg('completion_percentage');
    }
}

