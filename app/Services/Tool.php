<?php

namespace App\Services;

use App\Models\Movie;
use App\Models\TvShow;

class Tool
{

    protected const ENCODING_OFFSET = 123456789;
    protected static string $alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    /**
     * Tether conversion calculator.
     * This method is used to calculate the conversion of USDT to BOB and vice versa.
     * It also calculates the fee and the final amount.
     * It also returns the summary of the conversion.
     * direction: 'usdt_to_bob' or 'bob_to_usdt'
     * 
     * @param float $amount
     * @param float $price
     * @param float $fee
     * @param string $direction
     * @return array
     */
    public static function tetherConversionCalculator(float $amount, float $price, float $fee = 0.05, string $direction = 'usdt_to_bob'): array
    {
        // only in command line
        if (PHP_SAPI !== 'cli') {
            throw new \Exception('This method can only be used in command line interface');
        }

        // Validate direction parameter
        if (!in_array($direction, ['usdt_to_bob', 'bob_to_usdt'])) {
            throw new \InvalidArgumentException('Direction must be either "usdt_to_bob" or "bob_to_usdt"');
        }

        // Validate inputs
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Amount must be greater than 0');
        }

        if ($price <= 0) {
            throw new \InvalidArgumentException('Price must be greater than 0');
        }

        if ($fee < 0 || $fee >= 1) {
            throw new \InvalidArgumentException('Fee must be between 0 and 1 (0% to 99%)');
        }

        // Calculate conversion based on direction
        if ($direction === 'usdt_to_bob') {
            // Convert USDT to BOB: amount * exchange_rate
            $convertedAmount = $amount * $price;
            $targetCurrency = 'BOB';
            $sourceCurrency = 'USDT';
        } else {
            // Convert BOB to USDT: amount / exchange_rate
            $convertedAmount = $amount / $price;
            $targetCurrency = 'USDT';
            $sourceCurrency = 'BOB';
        }

        // Apply transaction fee (subtract fee from the converted amount)
        $finalAmount = $convertedAmount * (1 - $fee);

