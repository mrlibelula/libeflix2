import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import AdminLayout from '@/layouts/admin/layout';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
import { TabsTrigger } from '@/components/ui/tabs';

const breadcrumbs: BreadcrumbItem[] = [
  {
    title: 'Admin Users',
    href: '/admin/users',
  },
];

export default function Dashboard() {
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Admin Users" />

      <AdminLayout>

        <div className="mt-10_">
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="w-full">
              <TabsTrigger value="all">All</TabsTrigger>
              <TabsTrigger value="active">Active</TabsTrigger>
              <TabsTrigger value="inactive">Inactive</TabsTrigger>
              <TabsTrigger value="banned">Banned</TabsTrigger>
              <TabsTrigger value="pending">Pending</TabsTrigger>
            </TabsList>
            <TabsContent value="all">
              <div className="space-y-6 mt-4">
                <HeadingSmall title="All Users" description="All Users" />
              </div>
            </TabsContent>
            <TabsContent value="active">
              <div className="space-y-6 mt-4">
                <HeadingSmall title="Active Users" description="Active Users" />
              </div>
            </TabsContent>
            <TabsContent value="inactive">
              <div className="space-y-6 mt-4">
                <HeadingSmall title="Inactive Users" description="Inactive Users" />
              </div>
            </TabsContent>
            <TabsContent value="banned">
              <div className="space-y-6 mt-4">
                <HeadingSmall title="Banned Users" description="Banned Users" />
              </div>
            </TabsContent>
            <TabsContent value="pending">
              <div className="space-y-6 mt-4">
                <HeadingSmall title="Pending Users" description="Pending Users" />
              </div>
            </TabsContent>
          </Tabs>
        </div>

      </AdminLayout>
    </AppLayout>
  );
}
