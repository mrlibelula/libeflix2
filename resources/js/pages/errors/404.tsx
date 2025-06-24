import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';

interface ErrorProps {
    status: number;
}

export default function NotFound({ status }: ErrorProps) {
    const breadcrumbs: BreadcrumbItem[] = [
        {
            title: 'Error',
            href: '#',
        },
    ];

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="404 - Not Found" />
            <div className="flex h-full flex-1 flex-col items-center justify-center gap-4 rounded-xl p-5">
                <div className="text-center">
                    <h1 className="text-9xl font-bold text-gray-200 dark:text-gray-700">404</h1>
                    <h2 className="mb-4 text-2xl font-bold">Oops! TV Show Not Found</h2>
                    <p className="mb-8 text-gray-600 dark:text-gray-400">
                        The TV show you're looking for doesn't exist or has been removed.
                    </p>
                    <Link href="/dashboard" className="px-6 py-2 text-sm font-semibold rounded-md bg-rose-600 text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:ring-offset-2">
                        Back to Dashboard
                    </Link>
                </div>
            </div>
        </AppLayout>
    );
} 