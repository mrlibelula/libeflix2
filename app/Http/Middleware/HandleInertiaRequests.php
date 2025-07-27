<?php

namespace App\Http\Middleware;

use App\Services\Tool;
use Illuminate\Foundation\Inspiring;
use Illuminate\Http\Request;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        [$message, $author] = str(Inspiring::quotes()->random())->explode('-');

        // Get current authenticated user - this ensures fresh auth state on each request
        $user = $request->user();
        $subscription = null;
        
        if ($user) {
            $subscription = $user->getSubscriptionPlanDetails();
        }

        // Generate a fresh CSRF token for each request to handle Brave browser issues
        $csrfToken = csrf_token();
        
        // Check if this is Brave browser
        $userAgent = $request->userAgent();
        $isBrave = str_contains(strtolower($userAgent), 'brave') || 
                   str_contains(strtolower($userAgent), 'chrome') && str_contains(strtolower($userAgent), 'brave');

        return [
            ...parent::share($request),
            'name' => config('app.name'),
            'quote' => ['message' => trim($message), 'author' => trim($author)],
            // Auth state is always fresh from the request, preventing stale client-side state
            'auth' => [
                'user' => $user,
                'subscription' => $subscription,
                'canAccessPremium' => $user ? $user->canAccessPremiumContent() : false,
                'isAdmin' => $user ? $user->isAdmin() : false,
            ],
            'genres' => Tool::getMoviesAndTVShowsGenresWithSlugs(),
            'isProduction' => app()->environment('production'),
            'csrf_token' => $csrfToken,
            'isBrave' => $isBrave, // Add Brave detection to props
            'session_debug' => [
                'has_session' => $request->hasSession(),
                'session_started' => $request->session()->isStarted(),
                'csrf_from_session' => $request->session()->token(),
                'csrf_fresh' => $csrfToken,
                'user_agent_snippet' => substr($userAgent, 0, 50)
            ],
            'ziggy' => fn (): array => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ]
        ];
    }
}
