import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { PlayIcon, ExternalLinkIcon } from "lucide-react";

interface Trailer {
  id: string;
  key: string;
  name: string;
  site: string;
  type: string;
  official?: boolean;
  published_at?: string;
}

interface TrailerModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  movieTitle: string;
  movieId: number;
}

export function TrailerModal({ isOpen, onOpenChange, movieTitle, movieId }: TrailerModalProps) {
  const [trailers, setTrailers] = useState<Trailer[]>([]);
  const [selectedTrailer, setSelectedTrailer] = useState<Trailer | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Fetch trailers when modal opens
  useEffect(() => {
    if (isOpen && movieId) {
      fetchTrailers();
    }
  }, [isOpen, movieId]);

  // Reset selected trailer when modal opens or movie changes
  useEffect(() => {
    if (isOpen) {
      setSelectedTrailer(null);
      setTrailers([]);
    }
  }, [isOpen, movieId]);

  // Set first trailer as selected when trailers are loaded
  useEffect(() => {
    if (trailers.length > 0) {
      setSelectedTrailer(trailers[0]);
    }
  }, [trailers]);

  const fetchTrailers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch(`/api/movies/${movieId}/trailers-by-id`);
      if (response.ok) {
        const data = await response.json();
        
        // Handle error response
        if (data.error) {
          console.error('Error from API:', data.message);
          setTrailers([]);
          return;
        }
        
        // Filter only YouTube trailers
        const youtubeTrailers = data.filter((trailer: Trailer) => trailer.site === 'YouTube');
        // Sort to put trailers first, with official trailers at the very top
        const sortedTrailers = youtubeTrailers.sort((a: Trailer, b: Trailer) => {
          const aIsTrailer = a.type.toLowerCase() === 'trailer';
          const bIsTrailer = b.type.toLowerCase() === 'trailer';
          
          // If only one is a trailer, trailer comes first
          if (aIsTrailer && !bIsTrailer) return -1;
          if (!aIsTrailer && bIsTrailer) return 1;
          
          // If both are trailers, official ones come first
          if (aIsTrailer && bIsTrailer) {
            if (a.official && !b.official) return -1;
            if (!a.official && b.official) return 1;
          }
          
          // For non-trailers, official ones come first
          if (!aIsTrailer && !bIsTrailer) {
            if (a.official && !b.official) return -1;
            if (!a.official && b.official) return 1;
          }
          
          return 0;
        });
        setTrailers(sortedTrailers);
      }
    } catch (error) {
      console.error('Error fetching trailers:', error);
      setTrailers([]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTrailerSelect = (trailer: Trailer) => {
    setSelectedTrailer(trailer);
  };

  const openInYouTube = (trailer: Trailer) => {
    window.open(`https://www.youtube.com/watch?v=${trailer.key}`, '_blank');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[1400px] max-h-[90vh] p-0 overflow-hidden w-[98vw] sm:w-[95vw] outline-none focus:outline-none border-none focus:ring-0 focus:ring-offset-0" style={{ outline: 'none', border: 'none' }}>
        <DialogTitle className="sr-only">
          {movieTitle} - Trailers
        </DialogTitle>
        <DialogDescription className="sr-only">
          Watch movie trailers for {movieTitle}
        </DialogDescription>

        {/* Header with close button */}
        <div className="absolute top-4 right-4 z-10">
          <button
            onClick={() => onOpenChange(false)}
            className="dark:text-white text-black p-2 transition-colors outline-none focus:outline-none cursor-pointer"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col lg:flex-row h-full max-h-[70vh]">
          {/* Main video player */}
          <div className="flex-1 bg-black outline-none focus:outline-none" style={{ outline: 'none' }}>
            {isLoading ? (
              <div className="aspect-video flex items-center justify-center">
                <div className="text-white">Loading trailers...</div>
              </div>
            ) : selectedTrailer ? (
              <div className="aspect-video w-full lg:min-w-[800px] outline-none focus:outline-none" style={{ outline: 'none' }}>
                <iframe
                  key={selectedTrailer.key}
                  src={`https://www.youtube.com/embed/${selectedTrailer.key}?autoplay=1&rel=0&modestbranding=1`}
                  title={selectedTrailer.name}
                  className="w-full h-full outline-none focus:outline-none border-none"
                  style={{ outline: 'none', border: 'none' }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                  tabIndex={-1}
                />
              </div>
            ) : (
              <div className="aspect-video flex items-center justify-center">
                <div className="text-white text-center">
                  <PlayIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>No trailers available</p>
                </div>
              </div>
            )}
          </div>

          {/* Trailer list sidebar */}
          {trailers.length > 0 && (
            <div className="w-full lg:w-80 bg-gray-50 dark:bg-gray-900 border-t lg:border-t-0 lg:border-l border-gray-200 dark:border-gray-700">
              <div className="p-4">
                <div className="flex items-center justify-between mb-3 lg:mb-8">
                  <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                    All Trailers ({trailers.length})
                  </h3>
                </div>
                <div className="space-y-2 max-h-48 lg:max-h-[34rem] pr-2 overflow-y-auto custom-scrollbar">
                  {trailers.map((trailer) => (
                                          <div
                        key={trailer.id}
                        className={`p-2 lg:p-3 rounded-lg cursor-pointer transition-all duration-200 ${
                          selectedTrailer?.id === trailer.id
                            ? 'bg-rose-100 dark:bg-rose-900/30 border-2 border-rose-300 dark:border-rose-600'
                            : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                        onClick={() => handleTrailerSelect(trailer)}
                      >
                        <div className="flex items-start gap-2 lg:gap-3">
                          <div className="flex-shrink-0 w-12 h-9 lg:w-16 lg:h-12 bg-gray-200 dark:bg-gray-600 rounded overflow-hidden">
                            <img
                              src={`https://img.youtube.com/vi/${trailer.key}/mqdefault.jpg`}
                              alt={trailer.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <h4 className="text-xs lg:text-sm font-medium text-gray-900 dark:text-gray-100 line-clamp-2 leading-tight">
                              {trailer.name}
                            </h4>
                            <div className="flex items-center gap-1 lg:gap-2 mt-1">
                              {trailer.official && (
                                <span className="inline-flex items-center px-1 lg:px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                  Official
                                </span>
                              )}
                              <span className="text-xs text-gray-500 dark:text-gray-400 capitalize">
                                {trailer.type}
                              </span>
                            </div>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              openInYouTube(trailer);
                            }}
                            className="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                            title="Open in YouTube"
                          >
                            <ExternalLinkIcon className="w-3 h-3 lg:w-4 lg:h-4" />
                          </button>
                        </div>
                      </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
} 