import { AddCircleButton } from '@/components/ui/add-circle-button';
import { LikeCircleButton } from '@/components/ui/like-circle-button';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/ui/star-rating';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router } from '@inertiajs/react';
import { LoaderCircle, Play } from 'lucide-react';
import { Ribbon, RibbonItem } from "@/components/ui/ribbon"
import { useState, useEffect, useRef } from 'react';
import type { CarouselApi } from "@/components/ui/carousel";
import { CreditPoster } from '@/components/ui/credit-poster';
import { LazyImage } from '@/components/ui/lazy-image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlayEpisodeDialog } from '@/components/ui/play-episode-dialog';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

// Constants
const TVSHOW_OVERVIEW_STR_LIMIT = 260;
const SEASON_OVERVIEW_STR_LIMIT = 200;
const EPISODE_OVERVIEW_STR_LIMIT = 160;

export default function Tvshow({ tvshow, backdropUrl, selectedSeasonNumber = 0 }: { tvshow: any, backdropUrl: string, selectedSeasonNumber?: number }) {
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const isInitialMount = useRef(true);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Record<number, boolean>>({});
  const [expandedTvshowOverview, setExpandedTvshowOverview] = useState(false);
  const [expandedSeasonOverview, setExpandedSeasonOverview] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    // Find the requested season or default to first season if not found
    let initialSeason;
    
    if (selectedSeasonNumber) {
      initialSeason = tvshow.seasons.find((s: any) => s.season_number === selectedSeasonNumber);
      // If the requested season doesn't exist, fall back to the first season
      if (!initialSeason && tvshow.seasons.length > 0) {
        initialSeason = tvshow.seasons[0];
      }
    } else if (tvshow.seasons.length > 0) {
      initialSeason = tvshow.seasons[0];
    }
    
    setSelectedSeason(initialSeason);
  }, [tvshow, selectedSeasonNumber]);

  useEffect(() => {
    if (!carouselApi || !selectedSeason) return;
    
    // Only scroll on initial mount, not when user clicks on seasons
    if (isInitialMount.current) {
      const selectedIndex = tvshow.seasons.findIndex(
        (season: any) => season.season_number === selectedSeason?.season_number
      );
      
      if (selectedIndex !== -1) {
        // Scroll to the selected season
        carouselApi.scrollTo(selectedIndex, true);
      }
      
      isInitialMount.current = false;
    }
  }, [carouselApi, selectedSeason, tvshow.seasons]);

  // Simple function to handle episode selection
  const handleEpisodeClick = (episode: any) => {
    if (!episode.is_in_storage) return;
    
    if (episode.encFilePath) {
      // If we already have the encoded file path, use it directly
      setSelectedEpisode(episode);
      setIsDialogOpen(true);
    } else {
      // Show error that the episode can't be played
      setError('Cannot play episode: No encoded file path available');
    }
  };

  const handleSeasonSelect = (season: any) => {
    router.visit(`/tvshow/${tvshow.slug}?season=${season.season_number}`, {
      preserveState: true,
      only: ['selectedSeasonNumber'],
    });
    setSelectedSeason(season);
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `${tvshow.name} ▸ Season ${selectedSeason?.season_number || 'Unknown'} ▸ TV Show`,
      href: '/tvshow',
    },
  ];

  // Make sure we have a selected season before rendering
  if (!selectedSeason) return null;

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${tvshow.name} ▸ S${selectedSeason.season_number.toString().padStart(2, '0')} ▸ TV Show`} />
      {/* hero */}
      <div className="relative flex flex-col min-h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] overflow-hidden overflow-y-auto scrollbar">
        <div style={{ backgroundImage: `url(${backdropUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} className="w-full h-[calc(100vh-5.5rem)] filter grayscale" />
        <div className="absolute light-gradient-hero dark:dark-gradient-hero h-[calc(100vh-5.5rem)] w-full" />
        <div className="flex flex-col xl:flex-row w-full absolute">
          <div className="w-full flex flex-col items-start justify-start ">
            <div className="flex flex-col 2xl:flex-row w-full items-start justify-between gap-x-4 p-10">
              {/* left panel */}
              <div className="flex flex-col gap-y-4 items-start w-full 2xl:w-[50%] overflow-hidden">
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
                  <Button className="text-xl font-semibold h-[3rem] cursor-pointer" tabIndex={1} disabled={false}>
                    <Play className="ml-2 mr-1 h-4 w-4 fill-white dark:fill-black" />
                    Play
                    {false && <LoaderCircle className="h-4 w-4 animate-spin spinner-rose" />}
                    <div className="mr-2" />
                  </Button>

                  <AddCircleButton />

                  <LikeCircleButton isLiked={false} />
                </div>

                {/* genres */}
                <div className="px-5 py-3 flex flex-wrap gap-x-3 gap-y-1 text-base">
                  {tvshow.genres.map((genre: any) => (
                    <Link key={genre.id} href={`/genre/${genre.slug}`} className="text-neutral-700 dark:text-neutral-400 hover:text-rose-600 dark:hover:text-rose-400 transition-colors duration-150 rounded-md">
                      #{genre.slug}
                    </Link>
                  ))}
                </div>

                {/* hero details */}
                <div className="flex items-center justify-center gap-x-3 px-5 py-3 w-full animate-fadeIn">
                  <div className="flex items-center gap-x-8 w-full">
                    <div className="flex flex-col xl:flex-row text-base w-full sm:text-lg xl:text-xl justify-center gap-x-20 gap-y-6 xl:gap-y-0">
                      {/* details and overview */}
                      <div className="flex flex-col gap-x-3 w-full">
                        <div className="flex items-center gap-x-4 leading-tight"> 
                          {tvshow.networks?.length > 0 && tvshow.networks[0].logoPathUrl && (
                            <div className="w-[4rem] mr-2">
                              <img src={tvshow.networks[0].logoPathUrl} alt={tvshow.networks[0].name} className="dark:invert" />
                            </div>
                          )}
                          <div>
                            {tvshow.first_air_date.substring(0, 4)}
                          </div>
                          <div className=" text-nowrap">
                            {tvshow.number_of_seasons} {tvshow.number_of_seasons > 1 ? 'seasons' : 'season'}
                          </div>
                          <div className="italic text-sm border border-neutral-800 dark:border-neutral-600 rounded-sm px-1.5 py-0.5 backdrop-blur opacity-60 font-bold tracking-wider">
                            HD
                          </div>
                          <div className=" text-nowrap">
                            {tvshow.number_of_episodes} episodes
                          </div>
                          <div className="hidden lg:block">
                            <StarRating rating={tvshow.voteAverageStars} size={5} />
                          </div>
                        </div>

                        <div className="lg:hidden flex items-center gap-x-2 mt-10">
                          Rating: <StarRating rating={tvshow.voteAverageStars} size={5} />
                        </div>
                        
                        {/* overview */}
                        <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                          {tvshow.overview && tvshow.overview.length > TVSHOW_OVERVIEW_STR_LIMIT && !expandedTvshowOverview ? (
                            <>
                              {tvshow.overview.substring(0, TVSHOW_OVERVIEW_STR_LIMIT)}... 
                              <span 
                                className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer ml-1"
                                onClick={() => setExpandedTvshowOverview(true)}
                              >
                                more
                              </span>
                            </>
                          ) : tvshow.overview && tvshow.overview.length > TVSHOW_OVERVIEW_STR_LIMIT ? (
                            <>
                              {tvshow.overview}
                              <span 
                                className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer ml-1"
                                onClick={() => setExpandedTvshowOverview(false)}
                              >
                                less
                              </span>
                            </>
                          ) : (
                            tvshow.overview
                          )}
                        </div>

                        {/* tabs */}
                        <div className="mt-10">
                          <Tabs defaultValue="cast" className="w-full">
                            <TabsList className="w-full">
                              {tvshow.credits.cast && Object.entries(tvshow.credits.cast).length > 0 && (
                                <TabsTrigger value="cast">Cast</TabsTrigger>
                              )}
                              {tvshow.credits.guestStars && Object.entries(tvshow.credits.guestStars).length > 0 && (
                                <TabsTrigger value="guest_stars">Guest Stars</TabsTrigger>
                              )}
                              <TabsTrigger value="created_by">Creators</TabsTrigger>
                              {tvshow.credits.crew && Object.entries(tvshow.credits.crew).length > 0 && (
                                <TabsTrigger value="crew">Crew</TabsTrigger>
                              )}
                            </TabsList>
                            <TabsContent value="cast">
                              {/* cast ribbon */}
                              {Object.entries(tvshow.credits.cast).length > 0 && (
                                <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                                  <Ribbon 
                                    align="start" 
                                    dragFree={true}
                                  >
                                    {Object.entries(tvshow.credits.cast).map(([key, cast]: [string, any], index) => {
                                      // Prioritize the first 8 cast members for better initial load
                                      const isPriority = index < 8;
                                      
                                      return (
                                        <RibbonItem key={cast.id || key}>
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
                            <TabsContent value="guest_stars">
                              {/* guest stars ribbon */}
                              {tvshow.credits.guestStars && Object.entries(tvshow.credits.guestStars).length > 0 && (
                                <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                                  <Ribbon 
                                    align="start" 
                                    dragFree={true}
                                  >
                                    {Object.entries(tvshow.credits.guestStars).map(([key, guestStar]: [string, any], index) => {
                                      // Prioritize the first 8 guest stars for better initial load
                                      const isPriority = index < 8;
                                      
                                      return (
                                        <RibbonItem key={guestStar.id || key}>
                                          <CreditPoster 
                                            imageUrl={guestStar.profilePathUrl} 
                                            name={guestStar.name}
                                            characterName={guestStar.character} 
                                            priority={isPriority}
                                          />
                                        </RibbonItem>
                                      );
                                    })}
                                  </Ribbon>
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value="created_by">
                              {/* created by ribbon */}
                              {tvshow.created_by && tvshow.created_by.length > 0 && (
                                <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                                  <Ribbon 
                                    align="start" 
                                    dragFree={true}
                                  >
                                    {tvshow.created_by.map((creator: any, index: number) => {
                                      // Show all creators with priority - usually there are only a few
                                      const isPriority = true;
                                      
                                      return (
                                        <RibbonItem key={index}>
                                          <CreditPoster 
                                            imageUrl={creator.profile_path} 
                                            name={creator.name}
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
                              {Object.entries(tvshow.credits.crew).length > 0 && (
                                <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                                  <Ribbon 
                                    align="start" 
                                    dragFree={true}
                                  >
                                    {Object.entries(tvshow.credits.crew).map(([key, crew]: [string, any], index) => {
                                      // Prioritize the first 8 cast members for better initial load
                                      const isPriority = index < 8;
                                      
                                      return (
                                        <RibbonItem key={crew.id || key}>
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
                        
                      </div>

                    </div>
                  </div>
                </div>
              </div>
              {/* right panel */}
              <div className="w-full 2xl:w-[50%] overflow-hidden">
                {/* play episode */}
                {isLoading && (
                  <div className="px-5 py-3 mt-10 animate-fadeIn">
                    <div className="text-[1.2rem] font-bold mb-4 flex items-center">
                      <LoaderCircle className="h-6 w-6 animate-spin mr-2" />
                      Loading Episode...
                    </div>
                  </div>
                )}
                
                {error && (
                  <div className="px-5 py-3 mt-10 animate-fadeIn">
                    <div className="text-[1.2rem] font-bold mb-4 text-rose-500">
                      Error: {error}
                    </div>
                  </div>
                )}
                
                {/* Modal for playing episodes */}
                {selectedEpisode && (
                  <PlayEpisodeDialog 
                    episode={selectedEpisode} 
                    tvshowName={tvshow.name}
                    isOpen={isDialogOpen}
                    onOpenChange={(open) => {
                      setIsDialogOpen(open);
                      if (!open) {
                        // Clear the selected episode when dialog closes
                        setSelectedEpisode(null);
                      }
                    }}
                    onError={(err) => setError(err.message)}
                    hasNextEpisode={selectedSeason.episodes.findIndex((e: any) => e.id === selectedEpisode.id) < selectedSeason.episodes.length - 1}
                    hasPreviousEpisode={selectedSeason.episodes.findIndex((e: any) => e.id === selectedEpisode.id) > 0}
                    onNextEpisode={() => {
                      const currentIndex = selectedSeason.episodes.findIndex((e: any) => e.id === selectedEpisode.id);
                      if (currentIndex < selectedSeason.episodes.length - 1) {
                        const nextEpisode = selectedSeason.episodes[currentIndex + 1];
                        if (nextEpisode.is_in_storage && nextEpisode.encFilePath) {
                          setSelectedEpisode(nextEpisode);
                        }
                      }
                    }}
                    onPreviousEpisode={() => {
                      const currentIndex = selectedSeason.episodes.findIndex((e: any) => e.id === selectedEpisode.id);
                      if (currentIndex > 0) {
                        const prevEpisode = selectedSeason.episodes[currentIndex - 1];
                        if (prevEpisode.is_in_storage && prevEpisode.encFilePath) {
                          setSelectedEpisode(prevEpisode);
                        }
                      }
                    }}
                  />
                )}
                
                {/* seasons carousel */}
                <div className="px-5 py-3 mt-10 w-full animate-fadeIn">
                  <div className="2xl:hidden text-base font-semibold mb-8">
                    Seasons
                  </div>
                  <div className="relative">
                    <Ribbon
                      align="start"
                      dragFree={true}
                      onApiInitialized={setCarouselApi}
                    >
                      {tvshow.seasons.map((season: any, index: number) => {
                        // Prioritize the first 8 seasons to ensure smooth initial load
                        const isPriority = index < 8;
                        
                        return (
                          <RibbonItem 
                            key={index} 
                            onClick={() => handleSeasonSelect(season)} 
                            className="cursor-pointer"
                          >
                            <div className={`w-[10rem] h-[15rem] border-2 ${selectedSeason?.season_number === season.season_number ? 'border-rose-500 dark:border-rose-500' : 'border-neutral-400 dark:border-neutral-700'} rounded-md overflow-hidden opacity-90 group-hover:opacity-100 transition-all duration-150`}>
                              <LazyImage 
                                src={season.posterPathUrl}
                                alt={season.name}
                                className={`w-full h-full object-cover ${season.seasonFolderExists ? '' : 'grayscale'} group-hover:grayscale-0 transition-all duration-150`}
                                priority={isPriority}
                              />
                            </div>
                            <div className={`mt-6 font-semibold text-sm mb-4 rounded-md text-center w-full ${selectedSeason?.season_number === season.season_number ? 'bg-rose-500 dark:bg-rose-500 text-white' : 'text-neutral-700 dark:text-neutral-300 group-hover:text-neutral-900 dark:group-hover:text-neutral-100'} transition-colors duration-150`}>
                              {season.name}
                            </div>
                          </RibbonItem>
                        );
                      })}
                    </Ribbon>
                  </div>
                </div>
                {/* episodes */}
                <div className="px-5 py-3 mt-4 w-full animate-fadeIn">
                  <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-x-4">
                    <div className="text-[1.2rem] font-bold">
                      {selectedSeason.name} - Episodes ({selectedSeason.episodes.length})
                    </div>
                    {/* inform air date */}
                    {selectedSeason.air_date && selectedSeason.air_date !== '' && (
                      <div className="text-sm italic text-neutral-700 dark:text-neutral-300">
                        {new Date(selectedSeason.air_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).replace(/(\d)(st|nd|rd|th)/, '$1<sup>$2</sup>')}
                      </div>
                    )}
                  </div>
                  <div className="mt-6 text-base text-neutral-700 dark:text-neutral-300">
                    {selectedSeason.overview && selectedSeason.overview.length > SEASON_OVERVIEW_STR_LIMIT && !expandedSeasonOverview ? (
                      <>
                        {selectedSeason.overview.substring(0, SEASON_OVERVIEW_STR_LIMIT)}... 
                        <span 
                          className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer ml-1"
                          onClick={() => setExpandedSeasonOverview(true)}
                        >
                          more
                        </span>
                      </>
                    ) : selectedSeason.overview && selectedSeason.overview.length > SEASON_OVERVIEW_STR_LIMIT ? (
                      <>
                        {selectedSeason.overview}
                        <span 
                          className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer ml-1"
                          onClick={() => setExpandedSeasonOverview(false)}
                        >
                          less
                        </span>
                      </>
                    ) : (
                      selectedSeason.overview
                    )}
                  </div>

                  <div className="mt-8">
                    <ul>
                      {/* (lazy loading) Prioritize more episodes at the beginning (first 5) */}
                      {selectedSeason.episodes.map((episode: any, index: number, array: any[]) => {
                        const isLastItem = index === array.length - 1;
                        const isPriority = index < 5;
                        
                        return (
                          <li key={episode.id} className={`group flex flex-col lg:flex-row items-start gap-y-3 lg:gap-y-0 lg:items-center gap-x-4 lg:gap-x-8 justify-between px-2 py-8 bg-gradient-to-tr hover:bg-neutral-400/20 dark:hover:bg-neutral-800/30 transition-colors duration-150 ${!isLastItem ? 'border-b border-neutral-800 dark:border-neutral-700 border-dotted' : ''}`}>
                            <div className="text-2xl text-center w-[2.5rem] group-hover:text-rose-500 dark:group-hover:text-rose-500 transition-colors duration-150">
                              {episode.episode_number}
                            </div>
                            
                            <div 
                              className={`aspect-video w-full h-[12rem] lg:w-1/2 lg:h-[7rem] rounded-md overflow-hidden relative group ${episode.is_in_storage ? 'cursor-pointer' : ''}`}
                              onClick={() => episode.is_in_storage && handleEpisodeClick(episode)}
                            >
                              <LazyImage 
                                src={`${episode.stillUrl}`}
                                alt={episode.name}
                                className={`w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity duration-150 ${!episode.is_in_storage ? 'grayscale' : ''}`}
                                priority={isPriority}
                              />
                              {episode.is_in_storage && (
                                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity duration-150 bg-black/30">
                                  <Play 
                                    className="w-8 h-8 text-white fill-white" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleEpisodeClick(episode);
                                    }}
                                  />
                                </div>
                              )}
                            </div>

                            <div className="w-full flex flex-col gap-y-1 lg:gap-y-2">
                              <div className="flex flex-col lg:flex-row items-start gap-y-1 lg:gap-y-0 lg:items-center gap-x-2 justify-between">
                                <div className="flex flex-col 3xl:flex-row items-start 3xl:items-center w-full justify-between gap-x-2 font-semibold leading-tight">
                                  <div 
                                    className={episode.is_in_storage ? 'cursor-pointer' : ''}
                                    onClick={() => episode.is_in_storage && handleEpisodeClick(episode)}
                                  >
                                    {episode.name}
                                  </div>
                                  <div className="mt-1 3xl:mt-0 text-sm text-neutral-700 dark:text-neutral-400">
                                    <StarRating rating={episode.voteAverageStars} size={3} />
                                  </div>
                                </div>
                                {episode.runtime && episode.runtime > 0 && (
                                  <div className="text-sm font-bold text-neutral-700 dark:text-neutral-300">
                                    {episode.runtime}m
                                  </div>
                                )}
                              </div>
                              <div className="mt-2 text-sm text-neutral-700 dark:text-neutral-400 leading-tight">
                                {episode.overview && episode.overview.length > EPISODE_OVERVIEW_STR_LIMIT && !expandedEpisodes[episode.id] ? (
                                  <>
                                    {episode.overview.substring(0, EPISODE_OVERVIEW_STR_LIMIT)}... 
                                    <span 
                                      className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer ml-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedEpisodes(prev => ({...prev, [episode.id]: true}));
                                      }}
                                    >
                                      more
                                    </span>
                                  </>
                                ) : episode.overview && episode.overview.length > EPISODE_OVERVIEW_STR_LIMIT ? (
                                  <>
                                    {episode.overview}
                                    <span 
                                      className="text-rose-500 hover:text-rose-600 dark:text-rose-400 dark:hover:text-rose-300 cursor-pointer ml-1"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setExpandedEpisodes(prev => ({...prev, [episode.id]: false}));
                                      }}
                                    >
                                      less
                                    </span>
                                  </>
                                ) : (
                                  episode.overview
                                )}
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