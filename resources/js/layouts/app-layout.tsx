import AppLayoutTemplate from '@/layouts/app/app-sidebar-layout';
import { type BreadcrumbItem } from '@/types';
import { type ReactNode } from 'react';
import { Toaster } from 'sonner';

interface AppLayoutProps {
    children: ReactNode;
    breadcrumbs?: BreadcrumbItem[];
    headerMeta?: ReactNode;
    headerActions?: ReactNode;
}

export default ({ children, breadcrumbs, headerMeta, headerActions, ...props }: AppLayoutProps) => (
    <AppLayoutTemplate
        breadcrumbs={breadcrumbs}
        headerMeta={headerMeta}
        headerActions={headerActions}
        {...props}
    >
        {children}
        <Toaster />
    </AppLayoutTemplate>
);
