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
import { LoaderCircle, Volume2, VolumeX, Maximize, Minimize, SkipBack, SkipForward, XIcon, Repeat, Repeat1, Repeat2, StepBack, StepForward, PictureInPicture2, MessageSquareText, SquareStack, Check, LockIcon, UserIcon, CreditCardIcon, Share2, Heart } from 'lucide-react';
import { route } from 'ziggy-js';
import { Tooltip } from "@/components/ui/tooltip";
import { InlinePremiumNotice } from "@/components/premium-content-notice";
import { Link, usePage } from "@inertiajs/react";
import { useWebShare } from "@/hooks/use-web-share";
import { EpisodesApi } from "@/services/episodes-api";

/**
 * Enhanced PlayEpisodeDialog Component
 * 
 * Features smart episode navigation that handles missing episodes in incomplete seasons:
 * - Automatically finds next/previous available episodes, skipping missing ones
 * - Supports proper repeat modes (episode, season, entire TV show)
 * - Handles incomplete seasons by continuing to search for next available episodes
 * - When "repeat TV show" is enabled and reaching the last available episode, loops back to Season 1 Episode 1
 * - When "repeat season" is enabled and reaching the last available episode of a season, loops back to the first episode of that season
 * - Shows user-friendly notifications when skipping missing episodes or looping
 */

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
  initialRepeatMode?: 'none' | 'one' | 'season' | 'tvshow';
  onRepeatModeChange?: (mode: 'none' | 'one' | 'season' | 'tvshow') => void;
  onFirstEpisodeOfSeason?: () => void;
  onFirstEpisodeOfTVShow?: () => void;
  // Enhanced navigation props for handling missing episodes
  onFindNextAvailableEpisode?: () => void;
  onFindPreviousAvailableEpisode?: () => void;
  onLastEpisodeOfSeason?: () => void;
  onLastEpisodeOfTVShow?: () => void;
  // Information about episode availability
  isFirstEpisodeOfSeason?: boolean;
  isLastEpisodeOfSeason?: boolean;
  isFirstEpisodeOfTVShow?: boolean;
  isLastEpisodeOfTVShow?: boolean;
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
  hasPreviousEpisode = false,
  initialRepeatMode = 'tvshow',
  onRepeatModeChange,
  onFirstEpisodeOfSeason = () => {},
  onFirstEpisodeOfTVShow = () => {},
  // Enhanced navigation props for handling missing episodes
  onFindNextAvailableEpisode = () => {},
  onFindPreviousAvailableEpisode = () => {},
  onLastEpisodeOfSeason = () => {},
  onLastEpisodeOfTVShow = () => {},
  // Information about episode availability
  isFirstEpisodeOfSeason = false,
  isLastEpisodeOfSeason = false,
  isFirstEpisodeOfTVShow = false,
  isLastEpisodeOfTVShow = false
}: PlayEpisodeDialogProps) {
  const { props } = usePage<{
    auth: {
      user: any;
      canAccessPremium: boolean;
      isAdmin: boolean;
    };
  }>();

  // Check if user can access this episode
  const canAccessEpisode = episode?.is_free || props.auth.canAccessPremium || props.auth.isAdmin;
  const isAuthenticated = !!props.auth.user;
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(80);
  const [previousVolume, setPreviousVolume] = useState(80);
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
  const [repeatOne, setRepeatOne] = useState(false);
  const [repeatSeason, setRepeatSeason] = useState(false);
  const [repeatTvshow, setRepeatTvshow] = useState(false);
  const [showLoopNotification, setShowLoopNotification] = useState(false);
  const [showNextEpisodeNotification, setShowNextEpisodeNotification] = useState(false);
  const [showSkippingEpisodesNotification, setShowSkippingEpisodesNotification] = useState(false);
  const [showPremiumNotice, setShowPremiumNotice] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [isAccessChecked, setIsAccessChecked] = useState(false);
  
  // Subtitles & Audio menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<'none' | 'subtitles' | 'audio'>('none');
  const contextMenuRef = useRef<HTMLDivElement>(null);
  
  // Subtitle tracks state with default "Off" option
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{id: string, label: string, selected: boolean, src?: string}>>([
    { id: 'off', label: 'Off', selected: true },
  ]);
  
  // Track the currently selected subtitle ID
  const [currentSubtitleId, setCurrentSubtitleId] = useState<string>('off');

  const [audioTracks, setAudioTracks] = useState([
    { id: 'default', label: 'Default', selected: true },
    { id: 'EN-5.1', label: 'English (5.1)', selected: false },
    { id: 'EN-2.0', label: 'English (2.0)', selected: false },
  ]);

  // Check if subtitles exist
  const [hasSubtitles, setHasSubtitles] = useState(false);

  // Add userPreferredSubtitleId state to remember user's subtitle preference
  const [userPreferredSubtitleId, setUserPreferredSubtitleId] = useState<string>('off');

  // Web Share API hook
  const { share, isSharing, isSupported: isShareSupported } = useWebShare();

  // Add like-related state
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [isLikeToggling, setIsLikeToggling] = useState(false);
  const [isLikeAnimating, setIsLikeAnimating] = useState(false);

  // Initialize repeat mode states based on initialRepeatMode prop
  useEffect(() => {
    setRepeatOne(initialRepeatMode === 'one');
    setRepeatSeason(initialRepeatMode === 'season');
    setRepeatTvshow(initialRepeatMode === 'tvshow');
  }, [initialRepeatMode]);

  // Handle loading state when access changes
  useEffect(() => {
    if (!canAccessEpisode) {
      setIsLoading(false); // Don't show loading for restricted content
      setError(null); // Clear any previous errors
    } else {
      setIsLoading(true); // Reset loading state when access is granted
    }
  }, [canAccessEpisode]);

  // Initialize subtitle tracks when episode changes
  useEffect(() => {
    if (episode && episode.subtitles && Array.isArray(episode.subtitles)) {
      try {
        // Get previous selected subtitle ID to handle transitions
        const previouslySelectedId = currentSubtitleId;
        
        // Map the subtitles from the episode to our format
        const subtitleOptions = [
          { id: 'off', label: 'Off', selected: true }, // Start with 'Off' selected by default
          ...episode.subtitles
            .filter((subtitle: any) => 
              subtitle && 
              subtitle.language_code && 
              subtitle.encFilePath && 
              typeof subtitle.encFilePath === 'string'
            )
            .map((subtitle: any) => {
              // Normalize language code to uppercase for consistency
              const normalizedLanguageCode = subtitle.language_code.toUpperCase();
              
              return {
                id: normalizedLanguageCode,
                label: subtitle.language_name || subtitle.language_code,
                selected: false, // None selected initially
                src: route('tvshow.subtitles.serve', { 
                  encFilePath: subtitle.encFilePath,
                  disk: 'tvshows'
                })
              };
            })
        ];
        
        // Get list of available subtitle language IDs for this episode (excluding 'off')
        const availableSubtitleIds = subtitleOptions
          .filter(option => option.id !== 'off')
          .map(option => option.id);
        
        // Normalize the user preferred subtitle ID for comparison
        const normalizedUserPreferredId = userPreferredSubtitleId !== 'off' 
          ? userPreferredSubtitleId.toUpperCase() 
          : 'off';
        
        // Check if preferred subtitle exists in this episode
        const preferredSubtitleExists = availableSubtitleIds.includes(normalizedUserPreferredId);
        
        // Update selected state based on availability
        let selectedSubtitleId = 'off';
        
        if (preferredSubtitleExists) {
          // If preferred subtitle exists, mark it as selected
          selectedSubtitleId = normalizedUserPreferredId;
        } else if (normalizedUserPreferredId !== 'off' && availableSubtitleIds.length > 0) {
          // If user prefers subtitles but their language isn't available,
          // select the first available subtitle as fallback (common UX pattern)
          selectedSubtitleId = availableSubtitleIds[0];
        }
        
        // Update the selected state in the options
        const updatedOptions = subtitleOptions.map(option => ({
          ...option,
          selected: option.id === selectedSubtitleId
        }));
        
        setSubtitleTracks(updatedOptions);
        setCurrentSubtitleId(selectedSubtitleId);
        
        // Apply subtitle after a short delay
        if (selectedSubtitleId !== 'off') {
          setTimeout(() => {
            applySubtitleToVideo(selectedSubtitleId);
          }, 1000);
        }
        
        // Only set hasSubtitles to true if we have valid subtitle tracks (not just the 'off' option)
        setHasSubtitles(availableSubtitleIds.length > 0);
      } catch (err) {
        console.error('Error processing subtitles:', err);
        setSubtitleTracks([{ id: 'off', label: 'Off', selected: true }]);
        setCurrentSubtitleId('off');
        setHasSubtitles(false);
      }
    } else {
      // Reset to just the "Off" option if no subtitles
      setSubtitleTracks([{ id: 'off', label: 'Off', selected: true }]);
      setCurrentSubtitleId('off');
      setHasSubtitles(false);
    }
  }, [episode, userPreferredSubtitleId, currentSubtitleId]);

  // Custom handler to handle manual closing via the X button
  const handleClose = () => {
    // Exit PiP if active
    if (document.pictureInPictureElement === videoRef.current) {
      document.exitPictureInPicture().catch(() => {
        // Silent error handling
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
        document.exitPictureInPicture().catch(() => {
          // Silent error handling
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

  // Check if content requires authentication/subscription
  const checkContentAccess = async () => {
    if (!episode.encFilePath) return false;
    
    const videoUrl = route('tvshow.episode.serve', { encFilePath: episode.encFilePath, disk: 'tvshows' });
    
    try {
      // Use HEAD request with anti-cache headers to ensure fresh validation
      const response = await fetch(videoUrl, { 
        method: 'HEAD',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.status === 401) {
        setAuthError('Authentication required');
        setShowPremiumNotice(true);
        return false;
      } else if (response.status === 403) {
        setAuthError('Subscription required');
        setShowPremiumNotice(true);
        return false;
      }
      
      return response.ok;
    } catch (error) {
      console.error('Error checking content access:', error);
      // Don't show premium notice for network errors - just allow video to try loading
      // The video element itself will handle network errors appropriately
      return true; // Allow the video to attempt loading and handle its own errors
    }
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  const toggleMute = () => {
    if (!isMuted) {
      // Save current volume before muting
      setPreviousVolume(volume);
      // Set volume to 0 when muting
      setVolume(0);
    } else {
      // Restore previous volume when unmuting
      setVolume(previousVolume > 0 ? previousVolume : 80); // Fallback to 80 if previous was 0
    }
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
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    
    if (newVolume === 0) {
      // When volume reaches 0, consider it as muted
      if (!isMuted) {
        setIsMuted(true);
      }
    } else {
      // When volume is greater than 0, update previous volume and unmute
      setPreviousVolume(newVolume);
      if (isMuted) {
        setIsMuted(false);
      }
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

  // Enhanced navigation to previous episode with smart episode finding
  const handlePreviousEpisode = () => {
    if (hasPreviousEpisode) {
      // Use regular previous episode if available
      onPreviousEpisode();
    } else {
      // No direct previous episode, try to find previous available episode
      if (onFindPreviousAvailableEpisode && typeof onFindPreviousAvailableEpisode === 'function') {
        // Show notification that we're skipping missing episodes
        setShowSkippingEpisodesNotification(true);
        setTimeout(() => {
          setShowSkippingEpisodesNotification(false);
          onFindPreviousAvailableEpisode();
        }, 1500);
      } else if (repeatSeason || repeatTvshow) {
        // Fallback: If no previous episode but repeat mode is enabled, go to last episode
        if (repeatSeason && onLastEpisodeOfSeason) {
          onLastEpisodeOfSeason();
        } else if (repeatTvshow && onLastEpisodeOfTVShow) {
          onLastEpisodeOfTVShow();
        }
      }
    }
  };

  // Enhanced navigation to next episode with smart episode finding and repeat logic
  const handleNextEpisode = () => {
    // Store PiP state to restore it after episode change
    const wasInPipMode = document.pictureInPictureElement === videoRef.current;
    if (wasInPipMode) {
      sessionStorage.setItem('pipActiveBeforeEpisodeChange', 'true');
    }
    
    if (hasNextEpisode) {
      // Use regular next episode if available
      onNextEpisode();
    } else {
      // No direct next episode, try to find next available episode or handle repeat modes
      if (onFindNextAvailableEpisode && typeof onFindNextAvailableEpisode === 'function') {
        // Show notification that we're skipping missing episodes
        setShowSkippingEpisodesNotification(true);
        setTimeout(() => {
          setShowSkippingEpisodesNotification(false);
          // Try to find next available episode (skipping missing ones)
          onFindNextAvailableEpisode();
        }, 1500);
      } else if (repeatSeason || repeatTvshow) {
        // Fallback: No next episode found, handle according to repeat mode
        if (repeatSeason) {
          // Loop back to first episode of current season
          setShowLoopNotification(true);
          setTimeout(() => {
            setShowLoopNotification(false);
            onFirstEpisodeOfSeason();
          }, 1500);
        } else if (repeatTvshow) {
          // Loop back to first episode of entire TV show
          setShowNextEpisodeNotification(true);
          setTimeout(() => {
            setShowNextEpisodeNotification(false);
            onFirstEpisodeOfTVShow();
          }, 1500);
        }
      }
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
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || 
            e.key === ' ' || e.key === 'f' || e.key === 'F' || e.key === 'n' || e.key === 'N' || 
            e.key === 'p' || e.key === 'P' || e.key === 'b' || e.key === 'B') {
          
          // Only prevent video control keys if user has access to the content
          // This prevents accidental triggering of video actions on restricted content
          if (canAccessEpisode) {
            e.stopPropagation();
            e.preventDefault();
          }
        }
      }
    };

    // We still need this to catch any events that might bubble up to window
    window.addEventListener('keydown', handleKeyDown, true); // Use capture phase
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [dialogOpen, handleStepBack, handleStepForward, togglePlay, handleNextEpisode, handlePreviousEpisode]);

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
      
      // Check if browser supports PiP with subtitles (Chrome 94+ and Safari 16.1+)
      const supportsPictureInPictureWithSubtitles = 'pictureInPictureWindow' in window && 
                                                  document.pictureInPictureEnabled;
      
      
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
                videoRef.current.play().catch(() => {
                  // Silent error handling
                });
              }
            })
            .catch(() => {
              // Silent error handling
            });
        }
      } else if (!document.hidden && document.pictureInPictureElement === videoRef.current) {
        // When returning to the page, exit PiP if it was auto-entered
        document.exitPictureInPicture().catch(() => {
          // Silent error handling
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
      // Only handle if dialog is open and user has access to content
      if (!dialogOpen || !canAccessEpisode) return;
      
      if (e.key === 'p' && !e.ctrlKey && !e.altKey && !e.metaKey) {
        e.preventDefault();
        togglePictureInPicture();
      }
    };

    window.addEventListener('keydown', handlePipKeyDown);
    
    return () => {
      window.removeEventListener('keydown', handlePipKeyDown);
    };
  }, [dialogOpen, isPipSupported, canAccessEpisode]);
  
  // Add a cleanup effect to ensure video and PiP are properly terminated
  useEffect(() => {
    // This effect runs when dialogOpen changes or when component unmounts
    return () => {
      // If dialog is closed or component is unmounting
      if (!dialogOpen && videoRef.current) {
        // Exit PiP if active
        if (document.pictureInPictureElement === videoRef.current) {
          try {
            document.exitPictureInPicture().catch(() => {
              // Silent error handling
            });
          } catch (err) {
            
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
      document.exitPictureInPicture().catch(() => {
        // Silent error handling
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
    if (dialogOpen && (e.key === 'ArrowLeft' || e.key === 'ArrowRight' || e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === ' ' || 
                       e.key === 'f' || e.key === 'F' || e.key === 'n' || e.key === 'N' || 
                       e.key === 'p' || e.key === 'P' || e.key === 'b' || e.key === 'B' ||
                       e.key === 'm' || e.key === 'M') ) {
      e.stopPropagation();
      e.preventDefault();
      
      // Don't handle video control keys if user doesn't have access to the content
      if (!canAccessEpisode && (e.key === ' ' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' || 
                                e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'm' || e.key === 'M' ||
                                e.key === 'f' || e.key === 'F' || e.key === 'p' || e.key === 'P')) {
        return; // Skip video control actions when content is restricted
      }
      
      switch (e.key) {
        case 'ArrowLeft':
          handleStepBack();
          break;
        case 'ArrowRight':
          handleStepForward();
          break;
        case 'ArrowUp':
          increaseVolume();
          break;
        case 'ArrowDown':
          decreaseVolume();
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
        case 'm':
        case 'M':
          toggleMute();
          break;
      }
    }
  };

  // Function to increase volume
  const increaseVolume = () => {
    if (isMuted) {
      // When increasing volume while muted, restore previous volume
      setVolume(previousVolume > 0 ? previousVolume : 5);
      setIsMuted(false);
    } else {
      // Normal volume increase
      const newVolume = Math.min(100, volume + 5);
      setVolume(newVolume);
      setPreviousVolume(newVolume);
    }
  };

  // Function to decrease volume
  const decreaseVolume = () => {
    const newVolume = Math.max(0, volume - 5);
    setVolume(newVolume);
    
    if (newVolume === 0) {
      // When volume reaches 0, mute
      setIsMuted(true);
    } else {
      // Update previous volume when not muted
      setPreviousVolume(newVolume);
    }
  };

  // Add keyboard shortcut for volume control (up/down arrow keys)
  useEffect(() => {
    const handleVolumeKeyDown = (e: KeyboardEvent) => {
      // Only handle if dialog is open and user has access to content
      if (!dialogOpen || !canAccessEpisode) return;
      
      // Prevent default behavior (scrolling)
      if ((e.key === 'ArrowUp' || e.key === 'ArrowDown') && 
           // Skip if user is typing in an input element
           !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) {
        e.preventDefault();
        
        if (e.key === 'ArrowUp') {
          increaseVolume();
        } else if (e.key === 'ArrowDown') {
          decreaseVolume();
        }
      }
    };

    window.addEventListener('keydown', handleVolumeKeyDown, true); // Use capture phase
    
    return () => {
      window.removeEventListener('keydown', handleVolumeKeyDown, true);
    };
  }, [dialogOpen, volume, isMuted, canAccessEpisode]);

  // Toggle repeat modes with exclusive selection
  const toggleRepeatOne = () => {
    const newRepeatOne = !repeatOne;
    setRepeatOne(newRepeatOne);
    
    if (newRepeatOne) {
      // Turn off others
      setRepeatSeason(false);
      setRepeatTvshow(false);
      onRepeatModeChange?.('one');
    } else {
      // All modes are now off
      onRepeatModeChange?.('none');
    }
  };

  const toggleRepeatSeason = () => {
    const newRepeatSeason = !repeatSeason;
    setRepeatSeason(newRepeatSeason);
    
    if (newRepeatSeason) {
      // Turn off others
      setRepeatOne(false);
      setRepeatTvshow(false);
      onRepeatModeChange?.('season');
    } else {
      // All modes are now off
      onRepeatModeChange?.('none');
    }
  };

  const toggleRepeatTvshow = () => {
    const newRepeatTvshow = !repeatTvshow;
    setRepeatTvshow(newRepeatTvshow);
    
    if (newRepeatTvshow) {
      // Turn off others
      setRepeatOne(false);
      setRepeatSeason(false);
      onRepeatModeChange?.('tvshow');
    } else {
      // All modes are now off
      onRepeatModeChange?.('none');
    }
  };

  // Add useEffect to log important props changes
  useEffect(() => {
    // Repeat mode settings are tracked internally
  }, [
    repeatOne, 
    repeatSeason, 
    repeatTvshow, 
    hasNextEpisode,
    hasPreviousEpisode,
    initialRepeatMode
  ]);

  // Add effect to reset video state when the episode changes
  useEffect(() => {
    if (!videoRef.current || !dialogOpen || !isAccessChecked) return;
    
    // Create a function to handle the video loading and playback
    const prepareAndPlayVideo = () => {
      if (!videoRef.current) return;
      
      // Reset video state
      videoRef.current.currentTime = 0;
      
      // Use a more reliable way to start playback using event listeners
      const playVideo = () => {
        if (!videoRef.current) return;
        
        if (autoPlay) {
          // Use a small timeout to ensure the video element is fully initialized
          setTimeout(() => {
            if (videoRef.current) {
              videoRef.current.play()
                .catch(err => {
                  // Try one more time after a delay if first attempt failed
                  setTimeout(() => {
                    if (videoRef.current) {
                      videoRef.current.play().catch(() => {});
                    }
                  }, 1000);
                });
            }
          }, 300);
        }
        
        // Apply user's preferred subtitle after video starts playing if it exists for this episode
        if (userPreferredSubtitleId !== 'off') {
          // Get the available subtitle IDs for this episode
          const availableSubtitleIds = subtitleTracks
            .filter(track => track.id !== 'off')
            .map(track => track.id);
          
          // Check if user's preferred subtitle exists in this episode
          const preferredSubtitleExists = availableSubtitleIds.includes(userPreferredSubtitleId);
          
          // Apply the appropriate subtitle
          if (preferredSubtitleExists) {
            // If preferred subtitle exists, apply it
            setTimeout(() => {
              applySubtitleToVideo(userPreferredSubtitleId);
            }, 1500);
          } else if (availableSubtitleIds.length > 0 && currentSubtitleId !== 'off') {
            // If user had a subtitle selected but their preference isn't available,
            // apply the currently selected subtitle (which should be the fallback)
            setTimeout(() => {
              applySubtitleToVideo(currentSubtitleId);
            }, 1500);
          }
        }
      };
      
      // Set up event listeners for video loading
      const handleCanPlay = () => {
        playVideo();
        
        // Clean up this specific event listener
        if (videoRef.current) {
          videoRef.current.removeEventListener('canplay', handleCanPlay);
        }
      };
      
      // Add event listener for canplay event
      videoRef.current.addEventListener('canplay', handleCanPlay);
      
      // Also try to play if the video is already loaded
      if (videoRef.current.readyState >= 3) { // HAVE_FUTURE_DATA or higher
        playVideo();
      }
    };
    
    // Call the prepare function
    prepareAndPlayVideo();
    
    // Set a timeout as a backup to ensure video plays
    const backupTimeout = setTimeout(() => {
      if (videoRef.current && autoPlay && videoRef.current.paused) {
        videoRef.current.play().catch(() => {});
      }
      
      // Also ensure subtitle is applied as a backup
      if (userPreferredSubtitleId !== 'off') {
        // Get the available subtitle IDs for this episode
        const availableSubtitleIds = subtitleTracks
          .filter(track => track.id !== 'off')
          .map(track => track.id);
        
        // Check if user's preferred subtitle exists in this episode
        const preferredSubtitleExists = availableSubtitleIds.includes(userPreferredSubtitleId);
        
        if (preferredSubtitleExists) {
          applySubtitleToVideo(userPreferredSubtitleId);
        } else if (availableSubtitleIds.length > 0 && currentSubtitleId !== 'off') {
          // Apply the currently selected subtitle (which should be the fallback)
          applySubtitleToVideo(currentSubtitleId);
        }
      }
    }, 2000);
    
    return () => {
      clearTimeout(backupTimeout);
      // Remove any event listeners we added
      if (videoRef.current) {
        videoRef.current.removeEventListener('canplay', function() {});
      }
    };
  // Only run this effect when the episode changes or dialog state changes, NOT when subtitle preferences change
  }, [episode?.encFilePath, dialogOpen, autoPlay, isAccessChecked]);

  // Separate effect to handle subtitle changes without restarting the video
  useEffect(() => {
    // Only apply subtitle changes if video is already playing (not during initial load)
    if (videoRef.current && videoRef.current.readyState >= 3 && currentSubtitleId !== 'off') {
      // Get the available subtitle IDs for this episode
      const availableSubtitleIds = subtitleTracks
        .filter(track => track.id !== 'off')
        .map(track => track.id);
      
      // Only apply if the current subtitle is available
      if (availableSubtitleIds.includes(currentSubtitleId)) {
        applySubtitleToVideo(currentSubtitleId);
      }
    }
  }, [currentSubtitleId, subtitleTracks]);

  // Add a specific hook to initialize the video properly on first render
  const videoElementRef = useRef<boolean>(false);
  useEffect(() => {
    // Only run once when the video element is first rendered
    if (videoRef.current && !videoElementRef.current) {
      videoElementRef.current = true;
      
      // Create a reference to the original ended event handler
      const videoElement = videoRef.current;
      const originalEndedHandler = videoElement.onended;
      
      // Override the native onended property to ensure it works on first load
      videoElement.onended = (event) => {
        // Call our custom handler first
        if (hasNextEpisode) {
          setShowNextEpisodeNotification(true);
          setTimeout(() => {
            setShowNextEpisodeNotification(false);
            onNextEpisode();
          }, 1500);
          
          // Prevent other handlers from firing
          event.stopPropagation();
          return false;
        }
        
        // Otherwise, let the original handler run if it exists
        if (originalEndedHandler && typeof originalEndedHandler === 'function') {
          return originalEndedHandler.call(videoElement, event);
        }
      };
    }
  }, [hasNextEpisode, onNextEpisode]);
  
  // Add an initialization effect when the dialog first opens
  useEffect(() => {
    // This useEffect runs when the dialog opens
    if (dialogOpen && episode?.encFilePath) {
      setIsAccessChecked(false);
      setShowPremiumNotice(false);
      setAuthError(null);
      setError(null);
      
      // Check content access before attempting to load video
      checkContentAccess()
        .then((hasAccess) => {
          if (!hasAccess) {
            setIsLoading(false);
          }
        })
        .catch((error) => {
          console.error('Access check failed:', error);
          // Don't set error state for access check failures
          // Let the video element handle loading errors
        })
        .finally(() => {
          setIsAccessChecked(true);
        });
    }
  }, [dialogOpen, episode?.name, episode?.encFilePath]);

  // Enhanced handleVideoEnd function to handle missing episodes and proper repeat behavior
  const handleVideoEnd = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    // Prevent duplicate firing
    const video = e.currentTarget;
    
    // Create a unique key for this specific video end event
    const endEventKey = `video_end_${episode.id}_${new Date().getTime()}`;
    
    // Check if we've already handled this specific end event
    if (sessionStorage.getItem(endEventKey)) {
      return;
    }
    
    // Set a flag to prevent duplicate handling (expires after 2 seconds)
    sessionStorage.setItem(endEventKey, 'true');
    setTimeout(() => {
      sessionStorage.removeItem(endEventKey);
    }, 2000);
    
    // Check if we're in Picture-in-Picture mode and store the state
    const isInPipMode = document.pictureInPictureElement === videoRef.current;
    if (isInPipMode) {
      sessionStorage.setItem('pipActiveBeforeEpisodeChange', 'true');
    }
    
    // Handle based on repeat mode
    if (repeatOne) {
      // Loop current episode
      video.currentTime = 0;
      video.play().catch(() => {});
      setShowLoopNotification(true);
      setTimeout(() => setShowLoopNotification(false), 2000);
    } else if (repeatSeason || repeatTvshow) {
      // For repeat modes, we need to be smarter about finding next episodes
      if (hasNextEpisode) {
        // There is a direct next episode available
        setShowNextEpisodeNotification(true);
        setTimeout(() => {
          setShowNextEpisodeNotification(false);
          onNextEpisode();
        }, 1500);
      } else if (onFindNextAvailableEpisode && typeof onFindNextAvailableEpisode === 'function') {
        // Try to find next available episode (skipping missing ones)
        setShowSkippingEpisodesNotification(true);
        setTimeout(() => {
          setShowSkippingEpisodesNotification(false);
          onFindNextAvailableEpisode();
        }, 1500);
      } else {
        // No next episode found at all, handle according to repeat mode
        if (repeatSeason) {
          // Loop back to first episode of current season
          setShowLoopNotification(true);
          setTimeout(() => {
            setShowLoopNotification(false);
            onFirstEpisodeOfSeason();
          }, 2000);
        } else if (repeatTvshow) {
          // Loop back to first episode of entire TV show
          setShowNextEpisodeNotification(true);
          setTimeout(() => {
            setShowNextEpisodeNotification(false);
            onFirstEpisodeOfTVShow();
          }, 1500);
        }
      }
    } else {
      // No repeat mode active - try next episode if available, otherwise stop
      if (hasNextEpisode) {
        setShowNextEpisodeNotification(true);
        setTimeout(() => {
          setShowNextEpisodeNotification(false);
          onNextEpisode();
        }, 1500);
      } else if (onFindNextAvailableEpisode && typeof onFindNextAvailableEpisode === 'function') {
        // Try to find next available episode even without repeat mode
        setShowSkippingEpisodesNotification(true);
        setTimeout(() => {
          setShowSkippingEpisodesNotification(false);
          onFindNextAvailableEpisode();
        }, 1500);
      } else {
        // No next episode found and no repeat mode - stop playback
        setIsPlaying(false);
        onComplete?.();
      }
    }
  };

  // Toggle Picture in Picture mode
  const togglePictureInPicture = async () => {
    if (!videoRef.current) return;

    try {
      // Check if already in PiP mode
      if (document.pictureInPictureElement) {
        await document.exitPictureInPicture();
        setIsPipActive(false);
      } else {
        // Safari and Chrome 94+ support subtitles in PiP
        const browserSupportsPipWithSubtitles = 
          (navigator.userAgent.includes('Chrome') && parseInt(navigator.userAgent.match(/Chrome\/([0-9]+)/)?.[1] || '0') >= 94) || 
          (navigator.userAgent.includes('Safari') && !navigator.userAgent.includes('Chrome') && parseInt(navigator.userAgent.match(/Version\/([0-9]+)\.([0-9]+)/)?.[1] || '0') >= 16);
          
        if (browserSupportsPipWithSubtitles) {
          // Chrome 94+ and Safari 16.1+ support PiP with subtitles
          const pipVideo = videoRef.current as any;
          
          // Make sure subtitles are applied before entering PiP
          if (currentSubtitleId && currentSubtitleId !== 'off') {
            applySubtitleToVideo(currentSubtitleId);
          }
          
          // Set up PiP options with subtitles
          if (pipVideo.webkitSupportsPresentationMode && typeof pipVideo.webkitSetPresentationMode === 'function') {
            // Safari method
            pipVideo.webkitSetPresentationMode('picture-in-picture');
            setIsPipActive(true);
          } else {
            // Chrome method - explicitly request subtitles in PiP
            try {
              await pipVideo.requestPictureInPicture();
              setIsPipActive(true);
              
              // Re-apply subtitles after entering PiP in Chrome
              if (currentSubtitleId && currentSubtitleId !== 'off') {
                setTimeout(() => {
                  applySubtitleToVideo(currentSubtitleId);
                }, 100);
              }
            } catch (error: unknown) {
              handlePipError(error);
            }
          }
        } else {
          // Fallback for browsers without subtitle support in PiP
          try {
            await videoRef.current.requestPictureInPicture();
            setIsPipActive(true);
            
            // Force re-apply subtitles after entering PiP
            if (currentSubtitleId && currentSubtitleId !== 'off') {
              setTimeout(() => {
                applySubtitleToVideo(currentSubtitleId);
              }, 100);
            }
          } catch (error: unknown) {
            handlePipError(error);
          }
        }
      }
    } catch (error: unknown) {
      handlePipError(error);
    }
  };
  
  // Handler for successful PiP entry
  const handlePipEntered = () => {
    // Ensure the video is playing in PiP mode
    if (videoRef.current && videoRef.current.paused) {
      videoRef.current.play().catch(() => {
        // Silent error handling
      });
    }
    
    // Use the current subtitle ID from state
    // Make sure subtitles remain visible in PiP mode
    if (currentSubtitleId !== 'off') {
      // Different browsers have different PiP subtitle implementations
      // For modern Chrome (94+) and Safari (16.1+), subtitle tracks set to 'showing'
      // should automatically appear in PiP
      setTimeout(() => {
        applySubtitleToVideo(currentSubtitleId);
        
        // Add PiP subtitle event listener if browser supports it
        if ('pictureInPictureWindow' in window) {
          try {
            // @ts-ignore - Modern API
            const pipWindow = videoRef.current.requestPictureInPicture();
            // @ts-ignore - Modern API
            pipWindow.addEventListener('resize', () => {
              // Re-apply subtitles when PiP window resizes
              applySubtitleToVideo(currentSubtitleId);
            });
          } catch (err) {
            
          }
        }
      }, 100);
    }
  };
  
  // Handler for PiP errors
  const handlePipError = (error: unknown) => {
    const errorMessage = error instanceof Error 
      ? error.message 
      : 'Unknown Picture-in-Picture error';
    handleError(new Error(`Failed to handle Picture-in-Picture: ${errorMessage}`));
  };

  // Enhance the applySubtitleToVideo function to be more robust
  const applySubtitleToVideo = (subtitleId: string) => {
    if (!videoRef.current) return;
    
    try {
      // Store current playback position and playing state
      const currentTime = videoRef.current.currentTime;
      const wasPlaying = !videoRef.current.paused;
      
      // Normalize the subtitle ID for case-insensitive comparison
      const normalizedSubtitleId = subtitleId !== 'off' ? subtitleId.toUpperCase() : 'off';
      
      // Disable all tracks first
      Array.from(videoRef.current.textTracks).forEach((track) => {
        track.mode = 'disabled';
      });
      
      // Enable the selected track if it's not "off"
      if (normalizedSubtitleId !== 'off') {
        // Find the track index with case-insensitive comparison
        const subtitleIndex = subtitleTracks.findIndex(
          track => track.id.toUpperCase() === normalizedSubtitleId
        );
        
        // Only proceed if we found a valid subtitle in our tracks list (not "off")
        if (subtitleIndex > 0) { // Index 0 is "Off", so must be > 0
          // Calculate the actual track index in the video's textTracks collection
          const textTrackIndex = subtitleIndex - 1; // -1 because "Off" isn't in textTracks
          
          // Verify the calculated index is valid before trying to use it
          if (textTrackIndex >= 0 && videoRef.current.textTracks.length > textTrackIndex) {
            // Force a brief hidden->showing transition which can help trigger visibility in PiP mode
            videoRef.current.textTracks[textTrackIndex].mode = 'hidden';
            
            // Short timeout before showing to ensure the track mode change is processed
            setTimeout(() => {
              if (videoRef.current && videoRef.current.textTracks.length > textTrackIndex) {
                videoRef.current.textTracks[textTrackIndex].mode = 'showing';
                
                // For PiP mode in some browsers, we need an additional force-show
                if (document.pictureInPictureElement === videoRef.current) {
                  // Some browsers need multiple attempts to show subtitles in PiP
                  setTimeout(() => {
                    if (videoRef.current && videoRef.current.textTracks.length > textTrackIndex) {
                      // Re-apply showing mode after a brief delay
                      videoRef.current.textTracks[textTrackIndex].mode = 'showing';
                    }
                  }, 200);
                }
              }
            }, 50);
          } else {
            // Log a more helpful error message for diagnosis
            console.warn(`Cannot apply subtitle: calculated textTrack index (${textTrackIndex}) is invalid or out of range. Available tracks: ${videoRef.current.textTracks.length}`);
          }
        } else {
          // Log when the requested subtitle ID isn't found in our tracks
          console.warn(`Subtitle ID "${normalizedSubtitleId}" not found in available subtitle tracks. Available IDs: ${subtitleTracks.map(t => t.id).join(', ')}`);
        }
      }
    } catch (err) {
      console.error('Error applying subtitle to video:', err);
    }
  };

  // Handle subtitle selection
  const handleSelectSubtitle = (id: string) => {
    
    // Normalize the selected ID to uppercase (except for 'off')
    const normalizedId = id !== 'off' ? id.toUpperCase() : 'off';
    
    // Update the subtitle tracks with the selected one
    const updatedTracks = subtitleTracks.map(track => ({
      ...track,
      selected: track.id === normalizedId
    }));
    
    setSubtitleTracks(updatedTracks);
    
    // Update the current subtitle ID state
    setCurrentSubtitleId(normalizedId);
    
    // Store user preference for future episode changes
    setUserPreferredSubtitleId(normalizedId);
    
    // Store the active subtitle ID for PiP mode
    sessionStorage.setItem('activePipSubtitleId', normalizedId);
    
    // Apply the subtitle to the video
    applySubtitleToVideo(normalizedId);
    
    // Close menu after selection
    setTimeout(() => {
      setShowContextMenu(false);
      setActiveSection('none');
    }, 200);
  };

  // Handle audio track selection
  const handleSelectAudio = (id: string) => {
    const updatedTracks = audioTracks.map(track => ({
      ...track,
      selected: track.id === id
    }));
    
    setAudioTracks(updatedTracks);
    
    // Apply audio track to video element
    if (videoRef.current) {
      // In a real implementation, you would select the appropriate audio track
      // This depends on how your video is served and what audio tracks are available
    }
    
    // Close menu after selection
    setTimeout(() => {
      setShowContextMenu(false);
      setActiveSection('none');
    }, 200);
  };

  // Function to handle sharing the episode
  const handleShareEpisode = async () => {
    // Create a shareable URL with episode information
    const currentUrl = new URL(window.location.href);
    currentUrl.searchParams.set('season', episode.season_number.toString());
    currentUrl.searchParams.set('episode', episode.episode_number.toString());
    currentUrl.searchParams.set('autoplay', 'true');
    
    const episodeTitle = `${tvshowName} - S${episode.season_number}E${episode.episode_number}: ${episode.name}`;
    const episodeDescription = episode.overview 
      ? `Watch "${episode.name}" from ${tvshowName} - ${episode.overview.slice(0, 150)}${episode.overview.length > 150 ? '...' : ''}` 
      : `Watch "${episode.name}" from ${tvshowName} - An exciting episode you don't want to miss!`;
    
    const shareData = {
      title: episodeTitle,
      text: episodeDescription,
      url: currentUrl.toString(),
    };
    
    await share(shareData);
  };

  // Add effect to restore PiP when episode changes
  useEffect(() => {
    if (!videoRef.current || !dialogOpen || !isPipSupported) return;
    
    // Create a function to handle video loading and restore PiP if needed
    const prepareAndRestorePipIfNeeded = () => {
      // Check if we were in PiP mode before episode change
      const wasInPipMode = sessionStorage.getItem('pipActiveBeforeEpisodeChange') === 'true';
      
      if (wasInPipMode && videoRef.current) {
        // Clear the flag immediately to prevent redundant attempts
        sessionStorage.removeItem('pipActiveBeforeEpisodeChange');
        
        // Wait a moment for the video to load before restoring PiP
        const restorePipTimeout = setTimeout(() => {
          if (videoRef.current && document.pictureInPictureElement !== videoRef.current) {
            videoRef.current.requestPictureInPicture()
              .then(() => {
                // Apply subtitle if one was active
                if (currentSubtitleId !== 'off') {
                  setTimeout(() => {
                    applySubtitleToVideo(currentSubtitleId);
                  }, 200);
                }
              })
              .catch(err => {
                console.log('Failed to restore PiP mode:', err);
              });
          }
        }, 1000);
        
        // Clean up the timeout if the component unmounts
        return () => clearTimeout(restorePipTimeout);
      }
    };
    
    // Call the prepare function
    const cleanup = prepareAndRestorePipIfNeeded();
    
    return cleanup;
  }, [episode?.encFilePath, dialogOpen, isPipSupported, currentSubtitleId]);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (contextMenuRef.current && !contextMenuRef.current.contains(event.target as Node)) {
        setShowContextMenu(false);
        setActiveSection('none');
      }
    };

    if (showContextMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showContextMenu]);

  // Toggle context menu
  const handleToggleContextMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    // Simply toggle the menu visibility
    setShowContextMenu(!showContextMenu);
    
    // Reset active section when closing
    if (showContextMenu) {
      setActiveSection('none');
    }
  };

  // Add effect to fetch initial likes state
  useEffect(() => {
    if (episode?.id && isAuthenticated) {
      EpisodesApi.getLikes(episode.id)
        .then(response => {
          setIsLiked(response.is_liked);
          setLikesCount(response.likes_count);
        })
        .catch(error => {
          console.error('Error fetching likes:', error);
        });
    }
  }, [episode?.id, isAuthenticated]);

  // Add like toggle handler
  const handleLikeToggle = async () => {
    if (!isAuthenticated || isLikeToggling) return;
    
    setIsLikeToggling(true);
    setIsLikeAnimating(true);
    
    try {
      const response = isLiked
        ? await EpisodesApi.unlike(episode.id)
        : await EpisodesApi.like(episode.id);
      
      // Change status at the midpoint of animation
      setTimeout(() => {
        setIsLiked(response.is_liked);
        setLikesCount(response.likes_count);
      }, 150);
      
      // Complete animation cycle
      setTimeout(() => {
        setIsLikeAnimating(false);
      }, 300);
    } catch (error) {
      console.error('Error toggling like:', error);
      setIsLikeAnimating(false);
    } finally {
      setIsLikeToggling(false);
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
        {/* Debug information - hidden but useful for debugging */}
        <div className="sr-only" id="debug-info" data-repeat-one={repeatOne.toString()} data-repeat-season={repeatSeason.toString()} data-repeat-tvshow={repeatTvshow.toString()} data-has-next-episode={hasNextEpisode.toString()} data-episode-name={episode.name} data-episode-number={episode.episode_number} data-season-number={episode.season_number}>
          Debug info
        </div>
        
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
                  {showPremiumNotice ? (
                    <InlinePremiumNotice 
                      type="episode"
                      onSignIn={() => {
                        onOpenChange?.(false);
                        window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname + window.location.search);
                      }}
                      onUpgrade={() => {
                        onOpenChange?.(false);
                        window.location.href = '/subscription/plans';
                      }}
                    />
                  ) : episode.encFilePath && dialogOpen ? (
                    <>
                      <video 
                        ref={videoRef}
                        key={episode.encFilePath}
                        src={canAccessEpisode && isAccessChecked ? `${route('tvshow.episode.serve', { encFilePath: episode.encFilePath, disk: 'tvshows' })}` : undefined}
                        className="w-full h-full object-cover"
                        style={isFullscreen ? { objectFit: 'contain' } : {}}
                        controls={false}
                        autoPlay={canAccessEpisode ? isPlaying : false}
                        muted={isMuted}
                        playsInline
                        preload={canAccessEpisode ? "metadata" : "none"}
                        onLoadedData={() => {
                          if (canAccessEpisode) {
                            setIsLoading(false);
                          }
                        }}
                        onLoadedMetadata={(e) => {
                          if (canAccessEpisode && e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                            setDuration(e.currentTarget.duration);
                          }
                        }}
                        onDurationChange={(e) => {
                          if (canAccessEpisode && e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                            setDuration(e.currentTarget.duration);
                          }
                        }}
                        onTimeUpdate={(e) => {
                          if (canAccessEpisode && e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                            const progressValue = (e.currentTarget.currentTime / e.currentTarget.duration) * 100;
                            setProgress(progressValue);
                            setCurrentTime(e.currentTarget.currentTime);
                            
                            // Check if we're close to the end of the video
                            // This is a backup in case onEnded doesn't fire
                            if (e.currentTarget.currentTime > 0 && 
                                e.currentTarget.duration - e.currentTarget.currentTime < 0.5) {
                              handleVideoEnd(e);
                            }
                          }
                        }}
                        onEnded={(e) => {
                          if (canAccessEpisode) {
                            handleVideoEnd(e);
                          }
                        }}
                        onError={(e) => {
                          if (canAccessEpisode) {
                            handleError(new Error('Video playback error'));
                          }
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!canAccessEpisode) return; // Prevent interaction if no access
                          if (!controlsVisible) {
                            handleUserActivity();
                          } else {
                            togglePlay();
                          }
                        }}
                      >
                        {/* Render subtitle tracks dynamically */}
                        {subtitleTracks.map((track, index) => {
                          // Skip the "Off" option
                          if (track.id === 'off' || !track.src) return null;
                          
                          return (
                            <track 
                              key={track.id}
                              kind="subtitles"
                              src={track.src}
                              srcLang={track.id.toLowerCase()}
                              label={track.label}
                              default={track.selected}
                            />
                          );
                        })}
                      </video>

                      {/* Premium Content Overlay */}
                      {!canAccessEpisode && (
                        <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4">
                          <div className="text-center text-white p-3 sm:p-4 md:p-6 lg:p-8 max-w-[280px] sm:max-w-sm md:max-w-md lg:max-w-lg w-full">
                            <div className="mb-3 sm:mb-4 md:mb-6">
                              <LockIcon className="w-8 h-8 sm:w-12 sm:h-12 md:w-16 md:h-16 mx-auto mb-2 sm:mb-3 md:mb-4 text-yellow-500" />
                              <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold mb-1 sm:mb-2">Premium Content</h3>
                              <p className="text-gray-300 text-xs sm:text-sm md:text-base leading-tight sm:leading-normal">
                                {!isAuthenticated 
                                  ? "Please register and log in to watch this episode."
                                  : "This episode requires a premium subscription to watch."
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
                      
                      {/* Loop notification */}
                      {showLoopNotification && (
                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-md text-sm flex items-center">
                          {repeatOne ? (
                            <>
                              <Repeat1 className="w-4 h-4 mr-2 text-rose-500" />
                              <span>Repeating episode</span>
                            </>
                          ) : repeatSeason ? (
                            <>
                              <Repeat className="w-4 h-4 mr-2 text-rose-500" />
                              <span>Starting season over</span>
                            </>
                          ) : repeatTvshow ? (
                            <>
                              <Repeat2 className="w-4 h-4 mr-2 text-rose-500" />
                              <span>Starting series from Season 1</span>
                            </>
                          ) : null}
                        </div>
                      )}
                      
                      {/* Next episode notification */}
                      {showNextEpisodeNotification && (
                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-md text-sm flex items-center">
                          <SkipForward className="w-4 h-4 mr-2 text-rose-500" />
                          <span>Playing next episode</span>
                        </div>
                      )}
                      
                      {/* Skipping episodes notification */}
                      {showSkippingEpisodesNotification && (
                        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-70 text-white px-4 py-2 rounded-md text-sm flex items-center">
                          <SkipForward className="w-4 h-4 mr-2 text-yellow-500" />
                          <span>Skipping missing episodes...</span>
                        </div>
                      )}
                    </>
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
                  className={`absolute inset-0 bottom-[-0.1rem] bg-gradient-to-t_ from-[#fafafa] dark:from-[#171717] via-transparent to-transparent transition-opacity duration-300 flex flex-col justify-end ${
                    (controlsVisible && canAccessEpisode) ? 'opacity-100' : 'opacity-0 pointer-events-none'
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
                  
                  <div className="absolute inset-0 light-gradient-video dark:dark-gradient-video z-10" />

                  <div className="p-4 text-neutral-900 dark:text-neutral-100 z-30">
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
                        <Tooltip text={isPlaying ? "Pause (Space)" : "Play (Space)"} position="bottom">
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
                        </Tooltip>

                        {/* skip to previous episode */}
                        <Tooltip text="Previous Episode (B)" position="bottom">
                          <button 
                            onClick={handlePreviousEpisode} 
                            disabled={!hasPreviousEpisode}
                            className={`${!hasPreviousEpisode ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-500'} transition-colors duration-150`}
                          >
                            <SkipBack className="w-5 h-5" />
                          </button>
                        </Tooltip>
                        
                        {/* step back 5 seconds button */}
                        <Tooltip text="Back 5 seconds (Left Arrow)" position="bottom">
                          <button className="hidden sm:block" onClick={handleStepBack}>
                            <StepBack className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                          </button>
                        </Tooltip>
                        
                        {/* step forward 5 seconds button */}
                        <Tooltip text="Forward 5 seconds (Right Arrow)" position="bottom">
                          <button className="hidden sm:block" onClick={handleStepForward}>
                            <StepForward className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                          </button>
                        </Tooltip>

                        {/* skip to next episode */}
                        <Tooltip text="Next Episode (N)" position="bottom">
                          <button 
                            onClick={handleNextEpisode} 
                            disabled={!hasNextEpisode}
                            className={`${!hasNextEpisode ? 'opacity-50 cursor-not-allowed' : 'hover:text-rose-500'} transition-colors duration-150`}
                          >
                            <SkipForward className="w-5 h-5" />
                          </button>
                        </Tooltip>
                        
                        {/* Timer moved back to left controls */}
                        <div className="hidden sm:block text-sm">
                          {formatTime(currentTime)} / {formatTime(duration)}
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-x-4">
                        <div className="flex items-center gap-x-2 mr-2">
                          {/* mute button */}
                          <Tooltip text={isMuted ? "Unmute (m)" : "Mute (m)"} position="bottom">
                            <button onClick={toggleMute}>
                              {isMuted ? (
                                <VolumeX className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                              ) : (
                                <Volume2 className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                              )}
                            </button>
                          </Tooltip>
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

                        {/* Seasons and episodes list button */}
                        <Tooltip text="Seasons & Episodes" position="bottom">
                          <SquareStack className="w-5 h-5 hover:text-rose-500 transition-colors duration-150 cursor-pointer" />
                        </Tooltip>

                        {/* Subtitles and audio button */}
                        <Tooltip text="Subtitles & Audio" position="bottom">
                          <button 
                            onClick={handleToggleContextMenu}
                            className="focus:outline-none relative cursor-pointer"
                            aria-label="Subtitles and Audio Options"
                          >
                            <MessageSquareText className={`w-5 h-5 ${showContextMenu ? 'text-rose-500' : 'hover:text-rose-500'} transition-colors duration-150`} />
                          </button>
                        </Tooltip>
                        
                        {/* Context Menu for Subtitles and Audio */}
                        {showContextMenu && (
                          <div 
                            ref={contextMenuRef}
                            className="absolute right-10 bottom-14 z-50 bg-white dark:bg-neutral-900 rounded-md shadow-lg border border-neutral-200 dark:border-neutral-800"
                            style={{ width: '240px' }}
                          >
                            {/* Main menu items */}
                            <div className="py-1">
                              {/* Subtitles option - only show if subtitles are available */}
                              {hasSubtitles && (
                                <div 
                                  className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                                    activeSection === 'subtitles' 
                                      ? 'bg-neutral-100 dark:bg-neutral-800' 
                                      : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                  }`}
                                  onMouseEnter={() => setActiveSection('subtitles')}
                                >
                                  <span className="text-sm font-medium">Subtitles</span>
                                  <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                                    {subtitleTracks.find(track => track.selected)?.label || 'Off'}
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </span>
                                </div>
                              )}
                              
                              {/* Audio option */}
                              <div 
                                className={`flex items-center justify-between px-4 py-3 cursor-pointer transition-colors ${
                                  activeSection === 'audio' 
                                    ? 'bg-neutral-100 dark:bg-neutral-800' 
                                    : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                                }`}
                                onMouseEnter={() => setActiveSection('audio')}
                              >
                                <span className="text-sm font-medium">Audio</span>
                                <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center">
                                  {audioTracks.find(track => track.selected)?.label || 'Default'}
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 ml-1" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                                  </svg>
                                </span>
                              </div>
                            </div>
                            
                            {/* Subtitles submenu */}
                            {activeSection === 'subtitles' && (
                              <div className="absolute top-0 right-full bg-white dark:bg-neutral-900 rounded-md shadow-lg border border-neutral-200 dark:border-neutral-800 py-1" style={{ width: '180px' }}>
                                {subtitleTracks.map((track) => (
                                  <div 
                                    key={track.id}
                                    className="flex items-center px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                                    onClick={() => handleSelectSubtitle(track.id)}
                                  >
                                    <span className="flex-1 text-sm">{track.label}</span>
                                    {track.selected && <Check className="w-4 h-4 text-rose-500" />}
                                  </div>
                                ))}
                              </div>
                            )}
                            
                            {/* Audio submenu */}
                            {activeSection === 'audio' && (
                              <div className="absolute top-0 right-full bg-white dark:bg-neutral-900 rounded-md shadow-lg border border-neutral-200 dark:border-neutral-800 py-1" style={{ width: '180px' }}>
                                {audioTracks.map((track) => (
                                  <div 
                                    key={track.id}
                                    className="flex items-center px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                                    onClick={() => handleSelectAudio(track.id)}
                                  >
                                    <span className="flex-1 text-sm">{track.label}</span>
                                    {track.selected && <Check className="w-4 h-4 text-rose-500" />}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}
                        
                        {/* PiP button */}
                        <Tooltip text={isFullscreen ? "Exit Fullscreen (f)" : "Enter Fullscreen (f)"} position="bottom">
                          <button onClick={toggleFullscreen}>
                            {isFullscreen ? (
                              <Minimize className="w-5 h-5 hover:text-rose-500 transition-colors duration-150 cursor-pointer" />
                            ) : (
                              <Maximize className="w-5 h-5 hover:text-rose-500 transition-colors duration-150 cursor-pointer" />
                            )}
                          </button>
                        </Tooltip>
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
                <div className="sm:flex justify-between items-start w-full">
                  <div>
                    <div className="text-xs text-rose-500 dark:text-rose-500 mb-2 italic">
                      {tvshowName}
                    </div>
                    <div className="text-xl">
                      {episode.name}
                    </div>
                  </div>
                  <div className="hidden sm:flex items-center gap-x-4">
                    {/* Like button - only for premium users and admins */}
                    {(props.auth.canAccessPremium || props.auth.isAdmin) && (
                      <Tooltip 
                        text={
                          isAuthenticated 
                            ? (isLiked ? "Unlike this episode" : "Like this episode") 
                            : "Login to like this episode"
                        } 
                        position="bottom"
                      >
                        <button
                          onClick={handleLikeToggle}
                          disabled={isLikeToggling || !isAuthenticated}
                          className="focus:outline-none cursor-pointer disabled:opacity-50"
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
                            <Heart 
                              className={`w-5 h-5 transition-colors duration-200 ${
                                isLiked 
                                  ? 'text-rose-500 fill-rose-500 hover:text-rose-600 hover:fill-rose-600' 
                                  : 'hover:text-rose-500'
                              }`}
                            />
                          </div>
                        </button>
                      </Tooltip>
                    )}

                    {/* Repeat mode indicator */}
                    {(repeatOne || repeatSeason || repeatTvshow) && (
                      <span className="hidden text-xs text-rose-500 ml-2">
                        {repeatOne ? "Repeating episode" : ""}
                        {repeatSeason ? "Repeating season" : ""}
                        {repeatTvshow ? "Repeating entire series" : ""}
                      </span>
                    )}
                    {/* share episode button */}
                    <Tooltip 
                      text={
                        isShareSupported 
                          ? "Share this episode" 
                          : "Share this episode (copy link)"
                      } 
                      position="bottom"
                    >
                      <button
                        onClick={handleShareEpisode}
                        disabled={isSharing}
                        className="focus:outline-none cursor-pointer disabled:opacity-50"
                      >
                        <Share2 
                          className={`w-5 h-5 transition-colors duration-150 hover:text-rose-500`}
                        />
                      </button>
                    </Tooltip>
                    {/* repeat episode (loop episode) */}
                    <Tooltip text="Repeat current episode" position="bottom">
                      <button
                        className="focus:outline-none cursor-pointer"
                        onClick={toggleRepeatOne}
                      >
                        <Repeat1 
                          className={`w-5 h-5 transition-colors duration-150 ${
                            repeatOne ? 'text-rose-500' : 'hover:text-rose-500'
                          }`}
                        />
                      </button>
                    </Tooltip>
                    {/* repeat season playlist (loop season) */}
                    <Tooltip text="Repeat current season" position="bottom">
                      <button
                        className="focus:outline-none cursor-pointer"
                        onClick={toggleRepeatSeason}
                      >
                        <Repeat 
                          className={`w-5 h-5 transition-colors duration-150 ${
                            repeatSeason ? 'text-rose-500' : 'hover:text-rose-500'
                          }`}
                        />
                      </button>
                    </Tooltip>
                    {/* repeat entire tvshow episodes (loop all seasons) */}
                    <Tooltip text="Repeat entire TV show" position="bottom">
                      <button
                        className="focus:outline-none cursor-pointer"
                        onClick={toggleRepeatTvshow}
                      >
                        <Repeat2 
                          className={`w-5 h-5 transition-colors duration-150 ${
                            repeatTvshow ? 'text-rose-500' : 'hover:text-rose-500'
                          }`}
                        />
                      </button>
                    </Tooltip>
                  </div>
                </div>
              </DialogTitle>
              <DialogDescription>
                <span className="sm:flex justify-start items-center gap-x-2 w-full">
                    <span>Season {episode.season_number}</span><span> · </span><span>Episode {episode.episode_number}</span>{episode.runtime && episode.runtime > 0 && <><span> · </span><span>{episode.runtime}m</span></>}
                    {/* Add likes count */}
                    {likesCount > 0 && (
                      <><span> · </span><span>{likesCount} {likesCount === 1 ? 'like' : 'likes'}</span></>
                    )}
                </span>
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
} 