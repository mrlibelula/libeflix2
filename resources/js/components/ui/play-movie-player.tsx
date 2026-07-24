import { useState, useEffect, useRef, useCallback } from 'react';
import { LoaderCircle, Volume2, VolumeX, Maximize, Minimize, XIcon, PictureInPicture2, MessageSquareText, Check, LockIcon, UserIcon, CreditCardIcon, StepBack, StepForward, SkipBack, SkipForward, Play } from 'lucide-react';
import { route } from 'ziggy-js';
import { Tooltip } from "@/components/ui/tooltip";
import { Link, usePage } from "@inertiajs/react";
import axios from 'axios';
import { type PartyPlayerSync, usePartyPlaybackBridge } from '@/lib/party-playback-sync';
import { Button } from '@/components/ui/button';

type GestureDirection = 'forward' | 'backward';
type GestureFeedbackState = {
  direction: GestureDirection;
  amount: number;
};

type AudioTrack = {
  id: string;
  label: string;
  selected: boolean;
  encFilePath?: string;
};

const SEEK_INTERVAL_SECONDS = 10;
const DOUBLE_TAP_THRESHOLD_MS = 400;
const CONSECUTIVE_GESTURE_WINDOW_MS = 800;
const GESTURE_FEEDBACK_DURATION_MS = 600;
const TAP_MOVEMENT_THRESHOLD_PX = 18;
const EDGE_GESTURE_RATIO = 0.38;
const CONTROLS_AUTOHIDE_TIMEOUT_MS = 2800;

type PlayMoviePlayerProps = {
  movie: any;
  encFilePath: string;
  autoPlay?: boolean;
  onError?: (error: Error) => void;
  className?: string;
  imgBaseUrl?: string;
  /** When set, this player follows / drives a Party Theater room */
  partySync?: PartyPlayerSync | null;
};

