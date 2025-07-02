import { useState, useEffect } from 'react';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useForm } from '@inertiajs/react';
import { toast } from 'sonner';

import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import AdminLayout from '@/layouts/admin/layout';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

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

interface UserStats {
  total: number;
  active: number;
  inactive: number;
  banned: number;
  pending: number;
  premium: number;
}

interface Props {
  users?: {
    data?: User[];
    links?: any[];
    meta?: any;
  };
  roles?: Role[];
  permissions?: Permission[];
  filters?: {
    status?: string;
    search?: string;
    sort_by?: string;
    sort_order?: string;
  };
  userStats?: UserStats;
}

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Users',
    href: '/admin/users',
  },
];

const getStatusBadge = (user: User) => {
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

const getStatusColor = (user: User) => {
  if (user.is_banned) return 'text-red-600';
  if (user.is_pending) return 'text-yellow-600';
  if (!user.is_active) return 'text-gray-600';
  return 'text-green-600';
};

export default function AdminUsers({ users, roles = [], permissions = [], filters = {}, userStats }: Props) {
  const [searchTerm, setSearchTerm] = useState(filters.search || '');
  const [selectedStatus, setSelectedStatus] = useState(filters.status || 'all');
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; user: User | null }>({
    open: false,
    user: null,
  });

  const { data, setData, post, processing } = useForm({
    status: '',
    role: '',
    permission: '',
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    router.get('/admin/users', { 
      ...filters, 
      search: searchTerm,
      status: selectedStatus 
    });
  };

  const handleStatusFilter = (status: string) => {
    setSelectedStatus(status);
    router.get('/admin/users', { 
      ...filters, 
      status: status === 'all' ? undefined : status,
      search: searchTerm 
    });
  };

  const toggleUserStatus = async (user: User, status: string) => {
    try {
      const response = await fetch(`/admin/api/users/${user.encoded_id}/toggle-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({ status }),
      });

      if (response.ok) {
        toast.success('User status updated successfully');
        router.reload();
      } else {
        toast.error('Failed to update user status');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const assignRole = async (user: User, roleName: string) => {
    try {
      const response = await fetch(`/admin/api/users/${user.encoded_id}/assign-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({ role: roleName }),
      });

      if (response.ok) {
        toast.success('Role assigned successfully');
        router.reload();
      } else {
        toast.error('Failed to assign role');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const removeRole = async (user: User, roleName: string) => {
    try {
      const response = await fetch(`/admin/api/users/${user.encoded_id}/remove-role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
        },
        body: JSON.stringify({ role: roleName }),
      });

      if (response.ok) {
        toast.success('Role removed successfully');
        router.reload();
      } else {
        toast.error('Failed to remove role');
      }
    } catch (error) {
      toast.error('An error occurred');
    }
  };

  const handleDeleteUser = (user: User) => {
    setDeleteDialog({ open: true, user });
  };

  const confirmDelete = () => {
    if (deleteDialog.user) {
      router.delete(`/admin/users/${deleteDialog.user.encoded_id}`, {
        onSuccess: () => {
          toast.success('User deleted successfully');
          setDeleteDialog({ open: false, user: null });
        },
        onError: () => {
          toast.error('Failed to delete user');
        },
      });
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Users" />

      <AdminLayout>
        <div className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
            <HeadingSmall title="User Management" description="Manage users, roles, and permissions" />
            <Link href="/admin/users/create">
              <Button>Add New User</Button>
            </Link>
          </div>

          {/* Stats Cards */}
          {userStats && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">Total Users</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{userStats.total}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">Active</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-green-600">{userStats.active}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">Inactive</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-gray-600">{userStats.inactive}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">Banned</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-red-600">{userStats.banned}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">Pending</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-yellow-600">{userStats.pending}</div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium leading-tight">Premium</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-blue-600">{userStats.premium}</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Search and Filters */}
          <Card>
            <CardHeader>
              <CardTitle>Search & Filter</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSearch} className="flex gap-4">
                <Input
                  placeholder="Search by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="flex-1"
                />
                <Select value={selectedStatus} onValueChange={handleStatusFilter}>
                  <SelectTrigger className="w-48">
                    <SelectValue placeholder="Filter by status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Users</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="banned">Banned</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
                <Button type="submit">Search</Button>
              </form>
            </CardContent>
          </Card>

          {/* Users Tabs */}
          <Tabs value={selectedStatus} onValueChange={handleStatusFilter} className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="all">All ({userStats?.total || 0})</TabsTrigger>
              <TabsTrigger value="active">Active ({userStats?.active || 0})</TabsTrigger>
              <TabsTrigger value="inactive">Inactive ({userStats?.inactive || 0})</TabsTrigger>
              <TabsTrigger value="banned">Banned ({userStats?.banned || 0})</TabsTrigger>
              <TabsTrigger value="pending">Pending ({userStats?.pending || 0})</TabsTrigger>
            </TabsList>
            
            <TabsContent value={selectedStatus} className="mt-6">
              <Card>
                <CardHeader>
                  <CardTitle>Users ({users?.data?.length || 0})</CardTitle>
                  <CardDescription>
                    Manage user accounts, roles, and permissions
                  </CardDescription>
                </CardHeader>
                                 <CardContent>
                   <div className="overflow-x-auto">
                     <table className="w-full">
                       <thead>
                         <tr className="border-b">
                           <th className="text-left py-3 px-4 font-medium">User</th>
                           <th className="text-left py-3 px-4 font-medium">Status</th>
                           <th className="text-left py-3 px-4 font-medium">Roles</th>
                           <th className="text-left py-3 px-4 font-medium">Joined</th>
                           <th className="text-left py-3 px-4 font-medium">Actions</th>
                         </tr>
                       </thead>
                                              <tbody>
                         {users?.data?.length ? (
                           users.data.map((user) => (
                             <tr key={user.id} className="border-b hover:bg-gray-50 dark:hover:bg-gray-800/50">
                               <td className="py-3 px-4">
                                 <div className="flex items-center gap-3">
                                   <Avatar>
                                     <AvatarFallback>{getInitials(user.name)}</AvatarFallback>
                                   </Avatar>
                                   <div>
                                     <div className="font-medium">{user.name}</div>
                                     <div className="text-sm text-gray-500">{user.email}</div>
                                   </div>
                                 </div>
                               </td>
                               <td className="py-3 px-4">
                                 {getStatusBadge(user)}
                               </td>
                               <td className="py-3 px-4">
                                 <div className="flex gap-1 flex-wrap">
                                   {user.roles?.map((role) => (
                                     <Badge key={role.id} variant="outline">
                                       {role.name}
                                     </Badge>
                                   ))}
                                 </div>
                               </td>
                               <td className="py-3 px-4">
                                 {new Date(user.created_at).toLocaleDateString()}
                               </td>
                               <td className="py-3 px-4">
                                 <div className="flex items-center gap-2">
                                   <Link href={`/admin/users/${user.encoded_id}/edit`}>
                                     <Button variant="outline" size="sm">
                                       Edit
                                     </Button>
                                   </Link>
                                   
                                   {user.id !== 1 && (
                                     <Button 
                                       variant="outline" 
                                       size="sm"
                                       onClick={() => handleDeleteUser(user)}
                                       className="text-red-600 hover:text-red-700 hover:border-red-300"
                                     >
                                       Delete
                                     </Button>
                                   )}
                                   
                                   <DropdownMenu>
                                     <DropdownMenuTrigger asChild>
                                       <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                                         <span className="sr-only">More options</span>
                                         <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                           <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zM12 13a1 1 0 110-2 1 1 0 010 2zM12 20a1 1 0 110-2 1 1 0 010 2z" />
                                         </svg>
                                       </Button>
                                     </DropdownMenuTrigger>
                                 <DropdownMenuContent align="end" className="w-48">
                                   <DropdownMenuItem asChild>
                                     <Link href={`/admin/users/${user.encoded_id}`}>
                                       View Details
                                     </Link>
                                   </DropdownMenuItem>
                                   
                                   <DropdownMenuSeparator />
                                   
                                   {/* Status Actions */}
                                   {user.is_banned ? (
                                     <DropdownMenuItem 
                                       onClick={() => toggleUserStatus(user, 'unbanned')}
                                       className="text-green-600"
                                     >
                                       Unban User
                                     </DropdownMenuItem>
                                   ) : (
                                     <DropdownMenuItem 
                                       onClick={() => toggleUserStatus(user, 'banned')}
                                       className="text-red-600"
                                     >
                                       Ban User
                                     </DropdownMenuItem>
                                   )}
                                   
                                   {user.is_active ? (
                                     <DropdownMenuItem 
                                       onClick={() => toggleUserStatus(user, 'inactive')}
                                     >
                                       Deactivate
                                     </DropdownMenuItem>
                                   ) : (
                                     <DropdownMenuItem 
                                       onClick={() => toggleUserStatus(user, 'active')}
                                       className="text-green-600"
                                     >
                                       Activate
                                     </DropdownMenuItem>
                                   )}
                                   
                                   <DropdownMenuSeparator />
                                   
                                   {/* Role Management */}
                                   {roles?.map((role) => {
                                     const hasRole = user.roles?.some(r => r.name === role.name) || false;
                                     return hasRole ? (
                                       <DropdownMenuItem 
                                         key={role.id}
                                         onClick={() => removeRole(user, role.name)}
                                         className="text-red-600"
                                       >
                                         Remove {role.name}
                                       </DropdownMenuItem>
                                     ) : (
                                       <DropdownMenuItem 
                                         key={role.id}
                                         onClick={() => assignRole(user, role.name)}
                                         className="text-green-600"
                                       >
                                         Assign {role.name}
                                       </DropdownMenuItem>
                                     );
                                   })}
                                   

                                   </DropdownMenuContent>
                                   </DropdownMenu>
                                 </div>
                               </td>
                               </tr>
                             ))
                         ) : (
                           <tr>
                             <td colSpan={5} className="py-8 text-center text-gray-500">
                               No users found
                             </td>
                           </tr>
                         )}
                         </tbody>
                       </table>
                     </div>

                                     {/* Pagination */}
                   {users?.meta?.last_page && users.meta.last_page > 1 && (
                     <div className="flex justify-center mt-4 gap-2">
                       {users?.links?.map((link, index) => (
                        <Button
                          key={index}
                          variant={link.active ? 'default' : 'outline'}
                          size="sm"
                          disabled={!link.url}
                          onClick={() => link.url && router.get(link.url)}
                          dangerouslySetInnerHTML={{ __html: link.label }}
                        />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        {/* Delete Confirmation Dialog */}
        <Dialog open={deleteDialog.open} onOpenChange={(open: boolean) => setDeleteDialog({ open, user: null })}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete User</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{deleteDialog.user?.name}"? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialog({ open: false, user: null })}>
                Cancel
              </Button>
              <Button onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </AdminLayout>
    </AppLayout>
  );
}
