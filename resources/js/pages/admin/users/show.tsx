import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';

import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import AdminLayout from '@/layouts/admin/layout';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  updated_at: string;
  roles: Array<{ id: number; name: string }>;
  permissions: Array<{ id: number; name: string }>;
  subscriptions?: any[];
}

interface SubscriptionDetails {
  status?: string;
  ends_at?: string;
  trial_ends_at?: string;
  on_trial?: boolean;
  active?: boolean;
  canceled?: boolean;
}

interface Props {
  user: User;
  subscription_details?: SubscriptionDetails | null;
}

export default function ShowUser({ user, subscription_details }: Props) {
  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: 'Users',
      href: '/admin/users',
    },
    {
      title: user.name,
      href: `/admin/users/${user.encoded_id}`,
    },
  ];

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getStatusBadge = () => {
    if (user.is_banned) {
      return <Badge variant="destructive">Banned</Badge>;
    }
    if (user.is_pending) {
      return <Badge variant="secondary">Pending</Badge>;
    }
    if (!user.is_active) {
      return <Badge variant="outline">Inactive</Badge>;
    }
    return <Badge variant="default">Active</Badge>;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${user.name} - User Details`} />

      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <HeadingSmall 
              title={`${user.name}`} 
              description="User details and account information" 
            />
            <div className="flex gap-2">
              <Link href={`/admin/users/${user.encoded_id}/edit`}>
                <Button>Edit User</Button>
              </Link>
              <Link href="/admin/users">
                <Button variant="outline">Back to Users</Button>
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* User Profile */}
            <div className="lg:col-span-2 space-y-6">
              {/* Basic Information */}
              <Card>
                <CardHeader>
                  <CardTitle>Basic Information</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-20 w-20">
                      <AvatarFallback className="text-lg">{getInitials(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="space-y-2">
                      <h2 className="text-2xl font-bold">{user.name}</h2>
                      <p className="text-gray-600">{user.email}</p>
                      <div>{getStatusBadge()}</div>
                    </div>
                  </div>
                  
                  <Separator />
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <h3 className="font-medium text-sm text-gray-500 uppercase">Account Status</h3>
                      <div className="mt-2 space-y-1">
                        <p><strong>Active:</strong> {user.is_active ? 'Yes' : 'No'}</p>
                        <p><strong>Banned:</strong> {user.is_banned ? 'Yes' : 'No'}</p>
                        <p><strong>Pending:</strong> {user.is_pending ? 'Yes' : 'No'}</p>
                        <p><strong>Email Verified:</strong> {user.email_verified_at ? 'Yes' : 'No'}</p>
                      </div>
                    </div>
                    
                    <div>
                      <h3 className="font-medium text-sm text-gray-500 uppercase">Account Dates</h3>
                      <div className="mt-2 space-y-1">
                        <p><strong>Created:</strong> {formatDate(user.created_at)}</p>
                        <p><strong>Updated:</strong> {formatDate(user.updated_at)}</p>
                        {user.email_verified_at && (
                          <p><strong>Email Verified:</strong> {formatDate(user.email_verified_at)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Roles and Permissions */}
              <Card>
                <CardHeader>
                  <CardTitle>Roles & Permissions</CardTitle>
                  <CardDescription>Assigned roles and permissions for this user</CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  {/* Roles */}
                  <div>
                    <h3 className="font-medium text-sm text-gray-500 uppercase mb-3">Roles</h3>
                    {user.roles && user.roles.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {user.roles.map((role) => (
                          <Badge key={role.id} variant="default">
                            {role.name.replace('_', ' ')}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No roles assigned</p>
                    )}
                  </div>

                  <Separator />

                  {/* Direct Permissions */}
                  <div>
                    <h3 className="font-medium text-sm text-gray-500 uppercase mb-3">Direct Permissions</h3>
                    {user.permissions && user.permissions.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {user.permissions.map((permission) => (
                          <Badge key={permission.id} variant="outline">
                            {permission.name}
                          </Badge>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 italic">No direct permissions assigned</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar */}
            <div className="space-y-6">
              {/* Quick Actions */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Actions</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <Link href={`/admin/users/${user.id}/edit`}>
                    <Button className="w-full" variant="outline">
                      Edit User
                    </Button>
                  </Link>
                  
                  {!user.email_verified_at && (
                    <Button className="w-full" variant="outline">
                      Send Verification Email
                    </Button>
                  )}
                  
                  {user.is_banned ? (
                    <Button className="w-full" variant="outline">
                      Unban User
                    </Button>
                  ) : (
                    <Button className="w-full" variant="outline">
                      Ban User
                    </Button>
                  )}
                  
                  <Button className="w-full" variant="outline">
                    Reset Password
                  </Button>
                </CardContent>
              </Card>

              {/* Subscription Information */}
              {subscription_details && (
                <Card>
                  <CardHeader>
                    <CardTitle>Subscription</CardTitle>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    <div>
                      <p className="text-sm text-gray-500">Status</p>
                      <p className="font-medium capitalize">{subscription_details.status || 'No subscription'}</p>
                    </div>
                    
                    {subscription_details.on_trial && (
                      <div>
                        <p className="text-sm text-gray-500">Trial Ends</p>
                        <p className="font-medium">
                          {subscription_details.trial_ends_at ? formatDate(subscription_details.trial_ends_at) : 'N/A'}
                        </p>
                      </div>
                    )}
                    
                    {subscription_details.ends_at && (
                      <div>
                        <p className="text-sm text-gray-500">Subscription Ends</p>
                        <p className="font-medium">{formatDate(subscription_details.ends_at)}</p>
                      </div>
                    )}
                    
                    <div className="flex gap-2">
                      <Badge variant={subscription_details.active ? 'default' : 'secondary'}>
                        {subscription_details.active ? 'Active' : 'Inactive'}
                      </Badge>
                      {subscription_details.canceled && (
                        <Badge variant="outline">Canceled</Badge>
                      )}
                      {subscription_details.on_trial && (
                        <Badge variant="secondary">Trial</Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Account Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Account Stats</CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col gap-3">
                  <div>
                    <p className="text-sm text-gray-500">User ID</p>
                    <p className="font-medium">#{user.id}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Account Age</p>
                    <p className="font-medium">
                      {Math.floor((new Date().getTime() - new Date(user.created_at).getTime()) / (1000 * 60 * 60 * 24))} days
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Roles Count</p>
                    <p className="font-medium">{user.roles?.length || 0}</p>
                  </div>
                  
                  <div>
                    <p className="text-sm text-gray-500">Permissions Count</p>
                    <p className="font-medium">{user.permissions?.length || 0}</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </AdminLayout>
    </AppLayout>
  );
} 