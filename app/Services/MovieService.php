<?php

namespace App\Services;

use Illuminate\Support\Facades\Storage;
use OpenAI\Laravel\Facades\OpenAI;

class MovieService
{
    public static function importMovies(string $disk = 'movies')
    {
        $movies = [];
        $movieDirs = Storage::disk($disk)->directories();
        foreach ($movieDirs as $movieDir) {
            // enter the dir and search for *.mp4 files and get the release year from file path
            $files = Storage::disk($disk)->files($movieDir);
            foreach ($files as $file) {
                $movieName = self::extractMovieName($file);
                if (str_contains($file, '.mp4')) {
                    // First, try to find years in parentheses which is the common format for indicating release year
                    $releaseYear = preg_match('/\((\d{4})\)/', $file, $matches);
                    
                    // If no match was found in parentheses, try other patterns but avoid matches at the beginning of the string
                    if (empty($matches)) {
                        // Look for year patterns with some context (avoid matching at the beginning of string)
                        preg_match('/[^0-9a-zA-Z](\d{4})[^0-9a-zA-Z]/', $file . ' ', $matches); // Adding space to handle end of string
                    }
                    
                    // If we still don't have a match, try to get the release year from OpenAI
                    if (empty($matches)) {
                        echo 'Searching in OpenAI: ' . $movieName . PHP_EOL;
                        if ($movieName) {
                            $releaseYear = self::getMovieReleaseYearFromOpenAI($movieName);
                            if ($releaseYear) {
                                $matches = [
                                    'OpenAI',
                                    (string)$releaseYear
                                ];
                            }
                        }
                    }
                    
                    $movies[] = [
                        'name' => $movieName,
                        // 'file_path' => $file, 
                        'release_year' => (int)$matches[1] ?? 0,
                        'pick' => 0,
                    ];
                }
            }
        }

        info($movies);

        // return $movies;
    }
    
    /**
     * Extract movie name from file path
     */
    private static function extractMovieName(string $filePath): ?string
    {
        // Get the base directory name (usually contains the movie name)
        $parts = explode('/', $filePath);
        $dirName = $parts[0];
        
        // Remove common non-name parts 
        $dirName = preg_replace('/\(\d{4}\)/', '', $dirName); // Remove (YYYY)
        $dirName = preg_replace('/\[\d{4}\]/', '', $dirName); // Remove [YYYY]
        $dirName = preg_replace('/\[\d+p\]/', '', $dirName); // Remove [1080p]
        
        // Remove common file indicators
        $dirName = preg_replace('/\.(mp4|avi|mkv|mov|wmv)$/i', '', $dirName); 
        
        // Comprehensive list of technical terms to remove
        $techTerms = [
            // Video quality and formats
            'BluRay', 'BRRip', 'WEB-DL', 'WEBRip', 'HDRip', 'DVDRip', 'XviD', 'x264', 'x265', 'HEVC', 
            'H264', 'H.264', 'AAC', 'AC3', 'DTS', '5\.1', '5 1Ch', 'DD5\.1', 'DDP5\.1', '720p', '1080p', '4K',
            'HDTV', 'WEB', 'REMUX', 'BDRip', 'NTSC', 'PAL', 'MBLURAY', 'HDTVRip', 'mp4', 'avi', 'mkv',
            'DTS-ES', 'Widescreen', '35mm', '480p', 'x264', 'X264', 'X 264', 'DolbyDigital',
            
            // Technical identifiers
            'low audio quality', 'Audio', 'film', 'movie', 'cut', 'trilogy', 'DVDRip', 'DROCK', 'arc',
            'DIRECTORS', 'EXTENDED', 'UNRATED', 'IMAX', 'PROPER', 'REPACK', 'REMASTERED',
            'Ultimate', 'Hunter', 'Edition', 'Mind Bending',
            
            // Release groups and identifiers
            'YIFY', 'RARBG', 'YTS', '\[YTS\..+?\]', 'ETRG', 'BOKUTOX', 'SADPANDA', 'bitloks', 'Deceit',
            'TGx', 'GalaxyRG', 'BONE', 'vHD', 'PublicHD', 'CtrlHD', 'anoXmous', 'CMRG', 'hotpena', 
            'FKKHD', 'NVEE', 'AM', 'AG', 'LT', 'CM', 'EVO', 'SN', 'RBB', 'MX', 'BGR', 'sujaidr', 
            'SUJAIDR', 'GBM', 'THC', 'S4A', 'TiTAN', 'VLiS', 'ViGi', 'GokU61', 'JYK', 'Ozlem', 'DRT', 
            'ECE', 'aXXo', 'Team Nanban', 'MVGroup', 'org', 'TeleSync', 'MultiAudio', 'COLLECTiVE', 
            'MBLURAYFANS', 'DTS-JYK', 'AC3-JYK', 'rECOn', 'EbP', 'X26',
            'nickarad', 'PSA', 'Plex', 'A Release Lounge',
            
            // Language and subtitle info
            'DUAL', 'Dual Audio', 'ESN', 'MEX', 'dual', 'lat', 'Eng Subs', 'Eng NL Subs', 'iTALiAN',
            'Eng', 'Subs', 'NL',
            
            // File size and other metadata
            '800MB', '10bit', '6CH', '4x Dvd set bootleg', '1088x576'
        ];
        
        // First, directly remove any year patterns (YYYY) that are not at the beginning
        $dirName = preg_replace('/(?<!^)\b\d{4}\b/', '', $dirName);
        
        // Build a pattern that removes these terms regardless of case and surrounding delimiters
        $techPattern = '/\b(' . implode('|', $techTerms) . ')\b/i';
        
        // Apply pattern removal multiple times to catch nested terms
        for ($i = 0; $i < 3; $i++) {
            $dirName = preg_replace($techPattern, '', $dirName);
        }
        
        // Remove any leftover brackets, parentheses, and common separators
        $dirName = preg_replace('/[\[\]\(\)\_\-\.]/', ' ', $dirName);
        
        // Clean up multiple spaces
        $dirName = preg_replace('/\s+/', ' ', $dirName);
        
        // Remove trailing commas and other punctuation
        $dirName = rtrim($dirName, ' ,&');
        
        // Trim and clean up
        $dirName = trim($dirName);
        
        return $dirName ?: null;
    }
    
    /**
     * Get movie release year from OpenAI
     */
    private static function getMovieReleaseYearFromOpenAI(string $movieName): ?int
    {
        try {
            // Get base prompt from env
            $promptTemplate = env('OPENAI_MOVIE_RELEASE_YEAR_PROMPT');
            
            // Create prompt with movie name
            $prompt = str_replace('**movieName**', $movieName, $promptTemplate);
            
            // Make API call to OpenAI
            $result = OpenAI::chat()->create([
                'model' => env('OPENAI_MODEL'),
                'messages' => [
                    ['role' => 'user', 'content' => $prompt],
                ],
            ]);
            
            $content = $result->choices[0]->message->content;
            
            // Parse JSON response
            $data = json_decode($content, true);
            
            // Check for releaseYear and cast to int
            if (isset($data['releaseYear'])) {
                return (int) $data['releaseYear'];
            }
            
            // If no valid release year was found, log and return null
            info("Could not determine release year for '$movieName'");
            return null;
        } catch (\Exception $e) {
            info("OpenAI API error: " . $e->getMessage());
            return null;
        }
    }
}
