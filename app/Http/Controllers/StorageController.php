<?php

namespace App\Http\Controllers;

use App\Services\Tool;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Illuminate\Http\Response;
class StorageController extends Controller
{
    /**
     * Serve a TV show episode file for streaming
     * 
     * @param string $encFilePath
     * @param string $disk
     * @return BinaryFileResponse
     */
    public function tvshowEpisodeServe(string $encFilePath, string $disk = 'tvshows'): BinaryFileResponse
    {
        $filePath = $this->getFilePath($encFilePath, $disk);

        if (!file_exists($filePath)) {
            abort(404, 'Video file not found');
        }

        return response()->file($filePath, [
            'Content-Type' => 'video/mp4',
        ]);
    }

    /** 
     * Serve a TV show episode subtitles file for streaming
     * 
     * @param string $encFilePath
     * @param string $disk
     * @return \Illuminate\Http\Response
     */
    public function tvshowSubtitlesServe(string $encFilePath, string $disk = 'tvshows'): Response
    {
        try {
            $filePath = $this->getFilePath($encFilePath, $disk);
            
            if (!file_exists($filePath)) {
                Log::error('Subtitles file not found: ' . $filePath);
                abort(404, 'Subtitles file not found'); 
            }
            
            // Instead of BinaryFileResponse, use a regular response with file content
            // This allows us to add headers that might be stripped by BinaryFileResponse
            $content = file_get_contents($filePath);
            
            return response($content)
                ->header('Content-Type', 'text/vtt')
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Access-Control-Allow-Methods', 'GET, OPTIONS')
                ->header('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept, Authorization, X-Request-With')
                ->header('Cache-Control', 'public, max-age=3600');
        } catch (\Exception $e) {
            Log::error('Error serving subtitle file: ' . $e->getMessage());
            abort(500, 'Error serving subtitle file');
        }
    }

    /**
     * Get the file path
     * 
     * @param string $encFilePath
     * @param string $disk
     * @return string
     */
    private function getFilePath(string $encFilePath, string $disk): string
    {
        return Storage::disk($disk)->path(Tool::decode($encFilePath));
    }
}
