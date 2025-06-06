import { Link } from "@inertiajs/react";
import { LazyImage } from "@/components/ui/lazy-image";
import { CheckIcon, ClapperboardIcon, HeartIcon, PlusIcon, StarIcon } from "lucide-react";

interface Movie {
  id: number;
  slug: string;
  title: string;
  poster_path?: string;
  release_date?: string;
  vote_average?: number;
}

interface MoviePosterProps {
  movie: Movie;
  imgBaseUrl: string;
  isPriority?: boolean;
}

export function MoviePoster({ movie, imgBaseUrl, isPriority = false }: MoviePosterProps) {
  return (
    <>
      <Link href={`/movie/${movie.slug}`}>
        <div className="flex-none w-fit">
          <div className="relative w-[11rem] h-[17rem] overflow-hidden transition duration-150 ease-in-out rounded-[10px] opacity-[90%] group-hover:opacity-100 group-hover:brightness-[105%]">
            <LazyImage
              src={movie.poster_path ? `${imgBaseUrl}${movie.poster_path}` : '/images/default-poster.jpg'}
              alt={movie.title}
              className="w-full h-full object-cover"
              priority={isPriority}
            />
          </div>
        </div>
      </Link>
      <div className="flex flex-col gap-y-2 w-[11rem] py-4 mb-1 mt-1">
        <div className="text-zinc-600 dark:text-zinc-300 truncate text-[0.92rem] _text-lg font-semibold leading-tight line-clamp-2 group-hover:text-black dark:group-hover:text-zinc-100 transition-colors duration-150 ease-in-out">
          {movie.title}
        </div>
        <div className="flex items-center justify-between gap-x-2">
          <div className="text-zinc-500 truncate text-xs group-hover:text-zinc-400 transition-colors duration-150 ease-in-out">
            {movie.release_date ? new Date(movie.release_date).getFullYear() : 'N/A'}
          </div>
          <div className="flex items-center gap-x-4">
            <div className="flex items-center gap-x-2">
              {/* if movie is in watch later list, show check icon */}
              {movie.is_watch_later ? (
                <CheckIcon className=" text-green-400 w-[1rem] h-[1rem]" />
              ) : (
                <PlusIcon className=" text-zinc-400 w-[1rem] h-[1rem]" />
              )}
              <HeartIcon className=" text-zinc-400 w-[1rem] h-[1rem]" />
              <ClapperboardIcon className=" text-zinc-400 w-[1rem] h-[1rem]" />
            </div>
            <div className="flex items-center gap-x-1 text-amber-500 dark:text-amber-500 truncate text-xs group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors duration-150 ease-in-out">
              <StarIcon className="w-3 h-3" />
              {movie.vote_average ? Math.round(movie.vote_average * 10) + '%' : 'N/A'}
            </div>
          </div>
        </div>
      </div>
    </>
  );
} 