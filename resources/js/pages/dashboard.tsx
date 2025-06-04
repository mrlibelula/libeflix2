import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';

export default function Dashboard() {
  
  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Dashboard`,
      href: '/dashboard',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Dashboard" />
      <div className="px-5 py-7">
        <h1>Dashboard</h1>
      </div>
    </AppLayout>
  );
}
