import AppLayout from "@/layouts/app-layout";
import { Head } from "@inertiajs/react";
import { BreadcrumbItem } from "@/types";
import { MovieRibbon } from "@/components/movie-ribbon";
import { TvshowRibbon } from "@/components/tvshow-ribbon";
import { useState, useCallback } from "react";

export default function Genre({ 
  genre, 
  genreSlug,
  movies, 
  tvshows, 
  imgBaseUrl 
}: { 
  genre: string;
  genreSlug: string;
  movies: Array<any>;
  tvshows: Array<any>;
  imgBaseUrl: string;
}) {
  
  // State management for movies and tvshows
  const [moviesList, setMoviesList] = useState(movies);
  const [tvshowsList, setTvshowsList] = useState(tvshows);
  
  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `${genre} - Genre`,
      href: `/genre/${genreSlug}`,
    },
  ];

  // Handle movie watch later toggle
  const handleMovieWatchLaterToggle = useCallback((movieId: number, newStatus: boolean) => {
    setMoviesList(prev => 
      prev.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_watch_later: newStatus }
          : movie
      )
    );
  }, []);

  // Handle movie like toggle  
  const handleMovieLikeToggle = useCallback((movieId: number, newStatus: boolean, newCount: number) => {
    setMoviesList(prev => 
      prev.map(movie => 
        movie.id === movieId 
          ? { ...movie, is_liked: newStatus, likes_count: newCount }
          : movie
      )
    );
  }, []);

  // Handle tvshow watch later toggle
  const handleTvshowWatchLaterToggle = useCallback((tvshowId: number, newStatus: boolean) => {
    setTvshowsList(prev => 
      prev.map(tvshow => 
        tvshow.id === tvshowId 
          ? { ...tvshow, is_watch_later: newStatus }
          : tvshow
      )
    );
  }, []);

  // Handle tvshow like toggle
  const handleTvshowLikeToggle = useCallback((tvshowId: number, newStatus: boolean, newCount: number) => {
    setTvshowsList(prev => 
      prev.map(tvshow => 
        tvshow.id === tvshowId 
          ? { ...tvshow, is_liked: newStatus, likes_count: newCount }
          : tvshow
      )
    );
  }, []);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${genre} - Movies & TV Shows`} />

      <div className="flex flex-col gap-y-10 py-5">
        
        {/* Movies Ribbon */}
        {moviesList.length > 0 && (
          <MovieRibbon
            movies={moviesList}
            imgBaseUrl={imgBaseUrl}
            title={`${genre} Movies (${moviesList.length})`}
            ribbonId={`genre-${genre}-movies`}
            hideSortOptions={['added']}
            onWatchLaterToggle={handleMovieWatchLaterToggle}
            onLikeToggle={handleMovieLikeToggle}
          />
        )}

        {/* TV Shows Ribbon */}
        {tvshowsList.length > 0 && (
          <TvshowRibbon
            tvshows={tvshowsList}
            imgBaseUrl={imgBaseUrl}
            title={`${genre} TV Shows (${tvshowsList.length})`}
            ribbonId={`genre-${genre}-tvshows`}
            hideSortOptions={['added']}
            onWatchLaterToggle={handleTvshowWatchLaterToggle}
            onLikeToggle={handleTvshowLikeToggle}
          />
        )}

        {/* Empty state */}
        {moviesList.length === 0 && tvshowsList.length === 0 && (
          <div className="px-5">
            <div className="text-center py-16">
              <h2 className="text-xl font-semibold text-neutral-600 dark:text-neutral-400 mb-2">
                No content found
              </h2>
              <p className="text-neutral-500 dark:text-neutral-500">
                We couldn't find any movies or TV shows in the {genre} genre.
              </p>
            </div>
          </div>
        )}

      </div>
        
        
    </AppLayout>
  );
} 