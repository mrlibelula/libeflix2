import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { useState } from "react";

export default function Movies({ movies, imgBaseUrl, watchLaterMovies }: { movies: Array<any>, imgBaseUrl: string, watchLaterMovies: Array<any> }) {
  const [allMovies, setAllMovies] = useState(movies);
  const [watchLaterMoviesList, setWatchLaterMoviesList] = useState(watchLaterMovies);

  const handleWatchLaterToggle = (movieId: number, newStatus: boolean) => {
    // Update the is_watch_later status in both lists
    setAllMovies(prevMovies => 
      prevMovies.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    );

    if (newStatus) {
      // Add to watch later list if not already there (prepend to maintain DESC order)
      const movieToAdd = allMovies.find(movie => movie.id === movieId);
      if (movieToAdd && !watchLaterMoviesList.find(movie => movie.id === movieId)) {
        setWatchLaterMoviesList(prev => [{ ...movieToAdd, is_watch_later: true }, ...prev]);
      }
    } else {
      // Remove from watch later list
      setWatchLaterMoviesList(prev => prev.filter(movie => movie.id !== movieId));
    }
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Movies (${allMovies.length})`,
      href: '/movies',
    },
  ];
  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`Movies`} />

        <MovieRibbon
          movies={allMovies}
          imgBaseUrl={imgBaseUrl}
          onWatchLaterToggle={handleWatchLaterToggle}
        />

        <MovieRibbon
          movies={watchLaterMoviesList}
          imgBaseUrl={imgBaseUrl}
          title="Watch Later"
          onWatchLaterToggle={handleWatchLaterToggle}
        />
        
    </AppLayout>
  );
}