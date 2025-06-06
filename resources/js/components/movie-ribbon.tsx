import { useState } from "react";
import { ChevronDownIcon } from "lucide-react";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { MoviePoster } from "@/components/movie-poster";

interface MovieRibbonProps {
  movies: Array<any>;
  imgBaseUrl: string;
  title?: string;
}

export function MovieRibbon({ 
  movies, 
  imgBaseUrl, 
  title = "Now Streaming",
}: MovieRibbonProps) {

  const [isRibbonOpen, setIsRibbonOpen] = useState(true);

  const toggleRibbon = () => {
    setIsRibbonOpen(!isRibbonOpen);
  };

  return (
    <div className="relative px-4 mx-auto w-full max-w-screen md:max-w-[calc(100vw-var(--sidebar-width,0px)-10px)] _md:group-data-[state=collapsed]/sidebar-wrapper:max-w-[calc(100vw-var(--sidebar-width-icon,0px))]">
      {/* ribbon header */}
      <div onClick={toggleRibbon} className="flex w-full justify-start items-center select-none gap-x-4 px-2 mb-8 mt-5 text-zinc-900 dark:text-zinc-200 text-xl font-semibold z-10 cursor-pointer hover:text-black dark:hover:text-zinc-100 transition-colors duration-200 ease-in-out">
        <div>
          {title}
        </div>
        <ChevronDownIcon className={`w-5 h-5 transition-transform duration-300 ease-in-out ${!isRibbonOpen ? 'rotate-[270deg]' : 'rotate-0'}`} />
      </div>
      {/* ribbon content */}
      <div className={`transition-all duration-500 ease-in-out transform-gpu overflow-hidden ${
        isRibbonOpen 
          ? 'opacity-100 translate-y-0 scale-100 h-auto pt-4' 
          : 'opacity-0 -translate-y-4 scale-95 pointer-events-none h-0 pt-0'
      }`}>
        <Ribbon
          align="start"
          dragFree={true}
        >
          {movies.map((movie: any, index: number) => {
            // Prioritize the first 8 movies for better initial load
            const isPriority = index < 8;

            return (
              <RibbonItem
                key={movie.id}
              >
                <MoviePoster
                  movie={movie}
                  imgBaseUrl={imgBaseUrl}
                  isPriority={isPriority}
                />
              </RibbonItem>
            );
          })}
        </Ribbon>
      </div>
    </div>
  );
} 