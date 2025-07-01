import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { BookOpen, Code2, Clock, Folder, Music, Video, History, TrendingUp, ListFilter, SlidersHorizontal, Gamepad2, LayoutDashboard, Film, LogIn, UserPlus, Home, Tv, Handshake, Search } from 'lucide-react';
import { useAuth } from '@/hooks/use-auth';
import AppLogo from './app-logo';

const mainNavItems: NavItem[] = [
    {
        title: 'Home',
        href: '/',
        icon: Home,
    },
    {
        title: 'TV Shows',
        href: '/tvshows',
        icon: Tv,
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
    {
        title: 'Free Content',
        href: '/free-media',
        icon: Handshake,
    },
    {
        title: 'Search',
        href: '/search',
        icon: Search,
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
    const page = usePage<{ genres?: Array<{ name: string; slug: string }> }>();
    const genres = page.props.genres || [];

    // Show loading state during hydration
    if (isLoading) {
        return (
            <Sidebar collapsible="icon" variant="inset">
                <SidebarHeader>
                    <SidebarMenu>
                        <SidebarMenuItem>
                            <SidebarMenuButton size="lg" asChild>
                                <Link href="/" prefetch>
                                    <AppLogo />
                                </Link>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                    </SidebarMenu>
                </SidebarHeader>
                <SidebarContent>
                    <NavMain items={mainNavItems} genres={genres} />
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
                            <Link href="/" prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>
            </SidebarHeader>

            <SidebarContent>
                <NavMain items={mainNavItems} genres={genres} />
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
