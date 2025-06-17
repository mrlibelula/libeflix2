import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { LazyImage } from '@/components/ui/lazy-image';

export default function Tvshows({ tvshows, searchQuery }: { tvshows: Array<any>, searchQuery?: string }) {
  const imgUrl = 'https://image.tmdb.org/t/p/w500/';
  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: searchQuery 
        ? `TV Shows (${tvshows.length}) - Search: "${searchQuery}"`
        : `TV Shows (${tvshows.length})`,
      href: '/tvshows',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={searchQuery ? `TV Shows - Search: "${searchQuery}"` : "TV Shows"} />
      {/* hero */}

      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-5">
        {searchQuery && (
          <div className="mb-4">
            <h2 className="text-lg font-semibold mb-2">
              Search results for: "<span className="text-rose-500">{searchQuery}</span>"
            </h2>
            <p className="text-sm text-muted-foreground">
              Found {tvshows.length} TV {tvshows.length === 1 ? 'show' : 'shows'}
            </p>
          </div>
        )}
        
        <div className="grid auto-rows-min gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {tvshows.map((tvshow, index) => {
            // Prioritize the first 8-10 TV shows for initial viewport (typical grid on desktop)
            const isPriority = index < 10;
            
            return (
              <Link href={`/tvshow/${tvshow.slug}`} className="relative group rounded-xl overflow-hidden shadow-lg shadow-neutral-600 dark:shadow-black transition-all duration-[250ms] touch-manipulation" key={tvshow.id}>
                <div className="relative cursor-pointer w-full rounded-xl aspect-video overflow-hidden opacity-[93%] dark:opacity-[80%] hover:opacity-100 hover:dark:opacity-100 active:opacity-100 active:dark:opacity-100 focus:opacity-100 focus:dark:opacity-100 transition-all duration-[250ms]">
                  <LazyImage 
                    src={tvshow.backdrop_path ? imgUrl + tvshow.backdrop_path : imgUrl + tvshow.poster_path} 
                    alt={tvshow.name}
                    className="absolute w-full h-full object-cover"
                    priority={isPriority}
                  />
                
                <div className="dark-gradient absolute inset-0 size-full" />

                <div className="absolute bottom-0 text-center w-full p-3">
                  {
                    !tvshow.logo
                      ?
                      <h2 className="text-white leading-none font-semibold rounded px-1 py-0.5 w-full mx-auto text-sm group-hover-touch:-translate-y-8 group-hover-touch:text-[1.1rem] force-show-on-touch transition-all duration-[250ms]">
                        {tvshow.name}
                      </h2>
                      :
                      <div className="flex items-center justify-center gap-x-2 group-hover-touch:-translate-y-8 group-hover-touch:text-[1.1rem] force-show-on-touch transition-all duration-[250ms]">
                        <img src={tvshow.logo?.url} className="mb-2 w-[40%] group-hover-touch:scale-[118%] force-scale-on-touch transition-all duration-[250ms]" alt="" />
                      </div>
                  }
                  <div className="hidden group-hover-touch:flex justify-center gap-x-1 absolute text-white/60 text-sm bottom-1 left-0 right-0 px-3 py-2.5 force-show-on-touch transition-all duration-[250ms]">
                    <span className="text-white">⭐{Math.round(tvshow.vote_average * 10)}%</span>
                    <span className="text-white/30">•</span>
                    <span>{tvshow.seasons_count > 1 ? `${tvshow.seasons_count} Seasons` : `${tvshow.seasons_count} Season`}</span>
                  </div>
                </div>
              </div>
            </Link>
            );
          })}
        </div>

        {tvshows.length === 0 && searchQuery && (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="text-6xl mb-4">🔍</div>
            <h3 className="text-lg font-semibold mb-2">No TV shows found</h3>
            <p className="text-muted-foreground max-w-md">
              We couldn't find any TV shows matching "<span className="font-medium">{searchQuery}</span>". 
              Try adjusting your search terms or browse all TV shows.
            </p>
            <Link 
              href="/tvshows" 
              className="mt-4 px-4 py-2 bg-rose-500 text-white rounded-md hover:bg-rose-600 transition-colors"
            >
              View All TV Shows
            </Link>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
