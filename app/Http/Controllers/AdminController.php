<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules\Password;
use Inertia\Inertia;
use Spatie\Permission\Models\Role;
use Spatie\Permission\Models\Permission;

class AdminController extends Controller
{
    public function dashboard()
    {
        return Inertia::render('admin/dashboard');
    }

    public function users(Request $request)
    {
        $query = User::with(['roles', 'permissions']);
        
        // Filter by status
        if ($request->has('status') && $request->status !== 'all') {
            switch ($request->status) {
                case 'active':
                    $query->where('is_active', true)->where('is_banned', false);
                    break;
                case 'inactive':
                    $query->where('is_active', false)->where('is_banned', false);
                    break;
                case 'banned':
                    $query->where('is_banned', true);
                    break;
                case 'pending':
                    $query->where('is_pending', true);
                    break;
            }
        }
        
        // Search functionality
        if ($request->has('search') && $request->search) {
            $query->where(function($q) use ($request) {
                $q->where('name', 'like', '%' . $request->search . '%')
                  ->orWhere('email', 'like', '%' . $request->search . '%');
            });
        }
        
        // Sort functionality
        $sortBy = $request->get('sort_by', 'created_at');
        $sortOrder = $request->get('sort_order', 'desc');
        $query->orderBy($sortBy, $sortOrder);
        
        $users = $query->paginate(15);
        
        // Get all roles for the interface
        $roles = Role::all();
        $permissions = Permission::all();
        
        $userStats = [
            'total' => User::count(),
            'active' => User::where('is_active', true)->where('is_banned', false)->count(),
            'inactive' => User::where('is_active', false)->where('is_banned', false)->count(),
            'banned' => User::where('is_banned', true)->count(),
            'pending' => User::where('is_pending', true)->count(),
            'premium' => User::whereHas('subscriptions', function($query) {
                $query->where('stripe_status', 'active');
            })->count(),
        ];
        
        return Inertia::render('admin/users', [
            'users' => $users,
            'roles' => $roles,
            'permissions' => $permissions,
            'filters' => $request->only(['status', 'search', 'sort_by', 'sort_order']),
            'userStats' => $userStats
        ]);
    }
    
    public function createUser()
    {
        $roles = Role::all();
        $permissions = Permission::all();
        
        return Inertia::render('admin/users/create', [
            'roles' => $roles,
            'permissions' => $permissions
        ]);
    }
    
