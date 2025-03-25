<?php

namespace App\Services;

class Tool
{
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