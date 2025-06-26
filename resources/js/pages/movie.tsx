import AppLayout from "@/layouts/app-layout";
import { BreadcrumbItem, SharedData } from "@/types";
import { Head, Link, usePage, router } from "@inertiajs/react";
import { Clapperboard, HeartIcon, MessageSquareText, Share2, LockIcon, UserIcon, CreditCardIcon } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Ribbon, RibbonItem } from "@/components/ui/ribbon";
import { PaginatedRibbon } from "@/components/ui/paginated-ribbon";
import { CreditPoster } from "@/components/ui/credit-poster";
import { useEffect, useState, useRef } from "react";
import { MovieCard } from "@/components/ui/movie-card";
import { MovieCardSkeleton } from "@/components/ui/movie-card-skeleton";
import { TrailerModal } from "@/components/trailer-modal";
import { Tooltip } from "@/components/ui/tooltip";
import { useWebShare } from "@/hooks/use-web-share";
import axios from 'axios';
import { LazyImage } from "@/components/ui/lazy-image";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CommentsSection } from "@/components/ui/comments-section";

// console.log('movie.tsx loaded, CommentsSection imported:', CommentsSection);

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
  is_liked?: boolean;
  likes_count?: number;
}

export default function Movie({ movie, encFilePath, imgBaseUrl300, imgBaseUrl500, imgBaseUrl780, imgBaseUrl1280, isProduction }: { movie: any, encFilePath: string, imgBaseUrl300: string, imgBaseUrl500: string, imgBaseUrl780: string, imgBaseUrl1280: string, isProduction: boolean }) {
  const { props } = usePage<SharedData & {
    auth: {
      user: any;
      canAccessPremium: boolean;
      isAdmin: boolean;
    };
    csrf_token: string;
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
  
  // State for backdrop dialog
  const [selectedBackdrop, setSelectedBackdrop] = useState<string | null>(null);
  const [isBackdropDialogOpen, setIsBackdropDialogOpen] = useState(false);
  
  // State for shuffled backdrops (to maintain random order)
  const [shuffledBackdrops, setShuffledBackdrops] = useState<any[]>([]);
  
  // State for likes functionality
  const [isLiked, setIsLiked] = useState(movie.is_liked || false);
  const [likesCount, setLikesCount] = useState(movie.likes_count || 0);
  const [isLikeToggling, setIsLikeToggling] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);
  const [likedUsers, setLikedUsers] = useState<Array<{id: number, name: string}>>([]);
  const [loadingLikedUsers, setLoadingLikedUsers] = useState(false);

  // Video element ref for Picture-in-Picture
  const videoRef = useRef<HTMLVideoElement>(null);
  const [hasUserInitiatedPlayback, setHasUserInitiatedPlayback] = useState(false);

  // Web Share API hook
  const { share, isSharing, isSupported: isShareSupported } = useWebShare();

  // Function to fetch recommendations
  const fetchRecommendations = async () => {
    try {
      setLoadingRecommendations(true);
      setRecommendationsError(null);
      const response = await axios.get(`/api/movies/${movie.slug}/recommendations`);
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
      const response = await axios.get(`/api/movies/${movie.slug}/similar`);
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

  // Sync like state with movie prop
  useEffect(() => {
    setIsLiked(movie.is_liked || false);
    setLikesCount(movie.likes_count || 0);
  }, [movie.is_liked, movie.likes_count]);

  // Fetch recommendations and similar movies when component mounts
  useEffect(() => {
    fetchRecommendations();
    fetchSimilarMovies();
  }, [movie.slug]);

  // Effect for Picture-in-Picture on scroll
  useEffect(() => {
    const videoElement = videoRef.current;
    
    // This feature is only for the <video> element, not the iframe,
    // only for desktop/tablet views, and only after the user has started playback.
    if (!videoElement || isProduction || window.innerWidth < 1024 || !hasUserInitiatedPlayback) {
        return;
    }

    const observer = new IntersectionObserver(
        ([entry]) => {
            const isVideoInPiP = document.pictureInPictureElement === videoElement;

            // User scrolled down, video is less than 50% visible
            if (entry.intersectionRatio < 0.5) {
                if (
                    document.pictureInPictureEnabled && 
                    !isVideoInPiP &&
                    !videoElement.paused &&
                    videoElement.HAVE_CURRENT_DATA
                ) {
                    videoElement.requestPictureInPicture().catch((error) => {
                        // Avoid logging errors if user cancels PiP request
                        if (error.name !== 'AbortError') {
                            console.error("Failed to enter PiP mode:", error);
                        }
                    });
                }
            } 
            // User scrolled up, video is back in view
            else if (isVideoInPiP) {
                document.exitPictureInPicture().catch((error) => {
                    console.error("Failed to exit PiP mode:", error);
                });
            }
        },
        {
            threshold: 0.5, // Trigger when 50% of the video is visible/hidden
        }
    );

    observer.observe(videoElement);

    // On video pause, if it's in PiP, exit PiP.
    const handlePause = () => {
        if (document.pictureInPictureElement === videoElement) {
            document.exitPictureInPicture();
        }
    };

    videoElement.addEventListener('pause', handlePause);

    return () => {
        if (videoElement) {
            observer.unobserve(videoElement);
            videoElement.removeEventListener('pause', handlePause);

            // If component unmounts and this video is in PiP, exit PiP.
            if (document.pictureInPictureElement === videoElement) {
                document.exitPictureInPicture();
            }
        }
    };
  }, [isProduction, hasUserInitiatedPlayback]);

  // Cleanup effect to stop video on component unmount
  useEffect(() => {
    const videoElement = videoRef.current;

    // This is a cleanup function that runs when the component unmounts
    return () => {
      if (videoElement) {
        // Pause the video to prevent audio from playing in the background
        videoElement.pause();

        // If the video is in Picture-in-Picture mode, we must exit it
        if (document.pictureInPictureElement === videoElement) {
          document.exitPictureInPicture().catch((error) => {
            // Log error if we can't exit PiP, but it's not critical
            console.error("Failed to exit PiP on unmount:", error);
          });
        }
      }
    };
  }, []); // The empty dependency array ensures this effect runs only on mount and unmount

  // Shuffle backdrops once when component mounts
  useEffect(() => {
    if (movie.images?.backdrops && movie.images.backdrops.length > 0) {
      const shuffled = [...movie.images.backdrops]
        .sort(() => Math.random() - 0.5)
        .slice(0, 15);
      setShuffledBackdrops(shuffled);
    }
  }, [movie.slug]);

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
      const response = await fetch(`/api/movies/${movie.slug}/like`, {
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
          // Clear liked users cache to force reload on next hover
          setLikedUsers([]);
        }, 150);
        
        // Complete animation cycle
        setTimeout(() => {
          setIsLikeAnimating(false);
        }, 300);
      } else {
        console.error('HTTP error:', response.status, response.statusText);
        if (response.status === 419) {
          console.error('CSRF token mismatch. Please refresh the page.');
          // You could show a toast notification here or handle it differently
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

  // Function to fetch users who liked the movie
  const fetchLikedUsers = async () => {
    if (loadingLikedUsers || likedUsers.length > 0) return;
    
    setLoadingLikedUsers(true);
    try {
      const response = await fetch(`/api/movies/${movie.slug}/liked-users`);
      if (response.ok) {
        const data = await response.json();
        setLikedUsers(data.users);
      }
    } catch (error) {
      console.error('Error fetching liked users:', error);
    } finally {
      setLoadingLikedUsers(false);
    }
  };

  // Function to handle trailer clicks from movie cards
  const handleTrailerClick = (movieId: number, movieTitle: string) => {
    setSelectedTrailerMovie({ id: movieId, title: movieTitle });
    setIsTrailerModalOpen(true);
  };

  // Function to handle like changes from movie cards
  const handleMovieCardLikeChange = (movieId: number, isLiked: boolean, likesCount: number) => {
    // Update the recommendations array
    setRecommendations(prevRecommendations => 
      prevRecommendations.map(rec => 
        rec.id === movieId 
          ? { ...rec, is_liked: isLiked, likes_count: likesCount }
          : rec
      )
    );

    // Update the similar movies array
    setSimilarMovies(prevSimilar => 
      prevSimilar.map(sim => 
        sim.id === movieId 
          ? { ...sim, is_liked: isLiked, likes_count: likesCount }
          : sim
      )
    );
  };

  // Function to handle sharing the movie page
  const handleShare = async () => {
    const shareData = {
      title: `${movie.title}`,
      text: movie.overview ? `${movie.title} - ${movie.overview.slice(0, 100)}${movie.overview.length > 100 ? '...' : ''}` : `Check out this movie: ${movie.title}`,
      url: window.location.href,
    };
    
    await share(shareData);
  };

  // Function to handle backdrop image click
  const handleBackdropClick = (backdropPath: string) => {
    setSelectedBackdrop(backdropPath);
    setIsBackdropDialogOpen(true);
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title={`${movie.title}`}>
        {/* Open Graph meta tags for rich link sharing */}
        <meta property="og:title" content={`${movie.title} (${movie.release_date.split('-')[0]})`} />
        <meta property="og:description" content={movie.overview || `Watch ${movie.title} - ${movie.tagline || 'A great movie experience'}`} />
        <meta property="og:image" content={`${imgBaseUrl780}${movie.poster_path}`} />
        <meta property="og:image:width" content="780" />
        <meta property="og:image:height" content="1170" />
        <meta property="og:url" content={window.location.href} />
        <meta property="og:type" content="video.movie" />
        <meta property="og:site_name" content="Libeflix" />
        
        {/* Twitter Card meta tags */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={`${movie.title} (${movie.release_date.split('-')[0]})`} />
        <meta name="twitter:description" content={movie.overview || `Watch ${movie.title} - ${movie.tagline || 'A great movie experience'}`} />
        <meta name="twitter:image" content={`${imgBaseUrl780}${movie.poster_path}`} />
        
        {/* Additional meta tags */}
        <meta name="description" content={movie.overview || `Watch ${movie.title} - ${movie.tagline || 'A great movie experience'}`} />
        <meta name="keywords" content={`${movie.title}, movie, watch online, ${movie.genres?.map((g: any) => g.name).join(', ')}`} />
        
        {/* Movie-specific structured data */}
        <meta property="video:duration" content={`${movie.runtime * 60}`} />
        <meta property="video:release_date" content={movie.release_date} />
        
        {/* JSON-LD Structured Data for better SEO */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Movie",
            "name": movie.title,
            "description": movie.overview || `Watch ${movie.title}`,
            "image": `${imgBaseUrl780}${movie.poster_path}`,
            "datePublished": movie.release_date,
            "duration": `PT${movie.runtime}M`,
            "genre": movie.genres?.map((g: any) => g.name),
            "aggregateRating": movie.vote_average ? {
              "@type": "AggregateRating",
              "ratingValue": movie.vote_average,
              "ratingCount": 1,
              "bestRating": 10
            } : undefined,
            "url": window.location.href,
            "potentialAction": {
              "@type": "WatchAction",
              "target": window.location.href
            }
          })}
        </script>
      </Head>
      <div>
        <div className="flex flex-col items-start justify-between">
          <div className="flex flex-col w-full">
            <div className="bg-black text-white focus:outline-none sticky top-0 z-30 lg:relative">
              {!isProduction ? (
                <video 
                  ref={videoRef}
                  className="w-full aspect-video lg:aspect-auto xl:h-[73vh] object-cover object-center focus:outline-none"  
                  controls={canAccessMovie ? true : false}
                  controlsList="nodownload" 
                  onContextMenu={(e) => e.preventDefault()}
                  poster={`${imgBaseUrl1280}${movie.backdrop_path}`}
                  onPlay={() => setHasUserInitiatedPlayback(true)}
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
              ) : canAccessMovie ? (
                <iframe 
                  allow="autoplay; fullscreen; picture-in-picture; encrypted-media"
                  sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-presentation"
                  referrerPolicy="no-referrer-when-downgrade"
                  src={`https://drive.google.com/file/d/${movie.google_drive_file_id}/preview`} 
                  width="100%" 
                  className="w-full aspect-video lg:aspect-auto xl:h-[73vh] object-cover object-center focus:outline-none" 
                  // style={{ aspectRatio: '16 / 9' }} 
                ></iframe>
              ) : (
                <div 
                  className="w-full aspect-video lg:aspect-auto xl:h-[73vh] object-cover object-center bg-center bg-cover"
                  style={{
                    backgroundImage: `url(${imgBaseUrl1280}${movie.backdrop_path})`
                  }}
                ></div>
              )}

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
                          <Link 
                            href={route('register') + '?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)} 
                            className="block w-full bg-rose-600 hover:bg-rose-700 text-white font-medium sm:font-semibold py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 md:px-6 rounded-md sm:rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base"
                          >
                            <UserIcon className="w-3 h-3 sm:w-4 sm:h-4 md:w-5 md:h-5 inline mr-1 sm:mr-2" />
                            Create Account
                          </Link>
                          <Link 
                            href={route('login') + '?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)} 
                            className="block w-full bg-gray-600 hover:bg-gray-700 text-white font-medium sm:font-semibold py-2 sm:py-2.5 md:py-3 px-3 sm:px-4 md:px-6 rounded-md sm:rounded-lg transition-colors duration-200 text-xs sm:text-sm md:text-base"
                          >
                            Already have an account? Log In
                          </Link>
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
                        {/* Likes with tooltip */}
                        <Tooltip
                          content={
                            likesCount > 0
                              ? loadingLikedUsers
                                ? <div>Loading...</div>
                                : likedUsers.length > 0
                                ? (
                                  <div className="max-w-xs">
                                    <div className="font-medium mb-1 text-xs">Liked by:</div>
                                    <div className="space-y-0.5 max-h-20 overflow-y-auto">
                                      {likedUsers.slice(0, 5).map((user, index) => (
                                        <div key={user.id} className="text-xs opacity-90 hover:opacity-100 transition-opacity">
                                          {user.name}
                                        </div>
                                      ))}
                                    </div>
                                    {likedUsers.length > 5 && (
                                      <div className="text-xs opacity-60 mt-1 text-center">
                                        and {likedUsers.length - 5} more...
                                      </div>
                                    )}
                                  </div>
                                )
                                : <div>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</div>
                              : (
                                <div>
                                  {isAuthenticated
                                    ? (isLiked ? "Unlike this movie" : "Like this movie")
                                    : "Login to like this movie"
                                  }
                                </div>
                              )
                          }
                          position="top"
                          delayMs={500}
                        >
                          <button
                            onClick={handleLikeToggle}
                            onMouseEnter={() => {
                              if (likesCount > 0) {
                                fetchLikedUsers();
                              }
                            }}
                            disabled={isLikeToggling}
                            className="flex items-center gap-x-1 transition-all duration-200 ease-in-out hover:scale-110 disabled:opacity-50 cursor-pointer"
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
                              <HeartIcon 
                                className={`w-5 h-5 lg:w-6 lg:h-6 transition-colors duration-200 ${
                                  isLiked 
                                    ? 'text-red-500 fill-red-500 hover:text-red-600 hover:fill-red-600' 
                                    : 'text-gray-500 hover:text-gray-600'
                                }`} 
                              />
                            </div>
                            <span className="mr-2 ml-1 lg:mr-4 text-xs lg:text-base">{likesCount}</span>
                          </button>
                        </Tooltip>
                        <MessageSquareText className="w-5 h-5 lg:w-6 lg:h-6" />
                        <span className="mr-2 lg:mr-4 text-xs lg:text-base">0</span>
                        <Tooltip 
                          content={
                            isShareSupported 
                              ? "Share this movie" 
                              : "Share this movie (copy link)"
                          }
                          position="top"
                          delayMs={500}
                        >
                          <button
                            onClick={handleShare}
                            disabled={isSharing}
                            className="flex items-center gap-x-1 transition-all duration-200 ease-in-out hover:scale-110 cursor-pointer text-gray-500 hover:text-gray-600 disabled:opacity-50"
                          >
                            <Share2 className="w-5 h-5 lg:w-6 lg:h-6" />
                            <span className="mr-2 lg:mr-4 text-xs lg:text-base">
                              {isSharing ? "Share" : "Share"}
                            </span>
                          </button>
                        </Tooltip>
                        <button
                          onClick={() => handleTrailerClick(movie.id, movie.title)}
                          className="flex items-center transition-all duration-200 ease-in-out hover:scale-110 cursor-pointer text-gray-500 hover:text-gray-600"
                          title="Watch trailers"
                        >
                          <Clapperboard className="w-5 h-5 lg:w-6 lg:h-6" />
                        </button>
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

                    {/* Cast and Crew Tabs */}
                    <div className="flex justify-center gap-x-7 w-[calc(100vw-2rem)] md:w-[calc(100vw-var(--dynamic-sidebar-width)-5rem)] lg:w-[calc(100vw-var(--dynamic-sidebar-width)-5rem)]" 
                      style={{
                        '--dynamic-sidebar-width': sidebarWidth
                      } as React.CSSProperties}>
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
                      className="flex flex-col gap-y-10 w-[calc(100vw-2rem)] md:w-[calc(100vw-var(--dynamic-sidebar-width)-5rem)] lg:w-[calc(100vw-var(--dynamic-sidebar-width)-5rem)]"
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
                                    onLikeChange={handleMovieCardLikeChange}
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
                                    onLikeChange={handleMovieCardLikeChange}
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

                      <div className="flex flex-col lg:flex-row lg:gap-x-10 w-full"
                        style={{
                          '--dynamic-sidebar-width': sidebarWidth
                        } as React.CSSProperties}
                      >
                        {/* Comments section */}
                        <div className="flex flex-col gap-y-4 w-full">
                          {(() => {
                            // console.log('About to render CommentsSection with props:', {
                            //   commentableType: "movie",
                            //   commentableId: movie.id,
                            //   isAuthenticated,
                            //   currentUserId: props.auth.user?.id,
                            //   initialCommentsCount: movie.comments_count || 0
                            // });
                            return null;
                          })()}
                          <CommentsSection
                            commentableType="movie"
                            commentableId={movie.id}
                            isAuthenticated={isAuthenticated}
                            currentUserId={props.auth.user?.id}
                            initialCommentsCount={movie.comments_count || 0}
                            loginLink={
                              <Link 
                                href={route('login') + '?redirect=' + encodeURIComponent(window.location.pathname + window.location.search)}
                                className="text-blue-500 hover:text-blue-600 underline transition-colors duration-200"
                              >
                                Login to join the conversation
                              </Link>
                            }
                          />
                        </div>

                        {/* other logos, backdrops and posters */}
                        {shuffledBackdrops.length > 0 && (
                          <div className="flex flex-col gap-y-4 w-full">
                            <h2 className="text-xl font-bold mb-4">Images</h2>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-10">
                              {shuffledBackdrops.map((backdrop: any, index: number) => (
                                <div
                                  key={`backdrop-${index}`}
                                  className="cursor-pointer"
                                  onClick={() => handleBackdropClick(backdrop.file_path)}
                                >
                                  <LazyImage 
                                    src={`${imgBaseUrl300}${backdrop.file_path}`}
                                    alt={backdrop.file_path}
                                    className="w-full h-full object-cover rounded-lg shadow-md shadow-gray-500 dark:shadow-gray-700 opacity-80 hover:opacity-100 transition-opacity duration-300 ease-in-out"
                                  />
                                </div>
                              ))}
                            </div>
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

      {/* Backdrop Dialog */}
      <Dialog open={isBackdropDialogOpen} onOpenChange={setIsBackdropDialogOpen}>
        <DialogContent 
          className="!max-w-[80vw] !w-[80vw] !h-[80vh] p-0 overflow-hidden border-0 focus:outline-none focus-visible:outline-none"
          style={{ 
            width: '80vw', 
            height: '80vh', 
            maxWidth: '80vw', 
            maxHeight: '80vh' 
          }}
          onOpenAutoFocus={(e) => e.preventDefault()}
          onCloseAutoFocus={(e) => e.preventDefault()}
        >
          <DialogTitle className="sr-only">{movie.title} - Backdrop Image</DialogTitle>
          <DialogDescription className="sr-only">
            High-resolution backdrop image from {movie.title}
          </DialogDescription>
          {selectedBackdrop && (
            <div className="relative w-full h-full">
              <img
                src={`${imgBaseUrl1280}${selectedBackdrop}`}
                alt={`${movie.title} backdrop`}
                className="w-full h-full object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
      
    </AppLayout>
  );
}