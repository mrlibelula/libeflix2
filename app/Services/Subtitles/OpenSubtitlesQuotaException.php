<?php

namespace App\Services\Subtitles;

use RuntimeException;

class OpenSubtitlesQuotaException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly ?string $resetTimeUtc = null,
        public readonly ?int $remaining = null,
    ) {
        parent::__construct($message);
    }
}
