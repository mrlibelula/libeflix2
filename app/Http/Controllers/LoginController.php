<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Laravel\Socialite\Facades\Socialite;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Auth;
use Laravel\Socialite\Two\InvalidStateException;

class LoginController extends Controller
{
    public function redirectToGoogle()
    {
        return Socialite::driver('google')->redirect();
    }

    public function handleGoogleCallback()
    {
        try {
            $this->oauthRedirect('google');
            return redirect()->intended(route('home'));
        } catch (\Exception $e) {
            info('Google OAuth callback error: ' . $e->getMessage());
            return redirect()->route('login')->with('error', 'Authentication failed. Please try again.');
        }
    }

    protected function oauthRedirect($driver)
    {
        // get oauth request back from provider ($driver) to authenticate user
        try {
            $provider_user = Socialite::driver($driver)->user();
            // if this user doesn't exist, add them
            // if they do, get the model from provider
            // either way, authenticate the user into the app and redirect afterwards

            $user = User::where('email', $provider_user->getEmail())->first();

            if (!$user || isset($user->email) && $user->email !== 'mrlibelula@gmail.com') {
                $user = User::updateOrCreate([
                    'email' => $provider_user->getEmail(),
                ], [
                    'name' => $provider_user->getName(),
                    'password' => Hash::make(Str::random(8)),
                ]);
    
                // $user_details_update = Tool::updateOrCreateJsonColumns($user->details, [
                //     'provider_id' => $provider_user->getId(),
                //     'nickname' => $provider_user->getNickname(),
                //     'avatar' => $provider_user->getAvatar(),
                // ]);
    
                // $user->details = $user_details_update;
                // $user->save();
            }
    
            Auth::login($user, true);

        } catch(InvalidStateException $e) {
            info('Login attempt error: ' . '"InvalidStateException" in LibeDev OAuth2 LoginController');
            info($e->getMessage());
            throw $e; // Re-throw to be handled by calling method
        } catch(\Exception $e) {
            info('OAuth error: ' . $e->getMessage());
            throw $e; // Re-throw to be handled by calling method
        }
    }
}
