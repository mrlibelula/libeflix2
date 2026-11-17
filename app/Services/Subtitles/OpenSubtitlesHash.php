<?php

namespace App\Services\Subtitles;

use Illuminate\Support\Facades\Storage;

class OpenSubtitlesHash
{
    /**
     * OpenSubtitles movie hash: file size plus every uint64 in the first and last 64KB.
     * Files smaller than 64KB cannot be hashed.
     */
    public static function fromString(string $contents): ?string
    {
        $size = strlen($contents);
        if ($size < 65536) {
            return null;
        }

        $hash = self::sizeToChunks($size);
        $hash = self::addBuffer($hash, substr($contents, 0, 65536));
        $hash = self::addBuffer($hash, substr($contents, -65536));

        return self::format($hash);
    }

    public static function fromDisk(string $disk, string $path): ?string
    {
        $storage = Storage::disk($disk);
        if (! $storage->exists($path)) {
            return null;
        }

        $size = $storage->size($path);
        if ($size < 65536) {
            return null;
        }

        $stream = $storage->readStream($path);
        if (! is_resource($stream)) {
            return null;
        }

        $head = fread($stream, 65536);
        if (! is_string($head) || strlen($head) < 65536) {
            fclose($stream);

            return null;
        }

        $meta = stream_get_meta_data($stream);
        if (($meta['seekable'] ?? false) === true) {
            fseek($stream, -65536, SEEK_END);
            $tail = fread($stream, 65536);
        } elseif ($size === 65536) {
            $tail = $head;
        } else {
            $rest = stream_get_contents($stream);
            $tail = substr($head.$rest, -65536);
        }

        fclose($stream);

        if (! is_string($tail) || strlen($tail) < 65536) {
            return null;
        }

        $hash = self::sizeToChunks($size);
        $hash = self::addBuffer($hash, $head);
        $hash = self::addBuffer($hash, $tail);

        return self::format($hash);
    }

    /**
     * @return array{0: int, 1: int, 2: int, 3: int}
     */
    private static function sizeToChunks(int $size): array
    {
        return [
            $size & 0xFFFF,
            ($size >> 16) & 0xFFFF,
            ($size >> 32) & 0xFFFF,
            ($size >> 48) & 0xFFFF,
        ];
    }

    /**
     * @param  array{0: int, 1: int, 2: int, 3: int}  $hash
     * @return array{0: int, 1: int, 2: int, 3: int}
     */
    private static function addBuffer(array $hash, string $buffer): array
    {
        $unpacked = unpack('v*', $buffer);
        if ($unpacked === false) {
            return $hash;
        }

        $count = count($unpacked);
        for ($i = 1; $i <= $count; $i += 4) {
            $hash = self::add($hash, [
                $unpacked[$i] ?? 0,
                $unpacked[$i + 1] ?? 0,
                $unpacked[$i + 2] ?? 0,
                $unpacked[$i + 3] ?? 0,
            ]);
        }

        return $hash;
    }

    /**
     * @param  array{0: int, 1: int, 2: int, 3: int}  $left
     * @param  array{0: int, 1: int, 2: int, 3: int}  $right
     * @return array{0: int, 1: int, 2: int, 3: int}
     */
    private static function add(array $left, array $right): array
    {
        $carry = 0;
        $out = [0, 0, 0, 0];

        for ($i = 0; $i < 4; $i++) {
            $sum = $left[$i] + $right[$i] + $carry;
            $out[$i] = $sum & 0xFFFF;
            $carry = $sum >> 16;
        }

        return $out;
    }

    /**
     * @param  array{0: int, 1: int, 2: int, 3: int}  $hash
     */
    private static function format(array $hash): string
    {
        return sprintf('%04x%04x%04x%04x', $hash[3], $hash[2], $hash[1], $hash[0]);
    }
}
