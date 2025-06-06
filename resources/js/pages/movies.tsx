import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";

export default function Movies({ movies, imgBaseUrl, watchLaterMovies }: { movies: Array<any>, imgBaseUrl: string, watchLaterMovies: Array<any> }) {

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Movies (${movies.length})`,
      href: '/movies',
    },
  ];
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Movies`} />

        <MovieRibbon
          movies={movies}
          imgBaseUrl={imgBaseUrl}
        />

        <MovieRibbon
          movies={watchLaterMovies}
          imgBaseUrl={imgBaseUrl}
          title="Watch Later"
        />
        
    </AppLayout>
  );
}