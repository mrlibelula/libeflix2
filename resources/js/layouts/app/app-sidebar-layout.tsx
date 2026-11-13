import { AppContent } from '@/components/app-content';
import { AppShell } from '@/components/app-shell';
import { AppSidebar } from '@/components/app-sidebar';
import { AppSidebarHeader } from '@/components/app-sidebar-header';
import { type BreadcrumbItem } from '@/types';
import { type PropsWithChildren, type ReactNode } from 'react';

export default function AppSidebarLayout({
    children,
    breadcrumbs = [],
    headerMeta,
    headerActions,
}: PropsWithChildren<{
    breadcrumbs?: BreadcrumbItem[];
    headerMeta?: ReactNode;
    headerActions?: ReactNode;
}>) {
    return (
        <AppShell variant="sidebar">
            <AppSidebar />
            <AppContent variant="sidebar">
                <AppSidebarHeader
                    breadcrumbs={breadcrumbs}
                    headerMeta={headerMeta}
                    headerActions={headerActions}
                />
                {children}
            </AppContent>
        </AppShell>
    );
}
