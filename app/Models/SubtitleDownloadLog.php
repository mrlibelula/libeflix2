<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SubtitleDownloadLog extends Model
{
    protected $guarded = [];

    protected $casts = [
        'was_cached' => 'boolean',
        'file_id' => 'integer',
        'target_id' => 'integer',
        'remaining_after' => 'integer',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
