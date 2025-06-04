import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MoviePoster } from "@/components/libeflix/movie-poster";

export default function Movies({ movies }: { movies: Array<any> }) {

  const imgUrl = 'https://image.tmdb.org/t/p/w500/';

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Movies (${movies.length})`,
      href: '/movies',
    },
  ];
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Movies`} />
      <div className="relative flex flex-col min-h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] overflow-hidden overflow-y-auto scrollbar bg-[url('images/libeflix-bg.webp')] bg-cover bg-center">
        <div className="absolute inset-0 size-full dark-gradient-hero" />

        <div className="relative z-10">
          <div className="mx-auto px-5 py-7">
            {/* ribbon */}
            <div className="flex items-center gap-x-5">
              <MoviePoster />
              <MoviePoster />
              <MoviePoster />
              <MoviePoster />
              <MoviePoster />
            </div>
          </div>
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