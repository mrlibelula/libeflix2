import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { type PropsWithChildren } from 'react';

const sidebarNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/admin/dashboard',
        icon: null,
    },
    {
        title: 'Users',
        href: '/admin/users',
        icon: null,
    },
    {
        title: 'Content Management',
        href: '/admin/content-management',
        icon: null,
    },
    {
        title: 'FFMpeg Tasks',
        href: '/admin/ffmpeg-tasks',
        icon: null,
    },
    {
        title: 'Engagement',
        href: '/admin/engagement',
        icon: null,
    },
    {
        title: 'Search Engine Analytics',
        href: '/admin/search-engine',
        icon: null,
    },
    {
        title: 'Comments',
        href: '/admin/comments',
        icon: null,
    },
    {
        title: 'Error & Status Logs',
        href: '/admin/error-logs',
        icon: null,
    },
    {
        title: 'Storage Monitor',
        href: '/admin/storage-monitor',
        icon: null,
    },
    {
        title: 'Analytics',
        href: '/admin/analytics',
        icon: null,
    },
];

export default function AdminFullWidthLayout({ children }: PropsWithChildren) {
    // When server-side rendering, we only render the layout on the client...
    if (typeof window === 'undefined') {
        return null;
    }

    const currentPath = window.location.pathname;

    // Function to check if a nav item should be active
    const isNavItemActive = (href: string) => {
        // Exact match
        if (currentPath === href) {
            return true;
        }
        
        // For Users section, also match sub-routes
        if (href === '/admin/users' && currentPath.startsWith('/admin/users')) {
            return true;
        }
        
        // Add more sub-route matching for other sections as needed
        // if (href === '/admin/content-management' && currentPath.startsWith('/admin/content-management')) {
        //     return true;
        // }
        
        return false;
    };

    return (
        <div className="px-4 py-6 max-w-full overflow-x-hidden">
            <Heading title="Libeflix Admin Panel" description="Manage movies, tv shows, users, roles, permissions, analytics, engagement, and more" />

            <div className="flex flex-col space-y-8 lg:flex-row lg:space-y-0 lg:space-x-12 max-w-full">
                <aside className="w-full max-w-xl lg:w-48 flex-shrink-0">
                    <nav className="flex flex-col space-y-1 space-x-0">
                        {sidebarNavItems.map((item) => (
                            <Button
                                key={item.href}
                                size="sm"
                                variant="ghost"
                                asChild
                                className={cn('w-full justify-start', {
                                    'bg-muted': isNavItemActive(item.href),
                                })}
                            >
                                <Link href={item.href} prefetch>
                                    {item.title}
                                </Link>
                            </Button>
                        ))}
                    </nav>
                </aside>

                <Separator className="my-6 md:hidden" />

                {/* Full width content area */}
                <div className="flex-1 min-w-0 overflow-hidden max-w-full">
                    <section className="space-y-12 max-w-full">{children}</section>
                </div>
            </div>
        </div>
    );
}

