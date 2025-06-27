import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, Code2, Clock, Folder, Music, Video, History, TrendingUp, ListFilter, SlidersHorizontal, Gamepad2, LayoutDashboard, Film, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
    },
    {
        title: 'TV Shows',
        href: '/tvshows',
        icon: Video,
    },
    {
        title: 'Movies',
        href: '/movies',
        icon: Film,
    },
    {
        title: 'Watch Later',
        href: '/watch-later',
        icon: Clock,
    },
    {
        title: 'Popular/Top',
        href: '/popular-top',
        icon: TrendingUp,
    },
    // {
    //     title: 'Top',
    //     href: '/top',
    //     icon: ListFilter,
    // },
    // {
    //     title: 'Vintage Games',
    //     href: '/vintage-games',
    //     icon: Gamepad2,
    // },
    // {
    //     title: 'Music',
    //     href: '/music',
    //     icon: Music,
    // },
    // {
    //     title: 'History',
    //     href: '/history',
    //     icon: History,
    // },
    // {
    //     title: 'Control Panel',
    //     href: '/cpanel',
    //     icon: SlidersHorizontal,
    // },
];

const footerNavItems: NavItem[] = [
    {
        title: 'Libe.dev',
        href: 'https://libe.dev',
        icon: Code2,
    },
    {
        title: 'Repository',
        href: 'https://github.com/laravel/react-starter-kit',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://laravel.com/docs/starter-kits',
        icon: BookOpen,
    },
];

export function AppSidebar() {
    const { isAuthenticated, isLoading } = useAuth();

    // Show loading state during hydration
    if (isLoading) {
        return (
            <Sidebar collapsible="icon" variant="inset">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link href="/dashboard" prefetch>
                                    <AppLogo />
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <NavMain items={mainNavItems} />
                </SidebarContent>
                <SidebarFooter>
                    <NavFooter items={footerNavItems} className="mt-auto" />
                    {/* Show placeholder during hydration */}
                    <div className="h-12 animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md"></div>
                </SidebarFooter>
            </Sidebar>
        );
    }

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href="/dashboard" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} />
            </SidebarContent>

            <SidebarFooter>
                <NavFooter items={footerNavItems} className="mt-auto" />
                {isAuthenticated ? (
                    <NavUser />
                ) : (
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <Link href={'/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)}>
                                    <LogIn className="size-4" />
                                    <span>Sign in</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        <SidebarMenuItem>
                            <SidebarMenuButton asChild>
                                <Link href={'/register?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)}>
                                    <UserPlus className="size-4" />
                                    <span>Sign up</span>
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                )}
            </SidebarFooter>
        </Sidebar>
    );
}
