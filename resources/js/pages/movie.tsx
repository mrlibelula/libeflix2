import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";
import { Clapperboard, HeartIcon, MessageSquareText, Share2 } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { CreditPoster } from "@/components/ui/credit-poster";
import { useEffect, useState } from "react";

// Interface for sidebar state event
interface SidebarStateDetail {
  state: 'expanded' | 'collapsed';
  width: string;
  isMobile: boolean;
}

export default function Movie({ movie, encFilePath, imgBaseUrl300, imgBaseUrl500, imgBaseUrl780, imgBaseUrl1280 }: { movie: any, encFilePath: string, imgBaseUrl300: string, imgBaseUrl500: string, imgBaseUrl780: string, imgBaseUrl1280: string }) {
  const breadcrumbs: BreadcrumbItem[] = [ 
    {
      title: `${movie.title}`,
      href: `/movie/${movie.slug}`,
    },
  ];

  // Parse subtitles if they exist
  const subtitles = Array.isArray(movie.subtitles) ? movie.subtitles : [];

  // Helper function to get initial sidebar width from cookie
  const getInitialSidebarWidth = () => {
    if (typeof document !== 'undefined') {
      const cookies = document.cookie.split(';');
      const sidebarCookie = cookies.find(cookie => cookie.trim().startsWith('sidebar_state='));
      if (sidebarCookie) {
        const isExpanded = sidebarCookie.split('=')[1] === 'true';
        return isExpanded ? '12rem' : '3rem';
      }
    }
    return '12rem'; // Default to expanded if no cookie found
  };

  // State to track sidebar width for dynamic CSS calculations
  const [sidebarWidth, setSidebarWidth] = useState(getInitialSidebarWidth());

  // Listen for sidebar state changes
  useEffect(() => {
    const handleSidebarStateChange = (event: CustomEvent<SidebarStateDetail>) => {
      const { state, width, isMobile } = event.detail;
      if (!isMobile) {
        setSidebarWidth(width);
      }
    };

    window.addEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    
    return () => {
      window.removeEventListener('sidebarStateChange', handleSidebarStateChange as EventListener);
    };
  }, []);

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${movie.title}`} />

      {/* <div className=" h-full w-full bg-black">
        <div className="relative bg-black h-[calc(100vh-5rem)] w-full text-white focus:outline-none">
          <video 
            className="w-full h-full object-cover_ focus:outline-none"  
            controls 
            poster={`${imgBaseUrl780}${movie.backdrop_path}`}
          >
            <source src={`/movie/stream/${encFilePath}`} type="video/mp4" />
            
            {subtitles.map((subtitle: any, index: number) => (
              <track 
                key={index}
                kind="subtitles"
                src={`/movie/subtitles/${subtitle.encPath}`}
                srcLang={subtitle.languageCode.toLowerCase()}
                label={subtitle.languageName}
                default={index === 0} // Set first subtitle as default
              />
            ))}
            
            Your browser does not support the video tag.
          </video>
        </div>
      </div> */}

      {/* <div>
        <div className="flex flex-col 2xl:flex-row items-start justify-between p-0 2xl:p-5">
          <div className="flex flex-col w-full min-w-[75%]">
            <div className="bg-black text-white 2xl:rounded-lg 2xl:overflow-hidden focus:outline-none">
              <video 
                className="w-full aspect-video 2xl:aspect-auto 2xl:h-[50vh] object-cover object-center focus:outline-none"  
                controls controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
                poster={`${imgBaseUrl1280}${movie.backdrop_path}`}
              >
                <source src={`/movie/stream/${encFilePath}`} type="video/mp4" />
                
                {subtitles.map((subtitle: any, index: number) => (
                  <track 
                    key={index}
                    kind="subtitles"
                    src={`/movie/subtitles/${subtitle.encPath}`}
                    srcLang={subtitle.languageCode.toLowerCase()}
                    label={subtitle.languageName}
                    default={index === 0} // Set first subtitle as default
                  />
                ))}
                
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="py-6 w-full">
              overview
            </div>
          </div>

          <div className="px-6 w-full min-w-[25%]">
            right panel
          </div>
        </div>
      </div> */}

      <div>
        <div className="flex flex-col items-start justify-between">
          <div className="flex flex-col w-full">
            <div className="bg-black text-white focus:outline-none">
              <video 
                className="w-full aspect-video lg:aspect-auto xl:h-[73vh] object-cover object-center focus:outline-none"  
                controls controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
                poster={`${imgBaseUrl1280}${movie.backdrop_path}`}
              >
                <source src={`/movie/stream/${encFilePath}`} type="video/mp4" />
                
                {subtitles.map((subtitle: any, index: number) => (
                  <track 
                    key={index}
                    kind="subtitles"
                    src={`/movie/subtitles/${subtitle.encPath}`}
                    srcLang={subtitle.languageCode.toLowerCase()}
                    label={subtitle.languageName}
                    default={index === 0} // Set first subtitle as default
                  />
                ))}
                
                Your browser does not support the video tag.
              </video>
            </div>
            <div className="p-3 md:p-5 lg:p-7 w-full">
              <div className="flex items-start justify-between gap-7 w-full">
                <div className="flex flex-col gap-y-7 w-full">
                  <div className="flex lg:flex-row flex-col w-full items-start justify-between gap-y-6 gap-x-7">
                    <div className="flex flex-col gap-y-4 w-full">
                      {/* genres */}
                      <div className="flex flex-wrap gap-2">
                        {movie.genres.map((genre: any) => (
                          <span key={genre.id} className="text-gray-500 text-sm lg:text-base">
                            #{genre.name}
                          </span>
                        ))}
                      </div>
                      
                      <h1 className="text-[1.8rem] lg:text-[2.5rem] font-bold leading-tight w-full">
                        {movie.title}
                      </h1>
                      <div className="text-base lg:text-lg text-gray-500">
                        {movie.release_date.split('-')[0]}&nbsp;&nbsp;•&nbsp;&nbsp;{Math.floor(movie.runtime / 60)}h {movie.runtime % 60}m&nbsp;&nbsp;•&nbsp;&nbsp;CC&nbsp;&nbsp;•&nbsp;&nbsp;{Math.round((movie.vote_average) * 10)}%
                      </div>
                    </div>
                    
                    <div className="flex flex-row lg:flex-col lg:items-end items-start gap-y-6 lg:w-[30%] w-full">
                      <div className="w-full lg:text-right text-sm lg:text-base text-gray-500">
                        PG-13&nbsp;&nbsp;•&nbsp;&nbsp;0 views
                      </div>
                      <div className="flex items-center justify-end gap-x-2 text-gray-500 text-base lg:text-lg w-full lg:text-right whitespace-nowrap">
                        {/* Likes, comments, share, etc. */}
                        <HeartIcon className="w-5 h-5 lg:w-6 lg:h-6" />
                        <span className="mr-2 lg:mr-4 text-xs lg:text-base">0</span>
                        <MessageSquareText className="w-5 h-5 lg:w-6 lg:h-6" />
                        <span className="mr-2 lg:mr-4 text-xs lg:text-base">0</span>
                        <Share2 className="w-5 h-5 lg:w-6 lg:h-6" />
                        <span className="mr-2 lg:mr-4 text-xs lg:text-base">0</span>
                        <Clapperboard className="w-5 h-5 lg:w-6 lg:h-6" />
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col gap-y-7 w-full text-xl">
                    <div className="flex lg:flex-row flex-col gap-y-7 gap-x-7 w-full">
                      {movie.tagline && (
                        <div className="lg:hidden w-full text-base lg:text-lg text-center italic">
                          "{movie.tagline}"
                        </div>
                      )}

                      {/* <div className="mx-auto">
                        <img src={`${imgBaseUrl500}${movie.poster_path}`} alt={movie.title} className="w-[9em] h-[18rem] lg:w-[15rem] lg:h-[20rem] rounded-lg object-cover border-2 border-gray-100 dark:border-gray-700 shadow-lg shadow-gray-500 dark:shadow-gray-700 overflow-hidden" />
                      </div> */}
                      
                      <div className="w-full">
                        <div className="hidden lg:block">
                          {movie.tagline && (
                            <div className="text-base lg:text-lg italic mb-4">
                              "{movie.tagline}"
                            </div>
                          )}
                        </div>
                        {movie.overview && (
                          <div className="text-gray-500 text-base lg:text-lg">
                            {movie.overview}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex justify-center gap-x-7 w-[calc(100vw-2rem)] lg:w-full">
                      <Tabs 
                        defaultValue="cast" 
                        className="w-full lg:w-[calc(100vw-var(--dynamic-sidebar-width)-5rem)]"
                        style={{
                          '--dynamic-sidebar-width': sidebarWidth
                        } as React.CSSProperties}
                      >
                        <TabsList className="w-full">
                          {movie.credits?.cast && movie.credits.cast.length > 0 && (
                            <TabsTrigger value="cast">Cast</TabsTrigger>
                          )}
                          {movie.credits?.crew && movie.credits.crew.length > 0 && (
                            <TabsTrigger value="crew">Crew</TabsTrigger>
                          )}
                        </TabsList>
                        
                        <TabsContent value="cast">
                          {/* cast ribbon */}
                          {movie.credits?.cast && movie.credits.cast.length > 0 && (
                            <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                              <Ribbon 
                                align="start" 
                                dragFree={true}
                              >
                                {movie.credits.cast.map((cast: any, index: number) => {
                                  // Prioritize the first 8 cast members for better initial load
                                  const isPriority = index < 8;
                                  
                                  return (
                                    <RibbonItem key={`cast-${cast.id}-${index}`}>
                                      <CreditPoster 
                                        imageUrl={cast.profilePathUrl} 
                                        name={cast.name}
                                        characterName={cast.character} 
                                        priority={isPriority}
                                      />
                                    </RibbonItem>
                                  );
                                })}
                              </Ribbon>
                            </div>
                          )}
                        </TabsContent>
                        
                        <TabsContent value="crew">
                          {/* crew ribbon */}
                          {movie.credits?.crew && movie.credits.crew.length > 0 && (
                            <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                              <Ribbon 
                                align="start" 
                                dragFree={true}
                              >
                                {movie.credits.crew.map((crew: any, index: number) => {
                                  // Prioritize the first 8 crew members for better initial load
                                  const isPriority = index < 8;
                                  
                                  return (
                                    <RibbonItem key={`crew-${crew.id}-${index}`}>
                                      <CreditPoster 
                                        imageUrl={crew.profilePathUrl} 
                                        name={crew.name}
                                        characterName={crew.job} 
                                        priority={isPriority}
                                      />
                                    </RibbonItem>
                                  );
                                })}
                              </Ribbon>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                    <div className="flex flex-col 2xl:flex-row gap-y-7 2xl:gap-x-7 w-full bg-green-500">
                      <div className="flex gap-x-7 w-full bg-violet-500">
                        Recommended movies
                      </div>
                      <div className="flex gap-x-7 w-full bg-orange-500">
                        Similar movies
                      </div>
                    </div>
                    <div className="bg-red-500">
                      Comments
                    </div>
                  </div>
                  
                </div>
                {/* <div className="flex items-center justify-end w-[30%] bg-red-500">
                  right
                </div> */}
              </div>
            </div>
          </div>

        </div>
      </div>
      
    </AppLayout>
  );
}