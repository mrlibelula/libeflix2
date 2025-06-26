import { AddCircleButton } from '@/components/ui/add-circle-button';
import { LoveCircleButton } from '@/components/ui/love-circle-button';
import { Button } from '@/components/ui/button';
import { StarRating } from '@/components/ui/star-rating';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { LoaderCircle, Play, Share2 } from 'lucide-react';
import { Ribbon, RibbonItem } from "@/components/ui/ribbon"
import { PaginatedRibbon } from "@/components/ui/paginated-ribbon"
import { useState, useEffect, useRef } from 'react';
import type { CarouselApi } from "@/components/ui/carousel";
import { CreditPoster } from '@/components/ui/credit-poster';
import { LazyImage } from '@/components/ui/lazy-image';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { PlayEpisodeDialog } from '@/components/ui/play-episode-dialog';
import { useSeasonData } from '@/hooks/use-season-data';
import { useWebShare } from '@/hooks/use-web-share';
import { Tooltip } from '@/components/ui/tooltip';

// Constants
const TVSHOW_OVERVIEW_STR_LIMIT = 260;
const SEASON_OVERVIEW_STR_LIMIT = 200;
const EPISODE_OVERVIEW_STR_LIMIT = 160;

export default function Tvshow({ tvshow, backdropUrl, selectedSeasonNumber = 0, selectedEpisodeNumber = null }: { tvshow: any, backdropUrl: string, selectedSeasonNumber?: number, selectedEpisodeNumber?: number | null }) {
  const [selectedSeason, setSelectedSeason] = useState<any>(null);
  const [carouselApi, setCarouselApi] = useState<CarouselApi>();
  const isInitialMount = useRef(true);
  const hasAutoPlayedEpisode = useRef(false);
  const [autoPlayEpisodeNumber, setAutoPlayEpisodeNumber] = useState<number | null>(selectedEpisodeNumber);
  const [expandedEpisodes, setExpandedEpisodes] = useState<Record<number, boolean>>({});
  const [expandedTvshowOverview, setExpandedTvshowOverview] = useState(false);
  const [expandedSeasonOverview, setExpandedSeasonOverview] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<any>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  // Likes functionality state
  const [isLiked, setIsLiked] = useState(tvshow.is_liked || false);
  const [likesCount, setLikesCount] = useState(tvshow.likes_count || 0);
  const [isLikeToggling, setIsLikeToggling] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  
  // Get Inertia page props for authentication and CSRF token
  const { props } = usePage<{ 
    csrf_token?: string;
    auth?: {
      user?: any;
    };
  }>();
  
  // Check if user is authenticated
  const isAuthenticated = !!props.auth?.user;
  
  // New state for lazy-loaded data
  const [seasonEpisodes, setSeasonEpisodes] = useState<Record<number, any[]>>({});
  const [seasonCredits, setSeasonCredits] = useState<any>(tvshow.credits);
  
  // Use the custom hook for data loading
  const {
    loadSeasonEpisodes,
    loadSeasonCredits,
    getCachedEpisodes,
    getCachedCredits,
    isLoading,
    isCreditsLoading,
    error: loadingError
  } = useSeasonData(tvshow.slug);

  // Web Share API hook
  const { share, isSharing, isSupported: isShareSupported } = useWebShare();

  // Sync like state with tvshow prop
  useEffect(() => {
    setIsLiked(tvshow.is_liked || false);
    setLikesCount(tvshow.likes_count || 0);
  }, [tvshow.is_liked, tvshow.likes_count]);

  // Function to handle like toggle
  const handleLikeToggle = async () => {
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Redirect to login page with current page as redirect parameter
      const currentUrl = window.location.pathname + window.location.search;
      router.visit('/login' + '?redirect=' + encodeURIComponent(currentUrl));
      return;
    }
    
    if (isLikeToggling) return;
    
    setIsLikeToggling(true);
    setIsLikeAnimating(true);
    
    try {
      // Get CSRF token from Inertia shared data or meta tag
      const csrfToken = props.csrf_token || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (!csrfToken) {
        console.error('CSRF token not found');
        setIsLikeAnimating(false);
        return;
      }
      
      const method = isLiked ? 'DELETE' : 'POST';
      const response = await fetch(`/api/tvshows/${tvshow.slug}/like`, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'Accept': 'application/json',
        },
        credentials: 'same-origin', // Include cookies for CSRF
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Change status at the midpoint of animation
        setTimeout(() => {
          setIsLiked(data.is_liked);
          setLikesCount(data.likes_count);
        }, 150);
        
        // Complete animation cycle
        setTimeout(() => {
          setIsLikeAnimating(false);
        }, 300);
      } else {
        console.error('HTTP error:', response.status, response.statusText);
        if (response.status === 419) {
          console.error('CSRF token mismatch. Please refresh the page.');
        } else if (response.status === 401) {
          // User is not authenticated, redirect to login
          const currentUrl = window.location.pathname + window.location.search;
          router.visit('/login' + '?redirect=' + encodeURIComponent(currentUrl));
          return;
        }
        setIsLikeAnimating(false);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLikeAnimating(false);
    } finally {
      setIsLikeToggling(false);
    }
  };

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

  // Load episodes when selectedSeason changes
  useEffect(() => {
    if (!selectedSeason) return;
    
    const loadEpisodes = async () => {
      // Check if we already have cached episodes
      const cachedEpisodes = getCachedEpisodes(selectedSeason.season_number);
      if (cachedEpisodes) {
        setSeasonEpisodes(prev => ({
          ...prev,
          [selectedSeason.season_number]: cachedEpisodes
        }));
        return;
      }

      // Load episodes if not cached and not already loading
      if (!seasonEpisodes[selectedSeason.season_number] && !isLoading(selectedSeason.season_number)) {
        const episodes = await loadSeasonEpisodes(selectedSeason.season_number);
        setSeasonEpisodes(prev => ({
          ...prev,
          [selectedSeason.season_number]: episodes
        }));
      }
    };

    const loadCredits = async () => {
      // Check if we already have cached credits
      const cachedCredits = getCachedCredits(selectedSeason.season_number);
      if (cachedCredits) {
        setSeasonCredits(cachedCredits);
        return;
      }

      // Load credits if not cached and not already loading
      if (!isCreditsLoading(selectedSeason.season_number)) {
        const credits = await loadSeasonCredits(selectedSeason.season_number);
        setSeasonCredits(credits);
      }
    };

    loadEpisodes();
    loadCredits();
  }, [selectedSeason?.season_number, loadSeasonEpisodes, loadSeasonCredits, getCachedEpisodes, getCachedCredits]);

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
      console.error('Cannot play episode: No encoded file path available');
    }
  };

  const handleSeasonSelect = async (season: any) => {
    router.visit(`/tvshow/${tvshow.slug}?season=${season.season_number}`, {
      preserveState: true,
      only: ['selectedSeasonNumber'],
    });
    
    setSelectedSeason(season);
    
    // Pre-load episodes for the selected season if not already loaded
    if (!seasonEpisodes[season.season_number] && !isLoading(season.season_number)) {
      const episodes = await loadSeasonEpisodes(season.season_number);
      setSeasonEpisodes(prev => ({
        ...prev,
        [season.season_number]: episodes
      }));
    }
  };

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `${tvshow.name} ▸ Season ${selectedSeason?.season_number || 'Unknown'} ▸ TV Show`,
      href: '/tvshow',
    },
  ];

  // Function to handle sharing the TV show page
  const handleShare = async () => {
    const shareData = {
      title: `${tvshow.name} - Season ${selectedSeason?.season_number}`,
      text: tvshow.overview ? `${tvshow.name} - ${tvshow.overview.slice(0, 100)}${tvshow.overview.length > 100 ? '...' : ''}` : `Check out this TV show: ${tvshow.name}`,
      url: window.location.href,
    };
    
    await share(shareData);
  };

  // Handle shared episode URLs - check for episode parameters in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedSeason = urlParams.get('season');
    const sharedEpisode = urlParams.get('episode');
    const shouldAutoplay = urlParams.get('autoplay') === 'true';

    if (sharedSeason && sharedEpisode && shouldAutoplay) {
      const seasonNumber = parseInt(sharedSeason);
      const episodeNumber = parseInt(sharedEpisode);

      // Find the target season
      const targetSeason = tvshow.seasons?.find((s: any) => s.season_number === seasonNumber);
      
      if (targetSeason) {
        // Load episodes for that season if not already loaded
        loadSeasonEpisodes(seasonNumber).then(() => {
          const episodes = getCachedEpisodes(seasonNumber);
          const targetEpisode = episodes?.find((e: any) => e.episode_number === episodeNumber);
          
          if (targetEpisode) {
            // Switch to the target season if necessary
            if (selectedSeason?.season_number !== seasonNumber) {
              setSelectedSeason(targetSeason);
            }
            
            // Update document meta tags for episode sharing (for subsequent shares)
            document.title = `${tvshow.name} - S${seasonNumber}E${episodeNumber}: ${targetEpisode.name}`;
            
            // Update Open Graph meta tags dynamically
            const updateMetaTag = (property: string, content: string) => {
              let metaTag = document.querySelector(`meta[property="${property}"], meta[name="${property}"]`);
              if (metaTag) {
                metaTag.setAttribute('content', content);
              } else {
                metaTag = document.createElement('meta');
                if (property.startsWith('og:') || property.startsWith('video:')) {
                  metaTag.setAttribute('property', property);
                } else {
                  metaTag.setAttribute('name', property);
                }
                metaTag.setAttribute('content', content);
                document.head.appendChild(metaTag);
              }
            };
            
            // Update meta tags for this specific episode
            updateMetaTag('og:title', `${tvshow.name} - S${seasonNumber}E${episodeNumber}: ${targetEpisode.name}`);
            updateMetaTag('og:description', targetEpisode.overview || `Watch "${targetEpisode.name}" from ${tvshow.name}`);
            updateMetaTag('twitter:title', `${tvshow.name} - S${seasonNumber}E${episodeNumber}: ${targetEpisode.name}`);
            updateMetaTag('twitter:description', targetEpisode.overview || `Watch "${targetEpisode.name}" from ${tvshow.name}`);
            updateMetaTag('description', targetEpisode.overview || `Watch "${targetEpisode.name}" from ${tvshow.name}`);
            
            // Open the episode dialog with autoplay
            setSelectedEpisode(targetEpisode);
            setIsDialogOpen(true);
            
            // Clean up URL parameters after handling
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('season');
            newUrl.searchParams.delete('episode');
            newUrl.searchParams.delete('autoplay');
            window.history.replaceState({}, '', newUrl.toString());
          }
        });
      }
    }
  }, [tvshow.seasons, loadSeasonEpisodes, getCachedEpisodes, selectedSeason]);

  // Auto-play episode if specified in URL parameters (before early return to ensure hooks order)
  // This should only happen once when the page initially loads with episode parameters from search
  useEffect(() => {
    if (!autoPlayEpisodeNumber || !selectedSeason || hasAutoPlayedEpisode.current) return;
    
    const currentEpisodes = seasonEpisodes[selectedSeason.season_number] || [];
    if (!currentEpisodes.length) return;
    
    // Find the episode that matches the selected episode number
    const targetEpisode = currentEpisodes.find(
      (episode: any) => episode.episode_number === autoPlayEpisodeNumber
    );
    
    if (targetEpisode && targetEpisode.is_in_storage && targetEpisode.encFilePath) {
      // Automatically open the episode dialog
      setSelectedEpisode(targetEpisode);
      setIsDialogOpen(true);
      
      // Mark that auto-play has been triggered to prevent it from happening again
      hasAutoPlayedEpisode.current = true;
      
      // Clear the local auto-play episode number so it doesn't trigger again
      setAutoPlayEpisodeNumber(null);
      
      // Remove the episode parameter from URL to prevent auto-play on refresh
      const url = new URL(window.location.href);
      url.searchParams.delete('episode');
      window.history.replaceState({}, '', url.toString());
    }
  }, [autoPlayEpisodeNumber, selectedSeason, seasonEpisodes]);

  // Make sure we have a selected season before rendering
  if (!selectedSeason) return null;

  // Get current season's episodes
  const currentSeasonEpisodes = seasonEpisodes[selectedSeason.season_number] || [];
  const isLoadingCurrentSeason = isLoading(selectedSeason.season_number);
  
  // Smart episode availability checking functions
  // Helper function to check if an episode is actually playable (has video file)
  const isEpisodePlayable = (episode: any) => {
    // An episode is playable if:
    // 1. It exists in storage (is_in_storage = true)
    // 2. It has an encrypted file path (encFilePath is not null/undefined/empty)
    // 3. The encFilePath is not just "undefined" string or "null" string
    const hasValidFilePath = episode.encFilePath && 
                            episode.encFilePath !== 'undefined' && 
                            episode.encFilePath !== 'null' && 
                            episode.encFilePath.trim() !== '';
    
    return episode.is_in_storage && hasValidFilePath;
  };

  const hasSmartNextEpisode = (episode: any) => {
    if (!episode) {
      return false;
    }
    
    const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === episode.id);
    
    if (currentIndex === -1) {
      return false;
    }
    
    // Check if there's a next PLAYABLE episode in current season
    for (let i = currentIndex + 1; i < currentSeasonEpisodes.length; i++) {
      const ep = currentSeasonEpisodes[i];
      if (isEpisodePlayable(ep)) {
        return true;
      }
    }
    
    // Check if there are next seasons with CONFIRMED playable episodes
    const currentSeasonIndex = tvshow.seasons.findIndex(
      (s: any) => s.season_number === selectedSeason.season_number
    );
    
    for (let seasonIndex = currentSeasonIndex + 1; seasonIndex < tvshow.seasons.length; seasonIndex++) {
      const season = tvshow.seasons[seasonIndex];
      if (season.seasonFolderExists) {
        // Only return true if we have episodes loaded for this season AND they have playable episodes
        const nextSeasonEpisodes = seasonEpisodes[season.season_number];
        
        if (nextSeasonEpisodes) {
          const playableEpisodes = nextSeasonEpisodes.filter((e: any) => isEpisodePlayable(e));
          if (playableEpisodes.length > 0) {
            return true;
          }
        }
        // Don't assume there are episodes if we haven't loaded them yet
      }
    }
    
    return false;
  };
  
  const hasSmartPreviousEpisode = (episode: any) => {
    if (!episode) return false;
    
    const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === episode.id);
    
    // Check if there's a previous PLAYABLE episode in current season
    for (let i = currentIndex - 1; i >= 0; i--) {
      if (isEpisodePlayable(currentSeasonEpisodes[i])) {
        return true;
      }
    }
    
    // Check if there are previous seasons with CONFIRMED playable episodes
    const currentSeasonIndex = tvshow.seasons.findIndex(
      (s: any) => s.season_number === selectedSeason.season_number
    );
    
    for (let seasonIndex = currentSeasonIndex - 1; seasonIndex >= 0; seasonIndex--) {
      const season = tvshow.seasons[seasonIndex];
      if (season.seasonFolderExists) {
        // Only return true if we have episodes loaded for this season AND they have playable episodes
        const prevSeasonEpisodes = seasonEpisodes[season.season_number];
        if (prevSeasonEpisodes) {
          const hasPlayableEpisode = prevSeasonEpisodes.some((e: any) => 
            isEpisodePlayable(e)
          );
          if (hasPlayableEpisode) return true;
        }
        // Don't assume there are episodes if we haven't loaded them yet
      }
    }
    
    return false;
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${tvshow.name} ▸ S${selectedSeason.season_number.toString().padStart(2, '0')} ▸ TV Show`}>
        {/* Open Graph meta tags for rich link sharing */}
        <meta property="og:title" content={`${tvshow.name} - Season ${selectedSeason.season_number}`} />
        <meta property="og:description" content={selectedSeason.overview || tvshow.overview || `Watch ${tvshow.name} - A great TV show experience`} />
        <meta property="og:image" content={tvshow.backdropUrl || `https://image.tmdb.org/t/p/w780${tvshow.poster_path}`} />
        <meta property="og:image:width" content="780" />
        <meta property="og:image:height" content="439" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="video.tv_show" />
        <meta property="og:site_name" content="Libeflix" />
        
        {/* Twitter Card meta tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${tvshow.name} - Season ${selectedSeason.season_number}`} />
        <meta name="twitter:description" content={selectedSeason.overview || tvshow.overview || `Watch ${tvshow.name} - A great TV show experience`} />
        <meta name="twitter:image" content={tvshow.backdropUrl || `https://image.tmdb.org/t/p/w780${tvshow.poster_path}`} />
        
        {/* Additional meta tags */}
        <meta name="description" content={selectedSeason.overview || tvshow.overview || `Watch ${tvshow.name} - A great TV show experience`} />
        <meta name="keywords" content={`${tvshow.name}, TV show, series, watch online, ${tvshow.genres?.map((g: any) => g.name).join(', ')}`} />
        
        {/* TV show-specific structured data */}
        <meta property="video:series" content={tvshow.name} />
        {tvshow.first_air_date && <meta property="video:release_date" content={tvshow.first_air_date} />}
      </Head>
      {/* hero */}
      <div className="relative flex flex-col min-h-[calc(100vh-5.5rem)] max-h-[calc(100vh-5.5rem)] overflow-hidden overflow-y-auto scrollbar">
        <div 
          style={{ backgroundImage: `url(${backdropUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }} className="w-full h-[calc(100vh-5.5rem)] filter grayscale opacity-10" 
        />
        <div className="absolute light-gradient-hero dark:dark-gradient-hero h-[calc(100vh-5.5rem)] w-full" />
        <div className="flex flex-col xl:flex-row w-full absolute">
          <div className="w-full flex flex-col items-start justify-start ">
            <div className="flex flex-col 2xl:flex-row w-full items-start justify-between gap-x-4 py-2 xl:p-4 2xl:p-6">
              {/* left panel */}
              <div className="flex flex-col gap-y-4 items-start w-full 2xl:w-[50%] overflow-hidden">
                {/* hero title */}
                <div className="text-black dark:text-white text-4xl font-bold px-5 py-3">
                  {
                    tvshow.logo?.url ?
                      <img src={`${tvshow.logo?.url}`} alt={tvshow.name} className="w-full sm:w-1/2 object-cover animate-zoomIn invert dark:invert-0" />
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

                  <Tooltip 
                    content={
                      isAuthenticated
                        ? (isLiked ? "Unlike this TV show" : "Like this TV show")
                        : "Login to like this TV show"
                    }
                    position="top"
                    delayMs={500}
                  >
                    <div
                      className={`transition-all duration-300 ease-in-out ${
                        isLikeAnimating ? 'rotate-180' : 'rotate-0'
                      }`}
                      style={{
                        transform: isLikeAnimating 
                          ? 'rotate(180deg)' 
                          : 'rotate(0deg)',
                      }}
                    >
                      <LoveCircleButton 
                        isLiked={isLiked} 
                        onClick={handleLikeToggle}
                        disabled={isLikeToggling}
                        className={`${isLikeToggling ? 'opacity-50 cursor-not-allowed' : ''}`}
                      />
                    </div>
                  </Tooltip>

                  <Tooltip 
                    content={
                      isShareSupported 
                        ? "Share this TV show" 
                        : "Share this TV show (copy link)"
                    }
                    position="top"
                    delayMs={500}
                  >
                    <button
                      onClick={handleShare}
                      disabled={isSharing}
                      className="p-1 rounded-full backdrop-blur border-2 border-black dark:border-neutral-400 hover:border-neutral-500 dark:hover:border-neutral-300 transition-all duration-150 cursor-pointer disabled:opacity-50"
                    >
                      <Share2 className="h-8 w-8 p-1" />
                    </button>
                  </Tooltip>
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

                        {/* likes count display */}
                        {likesCount > 0 && (
                          <div className="mt-6 flex items-center gap-x-2 text-sm text-neutral-600 dark:text-neutral-400">
                            <span className="font-medium">
                              {likesCount} {likesCount === 1 ? 'person likes' : 'people like'} this TV show
                            </span>
                          </div>
                        )}

                        {/* tabs */}
                        <div className="mt-10">
                          <Tabs defaultValue="cast" className="w-full">
                            <TabsList className="w-full">
                              {seasonCredits.cast && seasonCredits.cast.length > 0 && (
                                <TabsTrigger value="cast">Cast ({seasonCredits.cast.length})</TabsTrigger>
                              )}
                              {seasonCredits.guestStars && seasonCredits.guestStars.length > 0 && (
                                <TabsTrigger value="guest_stars">Guest Stars ({seasonCredits.guestStars.length})</TabsTrigger>
                              )}
                              <TabsTrigger value="created_by">Creators</TabsTrigger>
                              {seasonCredits.crew && seasonCredits.crew.length > 0 && (
                                <TabsTrigger value="crew">Crew ({seasonCredits.crew.length})</TabsTrigger>
                              )}
                            </TabsList>
                            <TabsContent value="cast">
                              {/* cast ribbon */}
                              {seasonCredits.cast && seasonCredits.cast.length > 0 && (
                                <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                                  <PaginatedRibbon
                                    align="start"
                                    dragFree={true}
                                    itemsPerPage={30}
                                    paginationThreshold={30}
                                  >
                                    {seasonCredits.cast.map((cast: any, index: number) => {
                                      // Only prioritize the first 6-8 cast members for initial viewport
                                      const isPriority = index < 8;
                                      
                                      return (
                                        <CreditPoster 
                                          key={cast.id || `cast-${index}`}
                                          imageUrl={cast.profilePathUrl} 
                                          name={cast.name}
                                          characterName={cast.character} 
                                          priority={isPriority}
                                        />
                                      );
                                    })}
                                  </PaginatedRibbon>
                                </div>
                              )}
                            </TabsContent>
                            <TabsContent value="guest_stars">
                              {/* guest stars ribbon */}
                              {seasonCredits.guestStars && seasonCredits.guestStars.length > 0 && (
                                <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                                  <PaginatedRibbon
                                    align="start"
                                    dragFree={true}
                                    itemsPerPage={30}
                                    paginationThreshold={30}
                                  >
                                    {seasonCredits.guestStars.map((guestStar: any, index: number) => {
                                      // Only prioritize the first 6-8 guest stars for initial viewport
                                      const isPriority = index < 8;
                                      
                                      return (
                                        <CreditPoster 
                                          key={guestStar.id || `guest-${index}`}
                                          imageUrl={guestStar.profilePathUrl} 
                                          name={guestStar.name}
                                          characterName={guestStar.character} 
                                          priority={isPriority}
                                        />
                                      );
                                    })}
                                  </PaginatedRibbon>
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
                              {seasonCredits.crew && seasonCredits.crew.length > 0 && (
                                <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                                  <PaginatedRibbon
                                    align="start"
                                    dragFree={true}
                                    itemsPerPage={30}
                                    paginationThreshold={30}
                                  >
                                    {(() => {
                                      const jobOrder = [
                                        'Director',
                                        'Executive Producer',
                                        'Producer',
                                        'Writer',
                                        'Screenplay',
                                        'Teleplay',
                                        'Story',
                                        'Creator',
                                        'Director of Photography',
                                        'Editor',
                                        'Production Design',
                                        'Art Direction',
                                        'Costume Design',
                                        'Casting',
                                        'Original Music Composer',
                                      ];

                                      const sortedCrew = [...seasonCredits.crew].sort((a, b) => {
                                        const indexA = jobOrder.indexOf(a.job);
                                        const indexB = jobOrder.indexOf(b.job);

                                        if (indexA !== -1 && indexB === -1) return -1;
                                        if (indexA === -1 && indexB !== -1) return 1;
                                        if (indexA !== -1 && indexB !== -1) {
                                          if (indexA !== indexB) {
                                            return indexA - indexB;
                                          }
                                        }
                                        
                                        const jobComparison = a.job.localeCompare(b.job);
                                        if (jobComparison !== 0) {
                                          return jobComparison;
                                        }
                                        return a.name.localeCompare(b.name);
                                      });

                                      return sortedCrew.map((crew: any, index: number) => {
                                        // Only prioritize the first 6-8 crew members for initial viewport
                                        const isPriority = index < 8;
                                        
                                        return (
                                          <CreditPoster 
                                            key={crew.id || `crew-${index}`}
                                            imageUrl={crew.profilePathUrl} 
                                            name={crew.name}
                                            characterName={crew.job} 
                                            priority={isPriority}
                                          />
                                        );
                                      });
                                    })()}
                                  </PaginatedRibbon>
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
                {loadingError && (
                  <div className="px-5 py-3 mt-10 animate-fadeIn">
                    <div className="text-[1.2rem] font-bold mb-4 text-rose-500">
                      Error: {loadingError}
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
                        // Reset auto-play flag so it can work again if user comes from search later
                        hasAutoPlayedEpisode.current = false;
                      }
                    }}
                    onError={(err) => console.error(err.message)}
                    hasNextEpisode={(() => {
                      // Check if there's a next episode specifically in the CURRENT season
                      const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === selectedEpisode.id);
                      let hasNextInCurrentSeason = false;
                      
                      if (currentIndex !== -1) {
                        for (let i = currentIndex + 1; i < currentSeasonEpisodes.length; i++) {
                          if (isEpisodePlayable(currentSeasonEpisodes[i])) {
                            hasNextInCurrentSeason = true;
                            break;
                          }
                        }
                      }
                      
                      return hasNextInCurrentSeason;
                    })()}
                    hasPreviousEpisode={(() => {
                      // Check if there's a previous episode specifically in the CURRENT season
                      const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === selectedEpisode.id);
                      let hasPrevInCurrentSeason = false;
                      
                      if (currentIndex !== -1) {
                        for (let i = currentIndex - 1; i >= 0; i--) {
                          if (isEpisodePlayable(currentSeasonEpisodes[i])) {
                            hasPrevInCurrentSeason = true;
                            break;
                          }
                        }
                      }
                      
                      return hasPrevInCurrentSeason;
                    })()}
                                          onNextEpisode={() => {
                        const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === selectedEpisode.id);
                        
                        // Use the same logic as hasSmartNextEpisode - look for the next PLAYABLE episode
                        for (let i = currentIndex + 1; i < currentSeasonEpisodes.length; i++) {
                          const nextEpisode = currentSeasonEpisodes[i];
                          
                          if (isEpisodePlayable(nextEpisode)) {
                            // Keep dialog open when setting next episode
                            setSelectedEpisode(nextEpisode);
                            // Make sure dialog is open
                            setIsDialogOpen(true);
                            break;
                          }
                        }
                      }}
                    onPreviousEpisode={() => {
                      const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === selectedEpisode.id);
                      
                      // Use the same logic as hasSmartPreviousEpisode - look for the previous PLAYABLE episode
                      for (let i = currentIndex - 1; i >= 0; i--) {
                        const prevEpisode = currentSeasonEpisodes[i];
                        
                        if (isEpisodePlayable(prevEpisode)) {
                          setSelectedEpisode(prevEpisode);
                          setIsDialogOpen(true);
                          break;
                        }
                      }
                    }}
                    // Enhanced navigation functions for handling missing episodes
                    onFindNextAvailableEpisode={() => {
                      const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === selectedEpisode.id);
                      
                      // First, try to find next PLAYABLE episode in current season
                      for (let i = currentIndex + 1; i < currentSeasonEpisodes.length; i++) {
                        const episode = currentSeasonEpisodes[i];
                        if (isEpisodePlayable(episode)) {
                          setSelectedEpisode(episode);
                          setIsDialogOpen(true);
                          return;
                        }
                      }
                      
                      // If no available episodes in current season, search next seasons
                      const currentSeasonIndex = tvshow.seasons.findIndex(
                        (s: any) => s.season_number === selectedSeason.season_number
                      );
                      
                      // Helper function to handle when no episodes are found anywhere
                      const handleNoMoreEpisodes = () => {
                        // Since this function is called from the player when looking for next episodes,
                        // and no episodes were found, we should go back to first episode of TV show
                        // Try to get Season 1 specifically
                        let firstSeason = tvshow.seasons.find((s: any) => 
                          s.season_number === 1 && s.seasonFolderExists
                        );
                        
                        // If Season 1 isn't available, get the earliest available season
                        if (!firstSeason) {
                          const availableSeasons = tvshow.seasons
                            .filter((s: any) => s.season_number > 0 && s.seasonFolderExists)
                            .sort((a: any, b: any) => a.season_number - b.season_number);
                            
                          if (availableSeasons.length > 0) {
                            firstSeason = availableSeasons[0];
                          }
                        }
                        
                        if (firstSeason) {
                          // Switch to first season
                          handleSeasonSelect(firstSeason);
                          
                          const firstSeasonEpisodes = seasonEpisodes[firstSeason.season_number];
                          if (firstSeasonEpisodes) {
                            const firstPlayableEpisode = firstSeasonEpisodes.find((e: any) => 
                              e.is_in_storage && e.encFilePath
                            );
                            
                            if (firstPlayableEpisode) {
                              setTimeout(() => {
                                setSelectedEpisode(firstPlayableEpisode);
                                setIsDialogOpen(true);
                              }, 100);
                            }
                          } else {
                            // Load episodes for first season if not loaded
                            loadSeasonEpisodes(firstSeason.season_number).then((episodes) => {
                              const firstPlayableEpisode = episodes?.find((e: any) => 
                                e.is_in_storage && e.encFilePath
                              );
                              
                              if (firstPlayableEpisode) {
                                setTimeout(() => {
                                  setSelectedEpisode(firstPlayableEpisode);
                                  setIsDialogOpen(true);
                                }, 100);
                              }
                            });
                          }
                        }
                      };
                      
                      let foundEpisode = false;
                      let seasonsToCheck = 0;
                      
                      // Count how many seasons we need to check
                      for (let seasonIndex = currentSeasonIndex + 1; seasonIndex < tvshow.seasons.length; seasonIndex++) {
                        const season = tvshow.seasons[seasonIndex];
                        if (season.seasonFolderExists) {
                          seasonsToCheck++;
                        }
                      }
                      
                      // If no seasons to check, handle no more episodes immediately
                      if (seasonsToCheck === 0) {
                        handleNoMoreEpisodes();
                        return;
                      }
                      
                      let seasonsChecked = 0;
                      
                      for (let seasonIndex = currentSeasonIndex + 1; seasonIndex < tvshow.seasons.length; seasonIndex++) {
                        const season = tvshow.seasons[seasonIndex];
                        if (season.seasonFolderExists) {
                          const nextSeasonEpisodes = seasonEpisodes[season.season_number];
                          
                          if (nextSeasonEpisodes) {
                            const firstPlayableEpisode = nextSeasonEpisodes.find((e: any) => 
                              isEpisodePlayable(e)
                            );
                            
                            if (firstPlayableEpisode) {
                              foundEpisode = true;
                              // Change to the next season
                              handleSeasonSelect(season);
                              
                              // Small timeout to ensure season change completes first
                              setTimeout(() => {
                                setSelectedEpisode(firstPlayableEpisode);
                                setIsDialogOpen(true);
                              }, 100);
                              return;
                            }
                            
                            seasonsChecked++;
                            // If this was the last season to check and no episode found
                            if (seasonsChecked === seasonsToCheck && !foundEpisode) {
                              handleNoMoreEpisodes();
                            }
                          } else {
                            // Load episodes for this season if not loaded
                            loadSeasonEpisodes(season.season_number).then((episodes) => {
                              const firstPlayableEpisode = episodes?.find((e: any) => 
                                isEpisodePlayable(e)
                              );
                              
                              seasonsChecked++;
                              
                              if (firstPlayableEpisode) {
                                foundEpisode = true;
                                handleSeasonSelect(season);
                                setTimeout(() => {
                                  setSelectedEpisode(firstPlayableEpisode);
                                  setIsDialogOpen(true);
                                }, 100);
                              } else {
                                if (seasonsChecked === seasonsToCheck && !foundEpisode) {
                                  // If this was the last season to check and no episode found
                                  handleNoMoreEpisodes();
                                }
                              }
                            }).catch((error) => {
                              seasonsChecked++;
                              if (seasonsChecked === seasonsToCheck && !foundEpisode) {
                                handleNoMoreEpisodes();
                              }
                            });
                          }
                        }
                      }
                    }}
                    onFindPreviousAvailableEpisode={() => {
                      const currentIndex = currentSeasonEpisodes.findIndex((e: any) => e.id === selectedEpisode.id);
                      
                      // First, try to find previous PLAYABLE episode in current season
                      for (let i = currentIndex - 1; i >= 0; i--) {
                        const episode = currentSeasonEpisodes[i];
                        if (isEpisodePlayable(episode)) {
                          setSelectedEpisode(episode);
                          setIsDialogOpen(true);
                          return;
                        }
                      }
                      
                      // If no available episodes in current season, search previous seasons
                      const currentSeasonIndex = tvshow.seasons.findIndex(
                        (s: any) => s.season_number === selectedSeason.season_number
                      );
                      
                      // Helper function to handle when no previous episodes are found anywhere
                      const handleNoPreviousEpisodes = () => {
                        // Since this function is called when looking for previous episodes,
                        // and no episodes were found, we should go to last episode of TV show (for repeat modes)
                        // Find the last available season with episodes
                        const availableSeasons = tvshow.seasons
                          .filter((s: any) => s.season_number > 0 && s.seasonFolderExists)
                          .sort((a: any, b: any) => b.season_number - a.season_number); // Sort descending
                        
                        if (availableSeasons.length > 0) {
                          const lastSeason = availableSeasons[0];
                          
                          // Switch to last season
                          handleSeasonSelect(lastSeason);
                          
                          const lastSeasonEpisodes = seasonEpisodes[lastSeason.season_number];
                          if (lastSeasonEpisodes) {
                            // Find last playable episode in that season
                            for (let i = lastSeasonEpisodes.length - 1; i >= 0; i--) {
                              const episode = lastSeasonEpisodes[i];
                              if (episode.is_in_storage && episode.encFilePath) {
                                setTimeout(() => {
                                  setSelectedEpisode(episode);
                                  setIsDialogOpen(true);
                                }, 100);
                                return;
                              }
                            }
                          } else {
                            // Load episodes for last season if not loaded
                            loadSeasonEpisodes(lastSeason.season_number).then((episodes) => {
                              // Find last playable episode
                              for (let i = episodes.length - 1; i >= 0; i--) {
                                const episode = episodes[i];
                                if (episode.is_in_storage && episode.encFilePath) {
                                  setTimeout(() => {
                                    setSelectedEpisode(episode);
                                    setIsDialogOpen(true);
                                  }, 100);
                                  return;
                                }
                              }
                            });
                          }
                        }
                      };
                      
                      let foundEpisode = false;
                      let seasonsToCheck = 0;
                      
                      // Count how many seasons we need to check
                      for (let seasonIndex = currentSeasonIndex - 1; seasonIndex >= 0; seasonIndex--) {
                        const season = tvshow.seasons[seasonIndex];
                        if (season.seasonFolderExists) {
                          seasonsToCheck++;
                        }
                      }
                      
                      // If no seasons to check, handle no previous episodes immediately
                      if (seasonsToCheck === 0) {
                        handleNoPreviousEpisodes();
                        return;
                      }
                      
                      let seasonsChecked = 0;
                      
                      for (let seasonIndex = currentSeasonIndex - 1; seasonIndex >= 0; seasonIndex--) {
                        const season = tvshow.seasons[seasonIndex];
                        if (season.seasonFolderExists) {
                          const prevSeasonEpisodes = seasonEpisodes[season.season_number];
                          
                          if (prevSeasonEpisodes) {
                            // Find last playable episode in the previous season
                            for (let i = prevSeasonEpisodes.length - 1; i >= 0; i--) {
                              const episode = prevSeasonEpisodes[i];
                              if (isEpisodePlayable(episode)) {
                                foundEpisode = true;
                                // Change to the previous season
                                handleSeasonSelect(season);
                                
                                // Small timeout to ensure season change completes first
                                setTimeout(() => {
                                  setSelectedEpisode(episode);
                                  setIsDialogOpen(true);
                                }, 100);
                                return;
                              }
                            }
                            
                            seasonsChecked++;
                            // If this was the last season to check and no episode found
                            if (seasonsChecked === seasonsToCheck && !foundEpisode) {
                              handleNoPreviousEpisodes();
                            }
                          } else {
                            // Load episodes for this season if not loaded
                            loadSeasonEpisodes(season.season_number).then((episodes) => {
                              // Find last playable episode
                              for (let i = episodes.length - 1; i >= 0; i--) {
                                const episode = episodes[i];
                                if (isEpisodePlayable(episode)) {
                                  foundEpisode = true;
                                  handleSeasonSelect(season);
                                  setTimeout(() => {
                                    setSelectedEpisode(episode);
                                    setIsDialogOpen(true);
                                  }, 100);
                                  return;
                                }
                              }
                              
                              seasonsChecked++;
                              if (seasonsChecked === seasonsToCheck && !foundEpisode) {
                                // If this was the last season to check and no episode found
                                handleNoPreviousEpisodes();
                              }
                            }).catch((error) => {
                              seasonsChecked++;
                              if (seasonsChecked === seasonsToCheck && !foundEpisode) {
                                handleNoPreviousEpisodes();
                              }
                            });
                          }
                        }
                      }
                    }}
                    onFirstEpisodeOfSeason={() => {
                      // Get the first episode with valid file path in the current season
                      const firstPlayableEpisode = currentSeasonEpisodes.find((e: any) => 
                        isEpisodePlayable(e)
                      );
                      
                      if (firstPlayableEpisode) {
                        setSelectedEpisode(firstPlayableEpisode);
                      }
                    }}
                    onFirstEpisodeOfTVShow={() => {
                      // Try to get Season 1 specifically
                      let firstSeason = tvshow.seasons.find((s: any) => 
                        s.season_number === 1 && s.seasonFolderExists
                      );
                      
                      // If Season 1 isn't available, get the earliest available season
                      if (!firstSeason) {
                        const availableSeasons = tvshow.seasons
                          .filter((s: any) => s.season_number > 0 && s.seasonFolderExists)
                          .sort((a: any, b: any) => a.season_number - b.season_number);
                          
                        if (availableSeasons.length > 0) {
                          firstSeason = availableSeasons[0];
                        }
                      }
                      
                      if (firstSeason) {
                        // If we're already on first season, just go to first episode
                        if (firstSeason.season_number === selectedSeason.season_number) {
                          const firstPlayableEpisode = currentSeasonEpisodes.find((e: any) => 
                            isEpisodePlayable(e)
                          );
                          
                          if (firstPlayableEpisode) {
                            setSelectedEpisode(firstPlayableEpisode);
                            // Make sure dialog is open
                            setIsDialogOpen(true);
                          }
                        } else {
                          // Otherwise switch to first season
                          handleSeasonSelect(firstSeason);
                          
                          // Find first playable episode in that season
                          const firstSeasonEpisodes = seasonEpisodes[firstSeason.season_number];
                          if (firstSeasonEpisodes) {
                            const firstPlayableEpisode = firstSeasonEpisodes.find((e: any) => 
                              e.is_in_storage && e.encFilePath
                            );
                            
                            if (firstPlayableEpisode) {
                              // Small timeout to ensure season change completes first
                              setTimeout(() => {
                                setSelectedEpisode(firstPlayableEpisode);
                                setIsDialogOpen(true);
                              }, 100);
                            }
                          } else {
                            // Load episodes for first season if not loaded
                            loadSeasonEpisodes(firstSeason.season_number).then((episodes) => {
                              const firstPlayableEpisode = episodes?.find((e: any) => 
                                e.is_in_storage && e.encFilePath
                              );
                              
                              if (firstPlayableEpisode) {
                                setTimeout(() => {
                                  setSelectedEpisode(firstPlayableEpisode);
                                  setIsDialogOpen(true);
                                }, 100);
                              }
                            });
                          }
                        }
                      }
                    }}
                    onLastEpisodeOfSeason={() => {
                      // Find the last playable episode in the current season
                      for (let i = currentSeasonEpisodes.length - 1; i >= 0; i--) {
                        const episode = currentSeasonEpisodes[i];
                        if (episode.is_in_storage && episode.encFilePath) {
                          setSelectedEpisode(episode);
                          setIsDialogOpen(true);
                          return;
                        }
                      }
                    }}
                    onLastEpisodeOfTVShow={() => {
                      // Find the last available season with episodes
                      const availableSeasons = tvshow.seasons
                        .filter((s: any) => s.season_number > 0 && s.seasonFolderExists)
                        .sort((a: any, b: any) => b.season_number - a.season_number); // Sort descending
                      
                      if (availableSeasons.length > 0) {
                        const lastSeason = availableSeasons[0];
                        
                        if (lastSeason.season_number === selectedSeason.season_number) {
                          // We're already on the last season, find last episode
                          for (let i = currentSeasonEpisodes.length - 1; i >= 0; i--) {
                            const episode = currentSeasonEpisodes[i];
                            if (episode.is_in_storage && episode.encFilePath) {
                              setSelectedEpisode(episode);
                              setIsDialogOpen(true);
                              return;
                            }
                          }
                        } else {
                          // Switch to last season
                          handleSeasonSelect(lastSeason);
                          
                          const lastSeasonEpisodes = seasonEpisodes[lastSeason.season_number];
                          if (lastSeasonEpisodes) {
                            // Find last playable episode in that season
                            for (let i = lastSeasonEpisodes.length - 1; i >= 0; i--) {
                              const episode = lastSeasonEpisodes[i];
                              if (episode.is_in_storage && episode.encFilePath) {
                                setTimeout(() => {
                                  setSelectedEpisode(episode);
                                  setIsDialogOpen(true);
                                }, 100);
                                return;
                              }
                            }
                          } else {
                            // Load episodes for last season if not loaded
                            loadSeasonEpisodes(lastSeason.season_number).then((episodes) => {
                              // Find last playable episode
                              for (let i = episodes.length - 1; i >= 0; i--) {
                                const episode = episodes[i];
                                if (episode.is_in_storage && episode.encFilePath) {
                                  setTimeout(() => {
                                    setSelectedEpisode(episode);
                                    setIsDialogOpen(true);
                                  }, 100);
                                  return;
                                }
                              }
                            });
                          }
                        }
                      }
                    }}
                    initialRepeatMode="tvshow"
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
                            <div className={`w-[10rem] h-[15rem] border-2 ${selectedSeason?.season_number === season.season_number ? 'border-rose-500 dark:border-rose-500' : 'border-neutral-400 dark:border-neutral-700'} rounded-md overflow-hidden opacity-90 group-hover-touch:opacity-100 transition-all duration-150`}>
                              <LazyImage 
                                src={season.posterPathUrl}
                                alt={season.name}
                                className={`w-full h-full object-cover ${season.seasonFolderExists ? '' : 'grayscale'} group-hover-touch:grayscale-0 transition-all duration-150`}
                                priority={isPriority}
                              />
                            </div>
                            <div className={`mt-6 font-semibold text-sm mb-4 rounded-md text-center w-full ${selectedSeason?.season_number === season.season_number ? 'bg-rose-500 dark:bg-rose-500 text-white' : 'text-neutral-700 dark:text-neutral-300 group-hover-touch:text-neutral-900 dark:group-hover-touch:text-neutral-100'} transition-colors duration-150`}>
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
                    <div className="text-[1.2rem] font-bold flex items-center gap-x-2">
                      {selectedSeason.name} - Episodes ({currentSeasonEpisodes.length})
                      {isLoadingCurrentSeason && (
                        <LoaderCircle className="h-5 w-5 animate-spin text-rose-500" />
                      )}
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

                  <div className="mt-8 relative">
                    {isLoadingCurrentSeason && (
                      <div className="absolute inset-0 bg-white/20 dark:bg-black/20 backdrop-blur-sm z-10 flex items-center justify-center min-h-[300px] rounded-md">
                        <LoaderCircle className="h-8 w-8 animate-spin text-rose-500" />
                      </div>
                    )}
                    <ul>
                        {/* (lazy loading) Prioritize more episodes at the beginning (first 5) */}
                        {currentSeasonEpisodes.map((episode: any, index: number, array: any[]) => {
                          const isLastItem = index === array.length - 1;
                          const isPriority = index < 5;
                          
                          return (
                            <li key={episode.id} className={`group flex flex-col lg:flex-row items-start gap-y-3 lg:gap-y-0 lg:items-center gap-x-4 lg:gap-x-8 justify-between px-2 py-8 bg-gradient-to-tr hover:bg-neutral-400/20 dark:hover:bg-neutral-800/30 transition-colors duration-150 ${!isLastItem ? 'border-b border-neutral-800 dark:border-neutral-700 border-dotted' : ''}`}>
                              <div className="text-2xl text-center w-[2.5rem] group-hover-touch:text-rose-500 dark:group-hover-touch:text-rose-500 transition-colors duration-150">
                                {episode.episode_number}
                              </div>
                              
                              <div 
                                className={`aspect-video w-full h-[12rem] lg:w-1/2 lg:h-[7rem] rounded-md overflow-hidden relative group ${episode.is_in_storage ? 'cursor-pointer' : ''}`}
                                onClick={() => episode.is_in_storage && handleEpisodeClick(episode)}
                              >
                                <LazyImage 
                                  src={`${episode.stillUrl}`}
                                  alt={episode.name}
                                  className={`w-full h-full object-cover opacity-90 group-hover-touch:opacity-100 transition-opacity duration-150 ${!episode.is_in_storage ? 'grayscale' : ''}`}
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
                                    {/* subtitles */}
                                    {episode.subtitles && Array.isArray(episode.subtitles) && episode.subtitles.length > 0 && (
                                      <div className="flex flex-row items-center gap-x-2 py-1">
                                        <div className="flex items-center gap-x-1 text-[0.65rem] font-mono text-neutral-700 dark:text-neutral-400">
                                          <div className="rounded cursor-default select-none border border-neutral-700 dark:border-neutral-700 bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-100 px-0.5">
                                            CC
                                          </div>
                                          {episode.subtitles
                                            .filter((subtitle: any) => 
                                              subtitle && 
                                              subtitle.language_code && 
                                              typeof subtitle.language_code === 'string'
                                            )
                                            .map((subtitle: any, index: number) => (
                                              <div 
                                                className="rounded cursor-default select-none border border-neutral-700 dark:border-neutral-700 px-0.5" 
                                                key={`subtitle-${subtitle.language_code}-${index}`}
                                              >
                                                {subtitle.language_code}
                                              </div>
                                            ))
                                          }
                                        </div>
                                      </div>
                                    )}
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