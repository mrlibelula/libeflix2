import { AddCircleButton } from '@/components/ui/add-circle-button';
import { LikeCircleButton } from '@/components/ui/like-circle-button';
import { Button } from '@/components/ui/button';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { LoaderCircle, Play } from 'lucide-react';
import { Ribbon, RibbonItem } from "@/components/ui/ribbon"
import { useState, useEffect, useRef } from 'react';
import type { CarouselApi } from "@/components/ui/carousel";

export default function Tvshow({ tvshow, backdropUrl, selectedSeasonNumber = 0 }: { tvshow: any, backdropUrl: string, selectedSeasonNumber?: number }) {
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const isInitialMount = useRef(true);

  useEffect(() => {
    // Use the selectedSeasonNumber from props or default to the first season
    const initialSeason = selectedSeasonNumber 
      ? tvshow.seasons.find((s: any) => s.season_number === selectedSeasonNumber) 
      : tvshow.seasons[0];
    
    setSelectedSeason(initialSeason);
  }, [tvshow, selectedSeasonNumber]);

  useEffect(() => {
    if (!carouselApi || !selectedSeason) return;
    
    // Only scroll on initial mount, not when user clicks on seasons
    if (isInitialMount.current) {
      const selectedIndex = tvshow.seasons.findIndex(
        (season: any) => season.season_number === selectedSeason.season_number
      );
      
      if (selectedIndex !== -1) {
        // Scroll to the selected season
        carouselApi.scrollTo(selectedIndex, true);
      }
      
      isInitialMount.current = false;
    }
  }, [carouselApi, selectedSeason, tvshow.seasons]);

  const handleSeasonSelect = (season: any) => {
    router.visit(`/tvshow/${tvshow.slug}?season=${season.season_number}`, {
      preserveState: true,
      only: ['selectedSeasonNumber'],
    });
    setSelectedSeason(season);
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `${tvshow.name} - TV Show`,
      href: '/tvshow',
    },
  ];

  // Make sure we have a selected season before rendering
  if (!selectedSeason) return null;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${tvshow.name}`} />
      {/* hero */}
      <div className="relative flex flex-col gap-4 min-h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] overflow-hidden overflow-y-auto scrollbar">
        <div style={{ backgroundImage: `url(${backdropUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} className="w-full h-[calc(100vh-5.5rem)] filter grayscale" />
        <div className="absolute light-gradient-hero dark:dark-gradient-hero h-[calc(100vh-5.5rem)] w-full" />
        <div className="flex flex-col xl:flex-row w-full absolute">
          <div className="p-4 md:p-10 xl:p-20 top-0 left-0 w-full flex flex-col items-start justify-start ">
            <div className="flex flex-col xl:flex-row w-full gap-x-12 items-start justify-between">
              <div className="flex flex-col gap-y-4 items-start w-full xl:w-[50%]">
                {/* hero title */}
                <div className="text-black dark:text-white text-4xl font-bold px-5 py-3">
                  {
                    tvshow.logo?.url ?
                      <img src={`${tvshow.logo?.url}`} alt={tvshow.name} className="w-full sm:w-1/2 object-cover animate-zoomIn" />
                      :
                      <h1 className="text-3xl md:text-4xl xl:text-6xl font-bold animate-zoomIn">
                        {tvshow.name}
                      </h1>
                  }
                </div>

                {/* hero actions */}
                <div className="flex items-center justify-center gap-x-3 px-5 py-3 mt-6 animate-fadeIn">
                  <Button className="text-xl font-semibold h-[3rem]" tabIndex={1} disabled={false}>
                    <Play className="ml-2 mr-1 h-4 w-4 fill-white dark:fill-black" />
                    Play
                    {false && <LoaderCircle className="h-4 w-4 animate-spin" />}
                    <div className="mr-2" />
                  </Button>

                  <AddCircleButton />

                  <LikeCircleButton isLiked={false} />
                </div>

                {/* hero details */}
                <div className="flex items-center justify-center gap-x-3 px-5 py-3 mt-6 w-full animate-fadeIn">
                  <div className="flex items-center gap-x-8 w-full">
                    <div className="flex flex-col xl:flex-row text-base w-full sm:text-lg xl:text-xl justify-center gap-x-20 gap-y-6 xl:gap-y-0">
                      {/* details and overview */}
                      <div className="flex flex-col gap-x-3 gap-y-3 w-full">
                        <div className="flex items-center gap-x-4 leading-tight">
                          <div>{tvshow.first_air_date.substring(0, 4)}</div>
                          <div className=" text-nowrap">{tvshow.number_of_seasons} {tvshow.number_of_seasons > 1 ? 'seasons' : 'season'}</div>
                          <div className="border border-neutral-800 dark:border-neutral-300 rounded-md px-1.5 py-0.5 backdrop-blur">HD</div>
                          <div className=" text-nowrap">{tvshow.number_of_episodes} episodes</div>
                        </div>
                        <div className="flex flex-wrap gap-x-3 gap-y-1 text-base">
                          {tvshow.genres.map((genre: any) => (
                            <Link key={genre.id} href={`/genre/${genre.slug}`} className="text-neutral-700 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors duration-150 rounded-md">
                              #{genre.slug}
                            </Link>
                          ))}
                        </div>
                        <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                          {tvshow.overview}
                        </div>
                        {/* created by */}
                        <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                          <div className="font-semibold mb-8">
                            Created by
                          </div>
                          <Ribbon 
                            align="start" 
                            dragFree={true}
                          >
                            {tvshow.created_by.map((creator: any, index: number) => (
                              <RibbonItem key={index}>
                                <div 
                                  className="mx-auto w-[7rem] h-[10rem] bg-cover bg-center rounded-md overflow-hidden opacity-90 group-hover:opacity-100 transition-opacity duration-150" 
                                  style={{ backgroundImage: `url(${creator.profile_path})` }}
                                />
                                <div className="mt-6 text-sm mb-4 rounded-md text-center w-full text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100 transition-colors duration-150">
                                  {creator.name}
                                </div>
                              </RibbonItem>
                            ))}
                          </Ribbon>
                        </div>
                      </div>

                    </div>
                  </div>
                </div>
              </div>
              <div className="w-full xl:w-[50%]">
                {/* seasons carousel */}
                <div className="px-5 py-3 mt-10 w-full animate-fadeIn">
                  <div className="relative">
                    <Ribbon
                      align="start"
                      dragFree={true}
                      onApiInitialized={setCarouselApi}
                    >
                      {tvshow.seasons.map((season: any, index: number) => (
                        <RibbonItem 
                          key={index} 
                          onClick={() => handleSeasonSelect(season)} 
                          className="cursor-pointer"
                        >
                          <div 
                            className={`mx-auto w-[10rem] h-[15rem] bg-cover bg-center rounded-md border-2 ${selectedSeason.season_number === season.season_number ? 'border-white dark:border-rose-500' : 'border-white dark:border-black'} overflow-hidden opacity-90 group-hover:opacity-100 transition-all duration-150`} 
                            style={{ backgroundImage: `url(${season.posterPathUrl})` }}
                          />
                          <div className={`mt-6 font-semibold text-sm mb-4 rounded-md text-center w-full ${selectedSeason.season_number === season.season_number ? 'bg-rose-700 dark:bg-rose-500 text-white' : 'text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100'} transition-colors duration-150`}>
                            {season.name}
                          </div>
                        </RibbonItem>
                      ))}
                    </Ribbon>
                  </div>
                </div>
                {/* episodes */}
                <div className="px-5 py-3 mt-4 w-full animate-fadeIn">
                  <div className="flex items-center justify-between gap-x-4">
                    <div className="text-[1.2rem] font-bold">
                      {selectedSeason.name} - Episodes
                    </div>
                    
                  </div>
                  <div className="mt-6 text-base text-neutral-700 dark:text-neutral-300">
                    {selectedSeason.overview}
                  </div>
                  <div className="mt-8">
                    <ul className="">
                      {selectedSeason.episodes.map((episode: any) => {
                        return (
                          <li key={episode.id} className="flex items-center gap-x-4 lg:gap-x-8 justify-between px-2 py-8 border-b border-neutral-800 dark:border-neutral-700 border-dotted">
                            <div className="text-2xl text-center w-[2.5rem]">
                              {episode.episode_number}
                            </div>
                            <div className="aspect-video h-[3.5rem] lg:h-[5rem] rounded-md">
                              <img className="w-full h-full object-cover rounded-md" src={`${episode.stillUrl}`} alt={episode.name} />
                            </div>
                            <div className="w-full flex flex-col gap-y-1 lg:gap-y-2">
                              <div className="flex items-center gap-x-2 justify-between">
                                <div className=" font-semibold">
                                  {episode.name}
                                </div>
                                {episode.runtime && episode.runtime > 0 && (
                                  <div className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                                    {episode.runtime}m
                                  </div>
                                )}
                              </div>
                              <div className="text-sm text-neutral-700 dark:text-neutral-400">
                                {episode.overviewStrLimit150}
                              </div>
                            </div>
                          </li>
                        );
                      })}
                      
                    </ul>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>
    </AppLayout>
  );
}