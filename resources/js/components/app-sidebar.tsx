import { NavFooter } from '@/components/nav-footer';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link } from '@inertiajs/react';
import { BookOpen, Code2, Clock, Folder, Music, Video, History, TrendingUp, ListFilter, SlidersHorizontal, Gamepad2, LayoutDashboard, Film } from 'lucide-react';
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
    {
        title: 'Vintage Games',
        href: '/vintage-games',
        icon: Gamepad2,
    },
    {
        title: 'Music',
        href: '/music',
        icon: Music,
    },
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
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
