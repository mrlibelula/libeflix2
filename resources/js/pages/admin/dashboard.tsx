import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

import HeadingSmall from '@/components/heading-small';
import AppLayout from '@/layouts/app-layout';
import AdminLayout from '@/layouts/admin/layout';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Admin Dashboard',
        href: '/admin/dashboard',
    },
];

export default function Dashboard() {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Admin Dashboard" />

            <AdminLayout>
                <div className="space-y-6">
                    <HeadingSmall title="Dashboard" description="Dashboard" />
                </div>
            </AdminLayout>
        </AppLayout>
    );
}
