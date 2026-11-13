import { Breadcrumbs } from '@/components/breadcrumbs';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { type BreadcrumbItem as BreadcrumbItemType } from '@/types';
import { MovieSearchModal } from '@/components/movie-search-modal';
import { TvshowSearchModal } from '@/components/tvshow-search-modal';
import { usePage } from '@inertiajs/react';
import { type ReactNode } from 'react';

export function AppSidebarHeader({
    breadcrumbs = [],
    headerMeta,
    headerActions,
}: {
    breadcrumbs?: BreadcrumbItemType[];
    headerMeta?: ReactNode;
    headerActions?: ReactNode;
}) {
    const page = usePage();
    
    // Check if we should show movie search (on movies, movie pages, popular-top, and watch-later pages)
    const shouldShowMovieSearch = page.url.startsWith('/movies') || page.url.startsWith('/movie/') || page.url.startsWith('/popular-top') || page.url.startsWith('/watch-later');
    
    // Check if we should show TV show search (on tvshows and tvshow pages)
    const shouldShowTvshowSearch = page.url.startsWith('/tvshows') || page.url.startsWith('/tvshow/');
    
    return (
        <header className="border-sidebar-border/50 flex h-16 min-w-0 shrink-0 items-center gap-2 overflow-x-hidden border-b px-3 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 sm:px-4 md:px-4">
            <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                <SidebarTrigger className="-ml-1 shrink-0" />
                <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
                    <Breadcrumbs breadcrumbs={breadcrumbs} />
                    {headerMeta}
                </div>
            </div>
            {headerActions && (
                <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                    {headerActions}
                </div>
            )}
            {!headerActions && shouldShowMovieSearch && (
                <div className="flex items-center">
                    <MovieSearchModal />
                </div>
            )}
            {!headerActions && shouldShowTvshowSearch && (
                <div className="flex items-center">
                    <TvshowSearchModal />
                </div>
            )}
        </header>
    );
}
