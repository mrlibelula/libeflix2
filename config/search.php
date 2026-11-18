<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Search result limits
    |--------------------------------------------------------------------------
    |
    | Controllers clamp the request "limit" between these values so short
    | queries cannot load unbounded episode/movie rows into PHP memory.
    |
    */

    'default_limit' => (int) env('SEARCH_DEFAULT_LIMIT', 48),

    'max_limit' => (int) env('SEARCH_MAX_LIMIT', 100),

];
