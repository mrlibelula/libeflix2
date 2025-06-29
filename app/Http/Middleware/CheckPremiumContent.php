<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use App\Services\Tool;

class CheckPremiumContent
{
    /**
     * Handle an incoming request.
     *
     * @param  \Closure(\Illuminate\Http\Request): (\Symfony\Component\HttpFoundation\Response)  $next
     */
    public function handle(Request $request, Closure $next): Response
    {
        // CRITICAL: Add no-cache headers to prevent permission caching
        $request->headers->set('Cache-Control', 'no-cache, no-store, must-revalidate');
        $request->headers->set('Pragma', 'no-cache');
        
        // Get route parameters
        $encFilePath = $request->route('encFilePath');
        $movie = $request->route('movie');
        $episode = $request->route('episode');
        $slug = $request->route('slug');
        
        // Determine if this is premium content
        $isPremiumContent = false;
        
        // Handle streaming routes with encoded file paths
        if ($encFilePath) {
            $isPremiumContent = $this->checkEncodedFileContent($encFilePath, $request);
        }
        // Handle model-bound routes
        elseif ($movie && !$movie->is_free) {
            $isPremiumContent = true;
        } elseif ($episode) {
            // Episode is premium if both the episode itself AND the parent TV show are NOT free
            $season = $episode->season;
            $tvshow = $season ? $season->tvshow : null;
            
            $isEpisodeFree = $episode->is_free;
            $isTvshowFree = $tvshow ? $tvshow->is_free : false;
            
            if (!($isEpisodeFree || $isTvshowFree)) {
                $isPremiumContent = true;
            }
        } elseif ($slug) {
            // Handle TV show episodes or movies by slug
            $tvshow = \App\Models\Tvshow::where('slug', $slug)->first();
            if ($tvshow) {
                // For tvshow pages, we allow viewing the page but protect individual episode streaming
                // The actual episode streaming will be checked when they try to play specific episodes
                $isPremiumContent = false;
            } else {
                // Check if it's a movie page
                $movie = \App\Models\Movie::where('slug', $slug)->first();
                if ($movie && !$movie->is_free) {
                    // For movie pages, we can show the page but protect the streaming
                    $isPremiumContent = false;
                }
            }
        }
        
        // If content is free, allow access
        if (!$isPremiumContent) {
            return $next($request);
        }
        
        // CRITICAL: Always check authentication for premium content
        if (!\Illuminate\Support\Facades\Auth::check()) {
            // \Illuminate\Support\Facades\Log::info('Premium content access denied: User not authenticated', [
            //     'ip' => $request->ip(),
            //     'user_agent' => $request->userAgent(),
            //     'url' => $request->url()
            // ]);
            
            // For API requests, return JSON error
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'error' => 'Authentication required',
                    'message' => 'Please log in to access premium content.',
                    'redirect' => route('subscription.plans.public')
                ], 401);
            }
            
            // For web requests, redirect to login with intended URL properly stored
            return redirect()->guest(route('login'))
                ->with('message', 'Please log in to access premium content.');
        }
        
        $user = \Illuminate\Support\Facades\Auth::user();
        
        // CRITICAL: Always refresh user permissions from database
        $user->refresh();
        
        // Admin users can access all premium content without restrictions
        if ($user->isAdmin()) {
            // \Illuminate\Support\Facades\Log::info('Premium content access granted: Admin user', [
            //     'user_id' => $user->id,
            //     'user_email' => $user->email
            // ]);
            return $next($request);
        }
        
        // CRITICAL: Re-check premium access permissions for current user
        if (!$user->canAccessPremiumContent()) {
            // \Illuminate\Support\Facades\Log::warning('Premium content access denied: Insufficient subscription', [
            //     'user_id' => $user->id,
            //     'user_email' => $user->email,
            //     'ip' => $request->ip(),
            //     'url' => $request->url()
            // ]);
            
            // For API requests, return JSON error
            if ($request->expectsJson() || $request->is('api/*')) {
                return response()->json([
                    'error' => 'Subscription required',
                    'message' => 'Premium subscription required to access this content.',
                    'redirect' => route('subscription.plans')
                ], 403);
            }
            
            // For web requests, redirect to subscription page
            return redirect()->route('subscription.plans')
                ->with('message', 'Premium subscription required to access this content.');
        }
        
        \Illuminate\Support\Facades\Log::info('Premium content access granted: Valid subscription', [
            'user_id' => $user->id,
            'user_email' => $user->email
        ]);

        return $next($request);
    }
    
    /**
     * Check if encoded file content is premium
     *
     * @param string $encFilePath
     * @param \Illuminate\Http\Request $request
     * @return bool
     */
    private function checkEncodedFileContent(string $encFilePath, Request $request): bool
    {
        try {
            // Decode the file path
            $decodedPath = Tool::decode($encFilePath);
            
            // Check if this is a movie or episode by looking at the file path in the database
            
            // First check movies
            $movie = \App\Models\Movie::where('path', $decodedPath)->first();
            if ($movie) {
                return !$movie->is_free;
            }
            
            // Then check episodes - check MULTIPLE possible column values
            $episode = \App\Models\Episode::where('is_in_storage', $decodedPath)->first();
            
            if (!$episode) {
                // Try finding episode by partial path match
                $episode = \App\Models\Episode::where('is_in_storage', 'LIKE', '%' . basename($decodedPath))->first();
            }
            
            if ($episode) {
                // Episode is free if either the episode itself is free OR the parent TV show is free
                $season = $episode->season;
                $tvshow = $season ? $season->tvshow : null;
                
                $isEpisodeFree = $episode->is_free;
                $isTvshowFree = $tvshow ? $tvshow->is_free : false;
                
                return !($isEpisodeFree || $isTvshowFree);
            }
            
            // If not found in database, assume it's premium content for security
            // \Illuminate\Support\Facades\Log::warning('PREMIUM CHECK: Content not found in database - treating as premium', [
            //     'encFilePath' => $encFilePath,
            //     'decodedPath' => $decodedPath,
            //     'user_id' => \Illuminate\Support\Facades\Auth::id(),
            //     'will_block' => true
            // ]);
            return true;
            
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('PREMIUM CHECK: Error checking encoded file content', [
                'encFilePath' => $encFilePath,
                'error' => $e->getMessage(),
                'user_id' => \Illuminate\Support\Facades\Auth::id(),
                'will_block' => true
            ]);
            // If we can't decode or check, assume premium for security
            return true;
        }
    }
} 