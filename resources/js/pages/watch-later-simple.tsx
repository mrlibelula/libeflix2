import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { MovieRibbon } from "@/components/movie-ribbon";
import { useState } from "react";

export default function WatchLaterSimple({ 
  watchLaterMovies, 
  watchLaterTvshows,
  watchLaterSeasons,
  watchLaterEpisodes,
  imgBaseUrl 
}: { 
  watchLaterMovies: Array<any>,
  watchLaterTvshows: Array<any>,
  watchLaterSeasons: Array<any>,
  watchLaterEpisodes: Array<any>,
  imgBaseUrl: string 
}) {
  const [watchLaterMoviesList, setWatchLaterMoviesList] = useState(watchLaterMovies);

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Watch Later Movies and TV Shows`,
      href: '/watch-later',
    },
  ];

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Watch Later Movies and TV Shows" />

      <div className="p-8">
        <h1 className="text-3xl font-bold mb-6">Watch Later</h1>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-100 p-4 rounded">
            <h2 className="font-semibold">Movies</h2>
            <p>{watchLaterMovies.length} items</p>
          </div>
          
          <div className="bg-green-100 p-4 rounded">
            <h2 className="font-semibold">TV Shows</h2>
            <p>{watchLaterTvshows.length} items</p>
          </div>
          
          <div className="bg-yellow-100 p-4 rounded">
            <h2 className="font-semibold">Seasons</h2>
            <p>{watchLaterSeasons.length} items</p>
          </div>
          
          <div className="bg-purple-100 p-4 rounded">
            <h2 className="font-semibold">Episodes</h2>
            <p>{watchLaterEpisodes.length} items</p>
          </div>
        </div>

        {/* Only show movies for now */}
        {watchLaterMoviesList.length > 0 && (
          <div className="mt-8">
            <MovieRibbon
              movies={watchLaterMoviesList}
              imgBaseUrl={imgBaseUrl}
              title={`Watch Later Movies (${watchLaterMoviesList.length})`}
              ribbonId="watch-later-movies"
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
} 