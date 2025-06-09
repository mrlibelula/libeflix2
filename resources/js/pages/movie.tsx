import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head } from "@inertiajs/react";

export default function Movie({ movie, encFilePath, imgBaseUrl300, imgBaseUrl500, imgBaseUrl780 }: { movie: any, encFilePath: string, imgBaseUrl300: string, imgBaseUrl500: string, imgBaseUrl780: string }) {
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

      <div>
        <div className="flex flex-col xl:flex-row items-start justify-between p-0 lg:p-5">
          <div className="flex flex-col w-full min-w-[75%]">
            <div className="relative_ bg-black text-white w-full_ lg:rounded-lg lg:overflow-hidden shadow-md_ _shadow-zinc-900 focus:outline-none">
              <video 
                className="w-full aspect-video lg:aspect-auto lg:h-[50vh] _h-full aspect-video_ _md:aspect-auto object-cover object-center  focus:outline-none"  
                controls controlsList="nodownload" onContextMenu={(e) => e.preventDefault()}
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
            <div className="py-6 w-full">
              overview
            </div>
          </div>
          <div className="px-6 w-full min-w-[25%]">
            Right panel
          </div>
        </div>
      </div>
      
    </AppLayout>
  );
}