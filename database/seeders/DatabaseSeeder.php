<?php

namespace Database\Seeders;

use App\Models\User;
// use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // User::factory(10)->create();

        User::factory()->create([
            'name' => 'Libe',
            'email' => 'luis@libe.dev',
            'password' => Hash::make('password'),
        ]);

        $this->command->info('1 user seeded successfully');

        // Seed subscription plans
        $this->call(SubscriptionPlanSeeder::class);

        // Seed roles and permissions (this will assign admin role to user ID 1)
        $this->call(RolesAndPermissionsSeeder::class);
    }
}