        // Return array with converted amount and currency information
        return [
            'original_amount' => $amount,
            'original_currency' => $sourceCurrency,
            'net_total' => round($convertedAmount, 6), // Amount before fees
            'fee_amount' => round($convertedAmount - $finalAmount, 6), // Fee in target currency
            'fee_currency' => $targetCurrency, // Currency of the fee
            'converted_amount' => round($finalAmount, 6), // Final amount after fees
            'target_currency' => $targetCurrency,
            'exchange_rate' => $price,
            'fee_percentage' => $fee * 100,
            'formatted_net' => number_format(round($convertedAmount, 6), 6) . ' ' . $targetCurrency,
            'formatted_final' => number_format(round($finalAmount, 6), 6) . ' ' . $targetCurrency,
            'summary' => [
                'direction' => $direction,
                'price' => $direction === 'usdt_to_bob' ? (1 . " {$sourceCurrency} = " . $price . " {$targetCurrency}") : ($price . " {$sourceCurrency} = 1 {$targetCurrency}"),
                'conversion' => "{$amount} {$sourceCurrency} = " . number_format(round($convertedAmount, 6), 6) . " {$targetCurrency}",
                'fee_deducted' => number_format(round($convertedAmount - $finalAmount, 6), 6) . " {$targetCurrency} (" . ($fee * 100) . "% fee)",
                'final_amount' => number_format(round($finalAmount, 6), 6) . " {$targetCurrency}"
            ]
        ];
    }

    /**
     * Encodes a number into a 6-character, non-obvious string.
     */
    public static function encodeNumber(int $number): string
    {
        $alphabetLength = strlen(self::$alphabet);
        $encodedString = '';
        
        // Add the offset to the original number
        $numberToEncode = $number + self::ENCODING_OFFSET;

        while ($numberToEncode > 0) {
            $remainder = $numberToEncode % $alphabetLength;
            $encodedString = self::$alphabet[$remainder] . $encodedString;
            $numberToEncode = (int)($numberToEncode / $alphabetLength);
        }

        return str_pad($encodedString, 6, self::$alphabet[0], STR_PAD_LEFT);
    }

    /**
     * Decodes a string back to its original number.
     */
    public static function decodeString(string $encoded): int
    {
        $alphabetLength = strlen(self::$alphabet);
        $decodedNumber = 0;

        foreach (str_split($encoded) as $char) {
            $charPosition = strpos(self::$alphabet, $char);
            if ($charPosition !== false) {
                $decodedNumber = $decodedNumber * $alphabetLength + $charPosition;
            }
        }
        
        // Subtract the same offset to get the original number
        return $decodedNumber - self::ENCODING_OFFSET;
    }

    /**
     * Get "Movies and TV Shows" merged genres, unique. Can be sorted
     *
     * @param bool $sorted
     * @return array
     */
    public static function getMoviesAndTVShowsGenres(bool $sorted = true): array
    {
        $moviesAndTvshowsGenres = collect(array_merge(self::getMoviesGenres(), self::getTVShowsGenres()))->unique()->toArray();
        if ($sorted) sort($moviesAndTvshowsGenres);
        return $moviesAndTvshowsGenres ?? [];
    }

    /**
     * Get "Movies and TV Shows" merged genres with slugs, unique. Can be sorted
     *
     * @param bool $sorted
     * @return array
     */
    public static function getMoviesAndTVShowsGenresWithSlugs(bool $sorted = true): array
    {
        $genres = self::getMoviesAndTVShowsGenres($sorted);
        
        return collect($genres)->map(function ($genre) {
            return [
                'name' => $genre,
                'slug' => \Illuminate\Support\Str::slug($genre)
            ];
        })->toArray();
    }

    /**
     * Get unique "Movies" genres
     *
     * @return array
     */
    public static function getMoviesGenres(): array
    {
        $moviesGenres = Movie::select('genres')->get();
        $moviesGenresSet = collect([]);
        
        $moviesGenres = collect(json_decode($moviesGenres, true));
        $moviesGenres = $moviesGenres->flatten();
        $moviesGenres->each(function ($genre) use ($moviesGenresSet) {
            $genreArr = collect(json_decode($genre));
            $genreArr->each(function ($genre) use ($moviesGenresSet) {
                $moviesGenresSet->push($genre->name);
            });
        });
        
        return $moviesGenresSet->unique()->toArray();
    }

    /**
     * Get unique "TV Shows" genres
     *
     * @return array
     */
    public static function getTVShowsGenres(): array
    {
        $tvShowsGenres = TvShow::select('genres')->get();
        $tvShowsGenres = collect(json_decode($tvShowsGenres, true));
        $tvShowsGenres = $tvShowsGenres->flatten();
        
        // remove all numbers and null values from the array
        $tvShowsGenres = $tvShowsGenres->filter(function ($genre) {
            return !is_numeric($genre) && $genre !== null;
        });

        return $tvShowsGenres->unique()->toArray();
    }

    /**
     * Convert vote average to stars.
     * Scale: 0-10 maps to 0-5 stars.
     * Returns in half-star increments: 0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5.
     * Always returns at least one decimal place (e.g., 4.0, 3.5).
     * Based on vote count, the rating is reduced by 10% if less than 10 votes.
     * Since its an MVP project, no Bayesian average is applied.
     * 
     * @param float $voteAverage
     * @param int $voteCount
     * @return float
     */
    public static function voteAvarageToStars(float $voteAverage, int $voteCount = 0): float
    {
        // Convert the 0-10 vote average to a 0-5 star rating
        $starRating = $voteAverage / 2;

        // Round to the nearest 0.5 increment
        $starRating = round($starRating * 2) / 2;

        // Optional: Apply weighting based on vote count (if necessary)
        if ($voteCount < 10) {
            $starRating *= 0.9; // Reduce rating slightly if votes are too few
            $starRating = max(0, round($starRating * 2) / 2); // Keep within valid range
        }

        return $starRating;
    }
    
    /**
     * Get a random item from an array
     *
     * @param array $array
     * @return mixed
     */
    public static function getRandomItem(array $array): mixed
    {
        if (empty($array)) return null;
        return $array[array_rand($array)];
    }

    /**
     * base64 URL encode
     *
     * @param string $data
     * @return string
     */
    public static function base64UrlEncode(string $data): string
    {
        return rtrim(strtr(base64_encode($data), '+/', '-_'), '=');
    }

    /**
     * base64 URL decode
     *
     * @param string $data
     * @return string
     */
    public static function base64UrlDecode(string $data): string
    {
        // return base64_decode(str_pad(strtr($data, '-_', '+/'), strlen($data) % 4, '=', STR_PAD_RIGHT));
        return base64_decode(strtr($data, '-_', '+/') . str_repeat('=', 3 - (3 + strlen($data)) % 4));
    }

    /**
     * Encrypt encode (enc methods available: 'base_64' or 'laravel')
     *
     * @param string $data, bool $method = 'base_64'
     * @return string
     */
    public static function encode(string $data, string $method = 'base_64'): string
    {
        return $method === 'laravel' ? encrypt($data) : self::base64UrlEncode($data);
    }

    /**
     * Encrypt decode (decode methods available 'base_64' or 'laravel')
     *
     * @param string $data, bool $method = 'base_64'
     * @return string
     */
    public static function decode(string $data, string $method = 'base_64'): string
    {
        return $method === 'laravel' ? decrypt($data) : self::base64UrlDecode($data);
    }

    /**
     * Get language name from short language code for subtitle label
     *
     * @param string $shortLanguage
     * @return string
     */
    public static function getLanguageForSubtitleLabel(string $shortLanguage): string
    {
        $languages = config('app.languages');

        return $languages[strtoupper($shortLanguage)] ?? __('Other');
    }

    /**
     * Get language name from short language code for video label
     *
     * @param string $shortLanguage
     * @return string
     */
    public static function getLanguageForVideoLabel(string $shortLanguage): string
    {
        $languages = config('app.languages');
        // additional acceptable language codes
        $languages = array_merge($languages, config('app.additional-language-codes'));

        return $languages[strtoupper($shortLanguage)] ?? __('Other');
    }
}