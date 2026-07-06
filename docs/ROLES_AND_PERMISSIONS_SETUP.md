# LibeFlix Roles and Permissions Setup

This document outlines the roles and permissions system implemented in LibeFlix using the Spatie Laravel Permission package.

## 🔧 Installation Summary

✅ **Spatie Laravel Permission package installed**  
✅ **Permission tables migrated**  
✅ **User model configured with HasRoles trait**  
✅ **Middleware aliases configured**  
✅ **User ID 1 (Libe) assigned as admin**

## 👥 Roles Defined

### 1. **Admin** (Complete Access)
- Full access to all features
- User management
- Analytics and reporting
- Site settings management
- Content moderation

### 2. **Editor** (Content Management)
- Manage movies and TV shows
- Upload and moderate content
- Access premium content
- Limited analytics access

### 3. **Premium User** (Paid Subscriber)
- Access to premium content
- View movies and TV shows
- No content management access

### 4. **User** (Basic Access)
- View free movies and TV shows
- Limited functionality
- No premium content access

## 🔐 Permissions Structure

### Movie Permissions
- `view movies` - View movie listings
- `manage movies` - Full movie management
- `add movies` - Add new movies
- `edit movies` - Edit existing movies
- `delete movies` - Delete movies

### TV Show Permissions
- `view tvshows` - View TV show listings
- `manage tvshows` - Full TV show management
- `add tvshows` - Add new TV shows
- `edit tvshows` - Edit existing TV shows
- `delete tvshows` - Delete TV shows

### Episode Permissions
- `manage episodes` - Full episode management
- `add episodes` - Add new episodes
- `edit episodes` - Edit existing episodes
- `delete episodes` - Delete episodes

### User Management Permissions
- `view users` - View user listings
- `manage users` - Full user management
- `edit users` - Edit user accounts
- `delete users` - Delete user accounts

### Subscription Permissions
- `view subscriptions` - View subscription data
- `manage subscriptions` - Manage user subscriptions
- `view subscription plans` - View subscription plans
- `manage subscription plans` - Manage subscription plans

### Admin & Analytics Permissions
- `view admin dashboard` - Access admin dashboard
- `manage site settings` - Modify site configuration
- `view analytics` - Access analytics data

### Content Permissions
- `access premium content` - Access premium movies/shows
- `upload content` - Upload new content files
- `moderate content` - Review and moderate content

## 🛡️ Route Protection Examples

### Admin Routes (Require Admin Role)
```php
Route::middleware(['auth', 'role:admin'])->prefix('admin')->group(function () {
    Route::get('dashboard', [AdminController::class, 'dashboard']);
    Route::get('api/analytics', [MovieController::class, 'getAnalyticsSummary']);
});
```

### Editor Routes (Require Editor Role OR Manage Movies Permission)
```php
Route::middleware(['auth', 'role_or_permission:editor|manage movies'])->group(function () {
    Route::resource('movies', MovieController::class);
});
```

### Permission-Based Routes
```php
Route::middleware(['auth', 'permission:view analytics'])->group(function () {
    Route::get('analytics', [AnalyticsController::class, 'index']);
});
```

## 🎯 Controller Protection Examples

### Method-Level Permission Checks
```php
public function getAnalyticsSummary()
{
    // Check if user has permission to view analytics
    if (!Auth::user()->hasPermissionTo('view analytics')) {
        return response()->json(['error' => 'Unauthorized'], 403);
    }
    
    // Continue with method logic...
}
```

### Using Helper Methods
```php
if (Auth::user()->isAdmin()) {
    // Admin-only functionality
}

if (Auth::user()->canManageMovies()) {
    // Movie management functionality
}
```

## 🔧 User Model Helper Methods

The User model includes convenient helper methods:

```php
// Role checks
$user->isAdmin()           // Returns true if user has admin role
$user->isEditor()          // Returns true if user has editor role  
$user->isPremiumUser()     // Returns true if user has premium_user role

// Permission checks
$user->canManageMovies()           // Can manage movies
$user->canManageTvShows()          // Can manage TV shows
$user->canAccessAdminDashboard()   // Can access admin dashboard

// Spatie methods (also available)
$user->hasRole('admin')                    // Check specific role
$user->hasPermissionTo('view analytics')   // Check specific permission
$user->hasAnyPermission(['edit movies', 'add movies']) // Check any permission
```

## 🎭 Blade Directives (For Future Blade Templates)

```blade
@role('admin')
    <p>You are an admin.</p>
@endrole

@permission('manage movies')
    <button>Edit Movie</button>
@endpermission

@hasrole('admin|editor')
    <p>You can manage content.</p>
@endhasrole
```

## ⚙️ Configuration Files

### Database Seeder
The `RolesAndPermissionsSeeder` automatically:
- Creates all roles and permissions
- Assigns permissions to roles appropriately
- Assigns admin role to User ID 1

### Middleware Configuration (bootstrap/app.php)
```php
$middleware->alias([
    'premium.content' => CheckPremiumContent::class,
    'role' => \Spatie\Permission\Middleware\RoleMiddleware::class,
    'permission' => \Spatie\Permission\Middleware\PermissionMiddleware::class,
    'role_or_permission' => \Spatie\Permission\Middleware\RoleOrPermissionMiddleware::class,
]);
```

## 🚀 Usage Examples

### Assigning Roles to New Users
```php
// In a controller or seeder
$user = User::create([
    'name' => 'John Editor',
    'email' => 'editor@example.com',
    'password' => bcrypt('password'),
]);

$user->assignRole('editor');
```

### Checking Permissions in Controllers
```php
public function manageMovies()
{
    if (!Auth::user()->hasPermissionTo('manage movies')) {
        abort(403, 'You do not have permission to manage movies.');
    }
    
    // Continue with movie management logic
}
```

### Dynamic Permission Assignment
```php
// Give a user specific permission without a role
$user->givePermissionTo('edit movies');

// Remove permission
$user->revokePermissionTo('edit movies');

// Sync permissions (removes all others, assigns only these)
$user->syncPermissions(['view movies', 'edit movies']);
```

## 📊 Current Setup Status

- **Admin User**: Libe (ID: 1) ✅
- **Roles Created**: admin, editor, user, premium_user ✅
- **Permissions**: 23 permissions covering all LibeFlix functionality ✅
- **Route Protection**: Admin and editor routes protected ✅
- **Controller Protection**: Analytics methods protected ✅

## 🔄 Future Enhancements

1. **Admin Dashboard**: Create React components for admin panel
2. **User Management Interface**: CRUD operations for users
3. **Role Assignment UI**: Interface to assign/revoke roles
4. **Permission Management**: Dynamic permission assignment
5. **Audit Logging**: Track permission changes and access attempts

## 📚 References

- [Spatie Laravel Permission Documentation](https://spatie.be/docs/laravel-permission/v6/introduction)
- [Laravel 12 Authorization Documentation](https://laravel.com/docs/12.x/authorization)
- [Inertia.js Role-Based Access](https://inertiajs.com/authorization)

---

## 🎯 Quick Commands

```bash
# Run the seeder
php artisan db:seed --class=RolesAndPermissionsSeeder

# Clear permission cache (if needed)
php artisan permission:cache-reset

# List all routes with admin protection
php artisan route:list --name=admin

# Check user roles in Tinker
php artisan tinker --execute="echo App\Models\User::find(1)->roles->pluck('name');"
``` 