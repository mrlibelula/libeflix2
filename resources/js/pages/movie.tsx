import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";

export default function Movie({ movie, encFilePath, imgBaseUrl300, imgBaseUrl500, imgBaseUrl780, imgBaseUrl1280 }: { movie: any, encFilePath: string, imgBaseUrl300: string, imgBaseUrl500: string, imgBaseUrl780: string, imgBaseUrl1280: string }) {
  const breadcrumbs: BreadcrumbItem[] = [ 
    {
      title: `${movie.title}`,
      href: `/movie/${movie.slug}`,
    },
  ];

  // Parse subtitles if they exist
  const subtitles = Array.isArray(movie.subtitles) ? movie.subtitles : [];

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
            <div className="p-7 w-full">
              <div className="flex items-start justify-between gap-7 w-full">
                <div className="flex flex-col gap-y-6 w-full">
                  <div className="flex w-full items-start justify-between gap-x-7">
                    <div className="text-gray-500 text-lg lg:text-xl">
                      #sci-fi
                    </div>
                    <div className="text-gray-500 text-base lg:text-lg">
                      Likes
                    </div>
                  </div>
                  <h1 className="text-3xl lg:text-4xl font-bold leading-tight w-full _w-[70%]">
                    {movie.title}
                  </h1>
                  <div className="text-lg lg:text-xl">
                    1999, 1h 33m, 88%
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