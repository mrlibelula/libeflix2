<?php

namespace App\Services;

class Tool
{
    /**
     * Convert vote average to stars
     * Scale: 0-10 maps to 0-5 stars
     * Returns in half-star increments: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5
     * Always returns at least one decimal place (e.g., 4.0, 3.5)
     * Based on vote count, the rating is reduced by 10% if less than 10 votes
     * Since its an MVP project, no Bayesian average is applied
     * 
     * @param float $voteAverage
     * @param int $voteCount
     * @return float
     */
    public static function voteAvarageToStars(float $voteAverage, int $voteCount = 0): float
    {
        // Convert the 0-10 vote average to a 0-5 star rating
        $starRating = $voteAverage / 2;

        // Round to the nearest 0.5 increment
        $starRating = round($starRating * 2) / 2;

        // Optional: Apply weighting based on vote count (if necessary)
        if ($voteCount < 10) {
            $starRating *= 0.9; // Reduce rating slightly if votes are too few
            $starRating = max(0, round($starRating * 2) / 2); // Keep within valid range
        }

        return $starRating;
    }
    
    /**
     * Get a random item from an array
     *
     * @param array $array
     * @return mixed
     */
    public static function getRandomItem(array $array): mixed
    {
        if (empty($array)) return null;
        return $array[array_rand($array)];
    }
}