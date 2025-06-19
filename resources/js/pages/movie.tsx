import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem } from "@/types";
import { Head, usePage } from "@inertiajs/react";
import { Clapperboard, HeartIcon, MessageSquareText, Share2, LockIcon, UserIcon, CreditCardIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { PaginatedRibbon } from "@/components/ui/paginated-ribbon";
import { CreditPoster } from "@/components/ui/credit-poster";
import { useEffect, useState } from "react";
import { MovieCard } from "@/components/ui/movie-card";
import { MovieCardSkeleton } from "@/components/ui/movie-card-skeleton";
import { TrailerModal } from "@/components/trailer-modal";
import axios from 'axios';

// Interface for sidebar state event
interface SidebarStateDetail {
  state: 'expanded' | 'collapsed';
  width: string;
  isMobile: boolean;
}

// Interface for movie data from API
interface MovieData {
  id: number;
  title: string;
  poster_path?: string;
  poster_url?: string;
  backdrop_path?: string;
  backdrop_url?: string;
  vote_average: number;
  release_date: string;
  overview?: string;
  is_local?: boolean;
  slug?: string;
  is_watch_later?: boolean;
  has_subtitles?: boolean;
  subtitle_languages?: string[];
}

export default function Movie({ movie, encFilePath, imgBaseUrl300, imgBaseUrl500, imgBaseUrl780, imgBaseUrl1280 }: { movie: any, encFilePath: string, imgBaseUrl300: string, imgBaseUrl500: string, imgBaseUrl780: string, imgBaseUrl1280: string }) {
  const { props } = usePage<{
    auth: {
      user: any;
      canAccessPremium: boolean;
      isAdmin: boolean;
    };
  }>();

  // Check if user can access this movie
  const canAccessMovie = movie.is_free || props.auth.canAccessPremium || props.auth.isAdmin;
  const isAuthenticated = !!props.auth.user;

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
  
  // State for recommendations and similar movies
  const [recommendations, setRecommendations] = useState<MovieData[]>([]);
  const [similarMovies, setSimilarMovies] = useState<MovieData[]>([]);
  const [loadingRecommendations, setLoadingRecommendations] = useState(true);
  const [loadingSimilarMovies, setLoadingSimilarMovies] = useState(true);
  const [recommendationsError, setRecommendationsError] = useState<string | null>(null);
  const [similarMoviesError, setSimilarMoviesError] = useState<string | null>(null);
  
  // State for trailer modal
  const [isTrailerModalOpen, setIsTrailerModalOpen] = useState(false);
  const [selectedTrailerMovie, setSelectedTrailerMovie] = useState<{ id: number; title: string } | null>(null);

  // Function to fetch recommendations
  const fetchRecommendations = async () => {
    try {
      setLoadingRecommendations(true);
      setRecommendationsError(null);
      const response = await axios.get(`/api/movies/${movie.id}/recommendations`);
      if (response.data.success) {
        setRecommendations(response.data.recommendations);
      } else {
        setRecommendationsError('Failed to load recommendations');
      }
    } catch (error) {
      console.error('Error fetching recommendations:', error);
      setRecommendationsError('Failed to load recommendations');
    } finally {
      setLoadingRecommendations(false);
    }
  };

  // Function to fetch similar movies
  const fetchSimilarMovies = async () => {
    try {
      setLoadingSimilarMovies(true);
      setSimilarMoviesError(null);
      const response = await axios.get(`/api/movies/${movie.id}/similar`);
      if (response.data.success) {
        setSimilarMovies(response.data.similar_movies);
      } else {
        setSimilarMoviesError('Failed to load similar movies');
      }
    } catch (error) {
      console.error('Error fetching similar movies:', error);
      setSimilarMoviesError('Failed to load similar movies');
    } finally {
      setLoadingSimilarMovies(false);
    }
  };

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

  // Fetch recommendations and similar movies when component mounts
  useEffect(() => {
    fetchRecommendations();
    fetchSimilarMovies();
  }, [movie.id]);

  // Function to handle trailer clicks from movie cards
  const handleTrailerClick = (movieId: number, movieTitle: string) => {
    setSelectedTrailerMovie({ id: movieId, title: movieTitle });
    setIsTrailerModalOpen(true);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${movie.title}`} />
      <div>
        <div className="flex flex-col items-start justify-between">
          <div className="flex flex-col w-full">
            <div className="bg-black text-white focus:outline-none relative">
              <video 
                className="w-full aspect-video lg:aspect-auto xl:h-[73vh] object-cover object-center focus:outline-none"  
                controls={canAccessMovie ? true : false}
                controlsList="nodownload" 
                onContextMenu={(e) => e.preventDefault()}
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

              {/* Premium Content Overlay */}
              {!canAccessMovie && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-10 p-3 sm:p-4">
                  <div className="text-center text-white p-3 sm:p-4 md:p-6 lg:p-8 max-w-[280px] sm:max-w-sm md:max-w-md lg:max-w-lg w-full">
                    <div className="mb-3 sm:mb-4 md:mb-6">
                      <LockIcon className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 mx-auto mb-2 sm:mb-3 md:mb-4 text-yellow-500" />
                      <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Premium Content</h3>
                      <p className="text-gray-300 text-xs sm:text-sm md:text-base leading-tight sm:leading-normal">
                        {!isAuthenticated 
                          ? "Please register and log in to watch this movie."
                          : "This movie requires a premium subscription to watch."
                        }
                      </p>
                    </div>
                    
                    <div className="space-y-2 sm:space-y-2 md:space-y-3">
                      {!isAuthenticated ? (
                        <>
                          <a 
                            href="/register" 
                            className="block w-full bg-blue-600 hover:bg-blue-700 text-white font-medium sm:font-semibold py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 md:px-6 rounded-md sm:rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base"
                          >
                            <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 inline mr-1 sm:mr-2" />
                            Create Account
                          </a>
                          <a 
                            href="/login" 
                            className="block w-full bg-gray-600 hover:bg-gray-700 text-white font-medium sm:font-semibold py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 md:px-6 rounded-md sm:rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base"
                          >
                            Already have an account? Log In
                          </a>
                        </>
                      ) : (
                        <a 
                          href="/subscription/plans" 
                          className="block w-full bg-yellow-600 hover:bg-yellow-700 text-white font-medium sm:font-semibold py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 md:px-6 rounded-md sm:rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base"
                        >
                          <CreditCardIcon className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 inline mr-1 sm:mr-2" />
                          Get Premium Access
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}
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
                              <PaginatedRibbon
                                align="start"
                                dragFree={true}
                                itemsPerPage={20}
                                paginationThreshold={20}
                              >
                                {movie.credits.cast.map((cast: any, index: number) => {
                                  // Only prioritize the first 6-8 cast members for initial viewport
                                  const isPriority = index < 8;
                                  
                                  return (
                                    <CreditPoster 
                                      key={`cast-${cast.id}-${index}`}
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
                        
                        <TabsContent value="crew">
                          {/* crew ribbon */}
                          {movie.credits?.crew && movie.credits.crew.length > 0 && (
                            <div className="mt-10 text-base text-neutral-700 dark:text-neutral-300 w-full">
                              <PaginatedRibbon
                                align="start"
                                dragFree={true}
                                itemsPerPage={20}
                                paginationThreshold={20}
                              >
                                {movie.credits.crew.map((crew: any, index: number) => {
                                  // Only prioritize the first 6-8 crew members for initial viewport
                                  const isPriority = index < 8;
                                  
                                  return (
                                    <CreditPoster 
                                      key={`crew-${crew.id}-${index}`}
                                      imageUrl={crew.profilePathUrl} 
                                      name={crew.name}
                                      characterName={crew.job} 
                                      priority={isPriority}
                                    />
                                  );
                                })}
                              </PaginatedRibbon>
                            </div>
                          )}
                        </TabsContent>
                      </Tabs>
                    </div>
                    <div 
                      className="flex flex-col gap-y-10 w-[calc(100vw-2rem)] lg:w-[calc(100vw-var(--dynamic-sidebar-width)-5rem)]"
                      style={{
                        '--dynamic-sidebar-width': sidebarWidth
                      } as React.CSSProperties}
                    >
                      {/* Recommended Movies Section */}
                      <div className="flex flex-col gap-y-4 w-full">
                        <h2 className="text-xl font-bold mb-4">Recommended Movies</h2>
                        {loadingRecommendations ? (
                          <div className="w-full">
                            <Ribbon align="start" dragFree={true}>
                              {Array.from({ length: 8 }).map((_, index) => (
                                <RibbonItem key={`rec-skeleton-${index}`}>
                                  <MovieCardSkeleton count={1} className="w-[180px]" />
                                </RibbonItem>
                              ))}
                            </Ribbon>
                          </div>
                        ) : recommendationsError ? (
                          <div className="text-red-500 text-center py-8">
                            {recommendationsError}
                          </div>
                        ) : recommendations.length > 0 ? (
                          <div className="w-full">
                            <Ribbon align="start" dragFree={true}>
                              {recommendations.map((recommendation, index) => (
                                <RibbonItem key={`recommendation-${recommendation.id}-${index}`}>
                                  <MovieCard
                                    movie={recommendation}
                                    className="w-[180px]"
                                    onTrailerClick={handleTrailerClick}
                                  />
                                </RibbonItem>
                              ))}
                            </Ribbon>
                          </div>
                        ) : (
                          <div className="text-gray-500 text-center py-8">
                            No recommendations available
                          </div>
                        )}
                      </div>

                      {/* Similar Movies Section */}
                      <div className="flex flex-col gap-y-4 w-full">
                        <h2 className="text-xl font-bold mb-4">Similar Movies</h2>
                        {loadingSimilarMovies ? (
                          <div className="w-full">
                            <Ribbon align="start" dragFree={true}>
                              {Array.from({ length: 8 }).map((_, index) => (
                                <RibbonItem key={`sim-skeleton-${index}`}>
                                  <MovieCardSkeleton count={1} className="w-[180px]" />
                                </RibbonItem>
                              ))}
                            </Ribbon>
                          </div>
                        ) : similarMoviesError ? (
                          <div className="text-red-500 text-center py-8">
                            {similarMoviesError}
                          </div>
                        ) : similarMovies.length > 0 ? (
                          <div className="w-full">
                            <Ribbon align="start" dragFree={true}>
                              {similarMovies.map((similar, index) => (
                                <RibbonItem key={`similar-${similar.id}-${index}`}>
                                  <MovieCard
                                    movie={similar}
                                    className="w-[180px]"
                                    onTrailerClick={handleTrailerClick}
                                  />
                                </RibbonItem>
                              ))}
                            </Ribbon>
                          </div>
                        ) : (
                          <div className="text-gray-500 text-center py-8">
                            No similar movies available
                          </div>
                        )}
                      </div>
                    </div>
                    
                  </div>
                  
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Trailer Modal */}
      {selectedTrailerMovie && (
        <TrailerModal
          isOpen={isTrailerModalOpen}
          onOpenChange={setIsTrailerModalOpen}
          movieTitle={selectedTrailerMovie.title}
          movieId={selectedTrailerMovie.id}
        />
      )}
      
    </AppLayout>
  );
}