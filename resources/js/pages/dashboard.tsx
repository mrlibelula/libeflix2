import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, Link, router, usePage } from '@inertiajs/react';
import { useRef, useState, useEffect, useCallback } from 'react';
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from '@/components/ui/carousel';
import Autoplay from 'embla-carousel-autoplay';
import { useIsMobile } from '@/hooks/use-mobile';
import { Button } from '@/components/ui/button';
import { Share2, Plus, Check } from 'lucide-react';
import { useWebShare } from '@/hooks/use-web-share';

interface CarouselItemType {
  type: 'movie' | 'tvshow';
  id: number;
  title: string;
  tagline: string;
  slug: string;
  backdrop_path: string;
  is_watch_later: boolean;
}

interface TmdbImageUrls {
  desktop: string;
  mobile: string;
}

export default function Dashboard({ 
  carouselItems, 
  tmdbImageUrls 
}: { 
  carouselItems: CarouselItemType[];
  tmdbImageUrls: TmdbImageUrls;
}) {
  const isMobile = useIsMobile();
  const [api, setApi] = useState<CarouselApi>();
  const [current, setCurrent] = useState(0);
  const [count, setCount] = useState(0);
  const carouselRef = useRef<HTMLDivElement>(null);
  
  // State to track which images should be loaded/preloaded
  const [loadedImages, setLoadedImages] = useState<Set<number>>(new Set());
  const [preloadedImages, setPreloadedImages] = useState<Set<number>>(new Set());
  
  // Get page props for authentication and CSRF token
  const { props } = usePage<{ 
    csrf_token?: string;
    auth?: {
      user?: any;
    };
  }>();
  
  // Check if user is authenticated
  const isAuthenticated = !!props.auth?.user;
  
  // Web Share API hook
  const { share, isSharing, isSupported: isShareSupported } = useWebShare();
  
  // Watch later state for each carousel item
  const [watchLaterStates, setWatchLaterStates] = useState<Record<string, { 
    isWatchLater: boolean; 
    isToggling: boolean; 
    isAnimating: boolean; 
  }>>({});

  const breadcrumbs: BreadcrumbItem[] = [
    {
      title: `Trends Now`,
      href: '/',
    },
  ];

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

  // Fix autoplay configuration - make it persistent but functional
  const autoplay = useRef(
    Autoplay({ 
      delay: 5000,
      stopOnInteraction: false,
      stopOnMouseEnter: false,
      stopOnFocusIn: false,
      playOnInit: true,
      stopOnLastSnap: false,
      rootNode: (emblaRoot) => emblaRoot.parentElement,
    })
  );

  // Listen for sidebar state changes
  useEffect(() => {
    const handleSidebarStateChange = (event: CustomEvent<any>) => {
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

  // Function to determine which images should be preloaded
  const getImagesToPreload = useCallback((currentIndex: number, total: number) => {
    const indices = new Set<number>();
    
    // Always include current image
    indices.add(currentIndex);
    
    // Add 3 images ahead (with wraparound for infinite loop)
    for (let i = 1; i <= 3; i++) {
      const nextIndex = (currentIndex + i) % total;
      indices.add(nextIndex);
    }
    
    return indices;
  }, []);

  // Function to preload images
  const preloadImage = useCallback((url: string, index: number) => {
    return new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        setPreloadedImages(prev => new Set([...prev, index]));
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }, []);

  // Function to get the appropriate backdrop URL with fallbacks
  const getBackdropUrl = useCallback((item: CarouselItemType) => {
    if (!item.backdrop_path) {
      console.warn('No backdrop_path found for item:', item);
      return 'https://images7.alphacoders.com/131/1318286.jpeg'; // fallback image
    }
    
    const baseUrl = isMobile ? tmdbImageUrls.mobile : tmdbImageUrls.desktop;
    const imageUrl = `${baseUrl}${item.backdrop_path}`;
    
    return imageUrl;
  }, [isMobile, tmdbImageUrls]);

  // Initialize watch later states for carousel items
  useEffect(() => {
    if (!carouselItems || carouselItems.length === 0) return;

    const initialWatchLaterStates: Record<string, { 
      isWatchLater: boolean; 
      isToggling: boolean; 
      isAnimating: boolean; 
    }> = {};
    
    carouselItems.forEach(item => {
      const itemKey = `${item.type}-${item.id}`;
      initialWatchLaterStates[itemKey] = {
        isWatchLater: item.is_watch_later, // Use actual backend data
        isToggling: false,
        isAnimating: false
      };
    });
    
    setWatchLaterStates(initialWatchLaterStates);
  }, [carouselItems]);

  // Initial preloading of first 3 images on component mount
  useEffect(() => {
    if (!carouselItems || carouselItems.length === 0) return;

    const initialImagesToLoad = getImagesToPreload(0, carouselItems.length);
    
    initialImagesToLoad.forEach(index => {
      const item = carouselItems[index];
      if (item) {
        const imageUrl = getBackdropUrl(item);
        preloadImage(imageUrl, index).catch(console.error);
        setLoadedImages(prev => new Set([...prev, index]));
      }
    });
  }, [carouselItems, getImagesToPreload, getBackdropUrl, preloadImage]);

  // Track current slide and total count + handle dynamic preloading
  useEffect(() => {
    if (!api) return;

    setCount(api.scrollSnapList().length);
    setCurrent(api.selectedScrollSnap() + 1);

    api.on("select", () => {
      const newCurrent = api.selectedScrollSnap() + 1;
      setCurrent(newCurrent);
      
      // Preload images based on new current position
      const currentIndex = newCurrent - 1; // Convert to 0-based index
      const imagesToPreload = getImagesToPreload(currentIndex, carouselItems.length);
      
      imagesToPreload.forEach(index => {
        if (!preloadedImages.has(index) && !loadedImages.has(index)) {
          const item = carouselItems[index];
          if (item) {
            const imageUrl = getBackdropUrl(item);
            preloadImage(imageUrl, index).catch(console.error);
            setLoadedImages(prev => new Set([...prev, index]));
          }
        }
      });
    });
    
    // Start autoplay after API is ready
    const autoplayInstance = autoplay.current;
    if (autoplayInstance) {
      // Give the carousel a moment to initialize, then start autoplay
      setTimeout(() => {
        autoplayInstance.play();
      }, 100);
    }

    // Force reposition to fix initial loading alignment issues
    setTimeout(() => {
      api.reInit();
    }, 200);
  }, [api, carouselItems, getImagesToPreload, getBackdropUrl, preloadImage, preloadedImages, loadedImages]);

  // Ensure proper initialization after component mount
  useEffect(() => {
    const handleResize = () => {
      if (api) {
        api.reInit();
      }
    };

    // Reposition after fonts and images are loaded
    setTimeout(() => {
      if (api) {
        api.reInit();
        // Restart autoplay after reinit
        const autoplayInstance = autoplay.current;
        if (autoplayInstance) {
          autoplayInstance.play();
        }
      }
    }, 300);

    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [api, carouselItems]);

  // Ensure autoplay starts on component mount
  useEffect(() => {
    // Start autoplay after component is fully mounted
    const timer = setTimeout(() => {
      if (autoplay.current) {
        autoplay.current.play();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [carouselItems]);

  // Keyboard navigation support
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!api) return;

      switch (event.key) {
        case 'ArrowLeft':
          event.preventDefault();
          api.scrollPrev();
          break;
        case 'ArrowRight':
          event.preventDefault();
          api.scrollNext();
          break;
      }
    };

    // Add event listener to document for global keyboard navigation
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [api]);

  // Function to get the appropriate link based on content type
  const getContentLink = (item: CarouselItemType) => {
    return item.type === 'movie' ? `/movie/${item.slug}` : `/tvshow/${item.slug}`;
  };

  // Function to navigate to content page
  const handlePlayClick = (item: CarouselItemType) => {
    const url = getContentLink(item);
    router.visit(url);
  };

  // Function to handle watch later toggle
  const handleWatchLaterToggle = async (item: CarouselItemType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Check if user is authenticated
    if (!isAuthenticated) {
      // Redirect to login page with current page as redirect parameter
      const currentUrl = window.location.pathname + window.location.search;
      router.visit('/login' + '?redirect=' + encodeURIComponent(currentUrl));
      return;
    }
    
    const itemKey = `${item.type}-${item.id}`;
    const currentState = watchLaterStates[itemKey];
    if (currentState?.isToggling) return;
    
    setWatchLaterStates(prev => ({
      ...prev,
      [itemKey]: {
        ...prev[itemKey],
        isToggling: true,
        isAnimating: true,
      }
    }));
    
    try {
      // Get CSRF token from Inertia shared data or meta tag
      const csrfToken = props.csrf_token || document.querySelector('meta[name="csrf-token"]')?.getAttribute('content');
      
      if (!csrfToken) {
        console.error('CSRF token not found');
        setWatchLaterStates(prev => ({
          ...prev,
          [itemKey]: { ...prev[itemKey], isAnimating: false, isToggling: false }
        }));
        return;
      }
      
      const endpoint = item.type === 'movie' 
        ? `/api/movies/${item.id}/toggle-watch-later` 
        : `/api/tvshows/${item.id}/toggle-watch-later`;
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-CSRF-TOKEN': csrfToken,
          'Accept': 'application/json',
        },
        credentials: 'same-origin',
      });
      
      if (response.ok) {
        const data = await response.json();
        
        // Change status at the midpoint of animation
        setTimeout(() => {
          setWatchLaterStates(prev => ({
            ...prev,
            [itemKey]: {
              ...prev[itemKey],
              isWatchLater: data.is_watch_later,
            }
          }));
        }, 150);
        
        // Complete animation cycle
        setTimeout(() => {
          setWatchLaterStates(prev => ({
            ...prev,
            [itemKey]: {
              ...prev[itemKey],
              isAnimating: false,
            }
          }));
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
        setWatchLaterStates(prev => ({
          ...prev,
          [itemKey]: { ...prev[itemKey], isAnimating: false }
        }));
      }
    } catch (error) {
      console.error('Error toggling watch later:', error);
      setWatchLaterStates(prev => ({
        ...prev,
        [itemKey]: { ...prev[itemKey], isAnimating: false }
      }));
    } finally {
      setWatchLaterStates(prev => ({
        ...prev,
        [itemKey]: { ...prev[itemKey], isToggling: false }
      }));
    }
  };

  // Function to handle sharing
  const handleShare = async (item: CarouselItemType, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const shareUrl = `${window.location.origin}${getContentLink(item)}`;
    const shareData = {
      title: `${item.title} - ${item.type === 'movie' ? 'Movie' : 'TV Show'}`,
      text: item.tagline || ``,
      url: shareUrl,
    };
    
    await share(shareData);
  };

  // Function to go to specific slide
  const goToSlide = (index: number) => {
    if (api) {
      api.scrollTo(index);
    }
  };

  return (
    <AppLayout breadcrumbs={breadcrumbs}>
      <Head title="Trends" />
      
      {carouselItems && carouselItems.length > 0 ? (
        <div 
          ref={carouselRef}
          className="relative w-full focus:outline-none select-none"
          tabIndex={0}
          role="region"
          aria-label="Recently added content carousel - Use left and right arrow keys to navigate"
        >
          <Carousel
            setApi={setApi}
            plugins={[autoplay.current as any]}
            className="w-full overflow-hidden focus:outline-none select-none"
            opts={{
              align: "start",
              loop: true,
              containScroll: "trimSnaps",
            }}
          >
            <CarouselContent className="-ml-0 select-none">
              {carouselItems.map((item, index) => {
                const shouldLoadImage = loadedImages.has(index) || preloadedImages.has(index);
                const backdropUrl = shouldLoadImage ? getBackdropUrl(item) : '';
                
                return (
                  <CarouselItem key={`${item.type}-${item.id}`} className="pl-0 basis-full select-none">
                    <div 
                      id="hero" 
                      className="relative w-full h-[calc(100vh-5rem)] dark:bg-black/10 bg-white/10 z-10 select-none"
                      style={{
                        backgroundImage: backdropUrl ? `url(${backdropUrl})` : 'none',
                        backgroundSize: 'cover',
                        backgroundPosition: 'center',
                        backgroundRepeat: 'no-repeat',
                        backgroundBlendMode: 'overlay',
                        backgroundColor: !backdropUrl ? '#1a1a1a' : 'transparent', // Fallback color while loading
                      }}
                      onError={(e) => {
                        console.error('Background image failed to load:', backdropUrl);
                        // Set fallback background
                        e.currentTarget.style.backgroundImage = 'url(https://images7.alphacoders.com/131/1318286.jpeg)';
                      }}
                    >
                      <div className="absolute top-0 left-0 w-full h-full light-gradient-hero dark:dark-gradient-hero z-20" />
                                             <div className="absolute top-[80%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col gap-y-3 w-full text-white z-30 px-8 md:px-16 py-10 select-none">
                        <div className="py-0.5 px-3 text-sm bg-black/50 rounded-md w-fit">
                          {item.type === 'movie' ? 'movie' : 'TV Show'}
                        </div>
                        <div className="text-4xl md:text-5xl font-bold text-black dark:text-white">
                          {item.title}
                        </div>
                        <div className="text-black dark:text-white/50 text-lg md:text-xl mb-6">
                          {item.tagline || ''}
                        </div>
                        {/* action buttons */}
                        <div className="flex items-center gap-x-2 mb-4">
                          <Button 
                            variant="default"
                            onClick={() => handlePlayClick(item)}
                          >
                            Play
                          </Button>
                          
                          {/* Add to Watch Later Button */}
                          {isAuthenticated && (
                            <div
                              className={`transition-all duration-300 ease-in-out ${
                                watchLaterStates[`${item.type}-${item.id}`]?.isAnimating ? 'rotate-180' : 'rotate-0'
                              }`}
                              style={{
                                transform: watchLaterStates[`${item.type}-${item.id}`]?.isAnimating 
                                  ? 'rotate(180deg)' 
                                  : 'rotate(0deg)',
                              }}
                            >
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={(e) => handleWatchLaterToggle(item, e)}
                                disabled={watchLaterStates[`${item.type}-${item.id}`]?.isToggling}
                                className={`border-white/70 text-black dark:text-white hover:bg-white hover:text-black backdrop-blur-sm bg-black/20 transition-all duration-300 ${
                                  watchLaterStates[`${item.type}-${item.id}`]?.isToggling ? 'opacity-50 cursor-not-allowed' : ''
                                } ${watchLaterStates[`${item.type}-${item.id}`]?.isWatchLater ? 'bg-green-600/30 border-green-400/70 text-green-800 dark:text-green-100' : ''}`}
                              >
                                {watchLaterStates[`${item.type}-${item.id}`]?.isWatchLater ? (
                                  <Check className="h-4 w-4" />
                                ) : (
                                  <Plus className="h-4 w-4" />
                                )}
                              </Button>
                            </div>
                          )}
                          
                          {/* Share Button */}
                          <Button
                            variant="outline"
                            size="icon"
                            onClick={(e) => handleShare(item, e)}
                            disabled={isSharing}
                            className="border-white/70 text-black dark:text-white hover:bg-white hover:text-black backdrop-blur-sm bg-black/20"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </CarouselItem>
                );
              })}
            </CarouselContent>
          </Carousel>
          
          {/* Progress indicators - Dots */}
          {count > 1 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-40 select-none">
              <div className="flex items-center gap-x-2 md:gap-x-3 select-none">
                {Array.from({ length: count }).map((_, index) => (
                  <button
                    key={index}
                    onClick={() => goToSlide(index)}
                    className={`transition-all duration-300 rounded-full border-2 ${
                      index === current - 1 
                        ? 'w-3 h-3 md:w-4 md:h-4 bg-black dark:bg-white border-black dark:border-white' 
                        : 'w-2 h-2 md:w-3 md:h-3 bg-black/30 dark:bg-white/30 border-black/50 dark:border-white/50 hover:bg-black/60 dark:hover:bg-white/60 hover:border-black/75 dark:hover:border-white/75'
                    } relative before:content-[''] before:absolute before:inset-[-8px] before:rounded-full`}
                    aria-label={`Go to slide ${index + 1}`}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        // Loading state or error state - should not show fallback content anymore
        <div className="relative w-full h-[calc(100vh-5rem)] dark:bg-black/10 bg-white/10 z-10 flex items-center justify-center select-none">
          <div className="text-center text-white select-none">
            <div className="text-xl font-bold mb-2">Loading...</div>
            <div className="text-sm opacity-75">Preparing your trending content</div>
          </div>
        </div>
      )}

    </AppLayout>
  );
}
