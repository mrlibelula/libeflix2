import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { BookOpen, Clock, Folder, Music, Video, History, TrendingUp, ListFilter, SlidersHorizontal, Gamepad2, LayoutDashboard, Film, LogIn, UserPlus, Home, Tv, Handshake, Search, Clapperboard } from 'lucide-react';
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
        title: 'Party Theater',
        href: '/party',
        icon: Clapperboard,
    },
    {
        title: 'Watch Later',
        href: '/watch-later',
        icon: Clock,
    },
    {
        title: 'History',
        href: '/history',
        icon: History,
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
];

const footerNavItems: NavItem[] = [
    {
        title: 'Libe.dev',
        href: 'https://libe.dev',
        iconSrc: '/images/libesoft.io_inv.png',
    },
    {
        title: 'Repository',
        href: 'https://github.com/mrlibelula/libeflix2',
        icon: Folder,
    },
    {
        title: 'Documentation',
        href: 'https://libe.dev/blog/the-hard-part-of-a-netflix-clone-content-security',
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
