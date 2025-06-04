import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head, Link } from "@inertiajs/react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { LazyImage } from "@/components/ui/lazy-image";
import { CarouselApi } from "@/components/ui/carousel";
import { useState } from "react";
import { ChevronDownIcon, StarIcon } from "lucide-react";

export default function Movies({ movies, imgBaseUrl }: { movies: Array<any>, imgBaseUrl: string }) {

  const [carouselApi, setCarouselApi] = useState<CarouselApi>();


  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Movies (${movies.length})`,
      href: '/movies',
    },
  ];
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Movies`} />
      <div className="relative flex flex-col min-h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] overflow-hidden overflow-y-auto scrollbar bg-zinc-500 _bg-[url('images/libeflix-bg.webp')] bg-cover bg-center">
        <div className="absolute inset-0 size-full dark-gradient-hero" />

        <div className="flex w-full justify-start items-center gap-x-4 px-6 py-2 mt-5 text-zinc-200 text-xl font-semibold z-10 cursor-pointer">
          <div>
            Now Streaming
          </div>
          <div>
              <ChevronDownIcon className="w-5 h-5" />
          </div>
        </div>

        <div className="relative px-4 py-8 mx-auto max-w-screen md:max-w-[calc(100vw-var(--sidebar-width,0px))] _md:group-data-[state=collapsed]/sidebar-wrapper:max-w-[calc(100vw-var(--sidebar-width-icon,0px))]">
          <Ribbon
            align="start"
            dragFree={true}
            onApiInitialized={setCarouselApi}
          >
            {movies.map((movie: any, index: number) => {
              // Prioritize the first 8 movies for better initial load
              const isPriority = index < 8;

              return (
                <RibbonItem
                  key={movie.id}
                  className="cursor-pointer"
                >
                  <Link href={`/movie/${movie.slug}`}>
                    <div className="flex-none w-fit">
                      <div className="relative w-[11rem] h-[17rem] overflow-hidden transition duration-150 ease-in-out rounded-[10px] opacity-[90%] group-hover:opacity-100 group-hover:brightness-[105%]">
                        <LazyImage
                          src={movie.poster_path ? `${imgBaseUrl}${movie.poster_path}` : 'images/default-poster.jpg'}
                          alt={movie.title}
                          className="w-full h-full object-cover"
                          priority={isPriority}
                        />
                        {/* <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" /> */}
                        {/* <div className="absolute bottom-0 left-0 right-0 p-3">
                          <div className="text-center">
                            <div className="text-white text-sm font-semibold leading-tight line-clamp-2 mb-1">
                              {movie.title}
                            </div>
                            <div className="text-gray-300 text-xs">
                              {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                              {movie.vote_average && (
                                <>
                                  {' - '}
                                  <span className="text-rose-400">
                                    {Math.round(movie.vote_average * 10)}%
                                  </span>
                                </>
                              )}
                            </div>
                          </div>
                        </div> */}
                      </div>
                    </div>
                  </Link>
                  <div className="flex flex-col gap-y-2 w-[11rem] py-4 mb-1 mt-1">
                    <div className="text-zinc-300 truncate text-[0.92rem] _text-lg font-semibold _font-staatliches leading-tight line-clamp-2 group-hover:text-zinc-100 transition-colors duration-150 ease-in-out">
                      {movie.title}
                    </div>
                    <div className="flex items-center justify-between gap-x-2">
                      <div className="text-zinc-500 truncate text-xs group-hover:text-zinc-400 transition-colors duration-150 ease-in-out">
                        {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
                      </div>
                      <div className="flex items-center gap-x-1 text-amber-500 truncate text-xs group-hover:text-amber-300 transition-colors duration-150 ease-in-out">
                        <StarIcon className="w-3 h-3" />
                        {movie.vote_average ? Math.round(movie.vote_average * 10) + '%' : 'N/A'}
                      </div>
                    </div>
                  </div>
                  
                </RibbonItem>
              );
            })}
          </Ribbon>
        </div>

      </div>

      {/* <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {movies.map((movie) => (
          <div key={movie.id}>
            <h2>{movie.title}</h2>
          </div>
        ))}
      </div> */}
    </AppLayout>
  );
}