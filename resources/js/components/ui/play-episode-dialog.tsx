import { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { LoaderCircle, Volume2, VolumeX, Maximize, Minimize, Rewind, FastForward, SkipBack, SkipForward, XIcon } from 'lucide-react';
import { route } from 'ziggy-js';

type PlayEpisodeDialogProps = {
  episode: any;
  tvshowName: string;
  isOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  onError?: (error: Error) => void;
  onComplete?: () => void;
  autoPlay?: boolean;
  quality?: 'auto' | 'low' | 'medium' | 'high';
};

export function PlayEpisodeDialog({
  episode,
  tvshowName,
  isOpen,
  onOpenChange,
  onError,
  onComplete,
  autoPlay = true,
  quality = 'auto'
}: PlayEpisodeDialogProps) {
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [error, setError] = useState<Error | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dialogOpen, setDialogOpen] = useState(isOpen);

  // Custom handler to handle manual closing via the X button
  const handleClose = () => {
    setDialogOpen(false);
    onOpenChange?.(false);
  };
  
  // Handler that completely prevents closing by outside clicks
  const handleOpenChange = (open: boolean) => {
    // Allow closing when the X button is clicked (this is fired after DialogClose onClick)
    setDialogOpen(open);
    // Propagate the change to parent
    onOpenChange?.(open);
  };

  // Update dialogOpen when isOpen prop changes
  useEffect(() => {
    setDialogOpen(isOpen);
  }, [isOpen]);

  // Simulate loading completion after 2 seconds
  useEffect(() => {
    if (isOpen) {
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  useEffect(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.play().catch(err => {
          handleError(new Error('Failed to play video: ' + err.message));
        });
      } else {
        videoRef.current.pause();
      }
    }
  }, [isPlaying]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.volume = volume / 100;
    }
  }, [volume]);

  // Add event listener for progress update
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const updateProgress = () => {
      if (video.duration) {
        setProgress((video.currentTime / video.duration) * 100);
        setCurrentTime(video.currentTime);
      }
    };

    video.addEventListener('timeupdate', updateProgress);
    
    // Set duration when metadata is loaded
    const handleLoadedMetadata = () => {
      setDuration(video.duration);
    };
    
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    
    return () => {
      video.removeEventListener('timeupdate', updateProgress);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
    };
  }, []);
  
  // Add handler to update progress when user drags the progress bar
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newProgress = parseInt(e.target.value);
    setProgress(newProgress);
    
    if (videoRef.current && videoRef.current.duration) {
      videoRef.current.currentTime = (newProgress / 100) * videoRef.current.duration;
    }
  };

  const handleError = (err: Error) => {
    setError(err);
    onError?.(err);
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    setIsMuted(!isMuted);
  };

  const toggleFullscreen = () => {
    setIsFullscreen(!isFullscreen);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(e.target.value));
    if (parseInt(e.target.value) === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  if (error) {
    return (
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="sm:max-w-[800px] h-[500px] flex flex-col items-center justify-center"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
          {/* Let the native DialogClose handle closing */}
          <DialogClose className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100">
            <XIcon className="bg-neutral-100/50 dark:bg-neutral-800/50 rounded"/>
            <span className="sr-only">Close</span>
          </DialogClose>
          <DialogHeader className="w-full text-center">
            <DialogTitle className="text-rose-500">Playback Error</DialogTitle>
            <DialogDescription>
              There was an error playing this episode. Please try again later.
            </DialogDescription>
          </DialogHeader>
          <div className="my-8">
            {error.message}
          </div>
          <DialogFooter>
            <Button asChild>
              <DialogClose>Close</DialogClose>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
      <DialogContent 
        className={`sm:max-w-[800px] p-0 overflow-hidden ${isFullscreen ? 'fixed inset-0 max-w-none rounded-none' : ''}`}
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        {/* Let the native DialogClose handle closing */}
        <DialogClose className="absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100">
          <XIcon className="bg-neutral-100/50 dark:bg-neutral-800/50 rounded"/>
          <span className="sr-only">Close</span>
        </DialogClose>
        <div className="w-full h-full flex flex-col">
          {/* Video player area */}
          <div className="relative w-full aspect-video bg-black">
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-y-4">
                <LoaderCircle className="h-12 w-12 animate-spin spinner-rose" />
                <p>Loading episode...</p>
              </div>
            ) : (
              <>
                {/* Video element would go here */}
                <div className="w-full h-full bg-white dark:bg-black overflow-hidden">
                  {episode.encFilePath ? (
                    <video 
                      ref={videoRef}
                      src={`${route('tvshow.episode.serve', { encFilePath: episode.encFilePath, disk: 'tvshows' })}`}
                      className="w-full h-full object-cover"
                      controls={false}
                      autoPlay={isPlaying}
                      muted={isMuted}
                      playsInline
                      onLoadedData={() => setIsLoading(false)}
                      onEnded={() => onComplete?.()}
                      onError={(e) => handleError(new Error('Video playback error'))}
                    ></video>
                  ) : (
                    <img 
                      src={episode.stillUrl} 
                      alt={episode.name} 
                      className="w-full h-full aspect-video object-cover object-center"
                    />
                  )}
                </div>
                
                {/* Video controls overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/70 to-transparent opacity-0 hover:opacity-100 transition-opacity duration-200 flex flex-col justify-end">
                  <div className="p-4 text-white">
                    <div className="mb-2">
                      {/* progress bar */}
                      <input 
                        type="range" 
                        className="w-full h-1 bg-neutral-600 rounded-full accent-rose-500" 
                        value={progress} 
                        onChange={handleProgressChange} 
                        min="0" 
                        max="100" 
                      />
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-x-4">
                        {/* play/pause button */}
                        <button onClick={togglePlay} className="hover:text-rose-500 transition-colors duration-150">
                          {isPlaying ? (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                              <path fillRule="evenodd" d="M6.75 5.25a.75.75 0 01.75-.75H9a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H7.5a.75.75 0 01-.75-.75V5.25zm7.5 0A.75.75 0 0115 4.5h1.5a.75.75 0 01.75.75v13.5a.75.75 0 01-.75.75H15a.75.75 0 01-.75-.75V5.25z" clipRule="evenodd" />
                            </svg>
                          ) : (
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                              <path fillRule="evenodd" d="M4.5 5.653c0-1.426 1.529-2.33 2.779-1.643l11.54 6.348c1.295.712 1.295 2.573 0 3.285L7.28 19.991c-1.25.687-2.779-.217-2.779-1.643V5.653z" clipRule="evenodd" />
                            </svg>
                          )}
                        </button>

                        {/* skip back button */}
                        <SkipBack className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                        
                        {/* rewind button */}
                        <Rewind className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                        {/* fast forward button */}
                        <FastForward className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />

                        {/* skip forward button */}
                        <SkipForward className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                        
                        {/* timestamp */}
                        <div className="text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-x-4">
                        <div className="flex items-center gap-x-2">
                          {/* mute button */}
                          <button onClick={toggleMute}>
                            {isMuted ? (
                              <VolumeX className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                            ) : (
                              <Volume2 className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                            )}
                          </button>
                          {/* volume slider */}
                          <input 
                            type="range" 
                            className="w-20 h-1 bg-neutral-600 rounded-full accent-rose-500" 
                            value={volume} 
                            onChange={handleVolumeChange} 
                            min="0" 
                            max="100" 
                          />
                        </div>
                        
                        {/* fullscreen button */}
                        <button onClick={toggleFullscreen}>
                          {isFullscreen ? (
                            <Minimize className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                          ) : (
                            <Maximize className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
          
          {/* Episode details */}
          <div className="p-6">
            <DialogHeader>
              <DialogTitle>
                <div className="text-xs text-rose-500 dark:text-rose-500 mb-2 italic">
                  {tvshowName}
                </div>
                <div className="text-xl">
                  {episode.name}
                </div>
              </DialogTitle>
              <DialogDescription>
                Season {episode.season_number} · Episode {episode.episode_number} · {episode.runtime}m
              </DialogDescription>
            </DialogHeader>
            
            {/* <div className="mt-4 text-sm text-neutral-700 dark:text-neutral-300">
              {episode.overview}
            </div> */}
            
            {/* <DialogFooter className="mt-6">
              <div className="flex items-center gap-x-4">
                <div className="flex-1 text-sm text-neutral-500 dark:text-neutral-400">
                  {quality === 'auto' ? 'Auto Quality' : `${quality.charAt(0).toUpperCase() + quality.slice(1)} Quality`}
                </div>
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange?.(false)}
                >
                  Close
                </Button>
              </div>
            </DialogFooter> */}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 