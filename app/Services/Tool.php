<?php

namespace App\Services;

use App\Models\Movie;
use App\Models\TvShow;

class Tool
{

    protected const ENCODING_OFFSET = 123456789;
    protected static string $alphabet = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

    /**
     * Tether conversion calculator for P2P exchanges.
     * This method is used to calculate the conversion of USDT, BOB and USD.
     * It handles flat fees (e.g., 0.05 USDT) commonly used by exchanges like Binance.
     * 
     * IMPORTANT: Fee is only applied when SELLING USDT (usdt_to_bob, usdt_to_usd)
     * No fee is applied when BUYING USDT (bob_to_usdt, usd_to_usdt)
     * 
     * direction: 'usdt_to_bob' or 'bob_to_usdt' or 'usd_to_usdt' or 'usdt_to_usd'.
     * 
     * Examples:
     * - (direction: 'usdt_to_bob', amount: 100, price: 15.26, fee: 0.05) -> 99.95 USDT converted to BOB with 0.05 USDT fee
     * - (direction: 'bob_to_usdt', amount: 3500, price: 15.26, fee: 0.05) -> 3500 BOB converted to USDT with NO fee
     * - (direction: 'usd_to_usdt', amount: 500, price: 1, fee: 0.05) -> 500 USD converted to USDT with NO fee
     * - (direction: 'usdt_to_usd', amount: 500, price: 1, fee: 0.05) -> 499.95 USDT converted to USD with 0.05 USDT fee
     * 
     * @param float $amount
     * @param float $price
     * @param float $fee - Flat fee in USDT (e.g., 0.05 USDT) - only applied when selling USDT
     * @param string $direction
     * @param int $digits - Number of decimal places for rounding
     * @return array
     */
    public static function tetherConversionCalculator(float $amount, float $price, float $fee = 0.05, string $direction = 'usdt_to_bob', int $digits = 6): array
    {
        // only in command line
        if (PHP_SAPI !== 'cli') {
            throw new \Exception('This method can only be used in command line interface');
        }

        // Validate direction parameter
        if (!in_array($direction, ['usdt_to_bob', 'bob_to_usdt', 'usd_to_usdt', 'usdt_to_usd'])) {
            throw new \InvalidArgumentException('Direction must be either "usdt_to_bob" or "bob_to_usdt" or "usd_to_usdt" or "usdt_to_usd"');
        }

        // Validate inputs
        if ($amount <= 0) {
            throw new \InvalidArgumentException('Amount must be greater than 0');
        }

        if ($price <= 0) {
            throw new \InvalidArgumentException('Price must be greater than 0');
        }

        if ($fee < 0) {
            throw new \InvalidArgumentException('Fee must be greater than or equal to 0');
        }

        // Calculate conversion based on direction
        // Fee is only applied when selling USDT (usdt_to_bob, usdt_to_usd)
        if ($direction === 'usdt_to_bob') {
            // Convert USDT to BOB: amount * exchange_rate
            // Fee is deducted from the original USDT amount before conversion (selling USDT)
            $usdtAfterFee = $amount - $fee;
            
            if ($usdtAfterFee <= 0) {
                throw new \InvalidArgumentException('Amount must be greater than the fee to perform conversion');
            }
            
            $convertedAmount = $usdtAfterFee * $price;
            $finalAmount = $convertedAmount;
            $targetCurrency = 'BOB';
            $sourceCurrency = 'USDT';
            $feeInTargetCurrency = $fee * $price; // Fee equivalent in BOB
            $feePercentage = ($fee / $amount) * 100;
        } else if ($direction === 'bob_to_usdt') {
            // Convert BOB to USDT: amount / exchange_rate
            // No fee applied (buying USDT)
            $convertedAmount = $amount / $price;
            $finalAmount = $convertedAmount; // No fee deducted
            
            $targetCurrency = 'USDT';
            $sourceCurrency = 'BOB';
            $feeInTargetCurrency = 0; // No fee when buying USDT
            $feePercentage = 0; // No fee percentage
        } else if ($direction === 'usd_to_usdt') {
            // Convert USD to USDT: amount * exchange_rate
            // No fee applied (buying USDT)
            $convertedAmount = $amount * $price;
            $finalAmount = $convertedAmount; // No fee deducted
            
            $targetCurrency = 'USDT';
            $sourceCurrency = 'USD';
            $feeInTargetCurrency = 0; // No fee when buying USDT
            $feePercentage = 0; // No fee percentage
        } else if ($direction === 'usdt_to_usd') {
            // Convert USDT to USD: amount / exchange_rate
            // Fee is deducted from the original USDT amount before conversion (selling USDT)
            $usdtAfterFee = $amount - $fee;
            
            if ($usdtAfterFee <= 0) {
                throw new \InvalidArgumentException('Amount must be greater than the fee to perform conversion');
            }

            $convertedAmount = $usdtAfterFee / $price;
            $finalAmount = $convertedAmount;
            $targetCurrency = 'USD';
            $sourceCurrency = 'USDT';
            $feeInTargetCurrency = $fee; // Fee is already in USDT
            $feePercentage = ($fee / $amount) * 100;
        }

        // Determine if fee was applied (only when selling USDT)
        $feeApplied = in_array($direction, ['usdt_to_bob', 'usdt_to_usd']);
        
        // Return array with converted amount and currency information
        return [
            'original_amount' => $amount,
            'original_currency' => $sourceCurrency,
            'net_total' => round($convertedAmount, $digits), // Amount before fees
            'fee_amount' => $feeApplied ? round($fee, $digits) : 0, // Fee is only applied when selling USDT
            'fee_currency' => 'USDT', // Fee is always charged in USDT
            'converted_amount' => round($finalAmount, $digits), // Final amount after fees
            'target_currency' => $targetCurrency,
            'exchange_rate' => $price,
            'fee_percentage' => round($feePercentage, 2),
            'formatted' => number_format(round($convertedAmount, $digits), $digits) . ' ' . $targetCurrency,
            'formatted_net' => number_format(round($finalAmount, $digits), $digits) . ' ' . $targetCurrency,
            'summary' => [
                'direction' => $direction,
                'price' => $direction === 'usdt_to_bob' || $direction === 'usdt_to_usd' 
                    ? ("1 {$sourceCurrency} = " . $price . " {$targetCurrency}") 
                    : ($price . " {$sourceCurrency} = 1 {$targetCurrency}"),
                'conversion' => "{$amount} {$sourceCurrency} = " . number_format(round($convertedAmount, $digits), $digits) . " {$targetCurrency}",
                'fee_deducted_amount' => $feeApplied 
                    ? number_format(round($feeInTargetCurrency, $digits), $digits) . " {$targetCurrency} (flat fee)"
                    : "No fee applied (buying USDT)",
                'fee_deducted' => $feeApplied 
                    ? number_format(round($fee, $digits), $digits) . " USDT (flat fee)"
                    : "No fee applied (buying USDT)",
                'fee_deducted_percentage' => $feeApplied 
                    ? round($feePercentage, 2) . "%"
                    : "0%",
                'final_amount' => number_format(round($finalAmount, $digits), $digits) . " {$targetCurrency}"
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