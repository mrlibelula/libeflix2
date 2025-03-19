import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'TV Shows',
        href: '/dashboard',
    },
];

const imgUrl = 'https://image.tmdb.org/t/p/w780/';

export default function Dashboard({ tvshows }: { tvshows: Array<{
    id: number;
    folder_name: string;
    tmdb_id: number;
    name: string;
    original_name: string;
    genre_ids: string;
    poster_path: string | null;
    backdrop_path: string | null;
    original_language: string | null;
    overview: string | null;
    popularity: number | null;
    first_air_date: string | null;
    vote_average: number | null;
    vote_count: number | null;
    created_at: string;
    updated_at: string;
}> }) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Dashboard" />
            <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-10">
                <div className="grid auto-rows-min gap-6 sm:gap-8 lg:gap-10 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                    {tvshows.map((tvshow) => (
                        <div className="relative rounded-lg w-full aspect-video overflow-hidden" key={tvshow.id}>
                            <img src={tvshow.backdrop_path ? imgUrl + tvshow.backdrop_path : imgUrl + tvshow.poster_path} alt={tvshow.name} 
                                className="absolute w-full h-full object-cover" />
                        </div>
                    ))}
                </div>
                {/* <div className="grid auto-rows-min gap-4 md:grid-cols-3">
                    <div className="border-sidebar-border/70 dark:border-sidebar-border relative aspect-video overflow-hidden rounded-xl border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                    </div>
                    <div className="border-sidebar-border/70 dark:border-sidebar-border relative aspect-video overflow-hidden rounded-xl border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                    </div>
                    <div className="border-sidebar-border/70 dark:border-sidebar-border relative aspect-video overflow-hidden rounded-xl border">
                        <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                    </div>
                </div>
                <div className="border-sidebar-border/70 dark:border-sidebar-border relative min-h-[100vh] flex-1 overflow-hidden rounded-xl border md:min-h-min">
                    <PlaceholderPattern className="absolute inset-0 size-full stroke-neutral-900/20 dark:stroke-neutral-100/20" />
                </div> */}
            </div>
        </AppLayout>
    );
}
