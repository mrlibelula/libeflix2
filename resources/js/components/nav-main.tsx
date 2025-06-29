import { SidebarGroup, SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from '@/components/ui/sidebar';
import { type NavItem } from '@/types';
import { Link, usePage } from '@inertiajs/react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { useState, useEffect } from 'react';

interface Genre {
    name: string;
    slug: string;
}

export function NavMain({ items = [], genres = [] }: { items: NavItem[]; genres?: Genre[] }) {
    const page = usePage();
    const { state } = useSidebar();

    const isItemActive = (item: NavItem) => {
        if (item.title === 'TV Shows') {
            return page.url === item.href || page.url.startsWith('/tvshow');
        }
        if (item.title === 'Movies') {
            return page.url === item.href || page.url.startsWith('/movie');
        }
        return item.href === page.url;
    };

    const [isGenresExpanded, setIsGenresExpanded] = useState(() => {
        // Initialize from localStorage, default to false
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('sidebar-genres-expanded');
            return saved ? JSON.parse(saved) : false;
        }
        return false;
    });

    // State to track if we should show genres (with animation delay)
    const [showGenres, setShowGenres] = useState(state === "expanded");

    // Persist genres expansion state to localStorage
    useEffect(() => {
        if (typeof window !== 'undefined') {
            localStorage.setItem('sidebar-genres-expanded', JSON.stringify(isGenresExpanded));
        }
    }, [isGenresExpanded]);

    // Handle sidebar state changes with animation delay
    useEffect(() => {
        if (state === "expanded") {
            // Delay showing genres to wait for sidebar expansion animation
            const timer = setTimeout(() => {
                setShowGenres(true);
            }, 300); // 300ms delay to match typical sidebar animation
            return () => clearTimeout(timer);
        } else {
            // Hide genres immediately when sidebar collapses
            setShowGenres(false);
        }
    }, [state]);

    const isGenreActive = (genre: Genre) => {
        return page.url === `/genre/${genre.slug}`;
    };

    const toggleGenres = () => {
        setIsGenresExpanded(!isGenresExpanded);
    };

    return (
        <SidebarGroup className="px-2 py-0">
            <SidebarGroupLabel>Platform</SidebarGroupLabel>
            <SidebarMenu>
                {items.map((item) => (
                    <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild isActive={isItemActive(item)}>
                            <Link 
                                href={item.href} 
                                prefetch={false}
                                preserveScroll={false}
                                preserveState={false}
                            >
                                {item.icon && <item.icon />}
                                <span>{item.title}</span>
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                ))}
            </SidebarMenu>
            
            {/* Collapsible Genres Section - Only show when sidebar is expanded and animation completed */}
            {showGenres && (
                <>
                    <button
                        onClick={toggleGenres}
                        className="mt-2 flex items-center justify-between w-full px-2 py-1.5 text-xs font-medium text-sidebar-foreground/70 outline-none ring-sidebar-ring transition-[margin,opa] duration-200 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:ring-2 [&>svg]:size-4 [&>svg]:shrink-0 rounded-md"
                        aria-expanded={isGenresExpanded}
                        aria-label={isGenresExpanded ? "Collapse genres" : "Expand genres"}
                    >
                        <span>Genres</span>
                        {isGenresExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                        ) : (
                            <ChevronRight className="h-4 w-4" />
                        )}
                    </button>
                    
                    {isGenresExpanded && (
                        <SidebarMenu>
                            {genres.map((genre) => (
                                <SidebarMenuItem key={genre.slug}>
                                    <SidebarMenuButton asChild isActive={isGenreActive(genre)}>
                                        <Link 
                                            href={`/genre/${genre.slug}`} 
                                            prefetch={false}
                                            preserveScroll={false}
                                            preserveState={false}
                                        >
                                            <span>{genre.name}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    )}
                </>
            )}
        </SidebarGroup>
    );
}
