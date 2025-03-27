import { Button } from '@/components/ui/button';
import { PlaceholderPattern } from '@/components/ui/placeholder-pattern';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link } from '@inertiajs/react';
import { LoaderCircle } from 'lucide-react';

export default function Dashboard({ tvshows }: { tvshows: Array<any> }) {
  const imgUrl = 'https://image.tmdb.org/t/p/w500/';
  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `TV Shows (${tvshows.length})`,
      href: '/dashboard',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="TV Shows" />
      {/* hero */}

      <div className="flex h-full flex-1 flex-col gap-4 rounded-xl p-5">
        <div className="grid auto-rows-min gap-5 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {tvshows.map((tvshow) => (
            <div className="relative group rounded-xl overflow-hidden shadow-lg shadow-neutral-600 dark:shadow-black transition-all duration-[250ms]" key={tvshow.id}>
              <div className="relative cursor-default w-full rounded-xl aspect-video overflow-hidden opacity-[93%] dark:opacity-[80%] hover:opacity-100 hover:dark:opacity-100 transition-all duration-[250ms]">
                <img src={tvshow.backdrop_path ? imgUrl + tvshow.backdrop_path : imgUrl + tvshow.poster_path} alt={tvshow.name}
                  className="absolute w-full h-full object-cover" />
                <div className="dark-gradient absolute inset-0 size-full" />
                {/* <div className="hidden group-hover:flex absolute top-0 left-0 w-full h-full items-center justify-center transition-all duration-[250ms]">
                                    <div className="w-10 h-10 rounded-full text-neutral-400 dark:text-neutral-300/50 hover:text-white/60 hover:dark:text-white/60 bg-white/10 backdrop-blur-xs flex items-center justify-center transition-all duration-[250ms] cursor-pointer">
                                        <svg data-slot="icon" fill="none" stroke-width="1.5" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"></path>
                                            <path stroke-linecap="round" stroke-linejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z"></path>
                                        </svg>
                                    </div>
                                </div> */}
                <div className="absolute bottom-0 text-center w-full p-3">
                  {
                    !tvshow.logo
                      ?
                      <h2 className="text-white leading-none font-semibold rounded px-1 py-0.5 w-full mx-auto text-sm group-hover:-translate-y-8 group-hover:text-[1.1rem] transition-all duration-[250ms]">
                        {tvshow.name}
                      </h2>
                      :
                      <div className="flex items-center justify-center gap-x-2 group-hover:-translate-y-8 group-hover:text-[1.1rem] transition-all duration-[250ms]">
                        <img src={tvshow.logo?.url} className="mb-2 w-[40%] group-hover:scale-[118%] transition-all duration-[250ms]" alt="" />
                      </div>
                  }
                  <div className=" hidden group-hover:flex justify-center gap-x-1 absolute text-white/60 text-sm bottom-1 left-0 right-0 px-3 py-2.5 transition-all duration-[250ms]">
                    <span className="text-white">⭐{Math.round(tvshow.vote_average * 10)}%</span>
                    <span className="text-white/30">•</span>
                    <span>{tvshow.seasons_count > 1 ? `${tvshow.seasons_count} Seasons` : `${tvshow.seasons_count} Season`}</span>
                    <span className="text-white/30">•</span>
                    <Link href={`/tvshow/${tvshow.slug}`} className="cursor-pointer uppercase text-emerald-500 dark:text-emerald-400 hover:text-emerald-300 dark:hover:text-emerald-300 transition-all duration-[250ms] font-semibold">
                      Play
                    </Link>
                  </div>
                </div>
              </div>
              {/* <div className="absolute hidden group-hover:flex z-40 text-8xl w-full items-center justify-center bg-neutral-950_ bg-red-500 group-hover:shadow-xl group-hover:shadow-neutral-500/50 group-hover:dark:shadow-neutral-300/50 transition-all duration-[250ms]">
                                hola
                            </div> */}
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
