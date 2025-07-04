import { useState } from 'react';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, useForm } from '@inertiajs/react';
import { toast } from 'sonner';

import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import AdminLayout from '@/layouts/admin/layout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Separator } from '@/components/ui/separator';

interface User {
  id: number;
  encoded_id: string;
  name: string;
  email: string;
  email_verified_at: string | null;
  is_active: boolean;
  is_banned: boolean;
  is_pending: boolean;
  created_at: string;
  roles: Array<{ id: number; name: string }>;
  permissions: Array<{ id: number; name: string }>;
}

interface Role {
  id: number;
  name: string;
}

interface Permission {
  id: number;
  name: string;
}

interface Props {
  user: User;
  roles: Role[];
  permissions: Permission[];
}

export default function EditUser({ user, roles, permissions }: Props) {
  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: 'Users',
      href: '/admin/users',
    },
    {
      title: user.name,
      href: `/admin/users/${user.encoded_id}`,
    },
    {
      title: 'Edit',
      href: `/admin/users/${user.encoded_id}/edit`,
    },
  ];

  const { data, setData, put, processing, errors } = useForm({
    name: user.name,
    email: user.email,
    password: '',
    password_confirmation: '',
    roles: user.roles.map(role => role.name),
    permissions: user.permissions.map(permission => permission.name),
    is_active: user.is_active,
    is_banned: user.is_banned,
    is_pending: user.is_pending,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    put(`/admin/users/${user.encoded_id}`, {
      onSuccess: () => {
        toast.success('User updated successfully');
      },
      onError: () => {
        toast.error('Please check the form for errors');
      },
    });
  };

  const handleRoleChange = (roleName: string, checked: boolean) => {
    if (checked) {
      setData('roles', [...data.roles, roleName]);
    } else {
      setData('roles', data.roles.filter(role => role !== roleName));
    }
  };

  const handlePermissionChange = (permissionName: string, checked: boolean) => {
    if (checked) {
      setData('permissions', [...data.permissions, permissionName]);
    } else {
      setData('permissions', data.permissions.filter(permission => permission !== permissionName));
    }
  };

  const groupedPermissions = permissions.reduce((groups, permission) => {
    const category = permission.name.split(' ')[1] || 'general';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(permission);
    return groups;
  }, {} as Record<string, Permission[]>);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Edit ${user.name}`} />

      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <HeadingSmall 
              title={`Edit ${user.name}`} 
              description="Update user information, roles, and permissions" 
            />
            <div className="flex gap-2">
              <Link href={`/admin/users/${user.encoded_id}`}>
                <Button variant="outline">View Details</Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="outline">Back to Users</Button>
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <Card>
              <CardHeader>
                <CardTitle>Basic Information</CardTitle>
                <CardDescription>Update the user's basic details</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      value={data.name}
                      onChange={(e) => setData('name', e.target.value)}
                      placeholder="Enter full name"
                      className={errors.name ? 'border-red-500' : ''}
                    />
                    {errors.name && <p className="text-sm text-red-500">{errors.name}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={data.email}
                      onChange={(e) => setData('email', e.target.value)}
                      placeholder="Enter email address"
                      className={errors.email ? 'border-red-500' : ''}
                    />
                    {errors.email && <p className="text-sm text-red-500">{errors.email}</p>}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="password">New Password (leave blank to keep current)</Label>
                    <Input
                      id="password"
                      type="password"
                      value={data.password}
                      onChange={(e) => setData('password', e.target.value)}
                      placeholder="Enter new password"
                      className={errors.password ? 'border-red-500' : ''}
                    />
                    {errors.password && <p className="text-sm text-red-500">{errors.password}</p>}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password_confirmation">Confirm New Password</Label>
                    <Input
                      id="password_confirmation"
                      type="password"
                      value={data.password_confirmation}
                      onChange={(e) => setData('password_confirmation', e.target.value)}
                      placeholder="Confirm new password"
                      className={errors.password_confirmation ? 'border-red-500' : ''}
                    />
                    {errors.password_confirmation && <p className="text-sm text-red-500">{errors.password_confirmation}</p>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* User Status */}
            <Card>
              <CardHeader>
                <CardTitle>User Status</CardTitle>
                <CardDescription>Update the user's status</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-6">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_active"
                      checked={data.is_active}
                      onCheckedChange={(checked) => setData('is_active', !!checked)}
                    />
                    <Label htmlFor="is_active">Active</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_banned"
                      checked={data.is_banned}
                      onCheckedChange={(checked) => setData('is_banned', !!checked)}
                    />
                    <Label htmlFor="is_banned">Banned</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="is_pending"
                      checked={data.is_pending}
                      onCheckedChange={(checked) => setData('is_pending', !!checked)}
                    />
                    <Label htmlFor="is_pending">Pending Approval</Label>
                  </div>
                </div>

                <div className="text-sm text-gray-500">
                  <p><strong>Current Status:</strong> {user.is_banned ? 'Banned' : user.is_pending ? 'Pending' : !user.is_active ? 'Inactive' : 'Active'}</p>
                  <p><strong>Email Verified:</strong> {user.email_verified_at ? 'Yes' : 'No'}</p>
                  <p><strong>Member Since:</strong> {new Date(user.created_at).toLocaleDateString()}</p>
                </div>
              </CardContent>
            </Card>

            {/* Roles */}
            <Card>
              <CardHeader>
                <CardTitle>Roles</CardTitle>
                <CardDescription>Update user roles</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {roles.map((role) => (
                    <div key={role.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`role-${role.id}`}
                        checked={data.roles.includes(role.name)}
                        onCheckedChange={(checked) => handleRoleChange(role.name, !!checked)}
                      />
                      <Label htmlFor={`role-${role.id}`} className="capitalize">
                        {role.name.replace('_', ' ')}
                      </Label>
                    </div>
                  ))}
                </div>
                {errors.roles &&

 <p className="text-sm text-red-500 mt-2">{errors.roles}</p>}

                <div className="mt-4 text-sm text-gray-500">
                  <p><strong>Current Roles:</strong></p>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {user.roles.map((role) => (
                      <Badge key={role.id} variant="default">
                        {role.name.replace('_', ' ')}
                      </Badge>
                    ))}
                    {user.roles.length === 0 && <span className="text-gray-400">No roles assigned</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Permissions */}
            <Card>
              <CardHeader>
                <CardTitle>Permissions</CardTitle>
                <CardDescription>Update specific permissions for this user</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {Object.entries(groupedPermissions).map(([category, categoryPermissions]) => (
                    <div key={category}>
                      <h4 className="font-medium text-sm uppercase text-gray-500 mb-3">
                        {category} Permissions
                      </h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {categoryPermissions.map((permission) => (
                          <div key={permission.id} className="flex items-center space-x-2">
                            <Checkbox
                              id={`permission-${permission.id}`}
                              checked={data.permissions.includes(permission.name)}
                              onCheckedChange={(checked) => handlePermissionChange(permission.name, !!checked)}
                            />
                            <Label htmlFor={`permission-${permission.id}`} className="text-sm">
                              {permission.name}
                            </Label>
                          </div>
                        ))}
                      </div>
                      {category !== Object.keys(groupedPermissions)[Object.keys(groupedPermissions).length - 1] && (
                        <Separator className="mt-4" />
                      )}
                    </div>
                  ))}
                </div>
                {errors.permissions && <p className="text-sm text-red-500 mt-2">{errors.permissions}</p>}

                <div className="mt-4 text-sm text-gray-500">
                  <p><strong>Current Permissions:</strong></p>
                  <div className="flex gap-2 flex-wrap mt-1">
                    {user.permissions.map((permission) => (
                      <Badge key={permission.id} variant="outline">
                        {permission.name}
                      </Badge>
                    ))}
                    {user.permissions.length === 0 && <span className="text-gray-400">No direct permissions assigned</span>}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Changes Summary */}
            {(data.roles.length > 0 || data.permissions.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle>Updated Summary</CardTitle>
                  <CardDescription>Review updated roles and permissions</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {data.roles.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Updated Roles:</Label>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {data.roles.map((role) => (
                          <Badge key={role} variant="default">
                            {role.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  {data.permissions.length > 0 && (
                    <div>
                      <Label className="text-sm font-medium">Updated Permissions:</Label>
                      <div className="flex gap-2 flex-wrap mt-2">
                        {data.permissions.map((permission) => (
                          <Badge key={permission} variant="outline">
                            {permission}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {/* Actions */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex gap-4 justify-end">
                  <Link href={`/admin/users/${user.encoded_id}`}>
                    <Button type="button" variant="outline">
                      Cancel
                    </Button>
                  </Link>
                  <Button type="submit" disabled={processing}>
                    {processing ? 'Updating...' : 'Update User'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </form>
        </div>
      </AdminLayout>
    </AppLayout>
  );
} 