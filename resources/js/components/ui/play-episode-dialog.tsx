import { useState, useEffect, useRef, useCallback } from 'react';
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
import { LoaderCircle, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, XIcon, Repeat, Repeat1, Repeat2, StepBack, StepForward, PictureInPicture2 } from 'lucide-react';
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
  onNextEpisode?: () => void;
  onPreviousEpisode?: () => void;
  hasNextEpisode?: boolean;
  hasPreviousEpisode?: boolean;
};

export function PlayEpisodeDialog({
  episode,
  tvshowName,
  isOpen,
  onOpenChange,
  onError,
  onComplete,
  autoPlay = true,
  quality = 'auto',
  onNextEpisode = () => {},
  onPreviousEpisode = () => {},
  hasNextEpisode = false,
  hasPreviousEpisode = false
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
  const [wasPlaying, setWasPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [isMouseOverVideo, setIsMouseOverVideo] = useState(false);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [userActive, setUserActive] = useState(true);
  const userActivityTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const [isHoveringDialog, setIsHoveringDialog] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);

  // Custom handler to handle manual closing via the X button
  const handleClose = () => {
    // Exit PiP if active
    if (document.pictureInPictureElement === videoRef.current) {
      document.exitPictureInPicture().catch(err => {
        console.log('Exit PiP on manual close failed:', err);
      });
    }
    
    // Stop playback
    if (videoRef.current && !videoRef.current.paused) {
      videoRef.current.pause();
    }
    
    setDialogOpen(false);
    onOpenChange?.(false);
  };
  
  // Handler that completely prevents closing by outside clicks
  const handleOpenChange = (open: boolean) => {
    // Allow closing when the X button is clicked (this is fired after DialogClose onClick)
    setDialogOpen(open);
    
    // When dialog is being closed, make sure to exit PiP mode and stop playback
    if (!open) {
      // Exit PiP if active
      if (document.pictureInPictureElement === videoRef.current) {
        document.exitPictureInPicture().catch(err => {
          console.log('Exit PiP on dialog close failed:', err);
        });
      }
      
      // Pause video playback
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
    
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
      // Reset timer states when opening a new episode
      setProgress(0);
      setCurrentTime(0);
      setDuration(0);
      
      const timer = setTimeout(() => {
        setIsLoading(false);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [isOpen, episode?.encFilePath]); // Add encFilePath to dependencies to reset when episode changes

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

  // Let's fix the progress bar and timer display
  // This effect needs to run when the video is loaded and when the episode changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Reset states when loading a new episode
    setProgress(0);
    setCurrentTime(0);
    setDuration(0);

    // Create separate handler functions for each event
    const handleTimeUpdate = () => {
      // Only update if we have a valid duration
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        const progressValue = (video.currentTime / video.duration) * 100;
        setProgress(progressValue);
        setCurrentTime(video.currentTime);
      }
    };

    const handleLoadedMetadata = () => {
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
        // Force update current time as well
        setCurrentTime(video.currentTime);
      }
    };

    const handleDurationChange = () => {
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    };

    // Add event listeners
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('durationchange', handleDurationChange);
    
    // Force a check immediately if video is already loaded
    if (video.readyState >= 1) {
      handleLoadedMetadata();
      handleTimeUpdate();
    }

    return () => {
      // Clean up event listeners
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('durationchange', handleDurationChange);
    };
  }, [episode?.encFilePath]); // Only re-run when the episode changes

  // Make sure our video event listeners are added after the video loads
  useEffect(() => {
    if (!isLoading && videoRef.current) {
      const video = videoRef.current;
      // Try to get duration right after loading is complete
      if (video.duration && !isNaN(video.duration) && video.duration > 0) {
        setDuration(video.duration);
      }
    }
  }, [isLoading]);

  // Fix the progress bar handler to be more reliable
  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!videoRef.current || !videoRef.current.duration) return;
    
    // Parse the value as a float for precision
    const newProgress = parseFloat(e.target.value);
    
    // Calculate the exact time position
    const newTime = (newProgress / 100) * videoRef.current.duration;
    
    // Update video position
    videoRef.current.currentTime = newTime;
    
    // Update state manually to avoid waiting for timeupdate event
    setProgress(newProgress);
    setCurrentTime(newTime);
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

  // Step backward 5 seconds
  const handleStepBack = () => {
    if (!videoRef.current) return;
    
    const newTime = Math.max(0, videoRef.current.currentTime - 5);
    videoRef.current.currentTime = newTime;
  };

  // Step forward 5 seconds
  const handleStepForward = () => {
    if (!videoRef.current) return;
    
    const newTime = Math.min(
      videoRef.current.duration || 0, 
      videoRef.current.currentTime + 5
    );
    videoRef.current.currentTime = newTime;
  };

  // Simple fullscreen implementation with cross-browser support
  const toggleFullscreen = () => {
    // Only apply fullscreen to the video container element
    const videoContainer = containerRef.current;
    if (!videoContainer) return;
    
    try {
      if (!document.fullscreenElement && 
          !(document as any).webkitFullscreenElement &&
          !(document as any).mozFullScreenElement) {
        // Request fullscreen on the container (with browser prefixes)
        if (videoContainer.requestFullscreen) {
          videoContainer.requestFullscreen();
        } else if ((videoContainer as any).webkitRequestFullscreen) { // Safari & Chrome
          (videoContainer as any).webkitRequestFullscreen();
        } else if ((videoContainer as any).mozRequestFullScreen) { // Firefox
          (videoContainer as any).mozRequestFullScreen();
        } else if ((videoContainer as any).msRequestFullscreen) { // IE/Edge
          (videoContainer as any).msRequestFullscreen();
        }
      } else {
        // Exit fullscreen (with browser prefixes)
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) { // Safari & Chrome
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) { // Firefox
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) { // IE/Edge
          (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen API error:', err);
    }
  };

  // Listen for fullscreen changes to update our state
  useEffect(() => {
    const handleFullscreenChange = () => {
      // Simply track if we're in fullscreen mode
      setIsFullscreen(
        !!document.fullscreenElement || 
        !!(document as any).webkitFullscreenElement ||
        !!(document as any).mozFullScreenElement ||
        !!(document as any).msFullscreenElement
      );
    };

    // Add fullscreen change event listener with browser prefixes
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('mozfullscreenchange', handleFullscreenChange);
    document.addEventListener('MSFullscreenChange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      document.removeEventListener('mozfullscreenchange', handleFullscreenChange);
      document.removeEventListener('MSFullscreenChange', handleFullscreenChange);
    };
  }, []);

  // Add keyboard shortcut for fullscreen (F key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setVolume(parseInt(e.target.value));
    if (parseInt(e.target.value) === 0) {
      setIsMuted(true);
    } else {
      setIsMuted(false);
    }
  };

  // Fix formatTime to handle invalid values better
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds) || seconds === Infinity || seconds < 0) {
      return '0:00';
    }
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    // Only show hours if the video is longer than an hour
    if (hours > 0) {
      return `${hours}:${minutes < 10 ? '0' : ''}${minutes}:${secs < 10 ? '0' : ''}${secs}`;
    }
    
    return `${minutes}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // Handle visibility change to fix audio/video sync
  useEffect(() => {
    const handleVisibilityChange = () => {
      const video = videoRef.current;
      if (!video) return;

      // Check if we're in Picture-in-Picture mode
      const isInPipMode = document.pictureInPictureElement === video;

      if (document.hidden) {
        // User is leaving the page, store current playing state
        setWasPlaying(isPlaying);
        
        // Don't pause if we're in PiP mode
        if (isPlaying && !isInPipMode) {
          video.pause();
        }
      } else {
        // User is returning to the page
        if (wasPlaying && !isInPipMode) { // Only resume if not in PiP (PiP should already be playing)
          // Reset video's current time to fix sync issues
          const currentPos = video.currentTime;
          video.currentTime = currentPos;
          
          // Small delay before playing to ensure synchronization
          setTimeout(() => {
            video.play().catch(err => {
              handleError(new Error('Failed to resume video: ' + err.message));
            });
          }, 50);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPlaying, wasPlaying]);

  // Handle navigation to previous episode
  const handlePreviousEpisode = () => {
    if (hasPreviousEpisode && onPreviousEpisode) {
      onPreviousEpisode();
    }
  };

  // Handle navigation to next episode
  const handleNextEpisode = () => {
    if (hasNextEpisode && onNextEpisode) {
      onNextEpisode();
    }
  };

  // Add keyboard controls for video navigation
  useEffect(() => {
    // Focus the container when dialog opens
    if (dialogOpen && containerRef.current) {
      containerRef.current.focus();
    }
    
    // Create a ref for the dialog content element
    const dialogContentRef = containerRef.current?.closest('[role="dialog"]') as HTMLElement | null;

    // Since we're handling key events at the dialog root level,
    // we only need this for events that might bubble up to the window
    const handleKeyDown = (e: KeyboardEvent) => {
      // Skip if user is typing in an input element
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }

      // Only handle keyboard events when the dialog is open
      if (!dialogOpen) return;
      
      // Only process key events that originate from outside the dialog, 
      // but we want to capture them anyway to prevent affecting background elements
      const isInDialog = dialogContentRef?.contains(e.target as Node) || 
                         (e.target instanceof Node && containerRef.current?.contains(e.target as Node));
      
      // For events originating outside dialog but while dialog is open,
      // prevent them from affecting background elements
      if (!isInDialog && dialogOpen) {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ' || 
            e.key === 'f' || e.key === 'F' || e.key === 'n' || e.key === 'N' || 
            e.key === 'p' || e.key === 'P' || e.key === 'b' || e.key === 'B') {
          e.stopPropagation();
          e.preventDefault();
        }
      }
    };

    // We still need this to catch any events that might bubble up to window
    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [dialogOpen, handleStepBack, handleStepForward, togglePlay, handleNextEpisode, handlePreviousEpisode]);

  // Add auto-advance to next episode when current one ends
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handleVideoEnded = () => {
      // First call onComplete callback if provided
      if (onComplete) {
        onComplete();
      }
      
      // Then navigate to next episode if available
      if (hasNextEpisode && onNextEpisode) {
        onNextEpisode();
      }
    };

    video.addEventListener('ended', handleVideoEnded);
    
    return () => {
      video.removeEventListener('ended', handleVideoEnded);
    };
  }, [onComplete, hasNextEpisode, onNextEpisode]);

  // Implement YouTube-like behavior for controls visibility
  const handleUserActivity = useCallback(() => {
    
    // Only show controls when in fullscreen OR when hovering the video
    if (isFullscreen || isHoveringVideo) {
      setUserActive(true);
      setControlsVisible(true);
    }
    
    // Clear any existing timeout
    if (userActivityTimeout.current) {
      clearTimeout(userActivityTimeout.current);
    }
    
    // Always set timeout to hide controls after inactivity
    userActivityTimeout.current = setTimeout(() => {
      setUserActive(false);
      setControlsVisible(false);
    }, 3000);
  }, [isFullscreen, isHoveringVideo]);

  // Add an effect for dialog entry/exit
  useEffect(() => {
    // When dialog is open, show controls initially
    if (dialogOpen) {
      setUserActive(true);
      setControlsVisible(true);
      
      // Start timer to hide controls after initial display
      if (userActivityTimeout.current) {
        clearTimeout(userActivityTimeout.current);
      }
      
      userActivityTimeout.current = setTimeout(() => {
        setUserActive(false);
        setControlsVisible(false);
      }, 3000);
    }
    
    return () => {
      if (userActivityTimeout.current) {
        clearTimeout(userActivityTimeout.current);
        userActivityTimeout.current = null;
      }
    };
  }, [dialogOpen]);

  // Check for Picture-in-Picture support
  useEffect(() => {
    // Check if PiP is supported by the browser
    const checkPipSupport = () => {
      const video = document.createElement('video');
      setIsPipSupported(
        document.pictureInPictureEnabled || 
        (typeof video.requestPictureInPicture === 'function')
      );
    };
    
    checkPipSupport();
  }, []);

  // Monitor PiP state changes
  useEffect(() => {
    if (!isPipSupported) return;
    
    const handlePipChange = () => {
      setIsPipActive(document.pictureInPictureElement === videoRef.current);
    };
    
    document.addEventListener('enterpictureinpicture', handlePipChange);
    document.addEventListener('leavepictureinpicture', handlePipChange);
    
    return () => {
      document.removeEventListener('enterpictureinpicture', handlePipChange);
      document.removeEventListener('leavepictureinpicture', handlePipChange);
    };
  }, [isPipSupported]);
    
  // Toggle Picture-in-Picture
  const togglePictureInPicture = () => {
    if (!videoRef.current || !isPipSupported) return;
    
    try {
      if (document.pictureInPictureElement !== videoRef.current) {
        videoRef.current.requestPictureInPicture()
          .then(() => {
            // Ensure the video is playing in PiP mode
            if (videoRef.current && videoRef.current.paused) {
              videoRef.current.play().catch(err => {
                console.error('PiP play error:', err);
              });
            }
          })
          .catch(err => {
            console.error('PiP error:', err);
            handleError(new Error('Failed to enter Picture-in-Picture mode: ' + err.message));
          });
      } else {
        document.exitPictureInPicture().catch(err => {
          console.error('Exit PiP error:', err);
          handleError(new Error('Failed to exit Picture-in-Picture mode: ' + err.message));
        });
      }
    } catch (err) {
      console.error('PiP toggle error:', err);
      handleError(new Error('Picture-in-Picture mode is not supported in this browser'));
    }
  };

  // Add auto Picture-in-Picture when user navigates away from the page
  useEffect(() => {
    if (!isPipSupported || !videoRef.current) return;
    
    const handleVisibilityChange = () => {
      // Only trigger PiP if video is playing and dialog is open
      if (document.hidden && isPlaying && dialogOpen && videoRef.current) {
        // Save the current playing state before going into PiP
        setWasPlaying(true);
        
        // Only enter PiP if we're not already in it
        if (document.pictureInPictureElement !== videoRef.current) {
          videoRef.current.requestPictureInPicture()
            .then(() => {
              // Ensure video continues playing in PiP mode
              if (videoRef.current && videoRef.current.paused) {
                videoRef.current.play().catch(err => {
                  console.log('Auto PiP play failed:', err);
                });
              }
            })
            .catch(err => {
              console.log('Auto PiP failed:', err);
              // Don't show error to user for this case
            });
        }
      } else if (!document.hidden && document.pictureInPictureElement === videoRef.current) {
        // When returning to the page, exit PiP if it was auto-entered
        document.exitPictureInPicture().catch(err => {
          console.log('Auto exit PiP failed:', err);
        });
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [isPipSupported, isPlaying, dialogOpen]);

  // Add keyboard shortcut for Picture-in-Picture (p key)
  useEffect(() => {
    if (!isPipSupported) return;
    
    const handlePipKeyDown = (e: KeyboardEvent) => {
      // Only handle if dialog is open
      if (!dialogOpen) return;
      
      if (e.key === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        togglePictureInPicture();
      }
    };

    window.addEventListener('keydown', handlePipKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handlePipKeyDown);
    };
  }, [dialogOpen, isPipSupported]);
  
  // Add a cleanup effect to ensure video and PiP are properly terminated
  useEffect(() => {
    // This effect runs when dialogOpen changes or when component unmounts
    return () => {
      // If dialog is closed or component is unmounting
      if (!dialogOpen && videoRef.current) {
        // Exit PiP if active
        if (document.pictureInPictureElement === videoRef.current) {
          try {
            document.exitPictureInPicture().catch(err => {
              console.log('Exit PiP on cleanup failed:', err);
            });
          } catch (err) {
            console.log('PiP cleanup error:', err);
          }
        }
        
        // Stop playback
        if (!videoRef.current.paused) {
          videoRef.current.pause();
        }
      }
    };
  }, [dialogOpen]);
  
  // Automatically exit PiP when dialog closes
  useEffect(() => {
    if (!dialogOpen && document.pictureInPictureElement === videoRef.current) {
      document.exitPictureInPicture().catch(err => {
        console.log('Exit PiP on dialog close failed:', err);
      });
      
      // Also stop video playback
      if (videoRef.current && !videoRef.current.paused) {
        videoRef.current.pause();
      }
    }
  }, [dialogOpen]);

  // Handle keyboard events at the dialog root level
  const handleDialogKeyDown = (e: React.KeyboardEvent) => {
    // Process keyboard events at the dialog root level
    if (dialogOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === ' ' || 
                       e.key === 'f' || e.key === 'F' || e.key === 'n' || e.key === 'N' || 
                       e.key === 'p' || e.key === 'P' || e.key === 'b' || e.key === 'B')) {
      e.stopPropagation();
      e.preventDefault();
      
      switch (e.key) {
        case 'ArrowLeft':
          handleStepBack();
          break;
        case 'ArrowRight':
          handleStepForward();
          break;
        case 'f':
        case 'F':
          toggleFullscreen();
          break;
        case ' ':
          togglePlay();
          break;
        case 'n':
        case 'N':
          handleNextEpisode();
          break;
        case 'b':
        case 'B':
          handlePreviousEpisode();
          break;
        case 'p':
        case 'P':
          if (isPipSupported) {
            togglePictureInPicture();
          }
          break;
      }
    }
  };

  if (error) {
    return (
      <Dialog open={dialogOpen} onOpenChange={handleOpenChange}>
        <DialogContent 
          className="sm:max-w-[800px] h-[500px] flex flex-col items-center justify-center"
          onPointerDownOutside={(e) => e.preventDefault()}
        >
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
        className="sm:max-w-[800px] p-0 overflow-hidden"
        onPointerDownOutside={(e) => {
          // Prevent closing on outside clicks
          e.preventDefault();
          
          // Ensure the dialog maintains focus when clicking outside
          if (containerRef.current) {
            containerRef.current.focus();
          }
        }}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="w-full h-full flex flex-col">
          {/* Video player area */}
          <div 
            ref={containerRef} 
            className="relative w-full aspect-video bg-black outline-none"
            tabIndex={0}
            style={{
              cursor: userActive || !isFullscreen ? 'default' : 'none', // Hide cursor when inactive in fullscreen
              ...(isFullscreen && {
                width: '100%',
                height: '100%',
                objectFit: 'contain'
              })
            }}
            onClick={(e) => {
              // Check if click is on controls
              if (controlsRef.current && controlsRef.current.contains(e.target as Node)) {
                return;
              }
              
              // If controls aren't visible, show them first
              if (!controlsVisible) {
                handleUserActivity();
              } else {
                togglePlay();
              }
            }}
            onMouseMove={handleUserActivity}
            onMouseEnter={() => {
              setIsHoveringVideo(true);
              handleUserActivity();
            }}
            onMouseLeave={() => {
              setIsHoveringVideo(false);
              // Don't clear the timeout - let controls hide after inactivity even when mouse leaves
              // But don't immediately hide controls either
            }}
          >
            {isLoading ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-y-4">
                <LoaderCircle className="h-12 w-12 animate-spin spinner-rose" />
                <p>Loading episode...</p>
              </div>
            ) : (
              <>
                {/* Video element */}
                <div className="w-full h-full bg-white dark:bg-black overflow-hidden">
                  {episode.encFilePath && dialogOpen ? (
                    <video 
                      ref={videoRef}
                      src={`${route('tvshow.episode.serve', { encFilePath: episode.encFilePath, disk: 'tvshows' })}`}
                      className="w-full h-full object-cover"
                      style={isFullscreen ? { objectFit: 'contain' } : {}}
                      controls={false}
                      autoPlay={isPlaying}
                      muted={isMuted}
                      playsInline
                      preload="metadata"
                      onLoadedData={() => setIsLoading(false)}
                      onLoadedMetadata={(e) => {
                        if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                          setDuration(e.currentTarget.duration);
                        }
                      }}
                      onDurationChange={(e) => {
                        if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                          setDuration(e.currentTarget.duration);
                        }
                      }}
                      onTimeUpdate={(e) => {
                        if (e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                          const progressValue = (e.currentTarget.currentTime / e.currentTarget.duration) * 100;
                          setProgress(progressValue);
                          setCurrentTime(e.currentTarget.currentTime);
                        }
                      }}
                      onEnded={() => onComplete?.()}
                      onError={(e) => handleError(new Error('Video playback error'))}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (!controlsVisible) {
                          handleUserActivity();
                        } else {
                          togglePlay();
                        }
                      }}
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
                <div 
                  ref={controlsRef}
                  className={`absolute inset-0 overflow-hidden bottom-[-0.1rem] bg-gradient-to-t from-[#fafafa] dark:from-[#171717] to-transparent transition-opacity duration-300 flex flex-col justify-end ${
                    controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'
                  }`}
                  onMouseEnter={() => {
                    // Always show controls when hovering over them
                    setControlsVisible(true);
                    setUserActive(true);
                    
                    // Clear any hide timeout
                    if (userActivityTimeout.current) {
                      clearTimeout(userActivityTimeout.current);
                    }
                  }}
                  onMouseMove={(e) => {
                    // Prevent event propagation to avoid duplicate handlers
                    e.stopPropagation();
                    handleUserActivity();
                  }}
                  onMouseLeave={() => {
                    // Always restart the timer when mouse leaves controls area
                    if (userActivityTimeout.current) {
                      clearTimeout(userActivityTimeout.current);
                    }
                    
                    userActivityTimeout.current = setTimeout(() => {
                      setUserActive(false);
                      setControlsVisible(false);
                    }, 3000);
                  }}
                >
                  <div className="p-4 text-neutral-900 dark:text-neutral-100">
                    <div className="mb-3 relative">
                      {/* Progress bar with track and indicator */}
                      <div className="w-full h-2 bg-neutral-600 rounded-full relative">
                        {/* Progress indicator */}
                        <div 
                          className="absolute top-0 left-0 h-2 bg-rose-500 rounded-full pointer-events-none" 
                          style={{ width: `${progress}%` }}
                        ></div>
                        
                        {/* Circle indicator */}
                        <div 
                          className="absolute top-0 h-4 w-4 bg-white rounded-full shadow-sm pointer-events-none transform -translate-y-1/4" 
                          style={{ left: `calc(${progress}% - 2px)` }}
                        ></div>
                        
                        {/* The actual range input */}
                        <input 
                          type="range" 
                          className="absolute top-0 left-0 w-full h-4 opacity-0 cursor-pointer -mt-1 transition-all duration-150" 
                          value={progress.toString()} 
                          onChange={handleProgressChange} 
                          min="0" 
                          max="100" 
                          step="0.01"
                          onKeyDown={(e) => {
                            // Override default arrow key behavior to jump by 5 seconds
                            if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                              e.preventDefault();
                              if (e.key === 'ArrowLeft') {
                                handleStepBack();
                              } else {
                                handleStepForward();
                              }
                            }
                          }}
                        />
                      </div>
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

                        {/* skip to previous episode */}
                        <button 
                          onClick={handlePreviousEpisode} 
                          disabled={!hasPreviousEpisode}
                          className={`${!hasPreviousEpisode ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-500'} transition-colors duration-150`}
                          title={`Previous Episode (B)`}
                        >
                          <SkipBack className="w-5 h-5" />
                        </button>
                        
                        {/* step back 5 seconds button */}
                        <button onClick={handleStepBack}>
                          <StepBack className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                        </button>
                        
                        {/* step forward 5 seconds button */}
                        <button onClick={handleStepForward}>
                          <StepForward className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                        </button>

                        {/* skip to next episode */}
                        <button 
                          onClick={handleNextEpisode} 
                          disabled={!hasNextEpisode}
                          className={`${!hasNextEpisode ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-500'} transition-colors duration-150`}
                          title={`Next Episode (N)`}
                        >
                          <SkipForward className="w-5 h-5" />
                        </button>
                        
                        {/* Timer moved back to left controls */}
                        <div className="hidden sm:block text-sm">
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
                        
                        {/* PiP button */}
                        {isPipSupported && (
                          <button 
                            onClick={togglePictureInPicture}
                            title={isPipActive ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture (p)"}
                            aria-label={isPipActive ? "Exit Picture-in-Picture" : "Enter Picture-in-Picture"}
                          >
                            <PictureInPicture2 className={`w-5 h-5 transition-colors duration-150 ${isPipActive ? 'text-rose-500' : 'hover:text-rose-500'}`} />
                          </button>
                        )}
                        
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
                <div className="flex justify-between items-start w-full">
                  <div>
                    <div className="text-xs text-rose-500 dark:text-rose-500 mb-2 italic">
                      {tvshowName}
                    </div>
                    <div className="text-xl">
                      {episode.name}
                    </div>
                  </div>
                  <div className="flex items-center gap-x-4">
                    {/* repeat episode (repeat 1) */}
                    <Repeat1 className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                    {/* repeat playlist */}
                    <Repeat className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                    {/* repeat entire tvshow episodes (all available seasons) */}
                    <Repeat2 className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                  </div>
                </div>
              </DialogTitle>
              <DialogDescription>
                <span className="flex justify-start items-center gap-x-2 w-full">
                    <span>Season {episode.season_number}</span><span> · </span><span>Episode {episode.episode_number}</span>{episode.runtime && episode.runtime > 0 && <><span> · </span><span>{episode.runtime}m</span></>}
                </span>
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 