export function PlayMoviePlayer({
  movie,
  encFilePath,
  autoPlay = false,
  onError,
  className = '',
  imgBaseUrl = '',
  partySync = null,
}: PlayMoviePlayerProps) {
  const { props } = usePage<{
    auth: {
      user: any;
      canAccessPremium: boolean;
      isAdmin: boolean;
    };
  }>();

  // Check if user can access this movie
  const canAccessMovie = movie?.is_free || props.auth.canAccessPremium || props.auth.isAdmin;
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
  const containerRef = useRef<HTMLDivElement>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const controlsRef = useRef<HTMLDivElement>(null);
  const [userActive, setUserActive] = useState(true);
  const userActivityTimeout = useRef<NodeJS.Timeout | null>(null);
  const [isHoveringVideo, setIsHoveringVideo] = useState(false);
  const [isPipSupported, setIsPipSupported] = useState(false);
  const [isPipActive, setIsPipActive] = useState(false);
  const [isAccessChecked, setIsAccessChecked] = useState(false);
  const pipTriggeredByScroll = useRef(false); // Track if PiP was auto-triggered by scroll
  /** Native MP4 aspect (width/height); used in party theater so we don't force 16:9 */
  const [videoAspectRatio, setVideoAspectRatio] = useState<number | null>(null);

  const partyBridge = usePartyPlaybackBridge({
    videoRef,
    sync: partySync,
    isPlaying,
    setIsPlaying,
  });
  const controlsLockedByParty = partyBridge.enabled && !partyBridge.canControl;
  const preserveNativeAspect = Boolean(partySync?.enabled);
  
  // Wake Lock state for keeping screen awake during playback
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  
  // Subtitles & Audio menu state
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [activeSection, setActiveSection] = useState<'none' | 'subtitles' | 'audio'>('none');
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Mobile gesture state & refs
  const [gestureFeedback, setGestureFeedback] = useState<GestureFeedbackState | null>(null);
  const lastTapTimeRef = useRef<number>(0);
  const singleTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchStartPositionRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const gestureFeedbackTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const consecutiveGestureRef = useRef<{ direction: GestureDirection | null; count: number; timestamp: number }>({
    direction: null,
    count: 0,
    timestamp: 0
  });
  const tapControlsVisibleRef = useRef<boolean>(false);
  
  // Subtitle tracks state with default "Off" option
  const [subtitleTracks, setSubtitleTracks] = useState<Array<{id: string, label: string, selected: boolean, src?: string}>>([
    { id: 'off', label: 'Off', selected: true },
  ]);
  
  const [currentSubtitleId, setCurrentSubtitleId] = useState<string>('off');
  const [hasSubtitles, setHasSubtitles] = useState(false);
  const [userPreferredSubtitleId, setUserPreferredSubtitleId] = useState<string>('off');

  const [audioTracks, setAudioTracks] = useState<AudioTrack[]>([
    { id: 'default', label: 'Default', selected: true, encFilePath: encFilePath },
  ]);
  const [currentAudioTrack, setCurrentAudioTrack] = useState('default');
  const [currentEncFilePath, setCurrentEncFilePath] = useState(encFilePath);

  useEffect(() => {
    setVideoAspectRatio(null);
  }, [currentEncFilePath]);

  // Progress bar tooltip state
  const [progressTooltipVisible, setProgressTooltipVisible] = useState(false);
  const [progressTooltipTime, setProgressTooltipTime] = useState(0);
  const [progressTooltipPosition, setProgressTooltipPosition] = useState(0);
  const [tooltipLeftOffset, setTooltipLeftOffset] = useState(0);
  const [previewThumbnail, setPreviewThumbnail] = useState<string | null>(null);
  const progressBarRef = useRef<HTMLDivElement>(null);
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const thumbnailGenerationTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Handle loading state when access changes
  useEffect(() => {
    if (!encFilePath) {
      // If there's no video file, don't show loading
      setIsLoading(false);
    } else if (!canAccessMovie) {
      setIsLoading(false);
      setError(null);
    } else {
      // Only show loading briefly, then let the video handle it
      setIsLoading(true);
      const timeout = setTimeout(() => {
        setIsLoading(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
  }, [canAccessMovie, encFilePath]);

  // Initialize subtitle tracks when movie changes
  useEffect(() => {
    if (movie && movie.subtitles && Array.isArray(movie.subtitles)) {
      try {
        const subtitleOptions = [
          { id: 'off', label: 'Off', selected: true },
          ...movie.subtitles
            .filter((subtitle: any) => 
              subtitle && 
              subtitle.languageCode && 
              (subtitle.encPath || subtitle.encFilePath) && 
              typeof (subtitle.encPath || subtitle.encFilePath) === 'string'
            )
            .map((subtitle: any) => {
              const normalizedLanguageCode = (subtitle.languageCode || subtitle.language_code || '').toUpperCase();
              const encodedPath = subtitle.encPath || subtitle.encFilePath;
              
              return {
                id: normalizedLanguageCode,
                label: subtitle.languageName || subtitle.language_name || subtitle.languageCode || subtitle.language_code,
                selected: false,
                src: route('movie.subtitles.serve', { 
                  encFilePath: encodedPath,
                  disk: 'movies'
                })
              };
            })
        ];
        
        const availableSubtitleIds = subtitleOptions
          .filter(option => option.id !== 'off')
          .map(option => option.id);
        
        const normalizedUserPreferredId = userPreferredSubtitleId !== 'off' 
          ? userPreferredSubtitleId.toUpperCase() 
          : 'off';
        
        const preferredSubtitleExists = availableSubtitleIds.includes(normalizedUserPreferredId);
        
        let selectedSubtitleId = 'off';
        
        if (preferredSubtitleExists) {
          selectedSubtitleId = normalizedUserPreferredId;
        } else if (normalizedUserPreferredId !== 'off' && availableSubtitleIds.length > 0) {
          selectedSubtitleId = availableSubtitleIds[0];
        }
        
        const updatedOptions = subtitleOptions.map(option => ({
          ...option,
          selected: option.id === selectedSubtitleId
        }));
        
        setSubtitleTracks(updatedOptions);
        setCurrentSubtitleId(selectedSubtitleId);
        
        if (selectedSubtitleId !== 'off') {
          setTimeout(() => {
            applySubtitleToVideo(selectedSubtitleId);
          }, 1000);
        }
        
        setHasSubtitles(availableSubtitleIds.length > 0);
      } catch (err) {
        console.error('Error processing subtitles:', err);
        setSubtitleTracks([{ id: 'off', label: 'Off', selected: true }]);
        setCurrentSubtitleId('off');
        setHasSubtitles(false);
      }
    } else {
      setSubtitleTracks([{ id: 'off', label: 'Off', selected: true }]);
      setCurrentSubtitleId('off');
      setHasSubtitles(false);
    }
  }, [movie, userPreferredSubtitleId, currentSubtitleId]);

  // Initialize audio tracks when movie changes (for language-specific video files)
  useEffect(() => {
    if (movie && movie.encodedLanguageVideoFiles && Array.isArray(movie.encodedLanguageVideoFiles)) {
      try {
        // Get original language name from movie data or default to 'Original'
        const originalLanguageName = movie.original_language_name || 'Original';
        
        const audioOptions = [
          { 
            id: 'default', 
            label: originalLanguageName, 
            selected: true,
            encFilePath: encFilePath // Store the original encoded file path
          },
          ...movie.encodedLanguageVideoFiles
            .filter((langFile: any) => 
              langFile && 
              langFile.language_code && 
              langFile.encFilePath &&
              typeof langFile.encFilePath === 'string'
            )
            .map((langFile: any) => ({
              id: langFile.language_code.toUpperCase(),
              label: langFile.language_name || langFile.language_code.toUpperCase(),
              selected: false,
              encFilePath: langFile.encFilePath
            }))
        ];
        
        setAudioTracks(audioOptions);
        setCurrentAudioTrack('default');
      } catch (err) {
        console.error('Error processing audio tracks:', err);
        setAudioTracks([{ id: 'default', label: 'Original', selected: true, encFilePath: encFilePath }]);
      }
    } else {
      // No additional language files, just show default
      setAudioTracks([{ id: 'default', label: 'Original', selected: true, encFilePath: encFilePath }]);
    }
  }, [movie, encFilePath]);

  const handleError = (err: Error) => {
    setError(err);
    onError?.(err);
  };

  // Check if content requires authentication/subscription
  const checkContentAccess = async () => {
    if (!encFilePath) return false;
    
    const videoUrl = route('movie.serve', { encFilePath: encFilePath, disk: 'movies' });
    
    try {
      const response = await fetch(videoUrl, { 
        method: 'HEAD',
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache'
        }
      });
      
      if (response.status === 401 || response.status === 403) {
        return false;
      }
      
      return response.ok;
    } catch (error) {
      console.error('Error checking content access:', error);
      return true;
    }
  };

  // Wake Lock API - Keep screen awake during video playback
  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        wakeLockRef.current = await navigator.wakeLock.request('screen');
        // console.log('Wake Lock is active');
      }
    } catch (err) {
      console.error('Failed to request wake lock:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release();
        wakeLockRef.current = null;
        // console.log('Wake Lock released');
      } catch (err) {
        console.error('Failed to release wake lock:', err);
      }
    }
  };

  // Manage wake lock based on playback state
  useEffect(() => {
    if (isPlaying && canAccessMovie) {
      requestWakeLock();
    } else {
      releaseWakeLock();
    }

    // Cleanup on unmount
    return () => {
      releaseWakeLock();
    };
  }, [isPlaying, canAccessMovie]);

  const togglePlay = () => {
    if (controlsLockedByParty) return;
    const next = !isPlaying;
    setIsPlaying(next);
    partyBridge.onLocalPlayPause(next);
  };

  const toggleMute = () => {
    if (!isMuted) {
      setPreviousVolume(volume);
      setVolume(0);
    } else {
      setVolume(previousVolume > 0 ? previousVolume : 80);
    }
    setIsMuted(!isMuted);
  };

  const handleStepBack = () => {
    if (!videoRef.current || controlsLockedByParty) return;
    const newTime = Math.max(0, videoRef.current.currentTime - SEEK_INTERVAL_SECONDS);
    videoRef.current.currentTime = newTime;
    partyBridge.onLocalSeek(newTime, isPlaying);
  };

  const handleStepForward = () => {
    if (!videoRef.current || controlsLockedByParty) return;
    const newTime = Math.min(
      videoRef.current.duration || 0, 
      videoRef.current.currentTime + SEEK_INTERVAL_SECONDS
    );
    videoRef.current.currentTime = newTime;
    partyBridge.onLocalSeek(newTime, isPlaying);
  };

  const toggleFullscreen = () => {
    const videoContainer = containerRef.current;
    if (!videoContainer) return;
    
    try {
      if (!document.fullscreenElement && 
          !(document as any).webkitFullscreenElement &&
          !(document as any).mozFullScreenElement) {
        if (videoContainer.requestFullscreen) {
          videoContainer.requestFullscreen();
        } else if ((videoContainer as any).webkitRequestFullscreen) {
          (videoContainer as any).webkitRequestFullscreen();
        } else if ((videoContainer as any).mozRequestFullScreen) {
          (videoContainer as any).mozRequestFullScreen();
        } else if ((videoContainer as any).msRequestFullscreen) {
          (videoContainer as any).msRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen();
        } else if ((document as any).webkitExitFullscreen) {
          (document as any).webkitExitFullscreen();
        } else if ((document as any).mozCancelFullScreen) {
          (document as any).mozCancelFullScreen();
        } else if ((document as any).msExitFullscreen) {
          (document as any).msExitFullscreen();
        }
      }
    } catch (err) {
      console.error('Fullscreen API error:', err);
    }
  };

  // Listen for fullscreen changes
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(
        !!document.fullscreenElement || 
        !!(document as any).webkitFullscreenElement ||
        !!(document as any).mozFullScreenElement ||
        !!(document as any).msFullscreenElement
      );
    };

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

  // Track watch progress and send to API periodically (skipped in party theaters)
  useEffect(() => {
    if (partySync?.enabled) {
      return;
    }
    if (!movie?.id || !isAuthenticated || !videoRef.current) {
      return;
    }

    const video = videoRef.current;
    let progressUpdateInterval: NodeJS.Timeout | null = null;

    // Function to send progress update to API
    const updateWatchProgress = async () => {
      if (!video || video.paused || !video.duration || video.duration <= 0) {
        return;
      }

      try {
        await axios.post(route('api.views.progress.update'), {
          type: 'movie',
          id: movie.id,
          current_time: Math.floor(video.currentTime),
          duration: Math.floor(video.duration),
        });
      } catch (error) {
        console.error('Error updating watch progress:', error);
      }
    };

    // Update progress every 15 seconds while playing
    const startProgressTracking = () => {
      if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
      }
      progressUpdateInterval = setInterval(updateWatchProgress, 15000);
    };

    const stopProgressTracking = () => {
      if (progressUpdateInterval) {
        clearInterval(progressUpdateInterval);
        progressUpdateInterval = null;
      }
    };

    // Listen for play/pause events
    const handlePlay = () => {
      startProgressTracking();
      updateWatchProgress(); // Send immediate update on play
    };

    const handlePause = () => {
      stopProgressTracking();
      updateWatchProgress(); // Send update on pause
    };

    const handleEnded = async () => {
      stopProgressTracking();
      updateWatchProgress(); // Send final update on end
      
      // Record play if 80%+ was watched
      if (video.duration > 0) {
        try {
          await axios.post(route('api.plays.record'), {
            type: 'movie',
            id: movie.id,
            watch_duration: Math.floor(video.currentTime),
            media_duration: Math.floor(video.duration),
          });
        } catch (error) {
          console.error('Error recording play:', error);
        }
      }
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('ended', handleEnded);

    // Start tracking if already playing
    if (!video.paused) {
      startProgressTracking();
    }

    return () => {
      stopProgressTracking();
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('ended', handleEnded);
    };
  }, [movie?.id, isAuthenticated, partySync?.enabled]);

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (controlsLockedByParty) return;
    const newProgress = parseFloat(e.target.value);
    setProgress(newProgress);
    
    if (videoRef.current && videoRef.current.duration) {
      const newTime = (newProgress / 100) * videoRef.current.duration;
      videoRef.current.currentTime = newTime;
      partyBridge.onLocalSeek(newTime, isPlaying);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    
    if (newVolume === 0) {
      setIsMuted(true);
    } else if (isMuted) {
      setIsMuted(false);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  const generateThumbnailPreview = (timeInSeconds: number) => {
    if (!previewVideoRef.current || !previewCanvasRef.current || !canAccessMovie) return;
    
    const video = previewVideoRef.current;
    const canvas = previewCanvasRef.current;
    
    // Check if video is ready
    if (!video.videoWidth || !video.videoHeight) {
      return;
    }
    
    const ctx = canvas.getContext('2d', { 
      alpha: false, // Disable alpha channel for better performance
      willReadFrequently: false 
    });
    
    if (!ctx) return;
    
    // Set video time to the desired position
    video.currentTime = timeInSeconds;
    
    // Wait for the video to seek to the correct position
    const handleSeeked = () => {
      try {
        // Set canvas dimensions to match video aspect ratio (smaller for preview)
        const previewWidth = 160;
        const previewHeight = Math.round((video.videoHeight / video.videoWidth) * previewWidth);
        
        // Only resize canvas if dimensions changed (performance optimization)
        if (canvas.width !== previewWidth || canvas.height !== previewHeight) {
          canvas.width = previewWidth;
          canvas.height = previewHeight;
        }
        
        // Draw the video frame to canvas
        ctx.drawImage(video, 0, 0, previewWidth, previewHeight);
        
        // Convert canvas to data URL with lower quality for faster generation
        const thumbnailUrl = canvas.toDataURL('image/jpeg', 0.6);
        setPreviewThumbnail(thumbnailUrl);
      } catch (error) {
        console.error('Error generating thumbnail:', error);
      }
      
      video.removeEventListener('seeked', handleSeeked);
    };
    
    video.addEventListener('seeked', handleSeeked, { once: true });
  };

  const updateProgressTooltipAtX = (clientX: number, withThumbnail: boolean = false) => {
    if (!progressBarRef.current || !duration) return;

    const rect = progressBarRef.current.getBoundingClientRect();
    const relativeX = clientX - rect.left;
    const percentage = Math.max(0, Math.min(100, (relativeX / rect.width) * 100));
    const timeAtPosition = (percentage / 100) * duration;

    // Calculate tooltip position with boundary constraints
    const tooltipWidth = 160;
    const halfTooltipWidth = tooltipWidth / 2;

    let leftPosition = relativeX;

    if (leftPosition - halfTooltipWidth < 0) {
      leftPosition = halfTooltipWidth;
    } else if (leftPosition + halfTooltipWidth > rect.width) {
      leftPosition = rect.width - halfTooltipWidth;
    }

    setProgressTooltipPosition(percentage);
    setTooltipLeftOffset(leftPosition);
    setProgressTooltipTime(timeAtPosition);
    setProgressTooltipVisible(true);

    setControlsVisible(true);
    setUserActive(true);

    if (withThumbnail) {
      if (thumbnailGenerationTimeoutRef.current) {
        clearTimeout(thumbnailGenerationTimeoutRef.current);
      }
      thumbnailGenerationTimeoutRef.current = setTimeout(() => {
        generateThumbnailPreview(timeAtPosition);
      }, 30);
    }
  };

  const handleProgressBarMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    updateProgressTooltipAtX(e.clientX, true);
  };

  const handleProgressBarMouseEnter = () => {
    if (duration) {
      setProgressTooltipVisible(true);
    }
    
    // Keep controls visible and cancel any hide timeout
    setControlsVisible(true);
    setUserActive(true);
    if (userActivityTimeout.current) {
      clearTimeout(userActivityTimeout.current);
      userActivityTimeout.current = null;
    }
  };

  const handleProgressBarMouseLeave = () => {
    setProgressTooltipVisible(false);
    setPreviewThumbnail(null);
    
    if (thumbnailGenerationTimeoutRef.current) {
      clearTimeout(thumbnailGenerationTimeoutRef.current);
      thumbnailGenerationTimeoutRef.current = null;
    }
    
    // Resume auto-hide behavior after leaving progress bar
    handleUserActivity();
  };

  // Touch handlers for mobile progress bar tooltip
  const handleProgressBarTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    updateProgressTooltipAtX(touch.clientX);

    if (userActivityTimeout.current) {
      clearTimeout(userActivityTimeout.current);
      userActivityTimeout.current = null;
    }
  };

  const handleProgressBarTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.touches[0];
    if (!touch) return;
    updateProgressTooltipAtX(touch.clientX);
  };

  const handleProgressBarTouchEnd = () => {
    setProgressTooltipVisible(false);
    setPreviewThumbnail(null);

    if (thumbnailGenerationTimeoutRef.current) {
      clearTimeout(thumbnailGenerationTimeoutRef.current);
      thumbnailGenerationTimeoutRef.current = null;
    }

    handleUserActivity();
  };

  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!canAccessMovie) return;
    
    if (e.key === 'Escape') {
      if (isFullscreen) {
        e.preventDefault();
        toggleFullscreen();
      }
      return;
    }
    
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
      return;
    }

    switch (e.key) {
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        handleStepBack();
        break;
      case 'ArrowRight':
        e.preventDefault();
        handleStepForward();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case 'm':
      case 'M':
        e.preventDefault();
        toggleMute();
        break;
    }
  };

  useEffect(() => {
    // Don't steal focus from party theater queue/chat when syncing playback
    if (partySync?.enabled) return;
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, [partySync?.enabled]);

  const handleUserActivity = useCallback((forceShow: boolean = false, duration: number = CONTROLS_AUTOHIDE_TIMEOUT_MS) => {
    // Always show controls when user is active
    setUserActive(true);
    setControlsVisible(true);

    if (userActivityTimeout.current) {
      clearTimeout(userActivityTimeout.current);
    }

    // Auto-hide controls after inactivity
    userActivityTimeout.current = setTimeout(() => {
      setUserActive(false);
      setControlsVisible(false);
    }, duration);
  }, [isFullscreen]);

  useEffect(() => {
    // Show controls on mount and start auto-hide timer
    setUserActive(true);
    setControlsVisible(true);
    
    // Auto-hide after initial display
    handleUserActivity();
    
    return () => {
      if (userActivityTimeout.current) {
        clearTimeout(userActivityTimeout.current);
        userActivityTimeout.current = null;
      }
    };
  }, [handleUserActivity]);

  // Auto-hide controls when video starts playing
  useEffect(() => {
    if (isPlaying) {
      handleUserActivity();
    }
  }, [isPlaying, handleUserActivity]);

  const triggerGestureFeedback = (direction: GestureDirection) => {
    const now = Date.now();
    const isSameDirection = consecutiveGestureRef.current.direction === direction &&
      now - consecutiveGestureRef.current.timestamp < CONSECUTIVE_GESTURE_WINDOW_MS;

    const nextCount = isSameDirection ? consecutiveGestureRef.current.count + 1 : 1;

    consecutiveGestureRef.current = {
      direction,
      count: nextCount,
      timestamp: now
    };

    setGestureFeedback({
      direction,
      amount: nextCount * SEEK_INTERVAL_SECONDS
    });

    if (gestureFeedbackTimeoutRef.current) {
      clearTimeout(gestureFeedbackTimeoutRef.current);
    }

    gestureFeedbackTimeoutRef.current = setTimeout(() => {
      setGestureFeedback(null);
      consecutiveGestureRef.current = { direction: null, count: 0, timestamp: 0 };
      gestureFeedbackTimeoutRef.current = null;
    }, GESTURE_FEEDBACK_DURATION_MS);
  };

  const handleSeekGesture = (direction: GestureDirection) => {
    if (!canAccessMovie) return;

    if (direction === 'forward') {
      handleStepForward();
    } else {
      handleStepBack();
    }

    triggerGestureFeedback(direction);
    tapControlsVisibleRef.current = false;
    handleUserActivity(true, 1500);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canAccessMovie) return;

    const touch = e.touches[0];
    if (!touch) return;

    tapControlsVisibleRef.current = controlsVisible;
    touchStartPositionRef.current = {
      x: touch.clientX,
      y: touch.clientY
    };
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canAccessMovie) return;
    if (controlsRef.current && controlsRef.current.contains(e.target as Node)) {
      return;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!canAccessMovie) return;

    const targetNode = e.target as Node | null;

    const touch = e.changedTouches[0];
    if (!touch) return;

    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const startPos = touchStartPositionRef.current;
    const deltaX = Math.abs(touch.clientX - startPos.x);
    const deltaY = Math.abs(touch.clientY - startPos.y);
    const isTap = deltaX < TAP_MOVEMENT_THRESHOLD_PX && deltaY < TAP_MOVEMENT_THRESHOLD_PX;

    if (!isTap) {
      handleUserActivity(true, CONTROLS_AUTOHIDE_TIMEOUT_MS);
      lastTapTimeRef.current = 0;
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      return;
    }

    const now = Date.now();
    const timeSinceLastTap = now - lastTapTimeRef.current;

    // Check if tap is on an interactive element FIRST
    const interactiveAncestor = targetNode instanceof Element
      ? targetNode.closest('button, a, input, select, textarea, [role="slider"], [role="menu"], [role="menuitem"], [data-prevent-gesture]')
      : null;
    const isOnInteractiveElement = !!interactiveAncestor;

    // If tapping on interactive element (like control buttons), let the event through
    if (isOnInteractiveElement) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      lastTapTimeRef.current = 0;
      // Don't prevent default - let the button handle the tap
      return;
    }

    const executeSingleTap = () => {
      if (tapControlsVisibleRef.current) {
        if (userActivityTimeout.current) {
          clearTimeout(userActivityTimeout.current);
          userActivityTimeout.current = null;
        }
        setControlsVisible(false);
        setUserActive(false);
      } else {
        handleUserActivity(true, CONTROLS_AUTOHIDE_TIMEOUT_MS);
      }
      tapControlsVisibleRef.current = false;
    };

    if (timeSinceLastTap && timeSinceLastTap <= DOUBLE_TAP_THRESHOLD_MS) {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }

      e.preventDefault();
      e.stopPropagation();

      const relativeX = touch.clientX - rect.left;
      const normalizedX = relativeX / rect.width;

      if (normalizedX <= EDGE_GESTURE_RATIO) {
        handleSeekGesture('backward');
      } else if (normalizedX >= 1 - EDGE_GESTURE_RATIO) {
        handleSeekGesture('forward');
      } else {
        tapControlsVisibleRef.current = false;
        handleUserActivity(true, 1500);
        togglePlay();
      }

      lastTapTimeRef.current = 0;
      return;
    }

    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
    }

    lastTapTimeRef.current = now;

    e.preventDefault();
    e.stopPropagation();

    singleTapTimeoutRef.current = setTimeout(() => {
      executeSingleTap();
      singleTapTimeoutRef.current = null;
    }, DOUBLE_TAP_THRESHOLD_MS);
  };

  const handleTouchCancel = () => {
    if (singleTapTimeoutRef.current) {
      clearTimeout(singleTapTimeoutRef.current);
      singleTapTimeoutRef.current = null;
    }
    lastTapTimeRef.current = 0;
    tapControlsVisibleRef.current = false;
  };

  useEffect(() => {
    return () => {
      if (singleTapTimeoutRef.current) {
        clearTimeout(singleTapTimeoutRef.current);
        singleTapTimeoutRef.current = null;
      }
      if (gestureFeedbackTimeoutRef.current) {
        clearTimeout(gestureFeedbackTimeoutRef.current);
        gestureFeedbackTimeoutRef.current = null;
      }
      if (thumbnailGenerationTimeoutRef.current) {
        clearTimeout(thumbnailGenerationTimeoutRef.current);
        thumbnailGenerationTimeoutRef.current = null;
      }
    };
  }, []);

  // Check for Picture-in-Picture support
  useEffect(() => {
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
    
    const handlePipChange = (e: Event) => {
      const isEntering = e.type === 'enterpictureinpicture';
      setIsPipActive(document.pictureInPictureElement === videoRef.current);
      
      // Ensure subtitles remain visible in PiP mode
      if (isEntering && currentSubtitleId && currentSubtitleId !== 'off' && videoRef.current) {
        const video = videoRef.current;
        
        // Re-enable the current subtitle track for PiP
        setTimeout(() => {
          if (!video) return;
          
          // First, hide all tracks
          for (let i = 0; i < video.textTracks.length; i++) {
            video.textTracks[i].mode = 'hidden';
          }
          
          // Find and show the current subtitle
          const normalizedSubtitleId = currentSubtitleId.toUpperCase();
          const textTrackIndex = Array.from(video.textTracks).findIndex(
            track => {
              const trackLang = (track.language || '').toUpperCase();
              const trackLabel = (track.label || '').toUpperCase();
              return trackLang === normalizedSubtitleId || trackLabel.includes(normalizedSubtitleId);
            }
          );
          
          if (textTrackIndex !== -1 && video.textTracks[textTrackIndex]) {
            video.textTracks[textTrackIndex].mode = 'showing';
          }
        }, 150);
      }
    };
    
    document.addEventListener('enterpictureinpicture', handlePipChange);
    document.addEventListener('leavepictureinpicture', handlePipChange);
    
    return () => {
      document.removeEventListener('enterpictureinpicture', handlePipChange);
      document.removeEventListener('leavepictureinpicture', handlePipChange);
    };
  }, [isPipSupported, currentSubtitleId]);

  // Auto PiP based on scroll position
  useEffect(() => {
    if (!isPipSupported || !canAccessMovie || !videoRef.current || !containerRef.current) return;

    const handleScroll = () => {
      if (!containerRef.current || !videoRef.current || !isPipSupported) return;

      const rect = containerRef.current.getBoundingClientRect();
      const videoHeight = rect.height;
      const viewportHeight = window.innerHeight;

      // Check if more than half of the video is scrolled out of view (above viewport)
      const isHalfHidden = rect.top < 0 && Math.abs(rect.top) > videoHeight / 2;
      // Check if video is back in full view
      const isFullyVisible = rect.top >= 0 && rect.top < viewportHeight - videoHeight;

      // Enter PiP when half is hidden and video is playing
      if (isHalfHidden && !isPipActive && isPlaying && videoRef.current) {
        // Ensure subtitle track is showing BEFORE entering PiP
        if (currentSubtitleId && currentSubtitleId !== 'off') {
          const video = videoRef.current;
          const normalizedSubtitleId = currentSubtitleId.toUpperCase();
          
          for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            const trackLang = (track.language || '').toUpperCase();
            const trackLabel = (track.label || '').toUpperCase();
            
            if (trackLang === normalizedSubtitleId || trackLabel.includes(normalizedSubtitleId)) {
              track.mode = 'showing';
            } else {
              track.mode = 'disabled';
            }
          }
        }
        
        pipTriggeredByScroll.current = true;
        videoRef.current.requestPictureInPicture().catch((err) => {
          console.error('Auto PiP error:', err);
        });
      }
      
      // Exit PiP when scrolling back up and video is fully visible
      if (isFullyVisible && isPipActive && pipTriggeredByScroll.current) {
        document.exitPictureInPicture().catch((err) => {
          console.error('Exit PiP error:', err);
        });
        pipTriggeredByScroll.current = false;
      }
    };

    // Throttle scroll events for performance
    let scrollTimeout: NodeJS.Timeout | null = null;
    const throttledScroll = () => {
      if (scrollTimeout) return;
      scrollTimeout = setTimeout(() => {
        handleScroll();
        scrollTimeout = null;
      }, 100);
    };

    window.addEventListener('scroll', throttledScroll);
    
    return () => {
      window.removeEventListener('scroll', throttledScroll);
      if (scrollTimeout) clearTimeout(scrollTimeout);
    };
  }, [isPipSupported, canAccessMovie, isPipActive, isPlaying, currentSubtitleId]);

  const togglePictureInPicture = async () => {
    if (!videoRef.current || !isPipSupported) return;

    try {
      if (document.pictureInPictureElement === videoRef.current) {
        await document.exitPictureInPicture();
        pipTriggeredByScroll.current = false; // Reset when manually exiting
      } else {
        // Ensure subtitle track is showing BEFORE entering PiP
        if (currentSubtitleId && currentSubtitleId !== 'off' && videoRef.current) {
          const video = videoRef.current;
          const normalizedSubtitleId = currentSubtitleId.toUpperCase();
          
          for (let i = 0; i < video.textTracks.length; i++) {
            const track = video.textTracks[i];
            const trackLang = (track.language || '').toUpperCase();
            const trackLabel = (track.label || '').toUpperCase();
            
            if (trackLang === normalizedSubtitleId || trackLabel.includes(normalizedSubtitleId)) {
              track.mode = 'showing';
            } else {
              track.mode = 'disabled';
            }
          }
        }
        
        await videoRef.current.requestPictureInPicture();
        pipTriggeredByScroll.current = false; // Manual PiP, not scroll-triggered
      }
    } catch (err) {
      console.error('PiP error:', err);
    }
  };

  const handleToggleContextMenu = () => {
    setShowContextMenu(!showContextMenu);
    if (showContextMenu) {
      setActiveSection('none');
    }
  };

  const applySubtitleToVideo = (subtitleId: string) => {
    if (!videoRef.current) return;
    
    const video = videoRef.current;
    
    // First, hide all subtitle tracks
    for (let i = 0; i < video.textTracks.length; i++) {
      video.textTracks[i].mode = 'hidden';
    }
    
    if (subtitleId === 'off') {
      return;
    }
    
    // Find the matching track by language code
    const normalizedSubtitleId = subtitleId.toUpperCase();
    const textTrackIndex = Array.from(video.textTracks).findIndex(
      track => {
        const trackLang = (track.language || '').toUpperCase();
        const trackLabel = (track.label || '').toUpperCase();
        return trackLang === normalizedSubtitleId || trackLabel.includes(normalizedSubtitleId);
      }
    );
    
    if (textTrackIndex !== -1) {
      // Apply the subtitle with a small delay to ensure it's loaded
      setTimeout(() => {
        if (videoRef.current && videoRef.current.textTracks.length > textTrackIndex) {
          videoRef.current.textTracks[textTrackIndex].mode = 'showing';
          // console.log('Subtitle applied:', subtitleId, 'Track index:', textTrackIndex);
        }
      }, 100);
    } else {
      console.warn('Subtitle track not found:', subtitleId, 'Available tracks:', video.textTracks.length);
    }
  };

  const handleSelectSubtitle = (subtitleId: string) => {
    setSubtitleTracks(prevTracks => 
      prevTracks.map(track => ({
        ...track,
        selected: track.id === subtitleId
      }))
    );
    
    setCurrentSubtitleId(subtitleId);
    setUserPreferredSubtitleId(subtitleId);
    
    applySubtitleToVideo(subtitleId);
    
    setTimeout(() => {
      setShowContextMenu(false);
      setActiveSection('none');
    }, 200);
  };

  const handleSelectAudio = (audioId: string) => {
    // Find the selected audio track
    const selectedTrack = audioTracks.find(track => track.id === audioId);
    
    if (!selectedTrack || !selectedTrack.encFilePath) {
      console.error('Audio track not found or has no file path');
      return;
    }
    
    // If it's the same track, do nothing
    if (audioId === currentAudioTrack) {
      setShowContextMenu(false);
      setActiveSection('none');
      return;
    }
    
    // Save current playback time
    const currentTime = videoRef.current?.currentTime || 0;
    const wasPlaying = isPlaying;
    
    // Update audio tracks selection
    setAudioTracks(prevTracks => 
      prevTracks.map(track => ({
        ...track,
        selected: track.id === audioId
      }))
    );
    
    // Update current audio track and file path
    setCurrentAudioTrack(audioId);
    setCurrentEncFilePath(selectedTrack.encFilePath);
    
    // Wait for video to load new source, then restore time and play state
    setTimeout(() => {
      if (videoRef.current) {
        videoRef.current.currentTime = currentTime;
        
        if (wasPlaying) {
          videoRef.current.play().catch(err => {
            console.error('Error resuming playback after language switch:', err);
          });
        }
      }
    }, 100);
    
    setTimeout(() => {
      setShowContextMenu(false);
      setActiveSection('none');
    }, 200);
  };

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

  useEffect(() => {
    if (!canAccessMovie) return;

    const checkAccess = async () => {
      const hasAccess = await checkContentAccess();
      setIsAccessChecked(hasAccess);
    };

    checkAccess();
  }, [canAccessMovie, encFilePath]);

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

  if (error) {
    return (
      <div className={`relative w-full aspect-video bg-black flex items-center justify-center ${className}`}>
        <div className="text-center text-white p-4">
          <p className="text-rose-500 font-semibold mb-2">Playback Error</p>
          <p className="text-sm">{error.message}</p>
        </div>
      </div>
    );
  }

  const useNativeAspect = preserveNativeAspect && videoAspectRatio != null && !isFullscreen;

  return (
    <div 
      ref={containerRef} 
      className={`relative w-full bg-black outline-none ${useNativeAspect ? '' : 'aspect-video'} ${className}`}
      tabIndex={0}
      style={{
        cursor: userActive || !isFullscreen || !isPlaying ? 'default' : 'none',
        ...(useNativeAspect ? { aspectRatio: String(videoAspectRatio) } : {}),
        ...(isFullscreen && {
          width: '100%',
          height: '100%',
          objectFit: 'contain'
        }),
        touchAction: 'manipulation'
      }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onClick={(e) => {
        if (!canAccessMovie) return;
        
        const target = e.target as HTMLElement;
        
        // Don't trigger if clicking on interactive elements (buttons, links, inputs, menus, etc.)
        const isInteractiveElement = target.tagName === 'BUTTON' || 
                                      target.tagName === 'A' || 
                                      target.tagName === 'INPUT' ||
                                      target.tagName === 'SELECT' ||
                                      target.closest('button') ||
                                      target.closest('a') ||
                                      target.closest('input') ||
                                      target.closest('[role="slider"]') ||
                                      target.closest('[role="menu"]') ||
                                      target.closest('[role="menuitem"]') ||
                                      target.closest('[role="dialog"]') ||
                                      target.closest('[data-radix-popper-content-wrapper]') ||
                                      target.hasAttribute('data-radix-popper-content-wrapper');
        
        if (isInteractiveElement) {
          return;
        }
        
        // Toggle play/pause
        e.preventDefault();
        e.stopPropagation();
        togglePlay();
        handleUserActivity(true, CONTROLS_AUTOHIDE_TIMEOUT_MS);
      }}
      onMouseMove={() => handleUserActivity()}
      onMouseEnter={() => {
        setIsHoveringVideo(true);
        handleUserActivity();
      }}
      onMouseLeave={() => {
        setIsHoveringVideo(false);
      }}
      onKeyDown={handleDialogKeyDown}
    >
      {isLoading ? (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white gap-y-4">
          <LoaderCircle className="h-12 w-12 animate-spin spinner-rose" />
          <p>Loading movie...</p>
        </div>
      ) : (
        <>
          <div className="w-full h-full bg-white dark:bg-black overflow-hidden">
            {encFilePath ? (
              <>
                <video 
                  ref={videoRef}
                  key={currentEncFilePath}
                  src={canAccessMovie ? `${route('movie.serve', { encFilePath: currentEncFilePath, disk: 'movies' })}` : undefined}
                  poster={movie.backdrop_path ? `${imgBaseUrl}${movie.backdrop_path}` : undefined}
                  className={`w-full h-full ${preserveNativeAspect ? 'object-contain' : 'object-cover'}`}
                  style={{
                    ...(isFullscreen || preserveNativeAspect ? { objectFit: 'contain' } : {}),
                    cursor: (userActive || !isFullscreen || !isPlaying) ? 'pointer' : 'none'
                  }}
                  data-controls-visible={controlsVisible ? 'true' : 'false'}
                  controls={false}
                  autoPlay={canAccessMovie ? isPlaying : false}
                  muted={isMuted}
                  playsInline
                  preload={canAccessMovie ? "metadata" : "none"}
                  onClick={(e) => {
                    if (!canAccessMovie) return;
                    e.preventDefault();
                    e.stopPropagation();
                    togglePlay();
                    handleUserActivity(true, CONTROLS_AUTOHIDE_TIMEOUT_MS);
                  }}
                  onLoadedData={() => {
                    if (canAccessMovie) {
                      setIsLoading(false);
                    }
                  }}
                  onLoadedMetadata={(e) => {
                    if (canAccessMovie && e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                      setDuration(e.currentTarget.duration);

                      if (preserveNativeAspect && e.currentTarget.videoWidth > 0 && e.currentTarget.videoHeight > 0) {
                        setVideoAspectRatio(e.currentTarget.videoWidth / e.currentTarget.videoHeight);
                      }
                      
                      // Apply subtitle after video metadata is loaded
                      if (currentSubtitleId && currentSubtitleId !== 'off') {
                        setTimeout(() => {
                          applySubtitleToVideo(currentSubtitleId);
                        }, 500);
                      }
                    }
                  }}
                  onDurationChange={(e) => {
                    if (canAccessMovie && e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                      setDuration(e.currentTarget.duration);
                    }
                  }}
                  onTimeUpdate={(e) => {
                    if (canAccessMovie && e.currentTarget.duration && !isNaN(e.currentTarget.duration)) {
                      const progressValue = (e.currentTarget.currentTime / e.currentTarget.duration) * 100;
                      setProgress(progressValue);
                      setCurrentTime(e.currentTarget.currentTime);
                    }
                  }}
                  onError={(e) => {
                    if (canAccessMovie) {
                      handleError(new Error('Video playback error'));
                    }
                  }}
                >
                  {subtitleTracks.map((track, index) => {
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

                {partyBridge.needsTap && (
                  <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-black/70 px-6 text-center">
                    <p className="text-lg font-medium text-white">
                      {partySync?.isPlaying ? 'The show already started' : 'Join the screening'}
                    </p>
                    <p className="max-w-sm text-sm text-zinc-300">
                      Tap once so this browser can play along with everyone else.
                    </p>
                    <Button type="button" size="lg" onClick={() => void partyBridge.joinPlayback()}>
                      <Play className="mr-2 size-4 fill-current" />
                      Watch together
                    </Button>
                  </div>
                )}

                {/* Hidden preview video for generating thumbnails */}
                {canAccessMovie && currentEncFilePath && (
                  <>
                    <video 
                      ref={previewVideoRef}
                      src={route('movie.serve', { encFilePath: currentEncFilePath, disk: 'movies' })}
                      className="hidden"
                      preload="auto"
                      muted
                      playsInline
                      crossOrigin="anonymous"
                    />
                    <canvas 
                      ref={previewCanvasRef}
                      className="hidden"
                    />
                  </>
                )}

                {canAccessMovie && gestureFeedback && (
                  <div
                    className={`absolute inset-y-0 left-0 right-0 flex items-center pointer-events-none ${
                      gestureFeedback.direction === 'forward' ? 'justify-end pr-6' : 'justify-start pl-6'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-1 rounded-2xl bg-black/60 px-4 py-3 text-white shadow-lg">
                      {gestureFeedback.direction === 'forward' ? (
                        <SkipForward className="h-9 w-9 text-rose-500" />
                      ) : (
                        <SkipBack className="h-9 w-9 text-rose-500" />
                      )}
                      <span className="text-sm font-semibold tracking-wide">
                        {gestureFeedback.direction === 'forward'
                          ? `+${gestureFeedback.amount}s`
                          : `-${gestureFeedback.amount}s`}
                      </span>
                    </div>
                  </div>
                )}

                {!canAccessMovie && (
                  <div className="absolute inset-0 bg-black/80 flex items-center justify-center z-50 p-3 sm:p-4">
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
              </>
            ) : (
              <img 
                src={movie.backdrop_path ? `${imgBaseUrl}${movie.backdrop_path}` : (movie.poster_path ? `${imgBaseUrl}${movie.poster_path}` : '')} 
                alt={movie.title} 
                className="w-full h-full aspect-video object-cover object-center"
              />
            )}
          </div>
          
          {/* Video controls overlay */}
          <div 
            ref={controlsRef}
            className={`absolute inset-0 bottom-[-0.1rem] bg-gradient-to-t_ from-[#fafafa] dark:from-[#171717] via-transparent to-transparent transition-opacity duration-300 flex flex-col justify-end pointer-events-none ${
              (controlsVisible && canAccessMovie) ? 'opacity-100' : 'opacity-0'
            }`}
            onMouseEnter={() => {
              setControlsVisible(true);
              setUserActive(true);
              
              if (userActivityTimeout.current) {
                clearTimeout(userActivityTimeout.current);
              }
            }}
            onMouseMove={(e) => {
              e.stopPropagation();
              handleUserActivity();
            }}
            onMouseLeave={() => {
              if (userActivityTimeout.current) {
                clearTimeout(userActivityTimeout.current);
              }
              
              // Hide controls after leaving control area (with timeout)
              const hideTimeout = isFullscreen ? 2000 : 3000;
              userActivityTimeout.current = setTimeout(() => {
                setUserActive(false);
                setControlsVisible(false);
              }, hideTimeout);
            }}
          >
            
            <div className="absolute inset-0 light-gradient-video dark:dark-gradient-video z-10 pointer-events-none" />

            <div className="p-4 text-neutral-900 dark:text-neutral-100 z-30 pointer-events-auto">
              <div className="mb-3 relative">
                {/* Progress bar */}
                <div 
                  ref={progressBarRef}
                  className="w-full h-2 bg-neutral-600 rounded-full relative"
                  onMouseMove={handleProgressBarMouseMove}
                  onMouseEnter={handleProgressBarMouseEnter}
                  onMouseLeave={handleProgressBarMouseLeave}
                  onTouchStart={handleProgressBarTouchStart}
                  onTouchMove={handleProgressBarTouchMove}
                  onTouchEnd={handleProgressBarTouchEnd}
                  onTouchCancel={handleProgressBarTouchEnd}
                >
                  <div 
                    className="absolute top-0 left-0 h-2 bg-rose-500 rounded-full pointer-events-none" 
                    style={{ width: `${progress}%` }}
                  ></div>
                  
                  <div 
                    className="absolute top-0 h-4 w-4 bg-white rounded-full shadow-sm pointer-events-none transform -translate-y-1/4" 
                    style={{ left: `calc(${progress}% - 2px)` }}
                  ></div>
                  
                  <input 
                    type="range" 
                    className="absolute top-0 left-0 w-full h-4 opacity-0 cursor-pointer -mt-1 transition-all duration-150" 
                    value={progress.toString()} 
                    onChange={handleProgressChange} 
                    min="0" 
                    max="100" 
                    step="0.01"
                    onKeyDown={(e) => {
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

                  {/* Progress bar tooltip */}
                  {progressTooltipVisible && (
                    <div 
                      className="absolute bottom-6 flex flex-col items-center pointer-events-none z-50"
                      style={{ 
                        left: `${tooltipLeftOffset}px`,
                        transform: 'translateX(-50%)'
                      }}
                    >
                      {previewThumbnail && (
                        <div className="mb-2 rounded overflow-hidden shadow-lg border-2 border-white/20" style={{ width: '160px', flexShrink: 0 }}>
                          <img 
                            src={previewThumbnail} 
                            alt="Preview" 
                            className="block"
                            style={{ width: '160px', height: 'auto', display: 'block' }}
                          />
                        </div>
                      )}
                      <div className="bg-black/90 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
                        {formatTime(progressTooltipTime)}
                      </div>
                    </div>
                  )}
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
                  
                  {/* step back button */}
                  <Tooltip text={`Back ${SEEK_INTERVAL_SECONDS}s (Left Arrow)`} position="bottom">
                    <button className="hidden sm:block" onClick={handleStepBack}>
                      <StepBack className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                    </button>
                  </Tooltip>
                  
                  {/* step forward button */}
                  <Tooltip text={`Forward ${SEEK_INTERVAL_SECONDS}s (Right Arrow)`} position="bottom">
                    <button className="hidden sm:block" onClick={handleStepForward}>
                      <StepForward className="w-5 h-5 hover:text-rose-500 transition-colors duration-150" />
                    </button>
                  </Tooltip>
                  
                  {/* Timer */}
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

                  {/* Subtitles & Audio button */}
                  <Tooltip text="Subtitles & Audio" position="bottom">
                    <button 
                      onClick={handleToggleContextMenu}
                      className={`focus:outline-none relative cursor-pointer ${(!hasSubtitles && audioTracks.length <= 1) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      aria-label="Subtitles and Audio Options"
                      disabled={!hasSubtitles && audioTracks.length <= 1}
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
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="py-1">
                        {/* Audio Language Selection */}
                        {audioTracks.length > 1 && (
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
                        )}
                        
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
                      </div>
                      
                      {/* Audio Tracks Submenu */}
                      {activeSection === 'audio' && (
                        <div 
                          className="absolute top-0 right-full bg-white dark:bg-neutral-900 rounded-md shadow-lg border border-neutral-200 dark:border-neutral-800 py-1" 
                          style={{ width: '180px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {audioTracks.map((track) => (
                            <div 
                              key={track.id}
                              className="flex items-center px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectAudio(track.id);
                              }}
                            >
                              <span className="flex-1 text-sm">{track.label}</span>
                              {track.selected && <Check className="w-4 h-4 text-rose-500" />}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {/* Subtitles Submenu */}
                      {activeSection === 'subtitles' && (
                        <div 
                          className="absolute top-0 right-full bg-white dark:bg-neutral-900 rounded-md shadow-lg border border-neutral-200 dark:border-neutral-800 py-1" 
                          style={{ width: '180px' }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          {subtitleTracks.map((track) => (
                            <div 
                              key={track.id}
                              className="flex items-center px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-800 cursor-pointer transition-colors"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSelectSubtitle(track.id);
                              }}
                            >
                              <span className="flex-1 text-sm">{track.label}</span>
                              {track.selected && <Check className="w-4 h-4 text-rose-500" />}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Picture in Picture */}
                  {isPipSupported && (
                    <Tooltip text="Picture in Picture (p)" position="bottom">
                      <button 
                        onClick={togglePictureInPicture}
                        className={`${isPipActive ? 'text-rose-500' : 'hover:text-rose-500'} transition-colors duration-150`}
                      >
                        <PictureInPicture2 className="w-5 h-5" />
                      </button>
                    </Tooltip>
                  )}

                  {/* fullscreen button */}
                  <Tooltip text={isFullscreen ? "Exit Fullscreen (f)" : "Fullscreen (f)"} position="bottom">
                    <button onClick={toggleFullscreen} className="hover:text-rose-500 transition-colors duration-150">
                      {isFullscreen ? (
                        <Minimize className="w-5 h-5" />
                      ) : (
                        <Maximize className="w-5 h-5" />
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
  );
}

