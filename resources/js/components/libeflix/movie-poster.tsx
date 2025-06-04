
export function MoviePoster() {
  return (
    <div className="flex-none group w-fit">
      <div className="flex relative w-[10.5rem] overflow-hidden transition duration-500 ease-in-out rounded-lg opacity-75 group-hover:opacity-100">
        {/* skeleton loader */}
        <div className="w-[10.5rem] h-[16rem] relative bg-gradient-to-r from-gray-300 to-charade-800 animate-pulse"></div>
        <img src="https://is4.revolveassets.com/images/p4/n/z/PGIR-WQ23_V1.jpg" loading="lazy" className="m-auto w-[10.5rem] h-full absolute" alt="" />
        <div className="absolute w-[10.5rem] h-full fade-movie-poster p-2">
          <div className="flex h-1/3 justify-between">
            {/* trailers icon */}
            {/* if trailers count */}
            <svg
              className="w-6 h-6 cursor-pointer rounded text-gray-200 p-0.5 fade-80 hover:bg-black hover:text-rose-500 transition duration-200 ease-in-out"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"></path></svg>
            {/* else */}
            {/* <div className="w-6 h-6"></div> */}

            {/* watch later icon */}
            <svg
              className="w-6 h-6 rounded text-gray-300 p-0.5 fade-80 cursor-pointer hover:bg-black hover:text-green-500 transition duration-300 ease-in-out"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              {/* @if (isset($libeflixMovie['isWatchLater']) && $libeflixMovie['isWatchLater']) */}
              {/* <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4.5 12.75l6 6 9-13.5"></path> */}
              {/* @else */}
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6"></path>
              {/* @endif */}
            </svg>
          </div>

          <div className="h-1/3 w-full flex">
            {/* @if ($isIn) */}
            {/* play icon */}
            <svg
              className="w-13 h-13 cursor-pointer mx-auto text-gray-300 rounded-full fade-40 hover:text-gray-100 transition duration-500 ease-in-out"
              fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1" d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            {/* @endif */}

          </div>
          <div className="flex h-1/3 p-1.5 items-end">
            <div className="block w-full">
              <div className="block text-center md:text-lg">
                <div className="text-lg leading-none tracking-tight text-gray-200 capitalize font-staat xl:text-xl" style={{ fontFamily: 'Staatliches, sans-serif' }}>
                  Title
                </div>
                {/* @if ($isIn) */}
                {/* @if (count($libeflixMovie['subtitles'])) */}
                <div className="flex justify-center w-full mt-1 text-xs">
                  <div className="flex gap-x-0.5">
                    <div className="px-1 py-0.5 my-auto font-bold text-xs uppercase text-black leading-none bg-gray-400">
                      cc
                    </div>
                    {/* @foreach ($libeflixMovie['subtitles'] as $subtitle) */}
                    <div className="px-1 py-0.5 my-auto font-semibold font-mono text-xs uppercase text-gray-300 leading-none bg-black border border-gray-500">
                      subtitle
                    </div>
                    {/* @endforeach */}
                  </div>
                </div>
                {/* @endif */}
                {/* @endif */}
                <div className="text-sm leading-snug tracking-tight text-gray-400">
                  <div className="flex justify-center">
                    <span>
                      1980
                    </span>
                    {/* @if (isset($libeflixMovie['voteAverage'])) */}
                    -
                    <span className="text-rose-500">
                      85%
                    </span>
                    {/* @endif */}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
