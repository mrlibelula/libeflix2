<?php

namespace App\Models;

use App\Services\Tool;
use App\Traits\Likeable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOneThrough;

class Episode extends Model
{
    use Likeable;
    
    protected $guarded = [];
    protected $appends = ['stillUrl'];
    protected $casts = [
        'credits' => 'array',
        'subtitles' => 'array',
        'language_video_files' => 'array',
    ];

    public function season(): BelongsTo
    {
        return $this->belongsTo(Season::class, 'season_id');
    }

    public function tvshow(): HasOneThrough
    {
        return $this->hasOneThrough(Tvshow::class, Season::class, 'id', 'id', 'season_id', 'tvshow_id');
    }

    public function getStillUrlAttribute(): string
    {
        if (!$this->still_path) {
            return env('DEFAULT_EPISODE_STILL_IMAGE_URL');
        }

        return env('TMDB_IMAGE_BASE_URL_300') . $this->still_path;
    }
    
    /**
     * Get the subtitles attribute with standardized format
     * 
     * @param mixed $value
     * @return array
     */
    public function getSubtitlesAttribute($value)
    {
        if (empty($value)) {
            return [];
        }
        
        // Decode JSON string if needed
        $subtitles = is_string($value) ? json_decode($value, true) : $value;
        
        if (!is_array($subtitles)) {
            return [];
        }
        
        // Standardize each subtitle entry
        return collect($subtitles)->map(function ($subtitle) {
            if (!is_array($subtitle)) {
                return null;
            }
            
            // Determine language code
            $languageCode = isset($subtitle['language_code']) ? $subtitle['language_code'] : 
                           (isset($subtitle['lang']) ? $subtitle['lang'] : null);
                           
            if (!$languageCode) {
                return null;
            }
            
            // Determine file path
            $filePath = isset($subtitle['file_path']) ? $subtitle['file_path'] : 
                       (isset($subtitle['subtFilePath']) ? $subtitle['subtFilePath'] : null);
                       
            if (!$filePath) {
                return null;
            }
            
            // Return standardized format
            return [
                'language_code' => $languageCode,
                'language_name' => Tool::getLanguageForSubtitleLabel($languageCode),
                'encFilePath' => Tool::encode($filePath),
            ];
        })
        ->filter() // Remove null entries
        ->values() // Re-index array
        ->toArray();
    }


}
