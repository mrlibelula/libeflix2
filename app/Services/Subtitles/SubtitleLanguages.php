<?php

namespace App\Services\Subtitles;

class SubtitleLanguages
{
    /**
     * Two-letter codes stored in filenames (`basename_EN.vtt`).
     * Episode scanning only accepts [A-Z]{2}.
     *
     * @var array<string, string>
     */
    public const LIST = [
        'EN' => 'English',
        'ES' => 'Español',
        'FR' => 'French',
        'DE' => 'German',
        'IT' => 'Italian',
        'PT' => 'Portuguese',
        'BR' => 'Portuguese (Br)',
        'CN' => 'Chinese',
        'JP' => 'Japanese',
        'SE' => 'Swedish',
        'KR' => 'Korean',
        'NL' => 'Dutch',
        'RU' => 'Russian',
        'AR' => 'Arabic',
        'HI' => 'Hindi',
        'TR' => 'Turkish',
        'PL' => 'Polish',
    ];

    /**
     * @return array<int, string>
     */
    public static function codes(): array
    {
        return array_keys(self::LIST);
    }

    public static function isAllowed(string $code): bool
    {
        return isset(self::LIST[strtoupper($code)]);
    }

    public static function name(string $code): string
    {
        return self::LIST[strtoupper($code)] ?? strtoupper($code);
    }

    /**
     * @return array<int, array{code: string, name: string}>
     */
    public static function options(): array
    {
        $options = [];
        foreach (self::LIST as $code => $name) {
            $options[] = ['code' => $code, 'name' => $name];
        }

        return $options;
    }

    /**
     * Map an OpenSubtitles or filename token onto our two-letter code.
     */
    public static function normalize(?string $token): ?string
    {
        if ($token === null) {
            return null;
        }

        $key = strtolower(str_replace('_', '-', trim($token)));
        if ($key === '') {
            return null;
        }

        $map = [
            'en' => 'EN', 'eng' => 'EN', 'english' => 'EN',
            'es' => 'ES', 'spa' => 'ES', 'spanish' => 'ES', 'espanol' => 'ES', 'español' => 'ES',
            'fr' => 'FR', 'fre' => 'FR', 'fra' => 'FR', 'french' => 'FR',
            'de' => 'DE', 'ger' => 'DE', 'deu' => 'DE', 'german' => 'DE',
            'it' => 'IT', 'ita' => 'IT', 'italian' => 'IT',
            'pt-br' => 'BR', 'ptbr' => 'BR', 'pob' => 'BR', 'pb' => 'BR', 'br' => 'BR', 'brazilian' => 'BR',
            'pt' => 'PT', 'por' => 'PT', 'portuguese' => 'PT',
            'zh' => 'CN', 'zh-cn' => 'CN', 'zh-hans' => 'CN', 'chi' => 'CN', 'zho' => 'CN', 'cn' => 'CN', 'chinese' => 'CN',
            'ja' => 'JP', 'jp' => 'JP', 'jpn' => 'JP', 'japanese' => 'JP',
            'sv' => 'SE', 'se' => 'SE', 'swe' => 'SE', 'swedish' => 'SE',
            'ko' => 'KR', 'kr' => 'KR', 'kor' => 'KR', 'korean' => 'KR',
            'nl' => 'NL', 'dut' => 'NL', 'nld' => 'NL', 'dutch' => 'NL',
            'ru' => 'RU', 'rus' => 'RU', 'russian' => 'RU',
            'ar' => 'AR', 'ara' => 'AR', 'arabic' => 'AR',
            'hi' => 'HI', 'hin' => 'HI', 'hindi' => 'HI',
            'tr' => 'TR', 'tur' => 'TR', 'turkish' => 'TR',
            'pl' => 'PL', 'pol' => 'PL', 'polish' => 'PL',
        ];

        $code = $map[$key] ?? null;

        return $code !== null && self::isAllowed($code) ? $code : null;
    }

    /**
     * OpenSubtitles language parameter for one of our codes.
     */
    public static function toOpenSubtitles(string $code): string
    {
        return match (strtoupper($code)) {
            'BR' => 'pt-BR',
            'CN' => 'zh-CN',
            'JP' => 'ja',
            'SE' => 'sv',
            'KR' => 'ko',
            default => strtolower($code),
        };
    }

    public static function guessFromFilename(string $filename): ?string
    {
        $base = pathinfo($filename, PATHINFO_FILENAME);
        if ($base === '') {
            return null;
        }

        if (preg_match('/[._-]([A-Za-z]{2,3}(?:-[A-Za-z]{2,4})?)$/', $base, $matches)) {
            $guess = self::normalize($matches[1]);
            if ($guess !== null) {
                return $guess;
            }
        }

        $tokens = preg_split('/[._\-\s]+/', $base) ?: [];
        foreach (array_reverse($tokens) as $token) {
            if (strlen($token) < 3) {
                continue;
            }
            $guess = self::normalize($token);
            if ($guess !== null) {
                return $guess;
            }
        }

        return null;
    }
}
