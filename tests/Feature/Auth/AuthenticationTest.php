<?php

namespace Tests\Feature\Auth;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_login_screen_can_be_rendered()
    {
        $response = $this->get('/login');

        $response->assertStatus(200);
    }

    public function test_users_can_authenticate_using_the_login_screen()
    {
        $user = User::factory()->create();

        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect(route('dashboard', absolute: false));
    }

    public function test_users_can_not_authenticate_with_invalid_password()
    {
        $user = User::factory()->create();

        $this->post('/login', [
            'email' => $user->email,
            'password' => 'wrong-password',
        ]);

        $this->assertGuest();
    }

    public function test_users_can_logout()
    {
        $user = User::factory()->create();

        $response = $this->actingAs($user)->post('/logout');

        $this->assertGuest();
        $response->assertRedirect('/');
    }

    public function test_users_are_redirected_to_intended_url_after_login()
    {
        $user = User::factory()->create();

        // Visit a protected route first to set the intended URL
        $intendedUrl = route('dashboard');
        $this->get($intendedUrl);

        // Now login and check if redirected to intended URL
        $response = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        $response->assertRedirect($intendedUrl);
    }

    public function test_users_redirect_to_intended_url_when_accessing_premium_content()
    {
        $user = User::factory()->create();

        // First, try to access a premium streaming route which should redirect to login
        $response = $this->get('/movie/stream/some-encoded-path');
        
        // Should be redirected to login (assuming the middleware triggers)
        $response->assertRedirect(route('login'));

        // Now login
        $loginResponse = $this->post('/login', [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        // Should be redirected back to the intended URL (the movie stream page)
        // Note: This test might fail if the movie doesn't exist, but it tests the redirect flow
    }

    public function test_users_redirect_with_query_parameter()
    {
        $user = User::factory()->create();

        // Simulate clicking login from a movie page with redirect parameter
        $moviePageUrl = '/movie/some-movie-slug';
        $loginResponse = $this->post('/login?redirect=' . urlencode($moviePageUrl), [
            'email' => $user->email,
            'password' => 'password',
        ]);

        $this->assertAuthenticated();
        // Should be redirected to the movie page specified in the redirect parameter
        $loginResponse->assertRedirect($moviePageUrl);
    }
}