    public function storeUser(Request $request)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => ['required', 'confirmed', Password::defaults()],
            'roles' => 'array',
            'roles.*' => 'exists:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,name',
            'is_active' => 'boolean',
            'is_banned' => 'boolean',
            'is_pending' => 'boolean',
        ]);
        
        $user = User::create([
            'name' => $request->name,
            'email' => $request->email,
            'password' => Hash::make($request->password),
            'is_active' => $request->get('is_active', true),
            'is_banned' => $request->get('is_banned', false),
            'is_pending' => $request->get('is_pending', false),
        ]);
        
        // Assign roles
        if ($request->has('roles')) {
            $user->assignRole($request->roles);
        }
        
        // Assign permissions
        if ($request->has('permissions')) {
            $user->givePermissionTo($request->permissions);
        }
        
        return redirect()->route('admin.users')->with('success', 'User created successfully.');
    }
    
    public function showUser(User $user)
    {
        $user->load(['roles', 'permissions', 'subscriptions']);
        
        return Inertia::render('admin/users/show', [
            'user' => $user,
            'subscription_details' => $user->getSubscriptionPlanDetails()
        ]);
    }
    
    public function editUser(User $user)
    {
        $user->load(['roles', 'permissions']);
        $roles = Role::all();
        $permissions = Permission::all();
        
        return Inertia::render('admin/users/edit', [
            'user' => $user,
            'roles' => $roles,
            'permissions' => $permissions
        ]);
    }
    
    public function updateUser(Request $request, User $user)
    {
        $request->validate([
            'name' => 'required|string|max:255',
            'email' => ['required', 'string', 'email', 'max:255', Rule::unique('users')->ignore($user->id)],
            'password' => ['nullable', 'confirmed', Password::defaults()],
            'roles' => 'array',
            'roles.*' => 'exists:roles,name',
            'permissions' => 'array',
            'permissions.*' => 'exists:permissions,name',
            'is_active' => 'boolean',
            'is_banned' => 'boolean',
            'is_pending' => 'boolean',
        ]);
        
        $user->update([
            'name' => $request->name,
            'email' => $request->email,
            'is_active' => $request->get('is_active', $user->is_active),
            'is_banned' => $request->get('is_banned', $user->is_banned),
            'is_pending' => $request->get('is_pending', $user->is_pending),
        ]);
        
        // Update password if provided
        if ($request->filled('password')) {
            $user->update(['password' => Hash::make($request->password)]);
        }
        
        // Sync roles
        if ($request->has('roles')) {
            $user->syncRoles($request->roles);
        }
        
        // Sync permissions
        if ($request->has('permissions')) {
            $user->syncPermissions($request->permissions);
        }
        
        return redirect()->route('admin.users')->with('success', 'User updated successfully.');
    }
    
    public function deleteUser(User $user)
    {
        // Prevent deleting the first admin user
        if ($user->id === 1) {
            return redirect()->route('admin.users')->with('error', 'Cannot delete the primary admin user.');
        }
        
        $user->delete();
        
        return redirect()->route('admin.users')->with('success', 'User deleted successfully.');
    }
    
    public function toggleUserStatus(Request $request, User $user)
    {
        $request->validate([
            'status' => 'required|in:active,inactive,banned,unbanned'
        ]);
        
        switch ($request->status) {
            case 'active':
                $user->update(['is_active' => true, 'is_banned' => false]);
                break;
            case 'inactive':
                $user->update(['is_active' => false]);
                break;
            case 'banned':
                $user->update(['is_banned' => true, 'is_active' => false]);
                break;
            case 'unbanned':
                $user->update(['is_banned' => false, 'is_active' => true]);
                break;
        }
        
        return response()->json(['success' => true, 'message' => 'User status updated successfully.']);
    }
    
    public function assignRole(Request $request, User $user)
    {
        $request->validate([
            'role' => 'required|exists:roles,name'
        ]);
        
        $user->assignRole($request->role);
        
        return response()->json(['success' => true, 'message' => 'Role assigned successfully.']);
    }
    
    public function removeRole(Request $request, User $user)
    {
        $request->validate([
            'role' => 'required|exists:roles,name'
        ]);
        
        $user->removeRole($request->role);
        
        return response()->json(['success' => true, 'message' => 'Role removed successfully.']);
    }
    
    public function givePermission(Request $request, User $user)
    {
        $request->validate([
            'permission' => 'required|exists:permissions,name'
        ]);
        
        $user->givePermissionTo($request->permission);
        
        return response()->json(['success' => true, 'message' => 'Permission granted successfully.']);
    }
    
    public function revokePermission(Request $request, User $user)
    {
        $request->validate([
            'permission' => 'required|exists:permissions,name'
        ]);
        
        $user->revokePermissionTo($request->permission);
        
        return response()->json(['success' => true, 'message' => 'Permission revoked successfully.']);
    }
    
    public function getUserStats()
    {
        $totalUsers = User::count();
        $activeUsers = User::where('is_active', true)->where('is_banned', false)->count();
        $inactiveUsers = User::where('is_active', false)->where('is_banned', false)->count();
        $bannedUsers = User::where('is_banned', true)->count();
        $pendingUsers = User::where('is_pending', true)->count();
        $premiumUsers = User::whereHas('subscriptions', function($query) {
            $query->where('stripe_status', 'active');
        })->count();
        
        return response()->json([
            'total' => $totalUsers,
            'active' => $activeUsers,
            'inactive' => $inactiveUsers,
            'banned' => $bannedUsers,
            'pending' => $pendingUsers,
            'premium' => $premiumUsers,
        ]);
    }
}
