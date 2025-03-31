<?php

namespace App\Services;

use App\Models\Tvshow;
use Illuminate\Support\Facades\Storage;

class SeasonService
{
    /**
     * Check if a season folder exists in the storage
     * 
     * @param int $seasonNumberToCheck
     * @param Tvshow $tvshow
     * @param string $disk
     * @return bool
     */
    public static function isThereSeasonFolder(int $seasonNumberToCheck, Tvshow $tvshow, string $disk = 'tvshows'): bool
    {
        $storage = Storage::disk($disk);
        $searchPath = $tvshow->folder_name . '/' . $seasonNumberToCheck;
        return $storage->exists($searchPath);
    }
}


