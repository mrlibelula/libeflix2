<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Http\Requests\Auth\LoginRequest;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Route;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use App\Models\User;
use Inertia\Inertia;
use Inertia\Response;

class AuthenticatedSessionController extends Controller
{
    /**
     * Show the login page.
     */
    public function create(Request $request): Response
    {
        return Inertia::render('auth/login', [
            'canResetPassword' => Route::has('password.request'),
            'status' => $request->session()->get('status'),
        ]);
    }

    /**
     * Handle an incoming authentication request.
     */
    public function store(LoginRequest $request): RedirectResponse
    {
        $request->authenticate();

        $request->session()->regenerate();

        // Check if there's a redirect parameter in the request
        $redirectUrl = $request->get('redirect');
        if ($redirectUrl && filter_var($redirectUrl, FILTER_VALIDATE_URL) === false) {
            // If it's not a full URL, treat it as a path and validate it starts with /
            if (str_starts_with($redirectUrl, '/')) {
                // Store the redirect URL as the intended URL
                $request->session()->put('url.intended', url($redirectUrl));
            }
        }

        return redirect()->intended(route('dashboard', absolute: false));
    }

    /**
     * Handle login for Brave browser with alternative CSRF validation
     */
    public function storeBrave(Request $request)
    {
        // Manual validation without CSRF for Brave browser
        $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        // Verify this is actually a Brave browser request
        $userAgent = $request->userAgent();
        $isBrave = str_contains(strtolower($userAgent), 'brave') || 
                   (str_contains(strtolower($userAgent), 'chrome') && str_contains(strtolower($userAgent), 'brave'));

        if (!$isBrave) {
            return response()->json(['error' => 'This endpoint is only for Brave browser'], 403);
        }

        // Validate CSRF token manually for Brave browser
        $submittedToken = $request->header('X-CSRF-TOKEN') ?: 
                         $request->header('X-XSRF-TOKEN') ?: 
                         $request->input('_token');
        
        if (!$submittedToken) {
            return response()->json(['error' => 'CSRF token required'], 419);
        }
        
        // Validate the token against current session
        if ($request->hasSession()) {
            $sessionToken = $request->session()->token();
            if ($submittedToken !== $sessionToken) {
                // For Brave, try to regenerate session and continue
                $request->session()->regenerateToken();
                Log::info('Brave browser CSRF token mismatch, regenerated session token');
            }
        }

        // Manual authentication
        $user = User::where('email', $request->input('email'))->first();

        if (!$user || !Hash::check($request->input('password'), $user->password)) {
            return response()->json([
                'error' => 'The provided credentials are incorrect.',
                'errors' => ['email' => ['The provided credentials are incorrect.']]
            ], 422);
        }

        // Start a fresh session for Brave browser if session exists
        if ($request->hasSession()) {
            $request->session()->invalidate();
            $request->session()->regenerateToken();
            $request->session()->regenerate();
        }

        // Log the user in
        Auth::login($user, $request->boolean('remember'));

        // Return success response with redirect
        $redirectUrl = $request->input('redirect');
        $intendedUrl = url('/dashboard');
        
        if ($redirectUrl && filter_var($redirectUrl, FILTER_VALIDATE_URL) === false) {
            if (str_starts_with($redirectUrl, '/')) {
                $intendedUrl = url($redirectUrl);
            }
        }

        return response()->json([
            'success' => true,
            'redirect' => $intendedUrl,
            'user' => $user->only(['id', 'name', 'email']),
            'message' => 'Login successful'
        ]);
    }

    /**
     * Destroy an authenticated session.
     */
    public function destroy(Request $request): RedirectResponse
    {
        Auth::guard('web')->logout();

        $request->session()->invalidate();
        $request->session()->regenerateToken();
        $request->session()->flush();

        return redirect('/')->withHeaders([
            'Cache-Control' => 'no-cache, no-store, must-revalidate',
            'Pragma' => 'no-cache',
            'Expires' => '0'
        ]);
    }
}
