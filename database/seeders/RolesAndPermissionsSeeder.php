<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;
use App\Models\User;

class RolesAndPermissionsSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        // Reset cached roles and permissions
        app()[\Spatie\Permission\PermissionRegistrar::class]->forgetCachedPermissions();

        // Create permissions for LibeFlix
        $permissions = [
            // Movie permissions
            'view movies',
            'manage movies',
            'add movies',
            'edit movies',
            'delete movies',
            
            // TV Show permissions
            'view tvshows',
            'manage tvshows',
            'add tvshows',
            'edit tvshows',
            'delete tvshows',
            
            // Episode permissions
            'manage episodes',
            'add episodes',
            'edit episodes',
            'delete episodes',
            
            // User management permissions
            'view users',
            'manage users',
            'edit users',
            'delete users',
            
            // Subscription permissions
            'view subscriptions',
            'manage subscriptions',
            'view subscription plans',
            'manage subscription plans',
            
            // Dashboard and admin permissions
            'view admin dashboard',
            'manage site settings',
            'view analytics',
            
            // Content permissions
            'access premium content',
            'upload content',
            'moderate content',
        ];

        // Create permissions
        foreach ($permissions as $permission) {
            Permission::firstOrCreate(['name' => $permission]);
        }

        // Create roles
        $adminRole = Role::firstOrCreate(['name' => 'admin']);
        $editorRole = Role::firstOrCreate(['name' => 'editor']);
        $userRole = Role::firstOrCreate(['name' => 'user']);
        $premiumUserRole = Role::firstOrCreate(['name' => 'premium_user']);

        // Assign permissions to roles
        
        // Admin gets all permissions
        $adminRole->givePermissionTo(Permission::all());

        // Editor permissions (content management)
        $editorRole->givePermissionTo([
            'view movies',
            'manage movies',
            'add movies',
            'edit movies',
            'view tvshows',
            'manage tvshows',
            'add tvshows',
            'edit tvshows',
            'manage episodes',
            'add episodes',
            'edit episodes',
            'upload content',
            'moderate content',
            'access premium content',
        ]);

        // Premium User permissions
        $premiumUserRole->givePermissionTo([
            'view movies',
            'view tvshows',
            'access premium content',
        ]);

        // Regular User permissions
        $userRole->givePermissionTo([
            'view movies',
            'view tvshows',
        ]);

        // Assign admin role to User with email = 'luis@libe.dev'
        $adminUser = User::where('email', 'luis@libe.dev')->first();
        if ($adminUser) {
            $adminUser->assignRole('admin');
            $this->command->info("Admin role assigned to user: {$adminUser->name} (ID: {$adminUser->id})");
        } else {
            $this->command->warn("User with email luis@libe.dev not found. Please create a user first or run this seeder after user creation.");
        }
    }
}
