<?php

namespace App\Http\Controllers;

use App\Services\Tool;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

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
